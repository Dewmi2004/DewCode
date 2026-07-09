// Role enforcement on file mutations

import { Router } from 'express';
import {
  createFile, getFilesByProject, getFileById,
  updateFile, deleteFile,
} from '../controllers/file.controller';
import { protect } from '../middleware/auth.middleware';
import { requireWriter } from '../middleware/role.middleware';
import { checkFileLimit } from '../middleware/planLimiter.middleware';

const router = Router();

router.use(protect);

// READ — all roles
router.get('/project/:projectId', getFilesByProject);
router.get('/:id', getFileById);

// WRITE — Admin + Developer only
router.post('/',     requireWriter, checkFileLimit, createFile);
router.patch('/:id', requireWriter, updateFile);
router.delete('/:id', requireWriter, deleteFile);

export default router;
