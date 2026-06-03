import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { sendError } from '../utils/response';
import User, { IUser, UserRole } from '../models/User';

// Extend Express Request to carry user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// ── protect: verify JWT access token ────────────────────────────────────

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Check Authorization header (Bearer token)
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // 2. Fallback: check httpOnly cookie
    else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      sendError(res, 'Authentication required. Please sign in.', 401);
      return;
    }

    // Verify token
    let decoded: JwtPayload;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      sendError(res, 'Invalid or expired token. Please sign in again.', 401);
      return;
    }

    // Find user in DB (confirms account still exists)
    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) {
      sendError(res, 'User account not found.', 401);
      return;
    }

    // Check account lock
    if (user.isLocked()) {
      sendError(res, 'Account temporarily locked. Please try again later.', 403);
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// ── authorize: role-based access control ────────────────────────────────

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    if (!roles.includes(req.user.role as UserRole)) {
      sendError(
        res,
        `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
        403
      );
      return;
    }

    next();
  };
};