// ✅ NEW FILE: src/services/teamApi.ts

import apiFetch from './api';
import type { Team } from '../types';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export const teamApi = {
  getMine: () =>
    apiFetch<ApiResponse<{ teams: Team[] }>>('/api/teams'),

  getById: (id: string) =>
    apiFetch<ApiResponse<{ team: Team }>>(`/api/teams/${id}`),

  create: (name: string) =>
    apiFetch<ApiResponse<{ team: Team }>>('/api/teams', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  addMember: (teamId: string, email: string) =>
    apiFetch<ApiResponse<{ team: Team }>>(`/api/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  removeMember: (teamId: string, memberId: string) =>
    apiFetch<ApiResponse<{ team: Team }>>(`/api/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
    }),

  delete: (teamId: string) =>
    apiFetch<ApiResponse>(`/api/teams/${teamId}`, { method: 'DELETE' }),
};
