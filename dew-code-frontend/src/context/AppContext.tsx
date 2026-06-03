// src/context/AppContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, setAccessToken } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────

export type UserRole = 'Admin' | 'Developer' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isEmailVerified: boolean;
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

export interface Project {
  id: string;
  name: string;
  description: string;
  language: string;
  lastModified: string;
  status: 'Active' | 'Inactive' | 'Archived';
  files: FileNode[];
}

interface AppContextType {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: string | null;

  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;

  // App state
  projects: Project[];
  setProjects: (p: Project[]) => void;
  activeProject: Project | null;
  setActiveProject: (p: Project | null) => void;
  openFiles: FileNode[];
  setOpenFiles: (f: FileNode[]) => void;
  activeFile: FileNode | null;
  setActiveFile: (f: FileNode | null) => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

// Demo projects (replace with API calls once backend project endpoints exist)
const DEMO_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'E-commerce Platform',
    description: 'Full-stack online store with payment integration',
    language: 'JavaScript',
    lastModified: '2024-01-20',
    status: 'Active',
    files: [
      { id: 'src', name: 'src', type: 'folder', path: 'src', children: [
        { id: 'app', name: 'App.js', type: 'file', path: 'src/App.js', language: 'javascript',
          content: `import React from 'react';\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;` },
      ]},
    ],
  },
  {
    id: '2',
    name: 'AI Chatbot',
    description: 'Intelligent conversational AI assistant',
    language: 'Python',
    lastModified: '2024-01-22',
    status: 'Active',
    files: [
      { id: 'main', name: 'main.py', type: 'file', path: 'main.py', language: 'python',
        content: `from fastapi import FastAPI\napp = FastAPI()\n\n@app.get("/")\ndef root():\n    return {"message": "Hello"}\n` },
    ],
  },
];

// ── Provider ──────────────────────────────────────────────────────────────

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // true on mount — check session
  const [authError, setAuthError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [openFiles, setOpenFiles] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<FileNode | null>(null);

  // ── On mount: try to restore session via /api/auth/me ─────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const resp = await authApi.getMe();
        if (resp.success && resp.data) {
          setUser(resp.data.user);
          if (resp.data.accessToken) setAccessToken(resp.data.accessToken);
        }
      } catch {
        // No active session — stay logged out
      } finally {
        setAuthLoading(false);
      }
    };
    restoreSession();
  }, []);

  // ── Listen for session expiry events from api.ts ───────────────────────
  useEffect(() => {
    const handleExpiry = () => {
      setUser(null);
      setAccessToken(null);
    };
    window.addEventListener('auth:sessionExpired', handleExpiry);
    return () => window.removeEventListener('auth:sessionExpired', handleExpiry);
  }, []);

  // ── Auth actions ───────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await authApi.login(email, password);
      if (resp.success && resp.data) {
        setAccessToken(resp.data.accessToken);
        setUser(resp.data.user);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      setAuthError(message);
      throw err; // allow page to show inline error
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string): Promise<void> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await authApi.register(name, email, password);
      if (resp.success && resp.data) {
        setAccessToken(resp.data.accessToken);
        setUser(resp.data.user);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      setAuthError(message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
      setActiveProject(null);
      setOpenFiles([]);
      setActiveFile(null);
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AppContext.Provider value={{
      user,
      isAuthenticated: !!user,
      authLoading,
      authError,
      login,
      register,
      logout,
      clearAuthError,
      projects,
      setProjects,
      activeProject,
      setActiveProject,
      openFiles,
      setOpenFiles,
      activeFile,
      setActiveFile,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);