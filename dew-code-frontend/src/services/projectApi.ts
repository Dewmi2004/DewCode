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
  create: (payload: { name: string; description?: string; language?: string; teamId?: string | null }) =>
    apiFetch<ApiResponse<{ project: unknown }>>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAll: () =>
    apiFetch<ApiResponse<{ projects: unknown[]; count: number }>>('/api/projects'),

  getById: (id: string) =>
    apiFetch<ApiResponse<{ project: unknown }>>(`/api/projects/${id}`),

  update: (id: string, data: Partial<{ name: string; description: string; language: string; status: string; teamId: string | null }>) =>
    apiFetch<ApiResponse<{ project: unknown }>>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse>(`/api/projects/${id}`, { method: 'DELETE' }),
};

// ── File API ──────────────────────────────────────────────────────────────

export const fileApi = {
  create: (payload: { fileName: string; content?: string; language?: string; projectId: string; folderId?: string | null }) =>
    apiFetch<ApiResponse<{ file: unknown }>>('/api/files', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getByProject: (projectId: string) =>
    apiFetch<ApiResponse<{ files: unknown[]; count: number }>>(`/api/files/project/${projectId}`),

  getById: (id: string) =>
    apiFetch<ApiResponse<{ file: unknown }>>(`/api/files/${id}`),

  update: (id: string, data: Partial<{ fileName: string; content: string; language: string; folderId: string | null }>) =>
    apiFetch<ApiResponse<{ file: unknown }>>(`/api/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse>(`/api/files/${id}`, { method: 'DELETE' }),
};

// ── Folder API ────────────────────────────────────────────────────────────

export const folderApi = {
  create: (payload: { name: string; projectId: string; parentId?: string | null }) =>
    apiFetch<ApiResponse<{ folder: unknown }>>('/api/folders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getByProject: (projectId: string) =>
    apiFetch<ApiResponse<{ folders: unknown[]; count: number }>>(`/api/folders/project/${projectId}`),

  rename: (id: string, name: string) =>
    apiFetch<ApiResponse<{ folder: unknown }>>(`/api/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse>(`/api/folders/${id}`, { method: 'DELETE' }),
};
