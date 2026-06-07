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

// PATCH /api/users/role  (Admin only — change another user's role)
router.patch('/role', async (req, res, next) => {
  try {
    if (!req.user) { sendError(res, 'Not authenticated.', 401); return; }
    if (req.user.role !== 'Admin') { sendError(res, 'Admin only.', 403); return; }

    const { userId, role } = req.body;
    if (!userId || !['Admin','Developer','Viewer'].includes(role)) {
      sendError(res, 'userId and valid role required.', 400);
      return;
    }

    const updated = await User.findByIdAndUpdate(userId, { role }, { new: true });
    if (!updated) { sendError(res, 'User not found.', 404); return; }

    sendSuccess(res, 'Role updated.', { user: updated.toSafeObject() });
  } catch (e) { next(e); }
});

// GET /api/users  (Admin only — list all users)
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) { sendError(res, 'Not authenticated.', 401); return; }
    if (req.user.role !== 'Admin') { sendError(res, 'Admin only.', 403); return; }

    const users = await User.find().select('-password -refreshTokens');
    sendSuccess(res, 'Users fetched.', { users: users.map((u) => u.toSafeObject()) });
  } catch (e) { next(e); }
});

export default router;
