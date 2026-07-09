// Role: Viewers cannot execute commands
//
// FIX: /stdin and /kill were exported from terminal.controller.ts but never
// wired up here — only /execute was registered. That's why a session that
// came back waiting on input (sessionId set, exited: false) had nowhere to
// send follow-up input to: POST /api/terminal/stdin hit Express's default
// 404 handler instead of sendStdin(). Same story for /kill.

import { Router } from 'express';
import { executeCommand, sendStdin, killSession } from '../controllers/terminal.controller';
import { protect } from '../middleware/auth.middleware';
import { requireWriter } from '../middleware/role.middleware';

const router = Router();

router.post('/execute', protect, requireWriter, executeCommand);
router.post('/stdin',   protect, requireWriter, sendStdin);
router.post('/kill',    protect, requireWriter, killSession);

export default router;