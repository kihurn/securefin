import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.ts';

/**
 * Validates the user role permissions for system endpoints.
 * 4.) User Permission Checks (controls what pages or actions different user roles can access)
 */
export function checkPermission(
  roleRequired: 'user' | 'admin',
  getUserRole: (username: string) => Promise<'user' | 'admin' | null> | 'user' | 'admin' | null
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const name = req.firebaseUser?.name;
    if (!name) {
      return res.status(403).json({ error: 'Insufficient privileges: Unresolved identity' });
    }
    
    try {
      const role = await getUserRole(name);
      if (!role || role !== roleRequired) {
        return res.status(403).json({ error: 'Insufficient privileges: Admin role required' });
      }
      next();
    } catch (err: any) {
      console.error('Error resolving RBAC user role permissions:', err);
      res.status(500).json({ error: 'Internal system authorization validation error' });
    }
  };
}
