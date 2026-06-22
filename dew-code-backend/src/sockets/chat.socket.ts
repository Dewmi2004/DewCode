// ✅ NEW FILE: src/sockets/chat.socket.ts
// Real-time chat — DMs between teammates, and one group thread per team.
// Registers a second 'connection' listener on the SAME io instance
// collaboration.socket.ts created (Socket.IO supports multiple listeners
// per event), so the frontend keeps exactly one socket connection for both
// features, and reuses that file's JWT auth middleware — `socket.data`
// is already populated by the time either listener fires.
//
// DMs are intentionally scoped to people you already share a team with —
// there's no global user directory/search, so there's no path to message
// a stranger.

import { Server as SocketIOServer, Socket } from 'socket.io';
import Message from '../models/Message';
import Team from '../models/Team';
import { isTeamMember } from '../utils/projectAccess';

export const personalRoom = (userId: string): string => `user:${userId}`;
export const teamChatRoom = (teamId: string): string => `team-chat:${teamId}`;

const sharesATeam = async (userIdA: string, userIdB: string): Promise<boolean> => {
  const team = await Team.findOne({
    $and: [
      { $or: [{ owner: userIdA }, { 'members.user': userIdA }] },
      { $or: [{ owner: userIdB }, { 'members.user': userIdB }] },
    ],
  });
  return !!team;
};

interface SendPayload {
  chatType: 'dm' | 'team';
  recipientId?: string;
  teamId?: string;
  content: string;
}

type Ack = (res: { ok: boolean; error?: string }) => void;

export const initChatSocket = (io: SocketIOServer): void => {
  io.on('connection', async (socket: Socket) => {
    const { userId, name } = socket.data as { userId?: string; name?: string };
    if (!userId) return; // collaboration.socket.ts's auth middleware didn't run on this connection

    // Personal inbox room (cross-device/tab read-state sync) + every team's
    // chat room, so the unread badge can update live even on pages that
    // aren't the chat panel.
    socket.join(personalRoom(userId));
    const teams = await Team.find({ $or: [{ owner: userId }, { 'members.user': userId }] }).select('_id');
    teams.forEach((t) => socket.join(teamChatRoom(t._id.toString())));

    socket.on('chat:send', async (payload: SendPayload, ack?: Ack) => {
      try {
        const content = payload?.content?.trim();
        if (!content) { ack?.({ ok: false, error: 'Message is empty.' }); return; }
        if (content.length > 4000) { ack?.({ ok: false, error: 'Message is too long.' }); return; }

        if (payload.chatType === 'dm') {
          const recipientId = payload.recipientId;
          if (!recipientId) { ack?.({ ok: false, error: 'recipientId is required.' }); return; }
          if (recipientId === userId) { ack?.({ ok: false, error: "You can't message yourself." }); return; }
          if (!await sharesATeam(userId, recipientId)) {
            ack?.({ ok: false, error: 'You can only message people on a shared team.' });
            return;
          }

          const message = await Message.create({
            chatType: 'dm', sender: userId, recipient: recipientId, content, readBy: [userId],
          });
          const out = {
            id: message._id.toString(),
            chatType: 'dm' as const,
            senderId: userId,
            senderName: name ?? 'Someone',
            recipientId,
            content,
            createdAt: message.createdAt,
          };

          io.to(personalRoom(userId)).emit('chat:message', out);
          io.to(personalRoom(recipientId)).emit('chat:message', out);
          ack?.({ ok: true });
          return;
        }

        if (payload.chatType === 'team') {
          const teamId = payload.teamId;
          if (!teamId) { ack?.({ ok: false, error: 'teamId is required.' }); return; }
          if (!await isTeamMember(teamId, userId)) {
            ack?.({ ok: false, error: 'You are not a member of that team.' });
            return;
          }

          const message = await Message.create({
            chatType: 'team', sender: userId, teamId, content, readBy: [userId],
          });
          const out = {
            id: message._id.toString(),
            chatType: 'team' as const,
            senderId: userId,
            senderName: name ?? 'Someone',
            teamId,
            content,
            createdAt: message.createdAt,
          };

          io.to(teamChatRoom(teamId)).emit('chat:message', out);
          ack?.({ ok: true });
          return;
        }

        ack?.({ ok: false, error: 'Unknown chat type.' });
      } catch {
        ack?.({ ok: false, error: 'Failed to send message.' });
      }
    });
  });
};
