// src/App.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import { initAuth, sessionExpired } from './store/slices/authSlice';
import { fetchSettings, resetSettingsState } from './features/settings/settingsSlice';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
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

interface MainAppProps {
  page: string;
  onNavigate: (page: string) => void;
}

const MainApp: React.FC<MainAppProps> = ({ page, onNavigate }) => {
  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={onNavigate} />;
      case 'projects':  return <ProjectsPage onNavigate={onNavigate} />;
      case 'editor':    return <EditorPage />;
      case 'ai':        return <AIPage />;
      case 'settings':  return <SettingsPage />;
      default:          return <Dashboard onNavigate={onNavigate} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <Sidebar activePage={page} onNavigate={onNavigate} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {renderPage()}
      </main>
    </div>
  );
};

// ── Root component ────────────────────────────────────────────────────────

type RouteName = 'landing' | 'auth' | 'dashboard' | 'projects' | 'editor' | 'ai' | 'settings';

const pagePaths: Record<string, string> = {
  dashboard: '/app',
  projects: '/projects',
  editor: '/editor',
  ai: '/ai',
  settings: '/settings',
};

const getRouteFromPath = (path: string): RouteName => {
  switch (path) {
    case '/':
      return 'landing';
    case '/auth':
      return 'auth';
    case '/app':
    case '/dashboard':
      return 'dashboard';
    case '/projects':
    case '/app/projects':
      return 'projects';
    case '/editor':
    case '/app/editor':
      return 'editor';
    case '/ai':
    case '/app/ai':
      return 'ai';
    case '/settings':
    case '/app/settings':
      return 'settings';
    default:
      return 'landing';
  }
};

const isProtectedRoute = (route: RouteName) => route !== 'landing' && route !== 'auth';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, initialized } = useAppSelector((s) => s.auth);
  const settings = useAppSelector((s) => s.settings.settings);
  const [path, setPath] = useState(window.location.pathname);
  const [postAuthPath, setPostAuthPath] = useState('/app');
  const route = getRouteFromPath(path);

  const navigate = useCallback((nextPath: string, replace = false) => {
    if (window.location.pathname !== nextPath) {
      if (replace) {
        window.history.replaceState({}, '', nextPath);
      } else {
        window.history.pushState({}, '', nextPath);
      }
    }
    setPath(nextPath);
  }, []);

  const handleAppNavigate = useCallback((page: string) => {
    navigate(pagePaths[page] ?? '/app');
  }, [navigate]);

  // On mount: restore session from stored token + /api/auth/me
  useEffect(() => {
    dispatch(initAuth());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchSettings());
    } else {
      dispatch(resetSettingsState());
    }
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.appearance.theme;
    document.documentElement.style.setProperty('--accent', settings.appearance.accentColor);
    document.documentElement.dataset.compact = settings.appearance.compactMode ? 'true' : 'false';
    document.documentElement.dataset.reduceMotion = settings.appearance.reduceMotion ? 'true' : 'false';
  }, [settings.appearance]);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global session-expiry listener set by api.ts interceptor
  useEffect(() => {
    const handle = () => dispatch(sessionExpired());
    window.addEventListener('auth:sessionExpired', handle);
    return () => window.removeEventListener('auth:sessionExpired', handle);
  }, [dispatch]);

  useEffect(() => {
    if (!initialized) return;

    if (isAuthenticated && route === 'auth') {
      navigate(postAuthPath, true);
      return;
    }

    if (!isAuthenticated && isProtectedRoute(route)) {
      setPostAuthPath(path);
      navigate('/auth', true);
    }
  }, [initialized, isAuthenticated, route, path, postAuthPath, navigate]);

  if (!initialized) return <AuthLoadingScreen />;

  if (route === 'landing') {
    return (
      <LandingPage
        isAuthenticated={isAuthenticated}
        onEnterApp={() => {
          setPostAuthPath('/app');
          navigate(isAuthenticated ? '/app' : '/auth');
        }}
        onOpenEditor={() => {
          setPostAuthPath('/editor');
          navigate(isAuthenticated ? '/editor' : '/auth');
        }}
        onShowAuth={() => {
          setPostAuthPath('/editor');
          navigate('/auth');
        }}
      />
    );
  }

  if (!isAuthenticated || route === 'auth') {
    return <LoginPage onBack={() => navigate('/')} />;
  }

  return (
    <MainApp
      page={route}
      onNavigate={handleAppNavigate}
    />
  );
};

export default App;
