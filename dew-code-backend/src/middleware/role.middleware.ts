// There is only one role now (Developer) — access tiers are handled by
// PLAN (free/plus, see planLimiter.middleware.ts), not by role. This file
// is kept mainly so existing routes that import `requireWriter` don't need
// touching; it now just confirms the request is from an authenticated
// account (which can only ever be role 'Developer').

import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

type UserRole = 'Developer';

export const requireRole = (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role as UserRole | undefined;

    if (!userRole) {
      sendError(res, 'Not authenticated.', 401);
      return;
    }

    if (!roles.includes(userRole)) {
      sendError(res, `Access denied. Required role: ${roles.join(' or ')}. Your role: ${userRole}.`, 403);
      return;
    }

    next();
  };

// Kept for backwards compatibility with existing route imports — always
// passes for any authenticated user, since Developer is the only role.
export const requireWriter = requireRole('Developer');
