// Role enforcement: Viewers can GET, only Admin/Developer can create/edit/delete

import { Router } from 'express';
import {
  createProject, getProjects, getProjectById,
  updateProject, deleteProject,
} from '../controllers/project.controller';
import { protect } from '../middleware/auth.middleware';
import { requireWriter } from '../middleware/role.middleware';
import { checkProjectLimit } from '../middleware/planLimiter.middleware';

const router = Router();

// All project routes require authentication
router.use(protect);

// READ — everyone (single-role app; access is owner/team-based, not role-based)
router.get('/',    getProjects);
router.get('/:id', getProjectById);

// WRITE — gated by plan limit on create. Ownership (not role) is what
// controls who can edit/delete a given project — see project.controller.ts.
router.post('/',    requireWriter, checkProjectLimit, createProject);
router.patch('/:id', requireWriter, updateProject);
router.delete('/:id', requireWriter, deleteProject);

export default router;
