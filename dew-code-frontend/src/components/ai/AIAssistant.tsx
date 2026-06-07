// ✅ Day 10 → AI PANEL UI  +  Day 11 → CONNECT AI TO EDITOR
// Chat UI + Input/Response display + Editor integration
// Connects to POST /api/ai/prompt (see ai.controller.ts)

import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import apiFetch from '../../services/api';

interface AIResponse {
  success: boolean;
  data?: { response: string };
  message?: string;
}

interface AIAssistantProps {
  compact?: boolean;
  /** Pre-filled message from editor (Explain / Fix / Generate) */
  initialMessage?: string;
  /** Called after the initial message has been consumed */
  onContextConsumed?: () => void;
}

// Quick-action chips shown at bottom
const QUICK_ACTIONS = [
  { label: '⚡ Explain code', prompt: 'Explain what this code does in simple terms.' },
  { label: '🐛 Find bugs', prompt: 'Find and explain any bugs or issues in this code.' },
  { label: '✨ Optimize', prompt: 'How can I optimize this code for performance?' },
  { label: '📝 Add comments', prompt: 'Add JSDoc/inline comments to this code.' },
  { label: '🧪 Write tests', prompt: 'Write unit tests for this code.' },
];

const AIAssistant: React.FC<AIAssistantProps> = ({ compact, initialMessage, onContextConsumed }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI coding assistant powered by **Ollama Qwen2.5-Coder**.\n\nI can help you:\n• 🐛 Debug and fix errors\n• ⚡ Explain complex code\n• ✨ Optimize performance\n• 🧪 Write tests\n• 📝 Generate boilerplate\n\nPaste your code or use the editor buttons above!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [model, setModel] = useState('qwen2.5-coder');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Day 11: Auto-send when editor passes context ──────────────────────
  useEffect(() => {
    if (initialMessage && initialMessage.trim()) {
      setInput(initialMessage);
      onContextConsumed?.();
      // Auto-send after a short delay so user can see it
      setTimeout(() => {
        sendMessage(initialMessage);
        setInput('');
      }, 300);
    }
  }, [initialMessage]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || typing) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((m) => [...m, userMsg]);
    if (!text) setInput('');
    setTyping(true);

    try {
      // ── Day 9 / Day 11: Call real Ollama AI backend ───────────────────
      const resp = await apiFetch<AIResponse>('/api/ai/prompt', {
        method: 'POST',
        body: JSON.stringify({ prompt: content, model }),
      });

      const aiContent = resp.success && resp.data?.response
        ? resp.data.response
        : resp.message || 'Sorry, I could not get a response. Make sure Ollama is running.';

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiContent,
        timestamp: new Date(),
      };
      setMessages((m) => [...m, aiMsg]);
    } catch (err) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Could not reach AI backend.\n\nMake sure:\n1. Ollama is running: \`ollama serve\`\n2. Model is pulled: \`ollama pull ${model}\`\n3. Backend is running on port 5000`,
        timestamp: new Date(),
      };
      setMessages((m) => [...m, errMsg]);
    } finally {
      setTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: "Chat cleared. How can I help you?",
      timestamp: new Date(),
    }]);
  };

  // Simple markdown-like renderer for code blocks
  const renderContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).split('\n');
        const lang = lines[0].trim();
        const code = lines.slice(1).join('\n');
        return (
          <div key={i} className="mt-2 mb-2 rounded overflow-hidden" style={{ border: '1px solid #2A2A3A' }}>
            {lang && (
              <div className="px-3 py-1 text-xs" style={{ background: '#12121A', color: '#6B7280', borderBottom: '1px solid #2A2A3A' }}>
                {lang}
              </div>
            )}
            <pre className="p-3 text-xs overflow-x-auto leading-5" style={{ background: '#080810', color: '#00D4B8', fontFamily: "'JetBrains Mono', monospace" }}>
              {code}
            </pre>
          </div>
        );
      }
      // Render inline formatting
      return (
        <span key={i} className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
          __html: part
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#E2E8F0">$1</strong>')
            .replace(/`([^`]+)`/g, '<code style="background:#1A1A26;color:#00D4B8;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:11px">$1</code>')
            .replace(/^• /gm, '&nbsp;&nbsp;• ')
        }} />
      );
    });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#0D0D16' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: '#1A1A26' }}>
        <span className="text-sm" style={{ color: '#00D4B8' }}>✦</span>
        <span className="text-xs font-semibold tracking-wider" style={{ color: '#9CA3AF' }}>AI ASSISTANT</span>
        <div className="ml-auto flex items-center gap-2">
          {/* Model selector */}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-xs rounded px-1 py-0.5 outline-none"
            style={{ background: '#1A1A26', color: '#6B7280', border: '1px solid #2A2A3A' }}
          >
            <option value="qwen2.5-coder">qwen2.5-coder</option>
            <option value="codellama">codellama</option>
            <option value="deepseek-coder">deepseek-coder</option>
            <option value="llama3.2">llama3.2</option>
          </select>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00D4B8' }} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`animate-fade-in ${m.role === 'user' ? 'flex flex-col items-end' : ''}`}>
            {m.role === 'assistant' ? (
              <div className="flex items-start gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(0,212,184,0.15)', border: '1px solid rgba(0,212,184,0.3)' }}
                >
                  <span className="text-xs" style={{ color: '#00D4B8' }}>✦</span>
                </div>
                <div className="max-w-full flex-1">
                  <div
                    className="px-3 py-2 rounded-lg text-xs leading-5"
                    style={{ background: '#1A1A26', color: '#CBD5E1', border: '1px solid #2A2A3A' }}
                  >
                    {renderContent(m.content)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#3A3A50' }}>
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-full">
                <div
                  className="px-3 py-2 rounded-lg text-xs leading-5 whitespace-pre-wrap"
                  style={{ background: 'rgba(0,212,184,0.12)', color: '#E2E8F0', border: '1px solid rgba(0,212,184,0.2)' }}
                >
                  {m.content}
                </div>
                <p className="text-xs mt-1 text-right" style={{ color: '#3A3A50' }}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,212,184,0.15)' }}>
              <span className="text-xs" style={{ color: '#00D4B8' }}>✦</span>
            </div>
            <div className="flex gap-1 px-3 py-2 rounded-lg" style={{ background: '#1A1A26' }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: '#00D4B8', animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      {!compact && (
        <div className="px-3 py-2 border-t overflow-x-auto" style={{ borderColor: '#1A1A26' }}>
          <div className="flex gap-1.5 pb-1" style={{ minWidth: 'max-content' }}>
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                disabled={typing}
                className="px-2 py-1 text-xs rounded-md whitespace-nowrap transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: '#1A1A26', color: '#9CA3AF', border: '1px solid #2A2A3A' }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t" style={{ borderColor: '#1A1A26' }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything… (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 px-3 py-2 text-xs rounded-md outline-none resize-none"
            style={{
              background: '#12121A',
              border: '1px solid #2A2A3A',
              color: '#E2E8F0',
              caretColor: '#00D4B8',
              lineHeight: '1.5',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#00D4B8')}
            onBlur={(e) => (e.target.style.borderColor = '#2A2A3A')}
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={() => sendMessage()}
              disabled={typing || !input.trim()}
              className="px-3 py-2 text-xs rounded-md transition-all disabled:opacity-40"
              style={{ background: '#00D4B8', color: '#0A0A0F', fontWeight: 600 }}
            >
              ↑
            </button>
            <button
              onClick={clearChat}
              className="px-3 py-1 text-xs rounded-md transition-all"
              style={{ background: '#1A1A26', color: '#6B7280', border: '1px solid #2A2A3A' }}
              title="Clear chat"
            >
              ✕
            </button>
          </div>
        </div>
        <p className="text-xs mt-1.5" style={{ color: '#3A3A50' }}>
          Powered by Ollama · {model}
        </p>
      </div>
    </div>
  );
};

export default AIAssistant;