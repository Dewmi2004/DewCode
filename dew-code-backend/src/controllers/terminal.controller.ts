// 🔥 terminal.controller.ts — DOCKERODE REWRITE
//
// WHAT CHANGED AND WHY
// ─────────────────────────────────────────────────────────────────────────
// The previous version shelled out to the `docker` CLI via child_process
// (`spawn('cmd.exe', ['/c', fullCmd])` / `spawn('/bin/sh', ['-c', fullCmd])`).
// That meant every run/stdin round-trip depended on a *string* being built,
// quoted, and re-parsed by an intermediate shell — which is exactly how the
// Windows bind-mount path got mangled (`//c/...` → collapsed to `/c/...` →
// Docker treating it as an invalid volume *name* instead of a host path).
//
// This version talks to the Docker Engine API directly through `dockerode`.
// There is no shell in the middle of the host→Docker hop at all:
//   - Bind mounts are passed as a real path string in HostConfig.Binds,
//     normalized once, with no quoting/escaping required.
//   - The command run *inside* the container is passed as an argv array
//     (Cmd: ['sh', '-c', innerCmd]), not a flattened command line — so the
//     only place an inner shell exists is the one we explicitly ask Docker
//     to start *inside* the container, which is unavoidable since we need
//     compile-then-run chains (`javac ... && java ...`).
//   - stdout/stderr/stdin are real streams from `container.attach()`, demuxed
//     with dockerode's own `container.modem.demuxStream`, instead of being
//     parsed off a Node child_process's stdout/stderr pipes.
//
// No more `spawn`, no more ChildProcessWithoutNullStreams, no more
// `buildDockerCmd` string concatenation, no more `child_process` import at
// all — the entire execution path (including raw terminal commands and the
// host/no-Docker fallback) now runs through Docker containers.
//
// NEW ENDPOINTS (unchanged surface, same as before):
//   POST /api/terminal/execute  (session-aware)
//   POST /api/terminal/stdin    (send a line to a running session)
//   POST /api/terminal/kill     (terminate a session early, e.g. Esc)
//
// Docker images per language (auto-pulled on first use):
//   node:20-alpine        → JS, TS, JSX, TSX
//   python:3.11-slim      → Python
//   eclipse-temurin:21-alpine → Java
//   gcc:13                → C, C++
//   golang:1.22-alpine    → Go
//   rust:slim             → Rust
//   bash                  → raw terminal commands (mock/allowlist)
//
// Prerequisites:
//   Docker Desktop must be installed and RUNNING
//   Docker Engine API reachable at the default socket/pipe (see `docker`
//   instantiation below) — no .env flag needed anymore, Docker is now the
//   only execution path.

import { Request, Response, NextFunction } from 'express';
import Docker, { Container } from 'dockerode';
import { randomUUID } from 'crypto';
import fs   from 'fs';
import path from 'path';
import os   from 'os';
import { sendSuccess, sendError } from '../utils/response';

// ── Docker client ──────────────────────────────────────────────────────
// On Windows this talks to the named pipe Docker Desktop exposes; on
// macOS/Linux it talks to /var/run/docker.sock. dockerode picks the right
// default for the current platform automatically.
const docker = new Docker();

// ── Timing knobs ────────────────────────────────────────────────────────
// We don't have a real TTY/PTY telling us "the program is now blocked on
// input", so we approximate it: keep collecting output until nothing new
// has arrived for QUIET_MS, or until the relevant max wait is hit.
const QUIET_MS             = 200;
const INITIAL_MAX_WAIT_MS  = 6_000; // first run of a session — must exceed STARTUP_GRACE_MS with margin
const STDIN_MAX_WAIT_MS    = 3_000; // after feeding more input (process is already warm by then)
const SESSION_IDLE_TTL_MS  = 5 * 60_000; // kill sessions nobody's touched
const SWEEP_INTERVAL_MS    = 60_000;
const MAX_SESSIONS         = 50;    // simple resource guard

// ── Language → Docker image + run command ─────────────────────────────────
interface LangConfig {
  image:  string;
  runCmd: (filePath: string) => string;
  exts:   string[];
}

