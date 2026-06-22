// ✅ UPDATED: src/services/socket.ts
// Thin wrapper around socket.io-client for both real-time features that
// share one connection: file collaboration (EditorPage) and chat
// (ChatWidget, mounted for the whole authenticated session). Each caller
// connects/disconnects independently via a refcount, so EditorPage leaving
// the page doesn't kill the connection ChatWidget is still holding open,
// and vice versa — the socket only actually disconnects once nobody needs
// it anymore (in practice: on logout, when ChatWidget itself unmounts).
//
// BUGFIX 1: `auth` must be a function, not a plain object. socket.io-client
// only re-reads a plain `auth: {...}` object once, at the moment the
// socket instance is first constructed — every automatic reconnection
// after that (server restart, network blip, Render cold start) resends
// that same, now possibly-stale token, and the server's handshake
// middleware rejects it with "Authentication required." forever, with no
// further error shown anywhere obvious. socket.io-client DOES call a
// function-form `auth` fresh on every single connection attempt.
//
// BUGFIX 2: that function-form callback now WAITS for a token instead of
// firing immediately with whatever is (or isn't) available right this
// instant. The server only ever throws "Authentication required." when
// the handshake arrives with no token at all — and that's exactly what
// happens if anything calls connect() a beat before React/Redux has
// finished writing the token (most commonly React 18/19 StrictMode, which
// mounts → cleans up → re-mounts every effect once in dev, so the very
// first connection attempt can race app bootstrap). Once that attempt is
// rejected, the *connection* (not just the auth) is dead — socket.io does
// reconnect automatically, but every retry sends the same handshake, so a
// component watching for a one-shot "connect" can sit broken until a full
// page reload. Waiting for a real token before ever sending the CONNECT
// packet removes that failure mode entirely instead of retrying around it.
// This is also why chat ("Authentication required" in console) and the
// editor's live cursors (no presence/cursor events ever arrive) break
// together — they're two consumers of this one socket.
//
// BUGFIX 3: disconnectCollabSocket() no longer tears the socket down the
// instant refCount hits 0. StrictMode's mount→cleanup→re-mount happens
// inside the same tick for each component, but ChatWidget and EditorPage
// are *different* components, so there's a brief window where one has
// cleaned up (refCount dropped to 0, scheduling teardown) right before the
// other's re-mount calls connectCollabSocket() again. Without a grace
// window, that first teardown can fire and kill a connection something
// else just asked to keep open. A short delay (cancelled if refCount goes
// back above 0 in time) makes the singleton resilient to that churn.

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