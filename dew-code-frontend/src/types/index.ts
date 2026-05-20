export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Developer' | 'Viewer';
  avatar?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  language: string;
  lastModified: string;
  status: 'Active' | 'Inactive' | 'Archived';
  files: FileNode[];
  collaborators?: User[];
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

export interface Commit {
  day: string;
  commits: number;
}

export interface UsageTrend {
  month: string;
  value: number;
}
