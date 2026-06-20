import { Router } from 'express';
import {
  createProject, getProjects, getProjectById,
  updateProject, deleteProject,
} from '../controllers/project.controller';
import { protect } from '../middleware/auth.middleware';
import { requireWriter, requireAdmin } from '../middleware/role.middleware';
import { checkProjectLimit } from '../middleware/planLimiter.middleware';

const router = Router();

// All project routes require authentication
router.use(protect);

// READ — all roles
router.get('/',    getProjects);
router.get('/:id', getProjectById);

// WRITE — Admin + Developer only, gated by plan limit on create
router.post('/',    requireWriter, checkProjectLimit, createProject);
router.patch('/:id', requireWriter, updateProject);

// DELETE — Admin only
router.delete('/:id', requireAdmin, deleteProject);

export default router;