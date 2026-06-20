// ✅ NEW FILE: src/routes/folder.routes.ts

import { Router } from 'express';
import {
  createFolder, getFoldersByProject, renameFolder, deleteFolder,
} from '../controllers/folder.controller';
import { protect } from '../middleware/auth.middleware';
import { requireWriter } from '../middleware/role.middleware';
import { checkFolderLimit } from '../middleware/planLimiter.middleware';

const router = Router();

router.use(protect);

// READ — all roles
router.get('/project/:projectId', getFoldersByProject);

// WRITE — Admin + Developer only, gated by plan limits on create
router.post('/', requireWriter, checkFolderLimit, createFolder);
router.patch('/:id', requireWriter, renameFolder);
router.delete('/:id', requireWriter, deleteFolder);

export default router;
