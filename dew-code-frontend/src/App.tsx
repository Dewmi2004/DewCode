import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/dashboard/Dashboard';
import ProjectsPage from './components/projects/ProjectsPage';
import EditorPage from './components/editor/EditorPage';
import AIPage from './pages/AIPage';
import SettingsPage from './pages/SettingsPage';

const MainApp: React.FC = () => {
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={setPage} />;
      case 'projects': return <ProjectsPage onNavigate={setPage} />;
      case 'editor': return <EditorPage />;
      case 'ai': return <AIPage />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard onNavigate={setPage} />;
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

const App: React.FC = () => {
  const { isAuthenticated } = useApp();
  return isAuthenticated ? <MainApp /> : <LoginPage />;
};

export default App;
