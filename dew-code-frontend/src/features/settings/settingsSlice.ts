import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { settingsApi } from './settingsApi';
import { DEFAULT_SETTINGS, mergeSettings, SettingsUpdate, UserSettings } from './types';

interface SettingsState {
  settings: UserSettings;
  loading: boolean;
  saving: boolean;
  error: string | null;
  savedMessage: string | null;
}

const initialState: SettingsState = {
  settings: DEFAULT_SETTINGS,
  loading: false,
  saving: false,
  error: null,
  savedMessage: null,
};

export const fetchSettings = createAsyncThunk(
  'settings/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const resp = await settingsApi.getSettings();
      if (!resp.success || !resp.data) throw new Error(resp.message || 'Failed to load settings.');
      return resp.data.settings;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load settings.';
      return rejectWithValue(message);
    }
  }
);

export const saveSettings = createAsyncThunk(
  'settings/save',
  async (payload: SettingsUpdate, { rejectWithValue }) => {
    try {
      const resp = await settingsApi.updateSettings(payload);
      if (!resp.success || !resp.data) throw new Error(resp.message || 'Failed to save settings.');
      return resp.data.settings;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings.';
      return rejectWithValue(message);
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    applyLocalSettings(state, action: PayloadAction<SettingsUpdate>) {
      state.settings = mergeSettings(state.settings, action.payload);
    },
    clearSettingsMessage(state) {
      state.error = null;
      state.savedMessage = null;
    },
    resetSettingsState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = mergeSettings(DEFAULT_SETTINGS, action.payload);
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Failed to load settings.';
      })
      .addCase(saveSettings.pending, (state) => {
        state.saving = true;
        state.error = null;
        state.savedMessage = null;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.saving = false;
        state.settings = mergeSettings(DEFAULT_SETTINGS, action.payload);
        state.savedMessage = 'Settings saved.';
      })
      .addCase(saveSettings.rejected, (state, action) => {
        state.saving = false;
        state.error = (action.payload as string) ?? 'Failed to save settings.';
      });
  },
});

export const { applyLocalSettings, clearSettingsMessage, resetSettingsState } = settingsSlice.actions;
export default settingsSlice.reducer;
