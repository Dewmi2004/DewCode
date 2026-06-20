// ✅ UPDATED src/types/index.ts — added role helpers and RunOutput type

export type UserRole = 'Admin' | 'Developer' | 'Viewer';
export type PlanName = 'free' | 'plus';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isEmailVerified: boolean;
  plan: PlanName;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner: string;
  language: string;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: string;
  fileName: string;
  content: string;
  language: string;
  projectId: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFolder {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  language?: string;
  children?: FileNode[];
  path: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Stats {
  totalProjects: number;
  activeSessions: number;
  codeLines: number;
  hoursCoded: number;
}

export interface RunOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
}

// Code Correction & Suggestion types
export interface CodeIssue {
  type: 'error' | 'warning' | 'suggestion';
  line?: number;
  column?: number;
  message: string;
  fix?: string;
}

export interface CodeCorrection {
  issues: CodeIssue[];
  correctedCode: string;
  explanation: string;
}

export interface CodeSuggestion {
  text: string;
  description: string;
}

// Role helpers
export const canWrite  = (role?: UserRole) => role === 'Admin' || role === 'Developer';
export const isAdmin   = (role?: UserRole) => role === 'Admin';
export const isViewer  = (role?: UserRole) => role === 'Viewer';

export const ROLE_COLORS: Record<UserRole, string> = {
  Admin: '#F87171',
  Developer: '#00D4B8',
  Viewer: '#FBBF24',
};
