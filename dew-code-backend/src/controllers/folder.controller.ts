// ✅ NEW FILE: src/controllers/folder.controller.ts
// CRUD for the VS-Code-style folder tree. Folders are explicit documents
// (not derived from file paths) so empty folders persist and rename/move
// is an O(1) metadata update instead of rewriting every file's path.

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Folder from '../models/Folder';
import File from '../models/File';
import Project from '../models/Project';
import { sendSuccess, sendError } from '../utils/response';

const assertProjectOwner = async (projectId: string, userId: string): Promise<boolean> => {
  const project = await Project.findOne({ _id: projectId, owner: userId });
  return !!project;
};

// Recursively collect a folder + every descendant folder id (BFS).
const collectFolderAndDescendantIds = async (
  rootFolderId: string
): Promise<mongoose.Types.ObjectId[]> => {
  const ids: mongoose.Types.ObjectId[] = [new mongoose.Types.ObjectId(rootFolderId)];
  let frontier = [rootFolderId];
  while (frontier.length > 0) {
    const children = await Folder.find({ parentId: { $in: frontier } }).select('_id');
    if (children.length === 0) break;
    const childIds = children.map((c) => c._id);
    ids.push(...childIds);
    frontier = childIds.map((id) => id.toString());
  }
  return ids;
};

export const createFolder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, projectId, parentId } = req.body;
    if (!name?.trim()) { sendError(res, 'Folder name is required.', 400); return; }
    if (!projectId) { sendError(res, 'Project ID is required.', 400); return; }

    if (!await assertProjectOwner(projectId, req.user!._id.toString())) {
      sendError(res, 'Project not found or access denied.', 404); return;
    }

    if (parentId) {
      const parent = await Folder.findOne({ _id: parentId, projectId });
      if (!parent) { sendError(res, 'Parent folder not found.', 404); return; }
    }

    const folder = await Folder.create({
      name: name.trim(),
      projectId,
      parentId: parentId || null,
    });

    sendSuccess(res, 'Folder created.', { folder: folder.toSafeObject() }, 201);
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) { sendError(res, 'A folder with that name already exists here.', 409); return; }
    next(error);
  }
};

export const getFoldersByProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!await assertProjectOwner(projectId, req.user!._id.toString())) {
      sendError(res, 'Project not found or access denied.', 404); return;
    }
    const folders = await Folder.find({ projectId }).sort({ createdAt: 1 });
    sendSuccess(res, 'Folders fetched.', { folders: folders.map((f) => f.toSafeObject()), count: folders.length });
  } catch (error) { next(error); }
};

export const renameFolder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name?.trim()) { sendError(res, 'Folder name is required.', 400); return; }

    const existing = await Folder.findById(req.params.id);
    if (!existing) { sendError(res, 'Folder not found.', 404); return; }
    if (!await assertProjectOwner(existing.projectId.toString(), req.user!._id.toString())) {
      sendError(res, 'Access denied.', 403); return;
    }

    const folder = await Folder.findByIdAndUpdate(
      req.params.id,
      { name: name.trim() },
      { new: true, runValidators: true }
    );
    sendSuccess(res, 'Folder renamed.', { folder: folder!.toSafeObject() });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) { sendError(res, 'A folder with that name already exists here.', 409); return; }
    next(error);
  }
};

export const deleteFolder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await Folder.findById(req.params.id);
    if (!existing) { sendError(res, 'Folder not found.', 404); return; }
    if (!await assertProjectOwner(existing.projectId.toString(), req.user!._id.toString())) {
      sendError(res, 'Access denied.', 403); return;
    }

    // Cascade: delete this folder, every nested subfolder, and every file
    // inside any of them — same behavior as deleting a folder in VS Code's
    // file explorer (it removes everything underneath).
    const allFolderIds = await collectFolderAndDescendantIds(req.params.id);
    await File.deleteMany({ folderId: { $in: allFolderIds } });
    await Folder.deleteMany({ _id: { $in: allFolderIds } });

    sendSuccess(res, 'Folder and its contents deleted.');
  } catch (error) { next(error); }
};
