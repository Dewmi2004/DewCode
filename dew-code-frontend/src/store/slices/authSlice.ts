import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi, setAccessToken } from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Developer' | 'Viewer';
  avatar?: string;
  isEmailVerified: boolean;
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

// ── Persist token in localStorage ────────────────────────────────────────

const TOKEN_KEY = 'dewcode_access_token';

const persistToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

// ── Async thunks ─────────────────────────────────────────────────────────

export const initAuth = createAsyncThunk(
  'auth/init',
  async (_, { rejectWithValue }) => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) setAccessToken(storedToken);
      const resp = await authApi.getMe();
      if (!resp.success || !resp.data) throw new Error('No session');
      return { user: resp.data.user, token: resp.data.accessToken ?? storedToken };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Session restore failed.';
      return rejectWithValue(message);
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (
    { email, password }: { email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const resp = await authApi.login(email, password);
      if (!resp.success || !resp.data) throw new Error(resp.message || 'Login failed.');
      return { user: resp.data.user, token: resp.data.accessToken };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      return rejectWithValue(message);
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (
    { name, email, password }: { name: string; email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const resp = await authApi.register(name, email, password);
      if (!resp.success || !resp.data) throw new Error(resp.message || 'Registration failed.');
      return { user: resp.data.user, token: resp.data.accessToken };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      return rejectWithValue(message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.logout();
    } catch {
      // logout failure is non-fatal — clear local state regardless
    } finally {
      setAccessToken(null);
      persistToken(null);
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null,
    initialized: false,
  } as AuthState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    sessionExpired(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      persistToken(null);
    },
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
      persistToken(action.payload);
      setAccessToken(action.payload);
    },
  },
  extraReducers: (builder) => {
    // ── initAuth ──────────────────────────────────────────────────────────
    builder
      .addCase(initAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(initAuth.fulfilled, (state, action) => {
        state.user = action.payload.user as AuthUser;
        state.token = action.payload.token ?? null;
        state.isAuthenticated = true;
        state.loading = false;
        state.initialized = true;
        if (action.payload.token) {
          persistToken(action.payload.token);
          setAccessToken(action.payload.token);
        }
      })
      .addCase(initAuth.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.initialized = true;
        persistToken(null);
      });

    // ── loginUser ─────────────────────────────────────────────────────────
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload.user as AuthUser;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.loading = false;
        state.error = null;
        persistToken(action.payload.token);
        setAccessToken(action.payload.token);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Login failed.';
      });

    // ── registerUser ──────────────────────────────────────────────────────
    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.user = action.payload.user as AuthUser;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.loading = false;
        state.error = null;
        persistToken(action.payload.token);
        setAccessToken(action.payload.token);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Registration failed.';
      });

    // ── logoutUser ────────────────────────────────────────────────────────
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
    });
  },
});

export const { clearError, sessionExpired, setToken } = authSlice.actions;
export default authSlice.reducer;