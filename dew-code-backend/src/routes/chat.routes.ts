// ✅ NEW FILE: src/routes/chat.routes.ts

import { Router } from 'express';
import { getOverview, getMessages, markRead } from '../controllers/chat.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/overview',  getOverview);
router.get('/messages',  getMessages);
router.post('/read',     markRead);

export default router;
