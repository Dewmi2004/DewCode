// ✅ FIXED terminal.controller.ts
// Two execution modes:
//   MODE 1: { fileName, content, language } → writes file to temp dir → Docker run
//   MODE 2: { command }                     → raw terminal command (mock/allowlist)
//
// Docker images per language (auto-pulled on first use):
//   node:20-alpine    → JS, TS, JSX, TSX
//   python:3.11-slim  → Python
//   openjdk:21-slim   → Java   ← fixes the "file not found" error
//   gcc:13            → C, C++
//   golang:1.22-alpine→ Go
//   rust:slim         → Rust
//   bash              → Shell scripts (runs on host alpine)
//
// Prerequisites:
//   Docker Desktop must be installed and RUNNING on Windows
//   Set TERMINAL_USE_DOCKER=true in .env

import { Request, Response, NextFunction } from 'express';
import { exec }      from 'child_process';
import { promisify } from 'util';
import fs   from 'fs';
import path from 'path';
import os   from 'os';
import { sendSuccess, sendError } from '../utils/response';

const execAsync  = promisify(exec);
const USE_DOCKER = process.env.TERMINAL_USE_DOCKER === 'true';
const TIMEOUT_MS = 20_000; // 20 seconds per execution

// ── Language → Docker image + run command ─────────────────────────────────
interface LangConfig {
  image:    string;
  /** Returns the shell command to run INSIDE the container */
  runCmd:   (filePath: string) => string;
  exts:     string[];
}

const LANG_CONFIGS: LangConfig[] = [
  {
    image:  'node:20-alpine',
    exts:   ['js', 'mjs', 'cjs'],
    runCmd: (f) => `node "${f}"`,
  },
  {
    // ts-node pre-installed in this image
    image:  'node:20-alpine',
    exts:   ['ts', 'tsx'],
    runCmd: (f) => `npx --yes ts-node --skip-project --transpile-only "${f}"`,
  },
  {
    image:  'python:3.11-slim',
    exts:   ['py'],
    runCmd: (f) => `python3 "${f}"`,
  },
  {
    // Java: fileName MUST match public class name (e.g. Calculator.java → Calculator)
    image:  'openjdk:21-slim',
    exts:   ['java'],
    runCmd: (f) => {
      const dir       = path.dirname(f);
      const className = path.basename(f, '.java');
      return `javac "${f}" && java -cp "${dir}" "${className}"`;
    },
  },
  {
    image:  'gcc:13',
    exts:   ['c'],
    runCmd: (f) => `gcc -o /tmp/program "${f}" && /tmp/program`,
  },
  {
    image:  'gcc:13',
    exts:   ['cpp', 'cc', 'cxx'],
    runCmd: (f) => `g++ -o /tmp/program "${f}" && /tmp/program`,
  },
  {
    image:  'golang:1.22-alpine',
    exts:   ['go'],
    runCmd: (f) => `go run "${f}"`,
  },
  {
    image:  'rust:slim',
    exts:   ['rs'],
    runCmd: (f) => `rustc -o /tmp/program "${f}" && /tmp/program`,
  },
  {
    image:  'node:20-alpine',
    exts:   ['sh', 'bash'],
    runCmd: (f) => `sh "${f}"`,
  },
];

const getLangConfig = (fileName: string): LangConfig | null => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return LANG_CONFIGS.find((c) => c.exts.includes(ext)) ?? null;
};

// ── Build Docker run command ───────────────────────────────────────────────
// hostDir is mounted as /sandbox inside the container (read-only source)
// /tmp inside the container is writable for compiled output
const buildDockerCmd = (image: string, hostDir: string, innerCmd: string): string => {
  // On Windows, Docker Desktop requires Windows-style paths converted to POSIX for -v
  // e.g. C:\Users\foo\AppData\Local\Temp\dewcode-xyz  →  //c/Users/foo/AppData/Local/Temp/dewcode-xyz
  const posixDir = hostDir
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):/, (_, d) => `//${d.toLowerCase()}`);

  const escaped = innerCmd.replace(/"/g, '\\"');

  return [
    'docker run',
    '--rm',
    '--network none',    // no internet — sandbox
    '--memory 256m',     // 256 MB RAM limit
    '--cpus 0.8',        // 80% of one CPU
    '--pids-limit 64',   // prevent fork bombs
    '--workdir /sandbox',
    `-v "${posixDir}:/sandbox"`,  // mount source dir
    image,
    `sh -c "${escaped}"`,
  ].join(' ');
};

// ── Raw command allowlist (used when Docker is OFF) ───────────────────────
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

