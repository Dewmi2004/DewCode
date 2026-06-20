import { Request, Response, NextFunction } from 'express';
import Project from '../models/Project';
import File from '../models/File';
import Folder from '../models/Folder';
import { getPlanLimits } from '../config/plans';
import { sendSuccess, sendError } from '../utils/response';

export const createProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, language } = req.body;
    if (!name?.trim()) { sendError(res, 'Project name is required.', 400); return; }

    const project = await Project.create({
      name: name.trim(),
      description: description?.trim() ?? '',
      language: language?.trim() || 'JavaScript',
      owner: req.user!._id,
      status: 'Active',
    });

    sendSuccess(res, 'Project created successfully.', { project: project.toSafeObject() }, 201);
  } catch (error) { next(error); }
};

export const getProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projects = await Project.find({ owner: req.user!._id }).sort({ createdAt: -1 });
    const plan = req.user!.plan ?? 'free';
    const { maxProjects } = getPlanLimits(plan);
    sendSuccess(res, 'Projects fetched.', {
      projects: projects.map((p) => p.toSafeObject()),
      count: projects.length,
      plan,
      maxProjects: Number.isFinite(maxProjects) ? maxProjects : null,
    });
  } catch (error) { next(error); }
};

export const getProjectById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user!._id });
    if (!project) { sendError(res, 'Project not found.', 404); return; }
    sendSuccess(res, 'Project fetched.', { project: project.toSafeObject() });
  } catch (error) { next(error); }
};

export const updateProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, language, status } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (language !== undefined) updates.language = language.trim();
    if (status !== undefined) {
      if (!['Active', 'Inactive', 'Archived'].includes(status)) { sendError(res, 'Invalid status value.', 400); return; }
      updates.status = status;
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user!._id },
      updates,
      { new: true, runValidators: true }
    );
    if (!project) { sendError(res, 'Project not found.', 404); return; }
    sendSuccess(res, 'Project updated.', { project: project.toSafeObject() });
  } catch (error) { next(error); }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user!._id });
    if (!project) { sendError(res, 'Project not found.', 404); return; }
    await File.deleteMany({ projectId: req.params.id });
    await Folder.deleteMany({ projectId: req.params.id });
    sendSuccess(res, 'Project deleted.');
  } catch (error) { next(error); }
};