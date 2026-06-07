// ✅ UPDATED Sidebar.tsx
// Changes: Role badge per user, Admin-only nav items, collapse toggle, better UI

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { logoutUser } from '../../store/slices/authSlice';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const allNavItems = [
  { id: 'dashboard', label: 'Dashboard',    icon: '⊞',  roles: ['Admin','Developer','Viewer'] },
  { id: 'projects',  label: 'Projects',     icon: '📁',  roles: ['Admin','Developer','Viewer'] },
  { id: 'editor',    label: 'Editor',       icon: '<>',  roles: ['Admin','Developer','Viewer'] },
  { id: 'ai',        label: 'AI Assistant', icon: '✦',   roles: ['Admin','Developer','Viewer'] },
  { id: 'settings',  label: 'Settings',     icon: '⚙',   roles: ['Admin','Developer'] },
];

const ROLE_COLORS: Record<string, string> = {
  Admin: '#F87171',
  Developer: '#00D4B8',
  Viewer: '#FBBF24',
};

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const role = user?.role ?? 'Viewer';
  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await dispatch(logoutUser()).unwrap(); }
    finally { setLoggingOut(false); }
  };

  return (
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
              style={{ background: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}40` }}>
              {user.name[0].toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: `${ROLE_COLORS[role]}15`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}30`, fontSize: '9px', fontWeight: 600 }}>
                  {role.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}

        {user && collapsed && (
          <div className="flex justify-center mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}40` }}>
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
  );
};

export default Sidebar;
