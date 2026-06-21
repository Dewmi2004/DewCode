// ✅ NEW FILE: src/utils/projectAccess.ts
// Single definition of "can this user touch this project" used by the
// project/file/folder controllers AND the collaboration socket server, so
// access rules can't drift between REST and WebSocket paths.

import Project, { IProject } from '../models/Project';
import Team from '../models/Team';

// Returns the project if the user owns it OR is a member (or owner) of the
// team it's shared with — otherwise null.
export const findAccessibleProject = async (
  projectId: string,
  userId: string
): Promise<IProject | null> => {
  const project = await Project.findById(projectId);
  if (!project) return null;

  if (project.owner.toString() === userId) return project;

  if (project.teamId) {
    const team = await Team.findOne({
      _id: project.teamId,
      $or: [{ owner: userId }, { 'members.user': userId }],
    });
    if (team) return project;
  }

  return null;
};

// Mongo filter for "every project this user can see" — their own projects
// plus any project shared with a team they belong to.
export const getAccessibleProjectFilter = async (userId: string) => {
  const teams = await Team.find({ $or: [{ owner: userId }, { 'members.user': userId }] }).select('_id');
  const teamIds = teams.map((t) => t._id);
  return { $or: [{ owner: userId }, { teamId: { $in: teamIds } }] };
};

// Is this user the owner or a member of the given team?
export const isTeamMember = async (teamId: string, userId: string): Promise<boolean> => {
  const team = await Team.findOne({ _id: teamId, $or: [{ owner: userId }, { 'members.user': userId }] });
  return !!team;
};
