// src/App.tsx
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import { initAuth, sessionExpired } from './store/slices/authSlice';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/dashboard/Dashboard';
import ProjectsPage from './components/projects/ProjectsPage';
import EditorPage from './components/editor/EditorPage';
import AIPage from './pages/AIPage';
import SettingsPage from './pages/SettingsPage';

// ── Auth loading splash ───────────────────────────────────────────────────

const AuthLoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0F' }}>
    <div className="text-center">
      <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        <span style={{ color: '#00D4B8' }}>Dew</span>
        <span className="text-white">Code</span>
      </h1>
      <div className="flex gap-1.5 justify-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full inline-block animate-bounce"
            style={{ background: '#00D4B8', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ── Main app shell ────────────────────────────────────────────────────────

const MainApp: React.FC = () => {
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={setPage} />;
      case 'projects':  return <ProjectsPage onNavigate={setPage} />;
      case 'editor':    return <EditorPage />;
      case 'ai':        return <AIPage />;
      case 'settings':  return <SettingsPage />;
      default:          return <Dashboard onNavigate={setPage} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <Sidebar activePage={page} onNavigate={setPage} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {renderPage()}
      </main>
    </div>
  );
};

// ── Root component ────────────────────────────────────────────────────────

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, initialized } = useAppSelector((s) => s.auth);

  // On mount: restore session from stored token + /api/auth/me
  useEffect(() => {
    dispatch(initAuth());
  }, [dispatch]);

  // Global session-expiry listener set by api.ts interceptor
  useEffect(() => {
    const handle = () => dispatch(sessionExpired());
    window.addEventListener('auth:sessionExpired', handle);
    return () => window.removeEventListener('auth:sessionExpired', handle);
  }, [dispatch]);

  if (!initialized) return <AuthLoadingScreen />;
  return isAuthenticated ? <MainApp /> : <LoginPage />;
};

export default App;
