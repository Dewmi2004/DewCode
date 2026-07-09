

import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'dewcode_access_token';
const TOKEN_WAIT_TIMEOUT_MS = 8000;
const TEARDOWN_GRACE_MS = 300;

let socket: Socket | null = null;
let refCount = 0;
let connectPromise: Promise<Socket> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

const getSocketToken = (): string | null => {
  return getAccessToken() || window.localStorage.getItem(TOKEN_KEY);
};

// Resolves as soon as a token exists, polling briefly rather than trusting
// whatever is available at the exact instant the engine asks for it. Gives
// up after TOKEN_WAIT_TIMEOUT_MS and sends null anyway (so a genuinely
// logged-out connection attempt still fails fast with a clear server error
// instead of hanging forever).
const waitForToken = (): Promise<string | null> => {
  const existing = getSocketToken();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const start = Date.now();
    const poll = () => {
      const token = getSocketToken();
      if (token || Date.now() - start >= TOKEN_WAIT_TIMEOUT_MS) {
        resolve(token);
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  });
};

const getSocket = (): Socket => {
  if (!socket) {
    socket = io(BASE_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      // Function form — re-invoked on every connect AND every automatic
      // reconnect, and now waits for a real token before ever calling
      // back, so the CONNECT packet is never sent empty-handed.
      auth: (cb) => {
        waitForToken().then((token) => cb({ token }));
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
  }
  return socket;
};

// Connects (or reconnects) right now. No need to touch `s.auth` here —
// it's a function (see above) and already pulls the current token itself
// on every attempt, including this one.
export const connectCollabSocket = (): Socket => {
  refCount++;
  // Someone still needs this connection — cancel any pending teardown a
  // sibling component's cleanup may have just scheduled.
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  const s = getSocket();
  if (!s.connected && !s.active) s.connect();
  return s;
};

export const disconnectCollabSocket = (): void => {
  refCount = Math.max(0, refCount - 1);
  if (refCount !== 0) return;

  if (teardownTimer) clearTimeout(teardownTimer);
  teardownTimer = setTimeout(() => {
    teardownTimer = null;
    // Re-check — a connectCollabSocket() call during the grace window
    // already cleared this timer, but guard anyway in case of overlap.
    if (refCount === 0) {
      connectPromise = null;
      socket?.disconnect();
    }
  }, TEARDOWN_GRACE_MS);
};

export const getCollabSocket = (): Socket | null => socket;

export const waitForCollabSocket = (timeoutMs = 5000): Promise<Socket> => {
  const s = getSocket();

  if (s.connected) return Promise.resolve(s);
  if (!s.active) s.connect();
  if (connectPromise) return connectPromise;

  connectPromise = new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(s);
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeout);
      s.off('connect', onConnect);
      s.off('connect_error', onConnectError);
      connectPromise = null;
    };

    const onConnect = () => {
      cleanup();
      resolve(s);
    };

    const onConnectError = () => {
      cleanup();
      resolve(s);
    };

    s.once('connect', onConnect);
    s.once('connect_error', onConnectError);
  });

  return connectPromise;
};