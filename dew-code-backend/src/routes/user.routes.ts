import { Router, Request, Response, NextFunction } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import User, { DEFAULT_USER_SETTINGS, UserSettings } from '../models/User';

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
    const { name, email, avatar } = req.body;
    const updates: Record<string, string> = {};
    if (name !== undefined) {
      if (!name.trim()) {
        sendError(res, 'Display name is required.', 400);
        return;
      }
      updates.name = name.trim();
    }
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        sendError(res, 'Please provide a valid email address.', 400);
        return;
      }

      const existing = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.user!._id },
      });
      if (existing) {
        sendError(res, 'That email address is already in use.', 409);
        return;
      }

      updates.email = normalizedEmail;
    }
    if (avatar !== undefined) updates.avatar = avatar;

    const updated = await User.findByIdAndUpdate(
      req.user!._id,
      updates,
      { new: true, runValidators: true }
    );
    sendSuccess(res, 'Profile updated.', { user: updated?.toSafeObject() });
  } catch (e) { next(e); }
});

// GET /api/users/settings - fetch own persisted preferences
router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, 'Settings fetched.', {
      settings: req.user!.toSafeObject().settings,
    });
  } catch (e) { next(e); }
});

// PUT /api/users/settings - update own preferences
router.put('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const current = req.user!.toSafeObject().settings;
    const incoming = req.body as Partial<UserSettings> & {
      github?: Partial<UserSettings['github']> & { personalAccessToken?: string };
    };

    const nextSettings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      ...current,
      appearance: {
        ...current.appearance,
        ...(incoming.appearance ?? {}),
      },
      editor: {
        ...current.editor,
        ...(incoming.editor ?? {}),
      },
      layout: {
        ...current.layout,
        ...(incoming.layout ?? {}),
      },
      github: {
        ...current.github,
        ...(incoming.github ?? {}),
      },
      security: {
        ...current.security,
        ...(incoming.security ?? {}),
      },
    };

    const token = incoming.github?.personalAccessToken?.trim();
    if (token) {
      nextSettings.github.tokenConfigured = true;
      nextSettings.github.tokenLast4 = token.slice(-4);
    }

    const user = await User.findById(req.user!._id);
    if (!user) {
      sendError(res, 'User not found.', 404);
      return;
    }

    user.settings = nextSettings;
    await user.save();

    sendSuccess(res, 'Settings saved.', {
      settings: user.toSafeObject().settings,
    });
  } catch (e) { next(e); }
});

// PUT /api/users/password - change own password
router.put('/password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      sendError(res, 'Current password and new password are required.', 400);
      return;
    }

    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[^\s]{8,}$/;
    if (!strongPassword.test(newPassword)) {
      sendError(
        res,
        'Password must include uppercase, lowercase, number, and special character.',
        400
      );
      return;
    }

    const user = await User.findById(req.user!._id).select('+password');
    if (!user) {
      sendError(res, 'User not found.', 404);
      return;
    }

    const matches = await user.comparePassword(currentPassword);
    if (!matches) {
      sendError(res, 'Current password is incorrect.', 401);
      return;
    }

    user.password = newPassword;
    await user.save();

    sendSuccess(res, 'Password updated.');
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
