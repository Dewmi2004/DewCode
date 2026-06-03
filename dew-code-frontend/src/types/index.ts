// src/types/index.ts

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Developer' | 'Viewer';
  avatar?: string;
  isEmailVerified: boolean;
  createdAt: string;
}

// Matches backend SafeProject
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

// Matches backend SafeFile
export interface ProjectFile {
  id: string;
  fileName: string;
  content: string;
  language: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

// Legacy FileNode kept for EditorPage/FileTree compatibility
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
