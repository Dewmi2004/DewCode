// ✅ UPDATED src/features/settings/settingsSlice.ts
// New exports: updateEditorSettings, updateAISettings helpers

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiFetch from '../../services/api';
import { UserSettings, DEFAULT_SETTINGS } from './types';

interface SettingsState {
  settings: UserSettings;
  loading: boolean;
  error: string | null;
  saved: boolean;
}

const initialState: SettingsState = {
  settings: DEFAULT_SETTINGS,
  loading: false,
  error: null,
  saved: false,
};

export const fetchSettings = createAsyncThunk('settings/fetch', async () => {
  const res = await apiFetch<{ success: boolean; data: { user: { settings: UserSettings } } }>('/api/auth/me');
  return res.data.user.settings;
});

export const updateSettings = createAsyncThunk(
  'settings/update',
  async (partial: Partial<UserSettings>, { getState }) => {
    const state = getState() as { settings: SettingsState };
    const merged = deepMerge(state.settings.settings, partial);
    await apiFetch('/api/users/settings', {
      method: 'PATCH',
      body: JSON.stringify({ settings: merged }),
    });
    return merged;
  }
);

// Deep merge helper
function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key in override) {
    const val = override[key as keyof T];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      (result as Record<string, unknown>)[key] = deepMerge(
        (base as Record<string, unknown>)[key] as object ?? {},
        val as object
      );
    } else if (val !== undefined) {
      (result as Record<string, unknown>)[key] = val;
    }
  }
  return result;
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    resetSettingsState: (state) => {
      state.settings = DEFAULT_SETTINGS;
      state.loading = false;
      state.error = null;
      state.saved = false;
    },
    // Local-only slice updates (don't persist until Save is clicked)
    updateEditorSettings: (state, action: PayloadAction<Partial<UserSettings['editor']>>) => {
      state.settings.editor = { ...state.settings.editor, ...action.payload };
    },
    updateAISettings: (state, action: PayloadAction<{ model?: string }>) => {
      // AI settings stored under editor for now (extend UserSettings as needed)
      if (action.payload.model) {
        (state.settings as Record<string, unknown>)['aiModel'] = action.payload.model;
      }
    },
    updateAppearance: (state, action: PayloadAction<Partial<UserSettings['appearance']>>) => {
      state.settings.appearance = { ...state.settings.appearance, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.settings = deepMerge(DEFAULT_SETTINGS, action.payload ?? {});
      })
      .addCase(updateSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.saved = false;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload;
        state.saved = true;
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to save settings';
      });
  },
});

export const { resetSettingsState, updateEditorSettings, updateAISettings, updateAppearance } = settingsSlice.actions;
export default settingsSlice.reducer;
