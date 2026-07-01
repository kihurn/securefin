import { Request, Response, NextFunction } from 'express';

/**
 * SECURE DESIGN CHOICE - Principle of Least Privilege:
 * Role-Based Access Control (RBAC) ensures users can only perform operations
 * corresponding to their authorized role. This middleware factory implements a
 * "fail-closed" model: if the user's role is not explicitly authorized, they are
 * denied access.
 * 
 * @param allowedRoles List of roles authorized to access the route (e.g. 'admin', 'manager').
 * @returns An Express middleware function.
 */
export function authorizeRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Fail-Closed: If request does not contain user claims (authGuard was not executed), deny access immediately.
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required. Access denied.' });
      return;
    }

    const userRole = req.user.role;

    // Verify if user's role is within the authorized roles array.
    if (allowedRoles.includes(userRole)) {
      next();
    } else {
      // SECURE DESIGN CHOICE - Sanitized Forbidden Response:
      // Return HTTP 403 (Forbidden) with a generic, sanitized message.
      // Avoid leaking details about what permissions are missing to prevent attackers
      // from mapping our system's authorization layout.
      res.status(403).json({ error: 'Access forbidden. Insufficient privileges.' });
    }
  };
}
