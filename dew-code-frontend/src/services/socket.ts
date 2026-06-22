// ✅ UPDATED: src/services/socket.ts
// Thin wrapper around socket.io-client for both real-time features that
// share one connection: file collaboration (EditorPage) and chat
// (ChatWidget, mounted for the whole authenticated session). Each caller
// connects/disconnects independently via a refcount, so EditorPage leaving
// the page doesn't kill the connection ChatWidget is still holding open,
// and vice versa — the socket only actually disconnects once nobody needs
// it anymore (in practice: on logout, when ChatWidget itself unmounts).

import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socket: Socket | null = null;
let refCount = 0;

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
  refCount++;
  const s = getSocket();
  s.auth = { token: getAccessToken() };
  if (!s.connected) s.connect();
  return s;
};

export const disconnectCollabSocket = (): void => {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0) socket?.disconnect();
};

export const getCollabSocket = (): Socket | null => socket;
