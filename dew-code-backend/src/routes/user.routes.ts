import { Router, Request, Response, NextFunction } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import User from '../models/User';

const router = Router();

// All user routes require authentication
router.use(protect);

// GET /api/users/profile — get own profile
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, 'Profile fetched.', { user: req.user!.toSafeObject() });
  } catch (e) { next(e); }
});

// PUT /api/users/profile — update own name/avatar
router.put('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, avatar } = req.body;
    const updates: Record<string, string> = {};
    if (name) updates.name = name.trim();
    if (avatar) updates.avatar = avatar;

    const updated = await User.findByIdAndUpdate(
      req.user!._id,
      updates,
      { new: true, runValidators: true }
    );
    sendSuccess(res, 'Profile updated.', { user: updated?.toSafeObject() });
  } catch (e) { next(e); }
});

// ── Admin-only routes ────────────────────────────────────────────────────

// GET /api/users — list all users (Admin only)
router.get('/', authorize('Admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.find().select('-__v');
    sendSuccess(res, 'Users fetched.', { users: users.map(u => u.toSafeObject()) });
  } catch (e) { next(e); }
});

// PUT /api/users/:id/role — change a user's role (Admin only)
router.put('/:id/role', authorize('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
    const allowed = ['Admin', 'Developer', 'Viewer'];
    if (!allowed.includes(role)) {
      sendError(res, 'Invalid role.', 400);
      return;
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );
    if (!user) { sendError(res, 'User not found.', 404); return; }
    sendSuccess(res, 'Role updated.', { user: user.toSafeObject() });
  } catch (e) { next(e); }
});

// DELETE /api/users/:id — delete a user (Admin only)
router.delete('/:id', authorize('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!._id.toString()) {
      sendError(res, 'You cannot delete your own account.', 400);
      return;
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) { sendError(res, 'User not found.', 404); return; }
    sendSuccess(res, 'User deleted.');
  } catch (e) { next(e); }
});

export default router;
