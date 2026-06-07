// ✅ Day 7 → TERMINAL UI
// Frontend: Input box + output panel with history navigation
// Backend: Connects to POST /api/terminal/execute (see terminal.controller.ts)

import React, { useState, useRef, useEffect, useCallback } from 'react';
import apiFetch from '../../services/api';

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info' | 'success';
  text: string;
  timestamp?: string;
}

interface ExecuteResponse {
  success: boolean;
  data?: { stdout: string; stderr: string; exitCode: number };
  message?: string;
}

// Fallback mock responses for when backend isn't available
const MOCK_COMMANDS: Record<string, string> = {
  help: `Available commands:\n  ls          - List files\n  clear       - Clear terminal\n  pwd         - Print working directory\n  node -v     - Node.js version\n  npm -v      - npm version\n  git status  - Git status`,
  ls: 'src/  package.json  README.md  tsconfig.json  tailwind.config.js  node_modules/',
  pwd: '/home/user/dewcode-project',
  'node -v': 'v20.11.0',
  'npm -v': '10.2.4',
  whoami: 'dewcode-user',
  date: new Date().toString(),
  'git status': 'On branch main\nnothing to commit, working tree clean',
};

const Terminal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'info', text: '╔═══════════════════════════════════╗' },
    { type: 'info', text: '║   DewCode Terminal v1.0.0          ║' },
    { type: 'info', text: '╚═══════════════════════════════════╝' },
    { type: 'info', text: 'Type "help" for available commands.' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const appendLines = (newLines: TerminalLine[]) => {
    setLines((prev) => [...prev, ...newLines]);
  };

  const run = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    if (trimmed === 'clear') {
      setLines([]);
      setHistory((h) => [trimmed, ...h]);
      setHistoryIdx(-1);
      setInput('');
      return;
    }

    appendLines([{
      type: 'input',
      text: `$ ${trimmed}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }]);

    setHistory((h) => [trimmed, ...h]);
    setHistoryIdx(-1);
    setInput('');
    setRunning(true);

    try {
      // Try real backend execution
      const resp = await apiFetch<ExecuteResponse>('/api/terminal/execute', {
        method: 'POST',
        body: JSON.stringify({ command: trimmed }),
      });

      if (resp.success && resp.data) {
        const { stdout, stderr, exitCode } = resp.data;
        if (stdout) {
          stdout.split('\n').filter(Boolean).forEach((line) =>
            appendLines([{ type: 'output', text: line }])
          );
        }
        if (stderr) {
          stderr.split('\n').filter(Boolean).forEach((line) =>
            appendLines([{ type: 'error', text: line }])
          );
        }
        if (exitCode === 0 && !stdout && !stderr) {
          appendLines([{ type: 'success', text: '✓ Done' }]);
        }
      }
    } catch {
      // Fallback: mock responses
      const mockOut = MOCK_COMMANDS[trimmed];
      if (mockOut) {
        mockOut.split('\n').forEach((line) =>
          appendLines([{ type: 'output', text: line }])
        );
      } else {
        appendLines([{ type: 'error', text: `bash: ${trimmed}: command not found` }]);
      }
    } finally {
      setRunning(false);
    }
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      run(input);
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
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  const lineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input':   return '#00D4B8';
      case 'error':   return '#F87171';
      case 'info':    return '#6B7280';
      case 'success': return '#4ADE80';
      default:        return '#CBD5E1';
    }
  };

  return (
    <div className="flex flex-col h-full terminal" style={{ background: '#080810' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-1.5 border-b"
        style={{ borderColor: '#1A1A26' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: '#F87171' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#F59E0B' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#4ADE80' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>
            Terminal
          </span>
          {running && (
            <span className="text-xs animate-pulse" style={{ color: '#F59E0B' }}>● running</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLines([])}
            className="text-xs px-2 py-0.5 rounded transition-colors hover:text-white"
            style={{ color: '#6B7280' }}
            title="Clear (Ctrl+L)"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="text-xs hover:text-white transition-colors"
            style={{ color: '#6B7280' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        className="flex-1 overflow-auto p-3 space-y-0.5 cursor-text font-mono"
        style={{ fontSize: '12px' }}
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line, i) => (
          <div key={i} className="flex items-start gap-2 leading-5 whitespace-pre-wrap">
            {line.timestamp && (
              <span className="flex-shrink-0 text-xs" style={{ color: '#2A2A3A', fontFamily: 'monospace' }}>
                [{line.timestamp}]
              </span>
            )}
            <span style={{ color: lineColor(line.type) }}>{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-t"
        style={{ borderColor: '#1A1A26' }}
      >
        <span className="text-xs flex-shrink-0" style={{ color: '#00D4B8', fontFamily: 'monospace' }}>
          {'$'}
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={running ? 'Running...' : 'Enter command...'}
          disabled={running}
          className="flex-1 bg-transparent text-xs outline-none font-mono"
          style={{ color: '#E2E8F0', caretColor: '#00D4B8' }}
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default Terminal;