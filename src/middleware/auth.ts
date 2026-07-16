import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import {
  hashPassword,
  verifyPassword,
  generateCustomToken,
  verifyCustomToken
} from '../security/index.ts';

export {
  hashPassword,
  verifyPassword,
  generateCustomToken,
  verifyCustomToken
};

// Augment express Request to add our firebaseUser property
declare global {
  namespace Express {
    interface Request {
      firebaseUser?: DecodedIdToken;
    }
  }
}

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied: Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 1. Try custom HS256 JWT
  const customUser = verifyCustomToken(token);
  if (customUser) {
    req.firebaseUser = {
      uid: customUser.uid,
      email: customUser.email,
      name: customUser.name,
      aud: '',
      auth_time: 0,
      exp: 0,
      firebase: { identities: {}, sign_in_provider: 'custom' },
      iat: 0,
      iss: '',
      sub: customUser.uid,
    } as any;
    return next();
  }

  // 2. Try standard Firebase ID Token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying ID token (both custom & Firebase failed):', error);
    return res.status(401).json({ error: 'Access denied: Unauthorized: Invalid token' });
  }
};