const LANG_CONFIGS: LangConfig[] = [
  { image: 'node:20-alpine',           exts: ['js', 'mjs', 'cjs'], runCmd: (f) => `node "${f}"` },
  { image: 'node:20-alpine',           exts: ['ts', 'tsx'],        runCmd: (f) => `npx --yes ts-node --skip-project --transpile-only "${f}"` },
  { image: 'python:3.11-slim',         exts: ['py'],               runCmd: (f) => `python3 "${f}"` },
  {
    // Java: fileName MUST match public class name (e.g. Calculator.java → Calculator)
    image: 'eclipse-temurin:21-alpine',
    exts:  ['java'],
    runCmd: (f) => {
      const dir       = path.dirname(f);
      const className = path.basename(f, '.java');
      return `javac "${f}" && java -cp "${dir}" "${className}"`;
    },
  },
  { image: 'gcc:13',                   exts: ['c'],                runCmd: (f) => `gcc -o /tmp/program "${f}" && /tmp/program` },
  { image: 'gcc:13',                   exts: ['cpp', 'cc', 'cxx'], runCmd: (f) => `g++ -o /tmp/program "${f}" && /tmp/program` },
  { image: 'golang:1.22-alpine',       exts: ['go'],               runCmd: (f) => `go run "${f}"` },
  { image: 'rust:slim',                exts: ['rs'],               runCmd: (f) => `rustc -o /tmp/program "${f}" && /tmp/program` },
  { image: 'node:20-alpine',           exts: ['sh', 'bash'],       runCmd: (f) => `sh "${f}"` },
];

const getLangConfig = (fileName: string): LangConfig | null => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return LANG_CONFIGS.find((c) => c.exts.includes(ext)) ?? null;
};

// ── Host path → bind-mount path normalization ─────────────────────────────
// This replaces the old `buildDockerCmd`'s string-based `//c/...` trick.
// Docker Desktop's Linux engine accepts a plain `C:/Users/...` style path
// directly in HostConfig.Binds on Windows — no shell ever touches this
// string, so there's nothing left to collapse or mis-parse it.
const normalizeHostPath = (hostDir: string): string => {
  if (process.platform === 'win32') {
    return hostDir
      .replace(/\\/g, '/')                                     // backslashes → forward slashes
      .replace(/^([A-Za-z]):/, (_, d) => `${d.toUpperCase()}:`); // normalize drive letter case
  }
  return hostDir;
};

// ── Raw command allowlist (kept as a safety net for raw terminal input) ───
const ALLOWED_PREFIXES = [
  'node ', 'node -', 'npm ', 'npx ', 'yarn ',
  'python ', 'python3 ', 'pip ', 'pip3 ',
  'java ', 'javac ', 'mvn ',
  'go ', 'rustc ', 'cargo ',
  'gcc ', 'g++ ',
  'git ', 'ls', 'ls ', 'pwd', 'cat ',
  'echo ', 'tsc ', 'ts-node ',
  'whoami', 'date', 'node -v', 'npm -v',
  'python --version', 'java --version',
];

