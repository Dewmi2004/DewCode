// src/services/projectApi.ts
// All API calls for projects and files

import apiFetch from './api';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

// ── Project API ───────────────────────────────────────────────────────────

export const projectApi = {
  create: (payload: { name: string; description?: string; language?: string }) =>
    apiFetch<ApiResponse<{ project: unknown }>>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAll: () =>
    apiFetch<ApiResponse<{ projects: unknown[]; count: number }>>('/api/projects'),

  getById: (id: string) =>
    apiFetch<ApiResponse<{ project: unknown }>>(`/api/projects/${id}`),

  update: (id: string, data: Partial<{ name: string; description: string; language: string; status: string }>) =>
    apiFetch<ApiResponse<{ project: unknown }>>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse>(`/api/projects/${id}`, { method: 'DELETE' }),
};

// ── File API ──────────────────────────────────────────────────────────────

export const fileApi = {
  create: (payload: { fileName: string; content?: string; language?: string; projectId: string }) =>
    apiFetch<ApiResponse<{ file: unknown }>>('/api/files', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getByProject: (projectId: string) =>
    apiFetch<ApiResponse<{ files: unknown[]; count: number }>>(`/api/files/project/${projectId}`),

  getById: (id: string) =>
    apiFetch<ApiResponse<{ file: unknown }>>(`/api/files/single/${id}`),

  update: (id: string, data: Partial<{ fileName: string; content: string; language: string }>) =>
    apiFetch<ApiResponse<{ file: unknown }>>(`/api/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse>(`/api/files/${id}`, { method: 'DELETE' }),
};
