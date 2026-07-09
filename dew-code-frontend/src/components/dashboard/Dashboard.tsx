import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { fetchProjects, setActiveProject, type Project } from '../../store/slices/projectSlice';

interface Props {
  onNavigate: (page: string) => void;
}

const Dashboard: React.FC<Props> = ({ onNavigate }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { projects, loading } = useAppSelector((s) => s.projects);

  useEffect(() => {
    if (projects.length === 0) dispatch(fetchProjects());
  }, [dispatch, projects.length]);

  const activeCount = projects.filter((p) => p.status === 'Active').length;
  const recentProjects = [...projects].slice(0, 5);

  const handleOpenProject = (project: Project) => {
    dispatch(setActiveProject(project));
    onNavigate('editor');
  };

  const statCards = [
    { label: 'Total Projects', value: projects.length, icon: '📁', color: '#00D4B8' },
    { label: 'Active Projects', value: activeCount, icon: '⚡', color: '#8B5CF6' },
    { label: 'Archived', value: projects.filter((p) => p.status === 'Archived').length, icon: '🗄️', color: '#f59e0b' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: '#0A0A0F' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-white text-xl font-bold">
          Welcome back, {user?.name?.split(' ')[0] ?? 'Developer'} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here's what's happening with your projects.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: '#12121A', border: '1px solid #1E1E2E' }}
          >
            <span className="text-2xl">{card.icon}</span>
            <div>
              <p className="text-2xl font-bold" style={{ color: card.color }}>
                {loading ? '…' : card.value}
              </p>
              <p className="text-gray-500 text-xs">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent projects */}
      <div
        className="rounded-xl p-5"
        style={{ background: '#12121A', border: '1px solid #1E1E2E' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Recent Projects</h2>
          <button
            className="text-xs text-gray-400 hover:text-white transition-colors"
            onClick={() => onNavigate('projects')}
          >
            View all →
          </button>
        </div>

        {loading && (
          <p className="text-gray-500 text-sm py-4 text-center">Loading…</p>
        )}

        {!loading && recentProjects.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-3">No projects yet.</p>
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: '#00D4B8', color: '#000' }}
              onClick={() => onNavigate('projects')}
            >
              Create your first project
            </button>
          </div>
        )}

        <div className="space-y-2">
          {recentProjects.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => handleOpenProject(p)}
            >
              <span className="text-lg">📄</span>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">{p.name}</p>
                <p className="text-gray-500 text-xs truncate">{p.description || p.language}</p>
              </div>
              <span className="text-gray-600 text-xs shrink-0">
                {new Date(p.updatedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {[
          { label: 'New Project', icon: '➕', page: 'projects' },
          { label: 'Open Editor', icon: '💻', page: 'editor' },
          { label: 'AI Assistant', icon: '🤖', page: 'ai' },
          { label: 'Settings', icon: '⚙️', page: 'settings' },
        ].map((action) => (
          <button
            key={action.label}
            className="rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-white/5 transition-colors"
            style={{ background: '#12121A', border: '1px solid #1E1E2E' }}
            onClick={() => onNavigate(action.page)}
          >
            <span className="text-xl">{action.icon}</span>
            <span className="text-gray-400 text-xs">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
