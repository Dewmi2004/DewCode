// Lets the project owner attach/detach a team after the project already
// exists — the "share a project with it" step TeamsPage's own copy
// promised but never actually had anywhere to send you to. Once a team is
// set here, every member gets the real-time collaborative editor (see
// EditorPage's collaboration socket wiring) automatically — there's no
// separate "enable collaboration" toggle.

import React, { useState } from 'react';
import type { Project } from '../../store/slices/projectSlice';
import type { Team } from '../../types';

interface Props {
  project: Project;
  teams: Team[];
  onClose: () => void;
  onShare: (teamId: string | null) => Promise<void>;
}

const ShareProjectModal: React.FC<Props> = ({ project, teams, onClose, onShare }) => {
  const [teamId, setTeamId] = useState<string>(project.teamId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentTeam = teams.find((t) => t.id === project.teamId);
  const selectedTeam = teams.find((t) => t.id === teamId);
  const changed = (teamId || null) !== project.teamId;

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await onShare(teamId || null);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to update sharing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-xl p-6 w-full max-w-md" style={{ background: '#12121A', border: '1px solid #1E1E2E' }}>
        <h2 className="text-white text-lg font-semibold mb-1">Share “{project.name}”</h2>
        <p className="text-xs mb-4" style={{ color: '#6B7280' }}>
          Sharing with a team gives every member real-time collaborative editing — live cursors, instant
          sync, the works.
        </p>

        {error && (
          <p className="text-red-400 text-sm mb-3 bg-red-400/10 px-3 py-2 rounded">{error}</p>
        )}

        {teams.length === 0 ? (
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            You don’t have any teams yet. Head to the Teams page, create one and add members by email,
            then come back here to share this project with it.
          </p>
        ) : (
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Team</label>
            <select
              className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
              style={{ background: '#0A0A0F', border: '1px solid #1E1E2E' }}
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              autoFocus
            >
              <option value="">Personal project (just me)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>👥 {t.name} · {t.members.length + 1} people</option>
              ))}
            </select>

            {currentTeam && (
              <p className="text-xs mt-2" style={{ color: '#4B5563' }}>
                Currently shared with <strong style={{ color: '#9CA3AF' }}>{currentTeam.name}</strong>.
              </p>
            )}
            {!currentTeam && project.teamId === null && (
              <p className="text-xs mt-2" style={{ color: '#4B5563' }}>
                This project is currently personal — only you can see it.
              </p>
            )}
            {selectedTeam && changed && (
              <p className="text-xs mt-2" style={{ color: '#FBBF24' }}>
                {selectedTeam.members.length === 0
                  ? `${selectedTeam.name} has no members yet — add some from the Teams page so they can join.`
                  : `${selectedTeam.name}'s ${selectedTeam.members.length} member${selectedTeam.members.length === 1 ? '' : 's'} will get instant access to this project.`}
              </p>
            )}
            {!teamId && changed && (
              <p className="text-xs mt-2" style={{ color: '#FBBF24' }}>
                This will remove everyone else's access — the project becomes personal again.
              </p>
            )}
          </div>
        )}

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
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: '#00D4B8', color: '#000' }}
            onClick={handleSave}
            disabled={loading || teams.length === 0 || !changed}
          >
            {loading ? 'Saving…' : 'Save sharing'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareProjectModal;