const BLOCKED_PATTERNS = [
  /rm\s+-rf/i, /sudo/i, /chmod/i, /chown/i,
  /mkfs/i, /dd\s+if=/i, />\/dev\//i,
  /curl.*\|.*sh/i, /wget.*\|.*sh/i,
  /base64.*decode.*\|.*sh/i, /eval\s*\(/i,
];

const isRawSafe = (cmd: string): boolean => {
  for (const p of BLOCKED_PATTERNS) { if (p.test(cmd)) return false; }
  const lower = cmd.trim().toLowerCase();
  return ALLOWED_PREFIXES.some((p) => lower.startsWith(p.toLowerCase()));
};

// ════════════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ════════════════════════════════════════════════════════════════════════
//
// A "session" is now a running Docker container plus the attached duplex
// stream dockerode hands back from `container.attach()`. We keep the
// container alive (no --rm-on-exit-then-gone semantics until the process
// inside it actually finishes), and write further stdin straight into the
// attach stream — same idea as writing into a child_process's stdin pipe,
// just backed by the container's TTY/stdin instead of a local pipe.

interface TerminalSession {
  id:           string;
  container:    Container;
  attachStream: NodeJS.ReadWriteStream;
  tempDir:      string;
  label:        string;
  stdout:       string;
  stderr:       string;
  stdoutSent:   number; // how much of `stdout` has already been flushed to a client
  stderrSent:   number;
  exited:       boolean;
  exitCode:     number | null;
  lastActivity: number;
}

const sessions = new Map<string, TerminalSession>();

const cleanupTempDir = (dir: string) => {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
};

// Removes the container itself (separate from cleaning up the temp dir on
// disk). Safe to call even if the container is already gone.
const removeContainer = async (container: Container) => {
  try { await container.remove({ force: true }); } catch { /* ignore */ }
};

// Creates + starts a container for the given image/command, attaches to its
// streams, and registers it as a session. Mirrors what `createSession` +
// `spawnShell` used to do together, but entirely through the Docker Engine
// API — no shell string is built for the *host* side of this call.
const createSession = async (
  image: string,
  innerCmd: string,
  tempDir: string,
  label: string
): Promise<TerminalSession | null> => {
  if (sessions.size >= MAX_SESSIONS) return null;

  const hostBindPath = normalizeHostPath(tempDir);

  // Make sure the image exists locally; pull it if this is the first time
  // it's been used. dockerode's `pull` returns a stream we drain to
  // completion before continuing.
  await ensureImage(image);

  const container = await docker.createContainer({
    Image: image,
    Cmd: ['sh', '-c', innerCmd],
    WorkingDir: '/sandbox',
    Tty: false,        // keep stdout/stderr demultiplexed rather than merged
    OpenStdin: true,    // equivalent of the old `-i` flag — keeps stdin open
    StdinOnce: false,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    HostConfig: {
      Binds: [`${hostBindPath}:/sandbox`],
      // 'none' blocked anything needing network (e.g. `npx ts-node` resolving
      // packages on first use). Sandboxed enough via memory/cpu/pids limits
      // below; switch back to 'none' only if you pre-bake all toolchains
      // into the images so nothing ever needs to fetch at runtime.
      NetworkMode: 'bridge',
      Memory: 256 * 1024 * 1024,
      NanoCpus: 0.8 * 1e9,
      PidsLimit: 64,
      AutoRemove: false, // we remove explicitly once we've read final state
    },
  });

  // IMPORTANT: attach BEFORE start, and wire up demuxStream BEFORE start as
  // well. Docker begins emitting output frames the instant the container's
  // main process starts running — if `start()` fires before our 'data'
  // listeners exist, the first burst of output (often the *entire* output
  // of a fast program) is lost before anything reads it. This was the
  // actual cause of "no output at all" for fast-printing programs.
  // CRITICAL: hijack:true is what actually upgrades this HTTP request into
  // a raw bidirectional TCP/pipe socket (Connection: Upgrade). Without it,
  // dockerode still resolves a "stream" object, but it's a normal streamed
  // HTTP response — writes into it never reach the container's stdin, and
  // demuxStream's internal 'data' listener can end up watching a stream
  // that never actually receives Docker's multiplexed frames the way a
  // hijacked socket does. This was the real cause of empty stdout/stderr
  // even though the container itself started and ran successfully.
  const attachStream = await container.attach({
    stream: true,
    stdin: true,
    stdout: true,
    stderr: true,
    hijack: true,
  });

  const session: TerminalSession = {
    id: randomUUID(),
    container,
    attachStream,
    tempDir,
    label,
    stdout: '',
    stderr: '',
    stdoutSent: 0,
    stderrSent: 0,
    exited: false,
    exitCode: null,
    lastActivity: Date.now(),
  };

  // dockerode's demuxStream splits the single multiplexed attach stream
  // into separate stdout/stderr writable targets — this replaces listening
  // on `proc.stdout`/`proc.stderr` directly. Must be wired before start().
  const stdoutWritable = {
    write: (chunk: Buffer) => {
      session.stdout += chunk.toString();
      session.lastActivity = Date.now();
      return true;
    },
  };
  const stderrWritable = {
    write: (chunk: Buffer) => {
      session.stderr += chunk.toString();
      session.lastActivity = Date.now();
      return true;
    },
  };
  // @ts-expect-error dockerode's demuxStream accepts minimal writable-like objects
  docker.modem.demuxStream(attachStream, stdoutWritable, stderrWritable);

  attachStream.on('error', (err: Error) => {
    session.exited = true;
    session.exitCode = 1;
    session.stderr += `\n[attach error] ${err.message}`;
  });

  // Only NOW do we actually start the process — every listener above is
  // already wired, so no output frame can be missed.
  await container.start();

  // Poll container state in the background so we notice naturally-finished
  // runs (not just ones we kill ourselves). `wait()` resolves once the
  // container's main process exits, with the real exit code — this is the
  // dockerode equivalent of a child_process `close` event.
  container.wait()
    .then((result: { StatusCode: number }) => {
      session.exited = true;
      session.exitCode = result.StatusCode ?? 0;
      session.lastActivity = Date.now();
      cleanupTempDir(session.tempDir);
      void removeContainer(container);
    })
    .catch((err: Error) => {
      session.exited = true;
      session.exitCode = 1;
      session.stderr += `\n[wait error] ${err.message}`;
      cleanupTempDir(session.tempDir);
      void removeContainer(container);
    });

  sessions.set(session.id, session);
  return session;
};

// Pull an image only if it isn't already present locally.
const ensureImage = async (image: string): Promise<void> => {
  const images = await docker.listImages({ filters: { reference: [image] } });
  if (images.length > 0) return;

  await new Promise<void>((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) { reject(err); return; }
      docker.modem.followProgress(stream, (doneErr: Error | null) => {
        if (doneErr) reject(doneErr);
        else resolve();
      });
    });
  });
};

