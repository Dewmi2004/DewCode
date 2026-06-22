// ✅ NEW FILE: src/components/chat/ChatWidget.tsx
// Floating chat button (with an unread badge) + a half-screen slide-in
// panel. Mounted once in MainApp so it's available from every page and the
// badge stays live the whole session, not just while a chat panel happens
// to be open.
//
// Real-time delivery rides the same socket connection EditorPage uses for
// collaboration (see services/socket.ts) — connecting here just adds a
// reference so leaving the editor doesn't drop chat's connection too.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../hooks/redux';
import { chatApi, type ChatContact, type ChatTeamSummary, type ChatMessage, type ConversationRef } from '../../services/chatApi';
import { connectCollabSocket, disconnectCollabSocket, getCollabSocket } from '../../services/socket';

type Conversation =
  | { type: 'dm'; userId: string; name: string }
  | { type: 'team'; teamId: string; name: string };

const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 32 }) => (
  <div
    className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
    style={{ width: size, height: size, fontSize: size * 0.4, background: '#1E1E2E', color: '#00D4B8' }}
  >
    {initials(name)}
  </div>
);

const Badge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
      style={{ background: '#F87171', color: '#fff' }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
};

const ChatWidget: React.FC = () => {
  const user = useAppSelector((s) => s.auth.user);
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [teams, setTeams] = useState<ChatTeamSummary[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');

  const activeRef = useRef<Conversation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { activeRef.current = active; }, [active]);

  const totalUnread = contacts.reduce((sum, c) => sum + c.unread, 0) + teams.reduce((sum, t) => sum + t.unread, 0);

  // ── Connection + initial data, for the whole authenticated session ─────
  useEffect(() => {
    if (!user) return;
    const socket = connectCollabSocket();

    chatApi.getOverview().then((res) => {
      if (res.success && res.data) {
        setContacts(res.data.contacts);
        setTeams(res.data.teams);
      }
    }).catch(() => { /* badge just stays at 0 — non-fatal */ });

    const onMessage = (msg: ChatMessage) => {
      const conv = activeRef.current;
      const isForOpenConversation =
        !!conv &&
        ((msg.chatType === 'dm' && conv.type === 'dm' && (msg.senderId === conv.userId || msg.recipientId === conv.userId)) ||
         (msg.chatType === 'team' && conv.type === 'team' && msg.teamId === conv.teamId));

      if (isForOpenConversation) {
        setMessages((prev) => [...prev, msg]);
        if (msg.senderId !== user.id) {
          const ref: ConversationRef = conv!.type === 'dm' ? { chatType: 'dm', userId: conv!.userId } : { chatType: 'team', teamId: conv!.teamId };
          chatApi.markRead(ref).catch(() => {});
        }
        return;
      }

      if (msg.senderId === user.id) return; // my own message, sent from elsewhere — no badge bump

      if (msg.chatType === 'dm') {
        setContacts((prev) => prev.map((c) => (c.id === msg.senderId ? { ...c, unread: c.unread + 1 } : c)));
      } else if (msg.teamId) {
        setTeams((prev) => prev.map((t) => (t.id === msg.teamId ? { ...t, unread: t.unread + 1 } : t)));
      }
    };

    // Cross-tab/device sync when this same user reads a conversation elsewhere.
    const onRead = ({ chatType, userId, teamId }: { chatType: 'dm' | 'team'; userId?: string; teamId?: string }) => {
      if (chatType === 'dm' && userId) {
        setContacts((prev) => prev.map((c) => (c.id === userId ? { ...c, unread: 0 } : c)));
      } else if (chatType === 'team' && teamId) {
        setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, unread: 0 } : t)));
      }
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:read', onRead);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:read', onRead);
      disconnectCollabSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const openConversation = useCallback(async (conv: Conversation) => {
    setActive(conv);
    setMessages([]);
    setSendError('');
    setLoadingMessages(true);

    const ref: ConversationRef = conv.type === 'dm' ? { chatType: 'dm', userId: conv.userId } : { chatType: 'team', teamId: conv.teamId };

    try {
      const res = await chatApi.getMessages(ref);
      if (res.success && res.data) setMessages(res.data.messages);
      await chatApi.markRead(ref);
      if (conv.type === 'dm') {
        setContacts((prev) => prev.map((c) => (c.id === conv.userId ? { ...c, unread: 0 } : c)));
      } else {
        setTeams((prev) => prev.map((t) => (t.id === conv.teamId ? { ...t, unread: 0 } : t)));
      }
    } catch {
      setSendError('Could not load messages.');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const handleSend = useCallback(() => {
    const content = draft.trim();
    const conv = active;
    if (!content || !conv) return;

    // The widget's own mount effect already holds this connection open for
    // its whole lifetime — grab the existing socket rather than connecting
    // again (that would bump the refcount and require a matching release).
    const socket = getCollabSocket();
    if (!socket?.connected) { setSendError('Not connected — try again in a moment.'); return; }

    const payload = conv.type === 'dm'
      ? { chatType: 'dm' as const, recipientId: conv.userId, content }
      : { chatType: 'team' as const, teamId: conv.teamId, content };

    setDraft('');
    setSendError('');
    socket.emit('chat:send', payload, (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setSendError(res.error || 'Failed to send.');
    });
  }, [draft, active]);

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{ background: '#00D4B8', color: '#000' }}
        title="Team chat"
      >
        <span className="relative">
          💬
          <Badge count={totalUnread} />
        </span>
      </button>

      {open && (
        <div
          className="fixed top-0 right-0 z-50 flex flex-col"
          style={{
            width: 'min(50vw, 560px)',
            minWidth: 320,
            maxWidth: '100vw',
            height: '100vh',
            background: '#0E0E16',
            borderLeft: '1px solid #1E1E2E',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1E1E2E' }}>
            <h2 className="text-white font-semibold text-sm">Team Chat</h2>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Conversation list */}
            <div className="w-[220px] flex-shrink-0 overflow-y-auto border-r" style={{ borderColor: '#1E1E2E' }}>
              <div className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wide" style={{ color: '#6B7280' }}>Teams</div>
              {teams.length === 0 && <p className="px-3 py-1 text-xs" style={{ color: '#4B5563' }}>No teams yet</p>}
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openConversation({ type: 'team', teamId: t.id, name: t.name })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                  style={{ background: active?.type === 'team' && active.teamId === t.id ? '#1A1A26' : 'transparent' }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#1E1E2E' }}>👥</div>
                  <span className="flex-1 text-sm truncate" style={{ color: '#E5E7EB' }}>{t.name}</span>
                  {t.unread > 0 && (
                    <span className="text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center" style={{ background: '#F87171', color: '#fff' }}>
                      {t.unread > 9 ? '9+' : t.unread}
                    </span>
                  )}
                </button>
              ))}

              <div className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wide" style={{ color: '#6B7280' }}>Direct Messages</div>
              {contacts.length === 0 && <p className="px-3 py-1 text-xs" style={{ color: '#4B5563' }}>No teammates yet</p>}
              {contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation({ type: 'dm', userId: c.id, name: c.name })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                  style={{ background: active?.type === 'dm' && active.userId === c.id ? '#1A1A26' : 'transparent' }}
                >
                  <Avatar name={c.name} size={28} />
                  <span className="flex-1 text-sm truncate" style={{ color: '#E5E7EB' }}>{c.name}</span>
                  {c.unread > 0 && (
                    <span className="text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center" style={{ background: '#F87171', color: '#fff' }}>
                      {c.unread > 9 ? '9+' : c.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Thread */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {!active ? (
                <div className="flex-1 flex items-center justify-center text-center px-6">
                  <p className="text-sm" style={{ color: '#6B7280' }}>
                    Pick a teammate or team on the left to start chatting.
                  </p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2.5 border-b text-sm font-medium" style={{ borderColor: '#1E1E2E', color: '#E5E7EB' }}>
                    {active.type === 'team' ? `👥 ${active.name}` : active.name}
                  </div>

                  <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                    {loadingMessages && <p className="text-xs text-center" style={{ color: '#6B7280' }}>Loading…</p>}
                    {!loadingMessages && messages.length === 0 && (
                      <p className="text-xs text-center" style={{ color: '#6B7280' }}>No messages yet — say hello 👋</p>
                    )}
                    {messages.map((m) => {
                      const mine = m.senderId === user.id;
                      return (
                        <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                          <Avatar name={m.senderName} size={26} />
                          <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                            {!mine && active.type === 'team' && (
                              <span className="text-[11px] mb-0.5" style={{ color: '#6B7280' }}>{m.senderName}</span>
                            )}
                            <div
                              className="px-3 py-1.5 rounded-2xl text-sm break-words"
                              style={{
                                background: mine ? '#00D4B8' : '#1A1A26',
                                color: mine ? '#000' : '#E5E7EB',
                              }}
                            >
                              {m.content}
                            </div>
                            <span className="text-[10px] mt-0.5" style={{ color: '#4B5563' }}>
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {sendError && (
                    <p className="px-4 text-xs" style={{ color: '#F87171' }}>{sendError}</p>
                  )}

                  <div className="flex items-end gap-2 p-3 border-t" style={{ borderColor: '#1E1E2E' }}>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Message…"
                      rows={1}
                      className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ background: '#1A1A26', color: '#fff', border: '1px solid #2A2A3A', maxHeight: 96 }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!draft.trim()}
                      className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                      style={{ background: '#00D4B8', color: '#000' }}
                    >
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
