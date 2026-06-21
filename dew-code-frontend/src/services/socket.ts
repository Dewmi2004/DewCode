// ✅ NEW FILE: src/services/socket.ts
// Thin wrapper around socket.io-client for the collaboration feature.
// One socket instance is reused for the whole app session; it connects
// lazily (only when a Plus user actually opens a team-shared project) and
// disconnects when they leave the editor or sign out.

import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socket: Socket | null = null;

const getSocket = (): Socket => {
  if (!socket) {
    socket = io(BASE_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { token: getAccessToken() },
    });
  }
  return socket;
};

// Connects (or reconnects) using whatever access token is current right
// now — important since the JWT can rotate after the socket was created.
export const connectCollabSocket = (): Socket => {
  const s = getSocket();
  s.auth = { token: getAccessToken() };
  if (!s.connected) s.connect();
  return s;
};

export const disconnectCollabSocket = (): void => {
  socket?.disconnect();
};

export const getCollabSocket = (): Socket | null => socket;
