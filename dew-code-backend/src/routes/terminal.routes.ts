// ✅ Day 7 → TERMINAL ROUTES
// POST /api/terminal/execute → run a command

import { Router } from 'express';
import { executeCommand } from '../controllers/Terminal.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect); // All terminal routes require authentication
router.post('/execute', executeCommand);

export default router;