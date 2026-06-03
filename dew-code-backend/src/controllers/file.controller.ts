import { Request, Response, NextFunction } from 'express';
import File from '../models/File';
import Project from '../models/Project';
import { sendSuccess, sendError } from '../utils/response';

const assertProjectOwner = async (projectId: string, userId: string): Promise<boolean> => {
  const project = await Project.findOne({ _id: projectId, owner: userId });
  return !!project;
};

export const createFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fileName, content, language, projectId } = req.body;
    if (!fileName?.trim()) { sendError(res, 'File name is required.', 400); return; }
    if (!projectId) { sendError(res, 'Project ID is required.', 400); return; }

    if (!await assertProjectOwner(projectId, req.user!._id.toString())) {
      sendError(res, 'Project not found or access denied.', 404); return;
    }

    const file = await File.create({
      fileName: fileName.trim(),
      content: content ?? '',
      language: language?.trim() || detectLanguage(fileName),
      projectId,
    });

    sendSuccess(res, 'File created.', { file: file.toSafeObject() }, 201);
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) { sendError(res, 'A file with that name already exists in this project.', 409); return; }
    next(error);
  }
};

export const getFilesByProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!await assertProjectOwner(projectId, req.user!._id.toString())) {
      sendError(res, 'Project not found or access denied.', 404); return;
    }
    const files = await File.find({ projectId }).sort({ createdAt: 1 });
    sendSuccess(res, 'Files fetched.', { files: files.map((f) => f.toSafeObject()), count: files.length });
  } catch (error) { next(error); }
};

export const getFileById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) { sendError(res, 'File not found.', 404); return; }
    if (!await assertProjectOwner(file.projectId.toString(), req.user!._id.toString())) {
      sendError(res, 'Access denied.', 403); return;
    }
    sendSuccess(res, 'File fetched.', { file: file.toSafeObject() });
  } catch (error) { next(error); }
};

export const updateFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await File.findById(req.params.id);
    if (!existing) { sendError(res, 'File not found.', 404); return; }
    if (!await assertProjectOwner(existing.projectId.toString(), req.user!._id.toString())) {
      sendError(res, 'Access denied.', 403); return;
    }

    const { fileName, content, language } = req.body;
    const updates: Record<string, unknown> = {};
    if (fileName !== undefined) updates.fileName = fileName.trim();
    if (content !== undefined) updates.content = content;
    if (language !== undefined) updates.language = language.trim();

    const file = await File.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    sendSuccess(res, 'File updated.', { file: file!.toSafeObject() });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) { sendError(res, 'A file with that name already exists in this project.', 409); return; }
    next(error);
  }
};

export const deleteFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await File.findById(req.params.id);
    if (!existing) { sendError(res, 'File not found.', 404); return; }
    if (!await assertProjectOwner(existing.projectId.toString(), req.user!._id.toString())) {
      sendError(res, 'Access denied.', 403); return;
    }
    await File.findByIdAndDelete(req.params.id);
    sendSuccess(res, 'File deleted.');
  } catch (error) { next(error); }
};

function detectLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', java: 'java', cs: 'csharp', cpp: 'cpp', c: 'c',
    go: 'go', rs: 'rust', rb: 'ruby', php: 'php', html: 'html',
    css: 'css', scss: 'scss', json: 'json', md: 'markdown',
    yml: 'yaml', yaml: 'yaml', sh: 'shell', sql: 'sql', xml: 'xml',
  };
  return map[ext] ?? 'plaintext';
}