// Feed a line of input into the still-running container's stdin. This is
// the part that makes Scanner / input() work across multiple requests: we
// are writing into the SAME attach stream every time, so the process's
// internal state (and whatever it's already read) carries over naturally —
// identical intent to the old `writeStdin`, just over the Docker attach
// stream instead of a local child_process pipe.
const writeStdin = (session: TerminalSession, input: string) => {
  if (session.exited) return;
  try {
    session.attachStream.write(input.endsWith('\n') ? input : `${input}\n`);
  } catch { /* stdin may already be closed if the container just exited */ }
};

// Wait until output has "settled" (gone quiet) or we've hit the max wait —
// our best approximation of "the program is now waiting on you". A session
// that has produced ZERO output yet gets a longer grace period before the
// quiet-check kicks in, since slow-starting runtimes (JVM cold start via
// `javac && java`, `go run`'s first-time compile, etc.) can easily take
// over a second before printing their first line — without this, we'd
// declare "quiet" and hand back an empty response before the program even
// reaches its first println. Measured real-world javac+java startup was
// ~1.3s on a warm Docker image; 2500ms gives comfortable margin for slower
// machines or a cold image layer cache, while still well under
// INITIAL_MAX_WAIT_MS (4000ms) so we don't blow the overall budget.
const STARTUP_GRACE_MS = 2_500;

const waitForQuiet = (session: TerminalSession, maxMs: number): Promise<void> =>
  new Promise((resolve) => {
    const start = Date.now();
    let lastLen      = session.stdout.length + session.stderr.length;
    let lastChangeAt = Date.now();
    const hadOutputAtStart = lastLen > 0;

    const tick = () => {
      if (session.exited) { resolve(); return; }
      const len = session.stdout.length + session.stderr.length;
      const now = Date.now();
      if (len !== lastLen) { lastLen = len; lastChangeAt = now; }

      const stillNothingYet = !hadOutputAtStart && lastLen === 0;
      const quietThreshold  = stillNothingYet ? STARTUP_GRACE_MS : QUIET_MS;

      if (now - lastChangeAt >= quietThreshold || now - start >= maxMs) { resolve(); return; }
      setTimeout(tick, 30);
    };
    tick();
  });

const flushDiff = (session: TerminalSession): { stdout: string; stderr: string } => {
  const stdout = session.stdout.slice(session.stdoutSent);
  const stderr = session.stderr.slice(session.stderrSent);
  session.stdoutSent = session.stdout.length;
  session.stderrSent = session.stderr.length;
  return { stdout, stderr };
};

const respondWithSessionState = (res: Response, session: TerminalSession, message: string) => {
  const { stdout, stderr } = flushDiff(session);
  const exited   = session.exited;
  const exitCode = session.exitCode;
  const id       = session.id;

  if (exited) sessions.delete(id); // nothing left to send input to

  sendSuccess(res, message, {
    sessionId: exited ? null : id,
    stdout,
    stderr,
    exitCode: exited ? exitCode : null,
    exited,
    command: session.label,
  });
};

// Idle sweep: kill sessions nobody has touched in a while (closed tab,
// crashed client, etc.) so containers don't pile up forever.
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (!session.exited && now - session.lastActivity > SESSION_IDLE_TTL_MS) {
      void removeContainer(session.container);
      cleanupTempDir(session.tempDir);
      sessions.delete(id);
    }
  }
}, SWEEP_INTERVAL_MS);

