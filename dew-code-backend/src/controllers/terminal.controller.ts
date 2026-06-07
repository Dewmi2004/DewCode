// ✅ Day 7 → TERMINAL BACKEND
// POST /api/terminal/execute → runs command via child_process → returns stdout/stderr
//
// Security: Allowlisted commands only. For full Docker isolation, see notes below.
//
// Docker option (Day 7 advanced):
//   docker run --rm -i node:20-alpine sh -c "<command>"
//   Set TERMINAL_USE_DOCKER=true in .env to enable sandboxed execution.

import { Request, Response, NextFunction } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { sendSuccess, sendError } from '../utils/response';

const execAsync = promisify(exec);

const USE_DOCKER = process.env.TERMINAL_USE_DOCKER === 'true';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/tmp/dewcode-workspace';
const TIMEOUT_MS = 15_000; // 15 seconds max per command

// ── Allowlist: only safe commands can run without Docker ─────────────────
const ALLOWED_PREFIXES = [
  'node ', 'node -', 'npm ', 'npx ', 'yarn ',
  'python ', 'python3 ', 'pip ', 'pip3 ',
  'java ', 'javac ', 'mvn ',
  'git ', 'ls', 'pwd', 'cat ', 'echo ',
  'tsc ', 'ts-node ',
  'whoami', 'date', 'node -v', 'npm -v',
];

const BLOCKED_PATTERNS = [
  /rm\s+-rf/i, /sudo/i, /chmod/i, /chown/i, /mkfs/i,
  /dd\s+if=/i, />\s*\/dev\//i, /curl.*\|.*sh/i, /wget.*\|.*sh/i,
  /base64.*decode.*\|.*sh/i, /eval\s*\(/i,
];

const isCommandSafe = (command: string): boolean => {
  const trimmed = command.trim().toLowerCase();

  // Block dangerous patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) return false;
  }

  // If Docker is enabled, all commands go through container — safe
  if (USE_DOCKER) return true;

  // Otherwise check allowlist
  return ALLOWED_PREFIXES.some((prefix) => trimmed.startsWith(prefix.toLowerCase()));
};

const buildDockerCommand = (command: string): string => {
  const escaped = command.replace(/"/g, '\\"');
  return `docker run --rm --network none --memory 128m --cpus 0.5 -i node:20-alpine sh -c "${escaped}"`;
};

// ── POST /api/terminal/execute ────────────────────────────────────────────
// Body: { command: string }
export const executeCommand = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { command } = req.body;

    if (!command?.trim()) {
      sendError(res, 'Command is required.', 400);
      return;
    }

    const trimmed = command.trim();

    // Block unsafe commands
    if (!isCommandSafe(trimmed)) {
      sendError(res, `Command blocked for security: "${trimmed.split(' ')[0]}". Only development commands are allowed.`, 403);
      return;
    }

    const finalCommand = USE_DOCKER ? buildDockerCommand(trimmed) : trimmed;

    const { stdout, stderr } = await execAsync(finalCommand, {
      cwd: WORKSPACE_DIR,
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 512, // 512KB output limit
      env: {
        ...process.env,
        NODE_ENV: 'sandbox',
        HOME: WORKSPACE_DIR,
      },
    });

    sendSuccess(res, 'Command executed.', {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      command: trimmed,
    });
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number; killed?: boolean; signal?: string };

    if (execError.killed || execError.signal === 'SIGTERM') {
      sendError(res, `Command timed out after ${TIMEOUT_MS / 1000}s.`, 408);
      return;
    }

    // Non-zero exit code — still send output (it's a valid result, not a server error)
    if (execError.stdout !== undefined || execError.stderr !== undefined) {
      sendSuccess(res, 'Command completed with errors.', {
        stdout: execError.stdout?.trim() || '',
        stderr: execError.stderr?.trim() || '',
        exitCode: execError.code ?? 1,
        command: (req.body as { command: string }).command?.trim(),
      });
      return;
    }

    next(error);
  }
};