// ✅ UPDATED src/routes/project.routes.ts
// Role enforcement: Viewers can GET, only Admin/Developer can create/edit/delete

import { Router } from 'express';
import {
  createProject, getProjects, getProjectById,
  updateProject, deleteProject,
} from '../controllers/project.controller';
import { protect } from '../middleware/auth.middleware';
import { requireWriter, requireAdmin } from '../middleware/role.middleware';

const router = Router();

// All project routes require authentication
router.use(protect);

// READ — all roles
router.get('/',    getProjects);
router.get('/:id', getProjectById);

// WRITE — Admin + Developer only
router.post('/',    requireWriter, createProject);
router.patch('/:id', requireWriter, updateProject);

// DELETE — Admin only
router.delete('/:id', requireAdmin, deleteProject);

export default router;
