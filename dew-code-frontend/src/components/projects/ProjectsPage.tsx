import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Project } from '../../types';
import TopBar from '../layout/TopBar';

const LANG_COLORS: Record<string, string> = {
  JavaScript: '#F7DF1E',
  TypeScript: '#3178C6',
  Python: '#3776AB',
  React: '#61DAFB',
  default: '#00D4B8',
};

const ProjectsPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { projects, setProjects, setActiveProject } = useApp();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', language: 'JavaScript' });

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.name.trim()) return;
    const newProj: Project = {
      id: Date.now().toString(),
      name: form.name,
      description: form.description,
      language: form.language,
      lastModified: new Date().toISOString().split('T')[0],
      status: 'Active',
      files: [],
    };
    setProjects([...projects, newProj]);
    setForm({ name: '', description: '', language: 'JavaScript' });
    setShowModal(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjects(projects.filter(p => p.id !== id));
  };

  const openProject = (p: Project) => {
    setActiveProject(p);
    onNavigate('editor');
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: '#0A0A0F' }}>
      <TopBar extra={
        <button className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5" onClick={() => setShowModal(true)}>
          + New Project
        </button>
      } />

      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-end justify-between mb-6 animate-fade-in">
          <div>
            <h2 className="text-xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Projects</h2>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage your development projects</p>
          </div>
        </div>

        {/* Search + view toggle */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#6B7280' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-8 pr-4 py-2 text-sm rounded-md outline-none"
              style={{ background: '#12121A', border: '1px solid #22222F', color: '#E2E8F0' }}
              onFocus={e => e.target.style.borderColor = '#00D4B8'}
              onBlur={e => e.target.style.borderColor = '#22222F'}
            />
          </div>
          <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid #22222F' }}>
            {(['grid', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-2 text-xs transition-all"
                style={{ background: view === v ? '#00D4B8' : '#12121A', color: view === v ? '#0A0A0F' : '#6B7280' }}>
                {v === 'grid' ? '⊞' : '≡'}
              </button>
            ))}
          </div>
        </div>

        {/* Projects */}
        <div className={`${view === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-3'} animate-fade-in`}>
          {filtered.map(p => (
            <div key={p.id} className="card p-5 cursor-pointer group" onClick={() => openProject(p)}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors">{p.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.2)' }}>
                  {p.status}
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: '#6B7280' }}>{p.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: LANG_COLORS[p.language] || LANG_COLORS.default }} />
                  <span className="text-xs" style={{ color: '#9CA3AF' }}>{p.language}</span>
                  <span className="text-xs" style={{ color: '#6B7280' }}>{p.lastModified}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(p.id, e)}
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: '#F87171' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  title="Delete">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16" style={{ color: '#6B7280' }}>
            <p className="text-4xl mb-3">📁</p>
            <p className="text-sm">No projects found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-96 p-6 rounded-lg animate-fade-in" style={{ background: '#12121A', border: '1px solid #2A2A3A' }}>
            <h3 className="text-base font-semibold text-white mb-4">New Project</h3>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Project name"
                className="w-full px-3 py-2 text-sm rounded-md outline-none"
                style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }} />
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Description"
                className="w-full px-3 py-2 text-sm rounded-md outline-none"
                style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }} />
              <select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-md outline-none"
                style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }}>
                {['JavaScript', 'TypeScript', 'Python', 'React', 'Java', 'Go', 'Rust'].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn-primary flex-1 py-2 text-sm" onClick={handleCreate}>Create</button>
              <button className="flex-1 py-2 text-sm rounded-md" style={{ background: '#1A1A26', color: '#9CA3AF', border: '1px solid #2A2A3A' }}
                onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
