// ✅ NEW FILE: src/sockets/collaboration.socket.ts
// Real-time collaboration — available on any project shared with a Team.
// Teams can only be created by a Plus-plan Admin (see team.controller.ts),
// so this is effectively Plus-only, but individual members don't each
// need their own Plus subscription — same seat-based model most team
// plans use. Provides: multi-user editing (broadcast content changes),
// live cursor tracking, and instant presence updates.
//
// NOTE ON CONFLICT RESOLUTION: this broadcasts whole-content updates
// ("latest write wins") rather than true operational-transform/CRDT
// merging. Fine for a few people editing the same file; for heavy
// concurrent typing by many users at once you'd want something like Yjs.

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import User from '../models/User';
import File from '../models/File';
import { findAccessibleProject } from '../utils/projectAccess';

interface Presence {
  userId: string;
  name: string;
  color: string;
}

const COLORS = ['#00D4B8', '#F87171', '#FBBF24', '#60A5FA', '#A78BFA', '#F472B6', '#34D399', '#FB923C'];

// Deterministic per-user color so the same person always gets the same
// cursor color across reconnects/sessions.
const colorFor = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
};

// fileId -> socketId -> presence info for everyone currently viewing it
const roomPresence = new Map<string, Map<string, Presence>>();
// Debounced DB-persistence timers, one per fileId, so a fresh page load or
// new joiner sees reasonably current content without writing on every keystroke.
const saveTimers = new Map<string, NodeJS.Timeout>();

const roomName = (fileId: string): string => `file:${fileId}`;

export const initCollaborationSocket = (httpServer: HTTPServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
      ],
      credentials: true,
    },
  });

  // ── Auth handshake ─────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) { next(new Error('Authentication required.')); return; }

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      if (!user) { next(new Error('User not found.')); return; }

      // No per-socket plan check here on purpose: gating happens at the
      // team level (a team can only exist because its owner paid for
      // Plus — see team.controller.ts createTeam). Every member of that
      // team rides along on the team's access, the same seat-based model
      // most team plans use. join-file below re-verifies the project is
      // actually shared with a team this user belongs to.
      socket.data.userId = user._id.toString();
      socket.data.name = user.name;
      socket.data.color = colorFor(user._id.toString());
      next();
    } catch {
      next(new Error('Invalid or expired session.'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId, name, color } = socket.data as { userId: string; name: string; color: string };
    let currentFileId: string | null = null;

    const leaveCurrentRoom = () => {
      if (!currentFileId) return;
      const room = roomPresence.get(currentFileId);
      room?.delete(socket.id);
      socket.leave(roomName(currentFileId));
      socket.to(roomName(currentFileId)).emit('user-left', { userId });
      currentFileId = null;
    };

    // Join a file's live session. Requires the project to be shared with a
    // team the user belongs to — personal (non-team) projects never get
    // collaboration UI on the frontend, but we re-check here too since a
    // socket event is just as untrusted as an HTTP request.
    socket.on('join-file', async ({ fileId, projectId }: { fileId: string; projectId: string }) => {
      const project = await findAccessibleProject(projectId, userId);
      if (!project || !project.teamId) {
        socket.emit('collab-error', 'This project is not shared with a team — collaboration is unavailable.');
        return;
      }

      leaveCurrentRoom();
      currentFileId = fileId;
      socket.join(roomName(fileId));

      if (!roomPresence.has(fileId)) roomPresence.set(fileId, new Map());
      const room = roomPresence.get(fileId)!;
      room.set(socket.id, { userId, name, color });

      // Tell the joiner who's already here, and tell everyone else who just joined.
      socket.emit('presence', Array.from(room.values()).filter((p) => p.userId !== userId));
      socket.to(roomName(fileId)).emit('user-joined', { userId, name, color });
    });

    socket.on('leave-file', () => leaveCurrentRoom());

    // Live cursor tracking — position/selection only, never persisted.
    socket.on('cursor-move', ({ fileId, position, selection }: { fileId: string; position: unknown; selection?: unknown }) => {
      if (fileId !== currentFileId) return;
      socket.to(roomName(fileId)).emit('cursor-update', { userId, name, color, position, selection });
    });

    // Instant content sync — broadcast immediately, persist on a short debounce.
    socket.on('code-change', ({ fileId, content }: { fileId: string; content: string }) => {
      if (fileId !== currentFileId) return;
      socket.to(roomName(fileId)).emit('code-update', { userId, content });

      const existingTimer = saveTimers.get(fileId);
      if (existingTimer) clearTimeout(existingTimer);
      saveTimers.set(
        fileId,
        setTimeout(() => {
          File.findByIdAndUpdate(fileId, { content }).catch(() => {});
          saveTimers.delete(fileId);
        }, 1500)
      );
    });

    socket.on('disconnect', () => leaveCurrentRoom());
  });

  return io;
};
