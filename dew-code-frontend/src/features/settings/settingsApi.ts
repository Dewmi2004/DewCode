import apiFetch, { authApi } from '../../services/api';
import { SettingsUpdate, UserSettings } from './types';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

interface ProfilePayload {
  name: string;
  email: string;
  avatar?: string;
}

export const settingsApi = {
  getSettings: () =>
    apiFetch<ApiResponse<{ settings: UserSettings }>>('/api/users/settings'),

  updateSettings: (settings: SettingsUpdate) =>
    apiFetch<ApiResponse<{ settings: UserSettings }>>('/api/users/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  updateProfile: (profile: ProfilePayload) =>
    apiFetch<ApiResponse>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<ApiResponse>('/api/users/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  logoutAllSessions: () => authApi.logoutAll(),
};
