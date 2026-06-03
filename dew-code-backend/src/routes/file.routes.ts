import { Router } from 'express';
import { createFile, getFilesByProject, getFileById, updateFile, deleteFile } from '../controllers/file.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.use(protect);

router.post('/',                    createFile);
router.get('/project/:projectId',   getFilesByProject);
router.get('/single/:id',           getFileById);
router.put('/:id',                  updateFile);
router.delete('/:id',               deleteFile);

export default router;