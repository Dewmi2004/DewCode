// ✅ NEW FILE: src/services/chatApi.ts
// REST half of chat — overview (contacts/teams + unread counts), message
// history, and marking things read. Actually sending a message happens
// over the socket (see services/socket.ts + ChatWidget) since that's the
// whole point of "live" — this file is what loads before the socket has
// said anything yet, and what backs the floating button's badge on first
// paint.

import apiFetch from './api';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface ChatContact {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  unread: number;
}

export interface ChatTeamSummary {
  id: string;
  name: string;
  unread: number;
}

export interface ChatOverview {
  contacts: ChatContact[];
  teams: ChatTeamSummary[];
  totalUnread: number;
}

export interface ChatMessage {
  id: string;
  chatType: 'dm' | 'team';
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId?: string;
  teamId?: string;
  content: string;
  createdAt: string;
}

export type ConversationRef =
  | { chatType: 'dm'; userId: string }
  | { chatType: 'team'; teamId: string };

export const chatApi = {
  getOverview: () =>
    apiFetch<ApiResponse<ChatOverview>>('/api/chat/overview'),

  getMessages: (ref: ConversationRef) => {
    const qs = ref.chatType === 'dm'
      ? `chatType=dm&userId=${encodeURIComponent(ref.userId)}`
      : `chatType=team&teamId=${encodeURIComponent(ref.teamId)}`;
    return apiFetch<ApiResponse<{ messages: ChatMessage[] }>>(`/api/chat/messages?${qs}`);
  },

  markRead: (ref: ConversationRef) =>
    apiFetch<ApiResponse<unknown>>('/api/chat/read', {
      method: 'POST',
      body: JSON.stringify(ref),
    }),
};
