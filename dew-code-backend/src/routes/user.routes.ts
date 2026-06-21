// ✅ UPDATED src/routes/user.routes.ts
// Added: PATCH /api/users/settings

import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import User from '../models/User';

const router = Router();

router.use(protect);

// GET /api/users/me  (alias)
router.get('/me', async (req, res, next) => {
  try {
    if (!req.user) { sendError(res, 'Not authenticated.', 401); return; }
    sendSuccess(res, 'User fetched.', { user: req.user.toSafeObject() });
  } catch (e) { next(e); }
});

// PATCH /api/users/settings
router.patch('/settings', async (req, res, next) => {
  try {
    if (!req.user) { sendError(res, 'Not authenticated.', 401); return; }

    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      sendError(res, 'Settings object required.', 400);
      return;
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { settings } },
      { new: true, runValidators: true }
    );

    if (!updated) { sendError(res, 'User not found.', 404); return; }
    sendSuccess(res, 'Settings updated.', { user: updated.toSafeObject() });
  } catch (e) { next(e); }
});

// Note: there used to be Admin-only `PATCH /role` and `GET /` (list all
// users) endpoints here. Removed — there's only one role now, so they had
// no purpose, and nothing in the frontend called them.

export default router;
