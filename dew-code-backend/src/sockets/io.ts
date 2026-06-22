// ✅ NEW FILE: src/sockets/io.ts
// collaboration.socket.ts owns the actual Socket.IO server instance. This
// is just a tiny registry so a REST controller (chat.controller.ts's
// markRead, specifically) can push a socket event without importing the
// socket file directly or threading `io` through every function signature.

import { Server } from 'socket.io';

let ioInstance: Server | null = null;

export const setIO = (io: Server): void => {
  ioInstance = io;
};

export const getIO = (): Server | null => ioInstance;
