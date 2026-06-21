// src/components/projects/ProjectsPage.tsx
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  setActiveProject,
  type Project,
} from '../../store/slices/projectSlice';
import { fetchTeams } from '../../store/slices/teamSlice';
import type { Team } from '../../types';
import UpgradeModal from '../billing/UpgradeModal';
import ShareProjectModal from './ShareProjectModal';

interface Props {
  onNavigate: (page: string) => void;
}

const LANGUAGES = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'C#', 'PHP', 'Ruby'];

const statusColor: Record<string, string> = {
  Active: '#00D4B8',
  Inactive: '#f59e0b',
  Archived: '#6b7280',
};

// ── Create project modal ──────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; language: string; teamId: string | null }) => Promise<void>;
  loading: boolean;
  teams: Team[];
}

const CreateProjectModal: React.FC<CreateModalProps> = ({ onClose, onSubmit, loading, teams }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('JavaScript');
  const [teamId, setTeamId] = useState<string>('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Project name is required.'); return; }
    setError('');
    await onSubmit({ name, description, language, teamId: teamId || null });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="rounded-xl p-6 w-full max-w-md"
        style={{ background: '#12121A', border: '1px solid #1E1E2E' }}
      >
        <h2 className="text-white text-lg font-semibold mb-4">New Project</h2>

        {error && (
          <p className="text-red-400 text-sm mb-3 bg-red-400/10 px-3 py-2 rounded">{error}</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Project Name *</label>
            <input
              className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
              style={{ background: '#0A0A0F', border: '1px solid #1E1E2E' }}
              placeholder="My awesome project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Description</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none resize-none"
              style={{ background: '#0A0A0F', border: '1px solid #1E1E2E' }}
              placeholder="What does this project do?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Language</label>
            <select
              className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
              style={{ background: '#0A0A0F', border: '1px solid #1E1E2E' }}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>

          {teams.length > 0 && (
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Share with team (optional)</label>
              <select
                className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                style={{ background: '#0A0A0F', border: '1px solid #1E1E2E' }}
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">Personal project (just me)</option>
                {teams.map((t) => <option key={t.id} value={t.id}>👥 {t.name}</option>)}
              </select>
              <p className="text-xs mt-1" style={{ color: '#4B5563' }}>
                Team projects get real-time collaborative editing for every member.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button
            className="flex-1 py-2 rounded-lg text-gray-400 text-sm font-medium"
            style={{ background: '#1E1E2E' }}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ background: '#00D4B8', color: '#000' }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Project card ──────────────────────────────────────────────────────────

interface CardProps {
  project: Project;
  isOwner: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onShare: () => void;
}

const ProjectCard: React.FC<CardProps> = ({ project, isOwner, onOpen, onDelete, onShare }) => (
  <div
    className="rounded-xl p-4 flex flex-col gap-3 cursor-pointer group transition-all"
    style={{ background: '#12121A', border: '1px solid #1E1E2E' }}
    onClick={onOpen}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="text-white font-semibold truncate">{project.name}</h3>
          {project.teamId && (
            <span className="text-xs flex-shrink-0" title="Shared with a team — real-time collaborative">👥</span>
          )}
        </div>
        <p className="text-gray-500 text-xs mt-0.5 truncate">{project.description || 'No description'}</p>
      </div>
      <span
        className="text-xs px-2 py-0.5 rounded-full shrink-0"
        style={{ color: statusColor[project.status], background: `${statusColor[project.status]}18` }}
      >
        {project.status}
      </span>
    </div>

    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span
        className="px-2 py-0.5 rounded"
        style={{ background: '#1E1E2E', color: '#00D4B8' }}
      >
        {project.language}
      </span>
      <span className="ml-auto">
        {new Date(project.updatedAt).toLocaleDateString()}
      </span>
    </div>

    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
      {isOwner && (
        <button
          className="text-xs text-left hover:opacity-80"
          style={{ color: '#00D4B8' }}
          onClick={(e) => { e.stopPropagation(); onShare(); }}
        >
          👥 {project.teamId ? 'Manage sharing' : 'Share with team'}
        </button>
      )}
      <button
        className="text-xs text-red-400 text-left hover:text-red-300"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        Delete project
      </button>
    </div>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────

const ProjectsPage: React.FC<Props> = ({ onNavigate }) => {
  const dispatch = useAppDispatch();
  const { projects, loading, error, maxProjects } = useAppSelector((s) => s.projects);
  const { teams } = useAppSelector((s) => s.teams);
  const user = useAppSelector((s) => s.auth.user);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [shareTarget, setShareTarget] = useState<Project | null>(null);

  useEffect(() => {
    dispatch(fetchProjects());
    dispatch(fetchTeams());
  }, [dispatch]);

  const atLimit = maxProjects !== null && projects.length >= maxProjects;

  const handleCreate = async (data: { name: string; description: string; language: string; teamId: string | null }) => {
    setCreateLoading(true);
    try {
      await dispatch(createProject(data)).unwrap();
      setShowCreate(false);
    } catch (err: unknown) {
      const upgrade = (err as { upgrade?: boolean })?.upgrade;
      const message = (err as { message?: string })?.message;
      if (upgrade) {
        setShowCreate(false);
        setUpgradeReason(message || 'You\u2019ve reached the Free plan project limit.');
        setShowUpgrade(true);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this project and all its files?')) {
      dispatch(deleteProject(id));
    }
  };

  const handleShare = async (teamId: string | null) => {
    if (!shareTarget) return;
    await dispatch(updateProject({ id: shareTarget.id, data: { teamId } })).unwrap();
  };

  const handleOpen = (project: Project) => {
    dispatch(setActiveProject(project));
    onNavigate('editor');
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: '#0A0A0F' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold">Projects</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
            {maxProjects !== null && <span> · {projects.length}/{maxProjects} on Free plan</span>}
          </p>
        </div>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: '#00D4B8', color: '#000' }}
          onClick={() => {
            if (atLimit) {
              setUpgradeReason(`Free plan is limited to ${maxProjects} projects.`);
              setShowUpgrade(true);
            } else {
              setShowCreate(true);
            }
          }}
        >
          {atLimit ? '⚡ Upgrade for more' : '+ New Project'}
        </button>
      </div>

      {/* Search */}
      <input
        className="w-full px-4 py-2 rounded-lg text-white text-sm outline-none mb-5"
        style={{ background: '#12121A', border: '1px solid #1E1E2E' }}
        placeholder="Search projects…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Error */}
      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {/* Loading */}
      {loading && projects.length === 0 && (
        <div className="text-gray-500 text-sm text-center py-12">Loading projects…</div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📁</div>
          <p className="text-gray-400 font-medium">
            {search ? 'No projects match your search.' : 'No projects yet.'}
          </p>
          {!search && (
            <button
              className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: '#00D4B8', color: '#000' }}
              onClick={() => setShowCreate(true)}
            >
              Create your first project
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            isOwner={p.owner === user?.id}
            onOpen={() => handleOpen(p)}
            onDelete={() => handleDelete(p.id)}
            onShare={() => setShareTarget(p)}
          />
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          loading={createLoading}
          teams={teams}
        />
      )}

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} reason={upgradeReason} />}

      {shareTarget && (
        <ShareProjectModal
          project={shareTarget}
          teams={teams}
          onClose={() => setShareTarget(null)}
          onShare={handleShare}
        />
      )}
    </div>
  );
};

export default ProjectsPage;
