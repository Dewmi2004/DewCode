// ✅ UPDATED src/routes/terminal.routes.ts
// Role: Viewers cannot execute commands

import { Router } from 'express';
import { executeCommand } from '../controllers/terminal.controller';
import { protect } from '../middleware/auth.middleware';
import { requireWriter } from '../middleware/role.middleware';

const router = Router();

router.post('/execute', protect, requireWriter, executeCommand);

export default router;
