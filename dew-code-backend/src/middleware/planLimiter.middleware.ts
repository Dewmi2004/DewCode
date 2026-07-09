// Gates project/folder/file creation by the user's plan (Free vs Plus).
// On the Free plan, hitting a limit returns 403 with upgrade: true so the
// frontend can pop the Upgrade-to-Plus modal instead of a generic error.

import { Request, Response, NextFunction } from 'express';
import Project from '../models/Project';
import Folder from '../models/Folder';
import File from '../models/File';
import { getPlanLimits } from '../config/plans';
import { sendError } from '../utils/response';

const sendUpgradeRequired = (res: Response, message: string): void => {
  res.status(403).json({ success: false, message, upgrade: true });
};

// Gate for features that are Plus-only outright (no free tier at all) —
// e.g. creating a Team / real-time collaboration.
export const requirePlus = (req: Request, res: Response, next: NextFunction): void => {
  const plan = req.user!.plan ?? 'free';
  if (plan !== 'plus') {
    sendUpgradeRequired(res, 'This feature is available on the Plus plan.');
    return;
  }
  next();
};

export const checkProjectLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plan = req.user!.plan ?? 'free';
    const { maxProjects } = getPlanLimits(plan);
    if (Number.isFinite(maxProjects)) {
      const count = await Project.countDocuments({ owner: req.user!._id });
      if (count >= maxProjects) {
        sendUpgradeRequired(
          res,
          `Free plan is limited to ${maxProjects} projects. Upgrade to Plus for unlimited projects.`
        );
        return;
      }
    }
    next();
  } catch (error) { next(error); }
};

export const checkFolderLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plan = req.user!.plan ?? 'free';
    const { maxFoldersPerProject } = getPlanLimits(plan);
    if (Number.isFinite(maxFoldersPerProject)) {
      const { projectId } = req.body;
      if (!projectId) { sendError(res, 'Project ID is required.', 400); return; }
      const count = await Folder.countDocuments({ projectId });
      if (count >= maxFoldersPerProject) {
        sendUpgradeRequired(
          res,
          `Free plan is limited to ${maxFoldersPerProject} folders per project. Upgrade to Plus for unlimited folders.`
        );
        return;
      }
    }
    next();
  } catch (error) { next(error); }
};

export const checkFileLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plan = req.user!.plan ?? 'free';
    const { maxFilesPerProject, maxFileSizeBytes } = getPlanLimits(plan);
    const { projectId, content } = req.body;
    if (!projectId) { sendError(res, 'Project ID is required.', 400); return; }

    if (typeof content === 'string' && Buffer.byteLength(content, 'utf8') > maxFileSizeBytes) {
      sendUpgradeRequired(
        res,
        `Free plan limits files to ${Math.round(maxFileSizeBytes / 1024)}KB. Upgrade to Plus for larger files.`
      );
      return;
    }

    if (Number.isFinite(maxFilesPerProject)) {
      const count = await File.countDocuments({ projectId });
      if (count >= maxFilesPerProject) {
        sendUpgradeRequired(
          res,
          `Free plan is limited to ${maxFilesPerProject} files per project. Upgrade to Plus for unlimited files.`
        );
        return;
      }
    }
    next();
  } catch (error) { next(error); }
};
