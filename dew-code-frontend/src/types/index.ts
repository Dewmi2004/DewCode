// ✅ UPDATED src/types/index.ts — added role helpers and RunOutput type

export type UserRole = 'Developer';
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
  teamId: string | null;
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

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  addedAt: string;
}

export interface Team {
  id: string;
  name: string;
  owner: { id: string; name: string; email: string };
  members: TeamMember[];
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

// Role helpers — kept for any code that still imports them, but with one
// role these are now trivially constant. Access tiers (teams, real-time
// collaboration) are gated by `plan`, not role — see PlanName above.
export const canWrite  = (_role?: UserRole) => true;
export const isAdmin   = (_role?: UserRole) => false;
export const isViewer  = (_role?: UserRole) => false;

export const ROLE_COLORS: Record<UserRole, string> = {
  Developer: '#00D4B8',
};
