import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware.ts';

interface RateRecord {
  count: number;
  resetAt: number;
}

const ipBuckets = new Map<string, RateRecord>();
const tapBuckets = new Map<string, { count: number; lastTapMs: number }>();

/**
 * Standard API rate limiter (120 requests per minute per IP)
 */
export function standardRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxLimit = 150;

  let record = ipBuckets.get(ip);
  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + windowMs };
    ipBuckets.set(ip, record);
    return next();
  }

  record.count++;
  if (record.count > maxLimit) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }

  next();
}

/**
 * Anti-Cheat Tap Rate Limiter:
 * Disallows more than 3 tap-batch API requests per second per user
 */
export function tapAntiCheatLimiter(req: AuthRequest, res: Response, next: NextFunction): void {
  const userId = req.user?.telegramId;
  if (!userId) return next();

  const now = Date.now();
  const userTapData = tapBuckets.get(userId);

  if (!userTapData) {
    tapBuckets.set(userId, { count: 1, lastTapMs: now });
    return next();
  }

  const elapsed = now - userTapData.lastTapMs;
  if (elapsed < 300) {
    // Tapping faster than 300ms per batch
    res.status(429).json({ error: 'Anti-cheat warning: Excessive tap speed detected. Please slow down.' });
    return;
  }

  userTapData.lastTapMs = now;
  userTapData.count++;
  next();
}
