import { Request, Response, NextFunction } from 'express';
import Project from '../models/Project';
import File from '../models/File';
import Folder from '../models/Folder';
import { getPlanLimits } from '../config/plans';
import { findAccessibleProject, getAccessibleProjectFilter, isTeamMember } from '../utils/projectAccess';
import { sendSuccess, sendError } from '../utils/response';

export const createProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, language, teamId } = req.body;
    if (!name?.trim()) { sendError(res, 'Project name is required.', 400); return; }

    if (teamId) {
      const allowed = await isTeamMember(teamId, req.user!._id.toString());
      if (!allowed) { sendError(res, 'You are not a member of that team.', 403); return; }
    }

    const project = await Project.create({
      name: name.trim(),
      description: description?.trim() ?? '',
      language: language?.trim() || 'JavaScript',
      owner: req.user!._id,
      teamId: teamId || null,
      status: 'Active',
    });

    sendSuccess(res, 'Project created successfully.', { project: project.toSafeObject() }, 201);
  } catch (error) { next(error); }
};

export const getProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const filter = await getAccessibleProjectFilter(userId);
    const projects = await Project.find(filter).sort({ createdAt: -1 });
    const plan = req.user!.plan ?? 'free';
    const { maxProjects } = getPlanLimits(plan);
    // The plan limit only counts projects you OWN — shared team projects
    // someone else created don't count against your own quota.
    const ownedCount = await Project.countDocuments({ owner: userId });
    sendSuccess(res, 'Projects fetched.', {
      projects: projects.map((p) => p.toSafeObject()),
      count: projects.length,
      plan,
      maxProjects: Number.isFinite(maxProjects) ? maxProjects : null,
      ownedCount,
    });
  } catch (error) { next(error); }
};

export const getProjectById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user!._id.toString());
    if (!project) { sendError(res, 'Project not found.', 404); return; }
    sendSuccess(res, 'Project fetched.', { project: project.toSafeObject() });
  } catch (error) { next(error); }
};

export const updateProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const accessible = await findAccessibleProject(req.params.id, req.user!._id.toString());
    if (!accessible) { sendError(res, 'Project not found.', 404); return; }

    const { name, description, language, status, teamId } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (language !== undefined) updates.language = language.trim();
    if (status !== undefined) {
      if (!['Active', 'Inactive', 'Archived'].includes(status)) { sendError(res, 'Invalid status value.', 400); return; }
      updates.status = status;
    }

    // Sharing/unsharing changes who else can see and live-edit this project,
    // so only the actual owner can do it — a team member with edit access
    // shouldn't be able to re-route the project to a different team or
    // strip it away from the one that's currently using it.
    if (teamId !== undefined) {
      if (accessible.owner.toString() !== req.user!._id.toString()) {
        sendError(res, 'Only the project owner can change who it is shared with.', 403);
        return;
      }
      if (teamId === null) {
        updates.teamId = null;
      } else {
        const allowed = await isTeamMember(teamId, req.user!._id.toString());
        if (!allowed) { sendError(res, 'You are not a member of that team.', 403); return; }
        updates.teamId = teamId;
      }
    }

    const project = await Project.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    sendSuccess(res, 'Project updated.', { project: project!.toSafeObject() });
  } catch (error) { next(error); }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Deletion stays creator-only — team members can edit, but only the
    // project's original owner can delete it outright.
    const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user!._id });
    if (!project) { sendError(res, 'Project not found.', 404); return; }
    await File.deleteMany({ projectId: req.params.id });
    await Folder.deleteMany({ projectId: req.params.id });
    sendSuccess(res, 'Project deleted.');
  } catch (error) { next(error); }
};