// ✅ UPDATED Sidebar.tsx
// Single-role app now (just "Developer") — nav items are no longer
// filtered by role. Plus-only features still show their own upgrade
// prompts inline (e.g. Teams page gates team creation by plan).

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { logoutUser } from '../../store/slices/authSlice';
import UpgradeModal from '../billing/UpgradeModal';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard',    icon: '⊞' },
  { id: 'projects',  label: 'Projects',     icon: '📁' },
  { id: 'editor',    label: 'Editor',       icon: '<>' },
  { id: 'ai',        label: 'AI Assistant', icon: '✦' },
  { id: 'teams',     label: 'Teams',        icon: '👥' },
  { id: 'settings',  label: 'Settings',     icon: '⚙' },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await dispatch(logoutUser()).unwrap(); }
    finally { setLoggingOut(false); }
  };

  return (
    <>
    <aside
      className="flex flex-col border-r transition-all duration-300"
      style={{
        background: '#0D0D16',
        borderColor: '#1A1A26',
        width: collapsed ? '56px' : '208px',
        minHeight: '100vh',
      }}
    >
      {/* Logo + collapse toggle */}
      <div className="px-3 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1A1A26' }}>
        {!collapsed && (
          <h1 className="text-xl font-bold cursor-pointer" style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            onClick={() => onNavigate('dashboard')}>
            <span style={{ color: '#00D4B8' }}>Dew</span>
            <span className="text-white">Code</span>
          </h1>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-white/5"
          style={{ color: '#6B7280', marginLeft: collapsed ? 'auto' : undefined }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-md text-sm text-left transition-all duration-200"
              style={{
                background: isActive ? 'rgba(0,212,184,0.08)' : 'transparent',
                color: isActive ? '#00D4B8' : '#9CA3AF',
                borderLeft: isActive ? '2px solid #00D4B8' : '2px solid transparent',
              }}
            >
              <span
                className="text-base w-5 text-center flex-shrink-0"
                style={item.id === 'editor' ? { fontFamily: 'monospace', fontSize: '12px', fontWeight: 700 } : {}}>
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="p-3 border-t" style={{ borderColor: '#1A1A26' }}>
        {user && !collapsed && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'rgba(0,212,184,0.15)', color: '#00D4B8', border: '1px solid rgba(0,212,184,0.3)' }}>
              {user.name[0].toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <span className="text-xs px-1.5 py-0.5 rounded-full inline-block mt-0.5"
                style={{
                  background: user.plan === 'plus' ? 'rgba(0,212,184,0.15)' : 'rgba(107,114,128,0.15)',
                  color: user.plan === 'plus' ? '#00D4B8' : '#9CA3AF',
                  border: `1px solid ${user.plan === 'plus' ? 'rgba(0,212,184,0.3)' : 'rgba(107,114,128,0.3)'}`,
                  fontSize: '9px', fontWeight: 600,
                }}>
                {user.plan === 'plus' ? '⚡ PLUS' : 'FREE'}
              </span>
            </div>
          </div>
        )}

        {user && user.plan !== 'plus' && !collapsed && (
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full mb-3 px-2 py-2 rounded-md text-xs font-semibold text-left transition-all flex items-center gap-2"
            style={{ background: 'rgba(0,212,184,0.1)', color: '#00D4B8', border: '1px solid rgba(0,212,184,0.3)' }}
          >
            ⚡ Upgrade to Plus
          </button>
        )}

        {user && user.plan !== 'plus' && collapsed && (
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full mb-3 flex justify-center"
            title="Upgrade to Plus"
            style={{ color: '#00D4B8' }}
          >
            ⚡
          </button>
        )}

        {user && collapsed && (
          <div className="flex justify-center mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: 'rgba(0,212,184,0.15)', color: '#00D4B8', border: '1px solid rgba(0,212,184,0.3)' }}>
              {user.name[0].toUpperCase()}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs text-left transition-all"
          style={{ color: '#6B7280' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent'; }}
          title={collapsed ? 'Logout' : undefined}
        >
          <span>{loggingOut ? '…' : '↩'}</span>
          {!collapsed && <span>{loggingOut ? 'Signing out…' : 'Logout'}</span>}
        </button>
      </div>
    </aside>
    {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </>
  );
};

export default Sidebar;