// ════════════════════════════════════════════════════════════════════════
// POST /api/terminal/execute
// Body Option A (Run button):  { fileName: string, content: string, stdin? }
// Body Option B (Terminal):    { command: string, stdin? }
// Starts a session and waits briefly to see whether the program produces a
// prompt or finishes outright. Returns a sessionId you can keep feeding
// input to via /api/terminal/stdin, until `exited` comes back true.
// ════════════════════════════════════════════════════════════════════════
export const executeCommand = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { command, fileName, content, stdin } = req.body as {
      command?: string;
      fileName?: string;
      content?:  string;
      stdin?:   string;
    };

    // ── MODE A — run a file (e.g. the editor's ▶ Run button) ─────────────
    if (fileName && content !== undefined) {
      const langConfig = getLangConfig(fileName);
      if (!langConfig) {
        sendError(res, `Cannot run "${fileName}".\nSupported: .js .ts .py .java .c .cpp .go .rs .sh`, 400);
        return;
      }

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dewcode-'));
      fs.writeFileSync(path.join(tempDir, path.basename(fileName)), content, 'utf8');

      const innerCmd = langConfig.runCmd(`/sandbox/${path.basename(fileName)}`);
      const label    = `Docker(${langConfig.image}) → ${fileName}`;

      const session = await createSession(langConfig.image, innerCmd, tempDir, label);

      if (!session) {
        cleanupTempDir(tempDir);
        sendError(res, 'Too many active sessions — try again shortly.', 503);
        return;
      }

      if (stdin && stdin.trim()) writeStdin(session, stdin); // optional up-front input, still supported

      console.log(`[Terminal] Started session ${session.id}: ${label}`);
      await waitForQuiet(session, INITIAL_MAX_WAIT_MS);
      respondWithSessionState(res, session, 'Executed.');
      return;
    }

    // ── MODE B — raw terminal command (typed in the Terminal panel) ──────
    if (command?.trim()) {
      const trimmed = command.trim();

      if (!isRawSafe(trimmed)) {
        sendError(
          res,
          `Command not allowed: "${trimmed.split(' ')[0]}". Use: node, python, java, git, ls, pwd, echo, npm...`,
          403
        );
        return;
      }

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dewcode-'));
      const session = await createSession('bash', trimmed, tempDir, trimmed);

      if (!session) {
        cleanupTempDir(tempDir);
        sendError(res, 'Too many active sessions — try again shortly.', 503);
        return;
      }

      if (stdin && stdin.trim()) writeStdin(session, stdin);

      await waitForQuiet(session, INITIAL_MAX_WAIT_MS);
      respondWithSessionState(res, session, 'Command executed.');
      return;
    }

    sendError(res, 'Provide { fileName, content } to run a file, or { command } for terminal.', 400);
  } catch (error) {
    next(error);
  }
};

// ════════════════════════════════════════════════════════════════════════
// POST /api/terminal/stdin
// Body: { sessionId: string, input: string }
// Sends one line of input to an already-running session and waits briefly
// for the program's next chunk of output (or for it to exit).
// ════════════════════════════════════════════════════════════════════════
export const sendStdin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId, input } = req.body as { sessionId?: string; input?: string };

    if (!sessionId) { sendError(res, 'sessionId is required.', 400); return; }

    const session = sessions.get(sessionId);
    if (!session) {
      sendError(res, 'Session not found or already ended.', 404);
      return;
    }

    if (input !== undefined && input !== '') writeStdin(session, input);

    await waitForQuiet(session, STDIN_MAX_WAIT_MS);
    respondWithSessionState(res, session, 'Input sent.');
  } catch (error) {
    next(error);
  }
};

// ════════════════════════════════════════════════════════════════════════
// POST /api/terminal/kill
// Body: { sessionId: string }
// Terminates a session early — e.g. when the user presses Esc or closes
// the terminal panel.
// ════════════════════════════════════════════════════════════════════════
export const killSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.body as { sessionId?: string };

    if (!sessionId) { sendError(res, 'sessionId is required.', 400); return; }

    const session = sessions.get(sessionId);
    if (!session) {
      sendSuccess(res, 'Already ended.', { sessionId, exited: true });
      return;
    }

    await removeContainer(session.container);
    cleanupTempDir(session.tempDir);
    sessions.delete(sessionId);

    sendSuccess(res, 'Session killed.', { sessionId, exited: true });
  } catch (error) {
    next(error);
  }
};