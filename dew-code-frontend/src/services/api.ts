// src/services/api.ts
// Central Axios-like fetch wrapper with automatic JWT refresh

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let accessToken: string | null = null;
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

// Process queued requests after token refresh
const processQueue = (token: string | null): void => {
  refreshQueue.forEach((resolve) => resolve(token));
  refreshQueue = [];
};

// ── Core fetch wrapper ────────────────────────────────────────────────────
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // send/receive cookies (refresh token)
  });

  // Handle 401: try to refresh token once
  if (response.status === 401 && !endpoint.includes('/auth/')) {
    if (isRefreshing) {
      // Queue this request until refresh is done
      return new Promise((resolve, reject) => {
        refreshQueue.push((newToken) => {
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            fetch(url, { ...options, headers, credentials: 'include' })
              .then((r) => r.json())
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error('Session expired. Please sign in.'));
          }
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshResp = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!refreshResp.ok) throw new Error('Refresh failed');

      const refreshData = await refreshResp.json();
      const newToken: string = refreshData.data?.accessToken;
      setAccessToken(newToken);
      processQueue(newToken);

      // Retry original request with new token
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryResp = await fetch(url, { ...options, headers, credentials: 'include' });
      const data = await retryResp.json();
      if (!retryResp.ok) throw new Error(data.message || 'Request failed');
      return data as T;
    } catch {
      setAccessToken(null);
      processQueue(null);
      // Dispatch event so AppContext can clear user state
      window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
      throw new Error('Session expired. Please sign in.');
    } finally {
      isRefreshing = false;
    }
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

// ── Auth API calls ────────────────────────────────────────────────────────

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      name: string;
      email: string;
      role: 'Admin' | 'Developer' | 'Viewer';
      avatar?: string;
      isEmailVerified: boolean;
      createdAt: string;
    };
    accessToken: string;
  };
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiFetch<AuthResponse>('/api/auth/logout', { method: 'POST' }),

  logoutAll: () =>
    apiFetch<AuthResponse>('/api/auth/logout-all', { method: 'POST' }),

  getMe: () => apiFetch<AuthResponse>('/api/auth/me'),

  refresh: () =>
    apiFetch<AuthResponse>('/api/auth/refresh', { method: 'POST' }),
};

export default apiFetch;