// ── POST /api/terminal/execute ─────────────────────────────────────────────
// Body Option A (Run button):  { fileName: string, content: string }
// Body Option B (Terminal):    { command: string }
export const executeCommand = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Create a temp dir that we can always clean up in finally
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dewcode-'));

  try {
    const { command, fileName, content } = req.body as {
      command?: string;
      fileName?: string;
      content?:  string;
    };

    // ════════════════════════════════════════════════════════════
    // MODE A — Run a file (from the ▶ Run button in the editor)
    //          Writes content to disk, compiles + runs in Docker
    // ════════════════════════════════════════════════════════════
    if (fileName && content !== undefined) {

      const langConfig = getLangConfig(fileName);
      if (!langConfig) {
        sendError(
          res,
          `Cannot run "${fileName}".\nSupported: .js .ts .py .java .c .cpp .go .rs .sh`,
          400
        );
        return;
      }

      // Write the file into the temp directory
      // Handle nested paths like src/Main.java
      const hostFilePath = path.join(tempDir, path.basename(fileName));
      fs.writeFileSync(hostFilePath, content, 'utf8');

      const containerFilePath = `/sandbox/${path.basename(fileName)}`;
      const innerCmd = langConfig.runCmd(containerFilePath);

      let finalCmd: string;
      let cmdLabel: string;

      if (USE_DOCKER) {
        finalCmd = buildDockerCmd(langConfig.image, tempDir, innerCmd);
        cmdLabel = `Docker(${langConfig.image}) → ${fileName}`;
      } else {
        // No Docker: try to run directly on the host (requires language installed)
        // For Java we need to javac from the temp dir
        const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
        if (ext === 'java') {
          const className = path.basename(fileName, '.java');
          finalCmd = `cd "${tempDir}" && javac "${path.basename(fileName)}" && java "${className}"`;
        } else if (['c', 'cpp', 'cc'].includes(ext)) {
          finalCmd = `cd "${tempDir}" && gcc -o program "${path.basename(fileName)}" && ./program`;
        } else if (ext === 'rs') {
          finalCmd = `cd "${tempDir}" && rustc -o program "${path.basename(fileName)}" && ./program`;
        } else if (['ts', 'tsx'].includes(ext)) {
          finalCmd = `cd "${tempDir}" && npx --yes ts-node --transpile-only "${path.basename(fileName)}"`;
        } else if (ext === 'go') {
          finalCmd = `cd "${tempDir}" && go run "${path.basename(fileName)}"`;
        } else if (ext === 'py') {
          finalCmd = `cd "${tempDir}" && python3 "${path.basename(fileName)}"`;
        } else {
          finalCmd = `cd "${tempDir}" && node "${path.basename(fileName)}"`;
        }
        cmdLabel = `Host → ${fileName}`;
      }

      console.log(`[Terminal] Executing: ${cmdLabel}`);

      try {
        const { stdout, stderr } = await execAsync(finalCmd, {
          timeout:   TIMEOUT_MS,
          maxBuffer: 1024 * 512,
          shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
        });

        sendSuccess(res, 'Executed.', {
          stdout:   stdout.trim(),
          stderr:   stderr.trim(),
          exitCode: 0,
          command:  cmdLabel,
        });
      } catch (execErr: unknown) {
        const e = execErr as {
          stdout?: string; stderr?: string;
          code?: number;   killed?: boolean;
        };

        if (e.killed) {
          sendError(res, `Execution timed out after ${TIMEOUT_MS / 1000}s.`, 408);
          return;
        }

        // Compile/runtime error — still return stdout/stderr so user sees the message
        sendSuccess(res, 'Execution completed with errors.', {
          stdout:   e.stdout?.trim() || '',
          stderr:   e.stderr?.trim() || '',
          exitCode: e.code ?? 1,
          command:  cmdLabel,
        });
      }

      return;
    }

    // ════════════════════════════════════════════════════════════
    // MODE B — Raw terminal command (typed in the Terminal panel)
    // ════════════════════════════════════════════════════════════
    if (command?.trim()) {
      const trimmed = command.trim();

      if (!USE_DOCKER && !isRawSafe(trimmed)) {
        sendError(
          res,
          `Command not allowed: "${trimmed.split(' ')[0]}". Enable Docker or use: node, python, java, git, ls, pwd, echo, npm...`,
          403
        );
        return;
      }

      const finalCmd = USE_DOCKER
        ? buildDockerCmd('node:20-alpine', tempDir, trimmed.replace(/"/g, '\\"'))
        : trimmed;

      try {
        const { stdout, stderr } = await execAsync(finalCmd, {
          timeout:   TIMEOUT_MS,
          maxBuffer: 1024 * 512,
          env: { ...process.env, NODE_ENV: 'sandbox' },
          shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
        });

        sendSuccess(res, 'Command executed.', {
          stdout:   stdout.trim(),
          stderr:   stderr.trim(),
          exitCode: 0,
          command:  trimmed,
        });
      } catch (execErr: unknown) {
        const e = execErr as {
          stdout?: string; stderr?: string;
          code?: number;   killed?: boolean;
        };

        if (e.killed) {
          sendError(res, `Timed out after ${TIMEOUT_MS / 1000}s.`, 408);
          return;
        }

        sendSuccess(res, 'Command completed with errors.', {
          stdout:   e.stdout?.trim() || '',
          stderr:   e.stderr?.trim() || '',
          exitCode: e.code ?? 1,
          command:  trimmed,
        });
      }

      return;
    }

    sendError(res, 'Provide { fileName, content } to run a file, or { command } for terminal.', 400);

  } catch (error) {
    next(error);
  } finally {
    // Always clean up temp dir
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
};