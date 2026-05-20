import React, { useState, useRef, useEffect } from 'react';

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info';
  text: string;
}

const COMMANDS: Record<string, string> = {
  help: `Available commands:\n  ls         - List files\n  clear      - Clear terminal\n  npm start  - Start dev server\n  npm install - Install dependencies\n  node -v    - Node.js version\n  git status - Git status\n  git log    - Commit history`,
  ls: 'src/  package.json  README.md  tsconfig.json  tailwind.config.js',
  'node -v': 'v20.11.0',
  'npm -v': '10.2.4',
  'npm start': 'Starting development server...\nCompiled successfully!\nLocal: http://localhost:3000',
  'npm install': 'Installing dependencies...\nadded 1289 packages in 12.4s',
  'git status': 'On branch main\nYour branch is up to date with \'origin/main\'.\n\nnothing to commit, working tree clean',
  'git log': 'commit a3f4b2c (HEAD -> main)\nAuthor: dev <dev@dewcode.dev>\nDate: Wed Jan 24 10:30:00 2024\n\n    feat: add AI assistant integration',
  pwd: '/home/user/dewcode-project',
  whoami: 'dewcode-user',
};

const Terminal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'info', text: 'DewCode Terminal v1.0.0' },
    { type: 'info', text: 'Type "help" for available commands' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const run = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const newLines: TerminalLine[] = [
      ...lines,
      { type: 'input', text: `$ ${trimmed}` },
    ];

    if (trimmed === 'clear') {
      setLines([]);
    } else {
      const out = COMMANDS[trimmed];
      if (out) {
        out.split('\n').forEach(l => newLines.push({ type: 'output', text: l }));
      } else {
        newLines.push({ type: 'error', text: `bash: ${trimmed}: command not found` });
      }
      setLines(newLines);
    }

    setHistory(h => [trimmed, ...h]);
    setHistoryIdx(-1);
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { run(input); }
    else if (e.key === 'ArrowUp') {
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      setInput(history[next] || '');
    } else if (e.key === 'ArrowDown') {
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setInput(next === -1 ? '' : history[next]);
    }
  };

  const lineColor = (type: TerminalLine['type']) => {
    if (type === 'input') return '#00D4B8';
    if (type === 'error') return '#F87171';
    if (type === 'info') return '#6B7280';
    return '#CBD5E1';
  };

  return (
    <div className="flex flex-col h-full terminal" style={{ background: '#080810' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: '#1A1A26' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: '#00D4B8' }}>{'>'}_</span>
          <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Terminal</span>
        </div>
        <button onClick={onClose} className="text-xs hover:text-white transition-colors" style={{ color: '#6B7280' }}>✕</button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-0.5 cursor-text" onClick={() => inputRef.current?.focus()}>
        {lines.map((line, i) => (
          <div key={i} className="text-xs leading-5 whitespace-pre-wrap" style={{ color: lineColor(line.type) }}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: '#1A1A26' }}>
        <span className="text-xs" style={{ color: '#00D4B8' }}>$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter command..."
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: '#E2E8F0', caretColor: '#00D4B8' }}
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default Terminal;
