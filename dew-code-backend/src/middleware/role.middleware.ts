// ✅ NEW FILE: src/middleware/role.middleware.ts
// Place at: dew-code-backend/src/middleware/role.middleware.ts
//
// Usage in routes:
//   router.delete('/:id', authenticate, requireRole('Admin'), deleteProject);
//   router.patch('/:id', authenticate, requireRole('Admin', 'Developer'), updateProject);

import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

type UserRole = 'Admin' | 'Developer' | 'Viewer';

/**
 * Middleware: only allow requests from users with one of the specified roles.
 * Must be used AFTER the `authenticate` middleware.
 *
 * @example
 * router.delete('/:id', authenticate, requireRole('Admin'), handler);
 */
export const requireRole = (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role as UserRole | undefined;

    if (!userRole) {
      sendError(res, 'Not authenticated.', 401);
      return;
    }

    if (!roles.includes(userRole)) {
      sendError(
        res,
        `Access denied. Required role: ${roles.join(' or ')}. Your role: ${userRole}.`,
        403
      );
      return;
    }

    next();
  };

/**
 * Middleware: block Viewer role from mutating resources.
 * Equivalent to requireRole('Admin', 'Developer').
 */
export const requireWriter = requireRole('Admin', 'Developer');

/**
 * Middleware: allow only Admin.
 */
export const requireAdmin = requireRole('Admin');
