// src/components/layout/Sidebar.tsx
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'projects',  label: 'Projects',  icon: '📁' },
  { id: 'editor',    label: 'Editor',    icon: '<>' },
  { id: 'ai',        label: 'AI Assistant', icon: '✦' },
  { id: 'settings',  label: 'Settings',  icon: '⚙' },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const { user, logout } = useApp();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <aside className="flex flex-col w-52 min-h-screen border-r" style={{ background: '#0D0D16', borderColor: '#1A1A26' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: '#1A1A26' }}>
        <h1 className="text-xl font-bold cursor-pointer" style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          onClick={() => onNavigate('dashboard')}>
          <span style={{ color: '#00D4B8' }}>Dew</span><span className="text-white">Code</span>
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {navItems.map(item => (
          <button key={item.id} onClick={() => onNavigate(item.id)}
            className={`sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-left ${activePage === item.id ? 'active' : 'text-gray-400'}`}>
            <span className="text-base w-5 text-center"
              style={item.id === 'editor' ? { fontFamily: 'monospace', fontSize: '12px', fontWeight: 700 } : {}}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="p-4 border-t" style={{ borderColor: '#1A1A26' }}>
        {user && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'rgba(0,212,184,0.2)', color: '#00D4B8', border: '1px solid rgba(0,212,184,0.3)' }}>
              {user.name[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-xs truncate" style={{ color: '#6B7280' }}>{user.role}</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout} disabled={loggingOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-left transition-all"
          style={{ color: '#6B7280' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent'; }}>
          {loggingOut ? '…' : '↩'} {loggingOut ? 'Signing out…' : 'Logout'}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;