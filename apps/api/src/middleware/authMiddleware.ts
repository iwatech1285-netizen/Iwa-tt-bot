import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const getJwtSecret = () => process.env.JWT_SECRET || 'Anasiwabot1285@#৳%&*';

export interface AuthenticatedUserPayload {
  telegramId: string;
  username?: string;
  firstName: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUserPayload;
  adminEmail?: string;
}

/**
 * Signs a server session token for authenticated Telegram users
 */
export function signSessionToken(payload: AuthenticatedUserPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * Middleware: Enforces valid Telegram session
 */
export function requireTelegramAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthenticatedUserPayload;
    if (!decoded || !decoded.telegramId) {
      res.status(401).json({ error: 'Unauthorized: Invalid session payload' });
      return;
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
}

/**
 * Middleware: Enforces Administrator authorization
 */
export function requireAdminAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const adminSecretHeader = req.headers['x-admin-secret'] as string;
  const authHeader = req.headers.authorization;

  // 1. Check bootstrap master secret if provided
  const expectedSecret = process.env.ADMIN_SETUP_SECRET || 'Anasiwaadmin1229';
  if (adminSecretHeader && adminSecretHeader === expectedSecret) {
    req.adminEmail = 'iwatech1285@gmail.com';
    return next();
  }

  // 2. Check Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as Record<string, unknown>;
      if (decoded && (decoded.isAdmin || decoded.email === 'iwatech1285@gmail.com')) {
        req.adminEmail = (decoded.email as string) || 'admin@iwa-bot.com';
        return next();
      }
    } catch {
      // Token verification failed
    }
  }

  res.status(403).json({ error: 'Forbidden: Administrator privileges required' });
}
