import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';

const RESPONSES: Record<string, string> = {
  default: "I'm your AI coding assistant powered by Ollama CodeLlama. I can help you with code generation, debugging, and optimization. What would you like to work on?",
  component: "Here's a React component example:\n\n```jsx\nconst Button = ({ label, onClick }) => (\n  <button\n    className=\"px-4 py-2 bg-teal-500 text-black rounded hover:bg-teal-400\"\n    onClick={onClick}\n  >\n    {label}\n  </button>\n);\n\nexport default Button;\n```",
  bug: "I found a potential issue! The error likely occurs because:\n1. The variable may be undefined before use\n2. Add a null check: `if (value !== undefined) { ... }`\n3. Or use optional chaining: `value?.property`",
  optimize: "To optimize your code:\n• Use `useMemo` for expensive calculations\n• Implement `React.memo` for pure components\n• Lazy load with `React.lazy` and `Suspense`\n• Debounce frequent event handlers",
  explain: "This code does the following:\n1. Initializes component state\n2. Fetches data from an API on mount\n3. Renders a list of items with loading states\n4. Handles errors gracefully with try/catch",
};

const getResponse = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes('component') || m.includes('create') || m.includes('help me')) return RESPONSES.component;
  if (m.includes('bug') || m.includes('error') || m.includes('fix')) return RESPONSES.bug;
  if (m.includes('optimiz') || m.includes('performance') || m.includes('improve')) return RESPONSES.optimize;
  if (m.includes('explain') || m.includes('what') || m.includes('how')) return RESPONSES.explain;
  return RESPONSES.default;
};

const AIAssistant: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: "Hello! I'm your AI coding assistant powered by Ollama Qwen2.5-Coder. How can I help you today?", timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || typing) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    setMessages(m => [...m, userMsg]);
    const q = input;
    setInput('');
    setTyping(true);
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
    const resp: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: getResponse(q), timestamp: new Date() };
    setMessages(m => [...m, resp]);
    setTyping(false);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#0D0D16' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: '#1A1A26' }}>
        <span className="text-sm" style={{ color: '#00D4B8' }}>✦</span>
        <span className="text-xs font-semibold tracking-wider" style={{ color: '#9CA3AF' }}>AI ASSISTANT</span>
        <div className="ml-auto w-2 h-2 rounded-full animate-pulse-glow" style={{ background: '#00D4B8' }} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`animate-fade-in ${m.role === 'user' ? 'flex flex-col items-end' : ''}`}>
            {m.role === 'assistant' && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(0,212,184,0.15)', border: '1px solid rgba(0,212,184,0.3)' }}>
                  <span className="text-xs" style={{ color: '#00D4B8' }}>✦</span>
                </div>
                <div className="max-w-xs">
                  <div className="px-3 py-2 rounded-lg text-xs leading-5 whitespace-pre-wrap"
                    style={{ background: '#1A1A26', color: '#CBD5E1', border: '1px solid #2A2A3A' }}>
                    {m.content}
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#3A3A50' }}>
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}
            {m.role === 'user' && (
              <div className="max-w-xs">
                <div className="px-3 py-2 rounded-lg text-xs leading-5"
                  style={{ background: 'rgba(0,212,184,0.12)', color: '#E2E8F0', border: '1px solid rgba(0,212,184,0.2)' }}>
                  {m.content}
                </div>
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,212,184,0.15)' }}>
              <span className="text-xs" style={{ color: '#00D4B8' }}>✦</span>
            </div>
            <div className="flex gap-1 px-3 py-2 rounded-lg" style={{ background: '#1A1A26' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#00D4B8', animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t" style={{ borderColor: '#1A1A26' }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask me anything code..."
            className="flex-1 px-3 py-2 text-xs rounded-md outline-none"
            style={{ background: '#12121A', border: '1px solid #2A2A3A', color: '#E2E8F0', caretColor: '#00D4B8' }}
            onFocus={e => e.target.style.borderColor = '#00D4B8'}
            onBlur={e => e.target.style.borderColor = '#2A2A3A'}
          />
          <button onClick={send} className="btn-primary px-3 py-2 text-xs rounded-md" style={{ minWidth: '36px' }}>
            ↑
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
