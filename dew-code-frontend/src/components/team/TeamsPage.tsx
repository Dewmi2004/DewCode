// Admin-only "Groups" page: create a team (Plus plan required), add other
// registered users to it by email, and remove them. Any project assigned
// to a team becomes real-time collaborative for every member.

import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { fetchTeams, createTeam, addTeamMember, removeTeamMember, deleteTeam } from '../../store/slices/teamSlice';
import TopBar from '../layout/TopBar';
import UpgradeModal from '../billing/UpgradeModal';

const TeamsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { teams, loading, error } = useAppSelector((s) => s.teams);

  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({});
  const [memberError, setMemberError] = useState<Record<string, string>>({});

  useEffect(() => { dispatch(fetchTeams()); }, [dispatch]);

  // No role gate here — there's only one role (Developer) now. Creating a
  // team itself is still gated by the Plus plan (see the button below).

  const handleCreate = async () => {
    if (!newTeamName.trim()) return;
    setCreateLoading(true);
    try {
      await dispatch(createTeam(newTeamName.trim())).unwrap();
      setNewTeamName(''); setShowCreate(false);
    } catch (err: unknown) {
      const e = err as { upgrade?: boolean; message?: string };
      if (e?.upgrade) {
        setShowCreate(false);
        setUpgradeReason(e.message || 'Creating teams requires the Plus plan.');
        setShowUpgrade(true);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAddMember = async (teamId: string) => {
    const email = (memberEmail[teamId] || '').trim();
    if (!email) return;
    setMemberError((m) => ({ ...m, [teamId]: '' }));
    try {
      await dispatch(addTeamMember({ teamId, email })).unwrap();
      setMemberEmail((m) => ({ ...m, [teamId]: '' }));
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'Failed to add member.';
      setMemberError((m) => ({ ...m, [teamId]: message }));
    }
  };

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <TopBar />
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Teams</h2>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
              Add members to a team, then share a project with it for real-time collaboration.
            </p>
          </div>
          <button
            onClick={() => {
              if (user?.plan !== 'plus') {
                setUpgradeReason('Creating teams requires the Plus plan.');
                setShowUpgrade(true);
              } else {
                setShowCreate(true);
              }
            }}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90"
            style={{ background: '#00D4B8', color: '#0A0A0F' }}
          >
            {user?.plan === 'plus' ? '+ New Team' : '⚡ New Team (Plus)'}
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-lg mb-4">{error}</div>
        )}

        {showCreate && (
          <div className="rounded-xl p-4 mb-5 flex items-center gap-3" style={{ background: '#12121A', border: '1px solid #1E1E2E' }}>
            <input
              autoFocus
              className="flex-1 px-3 py-2 rounded-lg text-white text-sm outline-none"
              style={{ background: '#0A0A0F', border: '1px solid #2A2A3A' }}
              placeholder="Team name (e.g. Frontend Squad)"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button onClick={handleCreate} disabled={createLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: '#00D4B8', color: '#0A0A0F' }}>
              {createLoading ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-2 rounded-lg text-sm" style={{ color: '#6B7280' }}>
              Cancel
            </button>
          </div>
        )}

        {loading && teams.length === 0 && (
          <p className="text-sm text-center py-12" style={{ color: '#6B7280' }}>Loading teams…</p>
        )}

        {!loading && teams.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👥</div>
            <p className="font-medium" style={{ color: '#9CA3AF' }}>No teams yet.</p>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Create one, add members by email, then share a project with it.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {teams.map((team) => {
            const isOwner = team.owner.id === user?.id;
            return (
              <div key={team.id} className="rounded-xl p-5" style={{ background: '#12121A', border: '1px solid #1E1E2E' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">{team.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                      Owner: {isOwner ? 'You' : team.owner.name} · {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => window.confirm(`Delete "${team.name}"? Its shared projects become personal-only again.`) && dispatch(deleteTeam(team.id))}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ color: '#F87171' }}
                    >
                      🗑 Delete team
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {team.members.length === 0 && (
                    <span className="text-xs" style={{ color: '#4B5563' }}>No members yet.</span>
                  )}
                  {team.members.map((m) => (
                    <span key={m.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
                      style={{ background: '#1E1E2E', color: '#CBD5E1' }}>
                      {m.name} <span style={{ color: '#6B7280' }}>({m.email})</span>
                      {isOwner && (
                        <button onClick={() => dispatch(removeTeamMember({ teamId: team.id, memberId: m.id }))}
                          className="ml-0.5 hover:text-red-400" style={{ color: '#6B7280' }} title="Remove">✕</button>
                      )}
                    </span>
                  ))}
                </div>

                {isOwner && (
                  <div>
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 px-3 py-1.5 rounded-lg text-white text-xs outline-none"
                        style={{ background: '#0A0A0F', border: '1px solid #2A2A3A' }}
                        placeholder="teammate@email.com"
                        value={memberEmail[team.id] || ''}
                        onChange={(e) => setMemberEmail((m) => ({ ...m, [team.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddMember(team.id)}
                      />
                      <button onClick={() => handleAddMember(team.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(0,212,184,0.1)', color: '#00D4B8', border: '1px solid rgba(0,212,184,0.3)' }}>
                        Add member
                      </button>
                    </div>
                    {memberError[team.id] && (
                      <p className="text-xs mt-1.5" style={{ color: '#F87171' }}>{memberError[team.id]}</p>
                    )}
                    <p className="text-xs mt-1.5" style={{ color: '#4B5563' }}>
                      They must already have a DewCode account under this email.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} reason={upgradeReason} />}
    </div>
  );
};

export default TeamsPage;
