import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface TopBarProps {
  title?: string;
  extra?: React.ReactNode;
}

const TopBar: React.FC<TopBarProps> = ({ title, extra }) => {
  const { user } = useApp();
  const [search, setSearch] = useState('');

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b" style={{ background: '#0D0D16', borderColor: '#1A1A26', minHeight: '52px' }}>
      <div className="flex items-center gap-4">
        <button className="text-gray-500 hover:text-gray-300 transition-colors">☰</button>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#6B7280' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects, files..."
            className="pl-8 pr-4 py-1.5 text-xs rounded-md outline-none w-64"
            style={{ background: '#12121A', border: '1px solid #22222F', color: '#E2E8F0' }}
            onFocus={e => e.target.style.borderColor = '#00D4B8'}
            onBlur={e => e.target.style.borderColor = '#22222F'}
          />
        </div>
        {title && <span className="text-sm font-medium" style={{ color: '#9CA3AF' }}>{title}</span>}
      </div>

      <div className="flex items-center gap-3">
        {extra}
        {/* Collaborator avatars */}
        <div className="flex -space-x-2">
          {['A', 'B', 'C'].map((l, i) => (
            <div key={i} className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold"
              style={{ borderColor: '#0D0D16', background: i === 0 ? '#00D4B8' : i === 1 ? '#6366F1' : '#F59E0B', color: '#0A0A0F' }}>
              {l}
            </div>
          ))}
        </div>
        <button className="relative p-1.5 rounded-md transition-colors hover:bg-gray-800">
          <span style={{ color: '#6B7280' }}>🔔</span>
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: '#F87171' }} />
        </button>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'rgba(0,212,184,0.2)', color: '#00D4B8', border: '1px solid rgba(0,212,184,0.3)' }}>
          {user?.name[0].toUpperCase()}
        </div>
        <span className="text-xs" style={{ color: '#9CA3AF' }}>{user?.name}</span>
      </div>
    </header>
  );
};

export default TopBar;
