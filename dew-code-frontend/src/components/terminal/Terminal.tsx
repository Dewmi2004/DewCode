import React, { useState, useRef, useEffect, useCallback } from 'react';
import apiFetch from '../../services/api';

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info' | 'success';
  text: string;
  timestamp?: string;
}

interface ExecuteResponse {
  success: boolean;
  data?: {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    command?: string;
    sessionId?: string | null; // present while the container is still alive
    exited?: boolean;          // true once the container has finished
  };
  message?: string;
}

interface TerminalProps {
  onClose: () => void;
  /**
   * Optional: pass a file to run immediately (e.g. from an editor's ▶ Run
   * button). Existing callers that only pass `onClose` are unaffected —
   * this is purely additive.
   */
  runFile?: { fileName: string; content: string } | null;
}

// NOTE ON THE DOCKERODE BACKEND SWAP:
// This component only ever talks to the backend over HTTP
// (/api/terminal/execute, /api/terminal/stdin, /api/terminal/kill). It has
// no knowledge of how those endpoints are implemented underneath — whether
// that's child_process.spawn() shelling out to the `docker` CLI, or
// dockerode talking to the Docker Engine API directly, makes no difference
// to this file. The wire contract (ExecuteResponse shape, sessionId/exited
// flow) is identical either way, so nothing here needs to change.

const Terminal: React.FC<TerminalProps> = ({ onClose, runFile }) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'info', text: 'DewCode Terminal v2.0 (session-based stdin, dockerode-backed)' },
    { type: 'info', text: 'Type "help" or run programs — multi-step input now works.' },
  ]);

  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stdinMode, setStdinMode] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [running, setRunning] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the latest sessionId available to the unmount cleanup below
  // without re-running that effect (and killing the session) every time
  // sessionId changes.
  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  // Whenever the backend hands back a live session (program is running and
  // not yet exited), pull focus to the input so it's immediately obvious
  // the user can type — this is the actual "stdin field appears when the
  // program needs input" behavior, since the field exists the whole time
  // but now visibly demands attention the moment a session goes live.
  useEffect(() => {
    if (stdinMode && !running) {
      inputRef.current?.focus();
    }
  }, [stdinMode, running]);

  // Kill any still-running session if the terminal panel unmounts (closed,
  // navigated away, etc.) so we don't leak Docker containers.
  useEffect(() => {
    return () => {
      const id = sessionIdRef.current;
      if (id) {
        apiFetch('/api/terminal/kill', {
          method: 'POST',
          body: JSON.stringify({ sessionId: id }),
        }).catch(() => { /* best effort */ });
      }
    };
  }, []);

  const appendLines = (newLines: TerminalLine[]) => {
    setLines((prev) => [...prev, ...newLines]);
  };

  // Shared handling for whatever /execute or /stdin hands back.
  const handleExecResponse = useCallback((resp: ExecuteResponse) => {
    if (!resp.success || !resp.data) {
      appendLines([{ type: 'error', text: resp.message || 'Execution failed' }]);
      setSessionId(null);
      setStdinMode(false);
      return;
    }

    const { stdout, stderr, sessionId: newSessionId, exited, exitCode } = resp.data;

    if (stdout) {
      stdout.split('\n').forEach((line) => appendLines([{ type: 'output', text: line }]));
    }
    if (stderr) {
      stderr.split('\n').forEach((line) => appendLines([{ type: 'error', text: line }]));
    }

    if (exited) {
      appendLines([{
        type: 'info',
        text: `[process exited${exitCode != null ? ` with code ${exitCode}` : ''}]`,
      }]);
      setSessionId(null);
      setStdinMode(false);
    } else if (newSessionId) {
      setSessionId(newSessionId);
      setStdinMode(true);
    }
  }, []);

  // Run a file directly (e.g. triggered by an editor's Run button via props).
  const runFileSession = useCallback(async (fileName: string, content: string) => {
    appendLines([{ type: 'input', text: `$ run ${fileName}` }]);
    setRunning(true);
    try {
      const resp = await apiFetch<ExecuteResponse>('/api/terminal/execute', {
        method: 'POST',
        body: JSON.stringify({ fileName, content }),
      });
      handleExecResponse(resp);
    } catch {
      appendLines([{ type: 'error', text: 'Execution failed' }]);
    } finally {
      setRunning(false);
    }
  }, [handleExecResponse]);

  useEffect(() => {
    if (runFile) void runFileSession(runFile.fileName, runFile.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runFile]);

  // Typed into the terminal box. Two cases:
  //   - No active session  → this is a new command  → POST /execute
  //   - Active session      → this is stdin for it    → POST /stdin
  const run = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    appendLines([{ type: 'input', text: sessionId ? `> ${trimmed}` : `$ ${trimmed}` }]);
    setHistory((h) => [trimmed, ...h]);
    setHistoryIdx(-1);
    setInput('');
    setRunning(true);

    try {
      const endpoint = sessionId ? '/api/terminal/stdin' : '/api/terminal/execute';
      const body = sessionId
        ? { sessionId, input: trimmed }
        : { command: trimmed };

      const resp = await apiFetch<ExecuteResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      handleExecResponse(resp);
    } catch {
      appendLines([{ type: 'error', text: 'Execution failed' }]);
      setSessionId(null);
      setStdinMode(false);
    } finally {
      setRunning(false);
    }
  }, [sessionId, handleExecResponse]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      run(input);
    } else if (e.key === 'Escape') {
      if (sessionId) {
        apiFetch('/api/terminal/kill', {
          method: 'POST',
          body: JSON.stringify({ sessionId }),
        }).catch(() => { /* best effort */ });
        appendLines([{ type: 'info', text: 'Session terminated.' }]);
      }
      setSessionId(null);
      setStdinMode(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      setInput(history[next] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setInput(next === -1 ? '' : history[next]);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#080810' }}>

      {/* HEADER */}
      <div className="px-4 py-2 border-b text-xs text-gray-400">
        Terminal {stdinMode && <span style={{ color: '#F59E0B' }}>● running</span>}
      </div>

      {/* OUTPUT */}
      <div
        className="flex-1 overflow-auto p-3 font-mono text-xs"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ color: color(line.type) }}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div
        className="flex items-center px-3 py-2 border-t"
        style={stdinMode ? { borderTop: '1px solid #F59E0B', background: 'rgba(245, 158, 11, 0.08)' } : undefined}
      >
        <span style={{ color: stdinMode ? '#F59E0B' : '#00D4B8', fontWeight: stdinMode ? 700 : 400 }}>
          {stdinMode ? '>' : '$'}
        </span>

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={running}
          placeholder={stdinMode ? 'Program is waiting for input…' : 'Type a command…'}
          className="flex-1 bg-transparent outline-none text-xs ml-2"
        />

        {stdinMode && (
          <span className="text-xs ml-2" style={{ color: '#F59E0B' }}>
            waiting for input
          </span>
        )}
      </div>
    </div>
  );
};

const color = (type: string) => {
  switch (type) {
    case 'input': return '#00D4B8';
    case 'error': return '#F87171';
    case 'info': return '#6B7280';
    case 'success': return '#4ADE80';
    default: return '#CBD5E1';
  }
};

export default Terminal;