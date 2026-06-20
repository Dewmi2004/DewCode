// ✅ NEW FILE: src/routes/payment.routes.ts

import { Router } from 'express';
import { initiatePayment, payhereNotify, getPaymentStatus } from '../controllers/payment.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Public — PayHere's servers call this directly, no JWT available.
router.post('/payhere/notify', payhereNotify);

// Authenticated — the signed-in user starting/checking their own upgrade.
router.post('/payhere/initiate', protect, initiatePayment);
router.get('/status', protect, getPaymentStatus);

export default router;
