// ✅ NEW FILE: src/controllers/team.controller.ts
// Group management — any Admin or Developer can create one (Plus plan
// required), Viewers cannot.
// Once a team exists, any member — regardless of their own personal plan —
// gets real-time collaborative access to projects shared with that team.

import { Request, Response, NextFunction } from 'express';
import Team from '../models/Team';
import Project from '../models/Project';
import User from '../models/User';
import { sendSuccess, sendError } from '../utils/response';

// Populates owner/members with name+email instead of raw user toSafeObject,
// since Team has no notion of "the requesting user" to redact against.
const toTeamResponse = async (teamDoc: InstanceType<typeof Team>) => {
  const team = await Team.findById(teamDoc._id)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');

  const t = team as unknown as {
    _id: { toString(): string };
    name: string;
    owner: { _id: { toString(): string }; name: string; email: string };
    members: { user: { _id: { toString(): string }; name: string; email: string }; addedAt: Date }[];
    createdAt: Date;
    updatedAt: Date;
  };

  return {
    id: t._id.toString(),
    name: t.name,
    owner: { id: t.owner._id.toString(), name: t.owner.name, email: t.owner.email },
    members: t.members.map((m) => ({
      id: m.user._id.toString(),
      name: m.user.name,
      email: m.user.email,
      addedAt: m.addedAt,
    })),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
};

export const createTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name?.trim()) { sendError(res, 'Team name is required.', 400); return; }

    const team = await Team.create({ name: name.trim(), owner: req.user!._id, members: [] });
    sendSuccess(res, 'Team created.', { team: await toTeamResponse(team) }, 201);
  } catch (error) { next(error); }
};

export const getMyTeams = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id;
    const teams = await Team.find({ $or: [{ owner: userId }, { 'members.user': userId }] }).sort({ createdAt: -1 });
    sendSuccess(res, 'Teams fetched.', { teams: await Promise.all(teams.map(toTeamResponse)) });
  } catch (error) { next(error); }
};

export const getTeamById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const team = await Team.findOne({
      _id: req.params.id,
      $or: [{ owner: userId }, { 'members.user': userId }],
    });
    if (!team) { sendError(res, 'Team not found.', 404); return; }
    sendSuccess(res, 'Team fetched.', { team: await toTeamResponse(team) });
  } catch (error) { next(error); }
};

export const addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email?.trim()) { sendError(res, 'Member email is required.', 400); return; }

    const team = await Team.findOne({ _id: req.params.id, owner: req.user!._id });
    if (!team) { sendError(res, 'Team not found or you are not its owner.', 404); return; }

    const member = await User.findOne({ email: email.trim().toLowerCase() });
    if (!member) { sendError(res, 'No DewCode user found with that email.', 404); return; }

    if (member._id.toString() === team.owner.toString()) {
      sendError(res, 'You already own this team.', 400); return;
    }
    if (team.members.some((m) => m.user.toString() === member._id.toString())) {
      sendError(res, 'That user is already a member of this team.', 409); return;
    }

    team.members.push({ user: member._id, addedAt: new Date() });
    await team.save();
    sendSuccess(res, 'Member added.', { team: await toTeamResponse(team) });
  } catch (error) { next(error); }
};

export const removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const team = await Team.findOne({ _id: req.params.id, owner: req.user!._id });
    if (!team) { sendError(res, 'Team not found or you are not its owner.', 404); return; }

    team.members = team.members.filter((m) => m.user.toString() !== req.params.memberId);
    await team.save();
    sendSuccess(res, 'Member removed.', { team: await toTeamResponse(team) });
  } catch (error) { next(error); }
};

export const deleteTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const team = await Team.findOneAndDelete({ _id: req.params.id, owner: req.user!._id });
    if (!team) { sendError(res, 'Team not found or you are not its owner.', 404); return; }

    // Unshare any projects that pointed at this team — they become
    // personal-only again rather than left dangling on a deleted team.
    await Project.updateMany({ teamId: team._id }, { teamId: null });
    sendSuccess(res, 'Team deleted.');
  } catch (error) { next(error); }
};
