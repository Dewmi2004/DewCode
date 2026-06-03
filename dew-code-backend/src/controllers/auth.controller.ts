import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setTokenCookies,
  clearTokenCookies,
} from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/response';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;

// ── POST /api/auth/register ──────────────────────────────────────────────
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      sendError(res, 'Name, email, and password are required.', 400);
      return;
    }

    if (password.length < 8) {
      sendError(res, 'Password must be at least 8 characters long.', 400);
      return;
    }

    // Accepts any special character — not limited to a fixed set
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[^\s]{8,}$/;
    if (!strongPassword.test(password)) {
      sendError(
        res,
        'Password must include an uppercase letter, a lowercase letter, a number, and a special character (e.g. Test@1234).',
        400
      );
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      sendError(res, 'An account with this email already exists.', 409);
      return;
    }

    const allowedRoles = ['Developer', 'Viewer'];
    const assignedRole = allowedRoles.includes(role) ? role : 'Developer';

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: assignedRole,
    });

    const safeUser = user.toSafeObject();
    const accessToken = generateAccessToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });
    const refreshToken = generateRefreshToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });

    const hashedRefresh = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: hashedRefresh },
    });

    setTokenCookies(res, accessToken, refreshToken);

    sendSuccess(
      res,
      'Account created successfully.',
      { user: safeUser, accessToken },
      201
    );
  } catch (error) {
    console.error('[register error]', error);
    next(error);
  }
};

// ── POST /api/auth/login ─────────────────────────────────────────────────
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      sendError(res, 'Email and password are required.', 400);
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password +loginAttempts +lockUntil +refreshTokens');

    if (!user) {
      await new Promise((r) => setTimeout(r, 300));
      sendError(res, 'Invalid email or password.', 401);
      return;
    }

    if (user.isLocked()) {
      const minutesLeft = Math.ceil(
        ((user.lockUntil?.getTime() ?? 0) - Date.now()) / 60000
      );
      sendError(res, `Account locked. Try again in ${minutesLeft} minute(s).`, 423);
      return;
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
        user.loginAttempts = 0;
      }
      await user.save();
      sendError(res, 'Invalid email or password.', 401);
      return;
    }

    user.loginAttempts = 0;
    user.lockUntil = undefined;

    const safeUser = user.toSafeObject();
    const accessToken = generateAccessToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });
    const refreshToken = generateRefreshToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });

    const hashedRefresh = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const maxSessions = 5;
    const currentTokens = user.refreshTokens ?? [];
    user.refreshTokens = [...currentTokens.slice(-(maxSessions - 1)), hashedRefresh];

    await user.save();

    setTokenCookies(res, accessToken, refreshToken);
    sendSuccess(res, 'Login successful.', { user: safeUser, accessToken });
  } catch (error) {
    console.error('[login error]', error);
    next(error);
  }
};

// ── POST /api/auth/logout ────────────────────────────────────────────────
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken && req.user) {
      const hashedRefresh = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: hashedRefresh },
      });
    }

    clearTokenCookies(res);
    sendSuccess(res, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/refresh ───────────────────────────────────────────────
export const refreshAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      sendError(res, 'Refresh token not provided.', 401);
      return;
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      sendError(res, 'Invalid or expired refresh token. Please sign in again.', 401);
      return;
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) {
      sendError(res, 'User not found.', 401);
      return;
    }

    const hashedRefresh = crypto.createHash('sha256').update(refreshToken).digest('hex');
    if (!user.refreshTokens.includes(hashedRefresh)) {
      await User.findByIdAndUpdate(user._id, { $set: { refreshTokens: [] } });
      clearTokenCookies(res);
      sendError(res, 'Token reuse detected. All sessions invalidated.', 401);
      return;
    }

    const safeUser = user.toSafeObject();
    const newAccessToken = generateAccessToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });
    const newRefreshToken = generateRefreshToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });

    const newHashedRefresh = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    await User.findByIdAndUpdate(user._id, {
      $pull: { refreshTokens: hashedRefresh },
      $push: { refreshTokens: newHashedRefresh },
    });

    setTokenCookies(res, newAccessToken, newRefreshToken);
    sendSuccess(res, 'Token refreshed.', { accessToken: newAccessToken });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────────────────
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 'Not authenticated.', 401);
      return;
    }
    sendSuccess(res, 'User profile fetched.', { user: req.user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/logout-all ────────────────────────────────────────────
export const logoutAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 'Not authenticated.', 401);
      return;
    }
    await User.findByIdAndUpdate(req.user._id, { $set: { refreshTokens: [] } });
    clearTokenCookies(res);
    sendSuccess(res, 'Logged out from all devices.');
  } catch (error) {
    next(error);
  }
};