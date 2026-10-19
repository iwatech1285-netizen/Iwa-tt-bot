import { Router, Request, Response } from 'express';
import { validateTelegramInitData } from '../services/telegramAuth.ts';
import { dbService } from '../services/dbService.ts';
import {
  requireTelegramAuth,
  requireAdminAuth,
  signSessionToken,
  AuthRequest,
} from '../middleware/authMiddleware.ts';
import { tapAntiCheatLimiter } from '../middleware/rateLimiter.ts';
import {
  TelegramAuthSchema,
  TapBatchSchema,
  TaskVerifySchema,
  WithdrawalRequestSchema,
  AdminUserStatusSchema,
  AdminAdjustBalanceSchema,
  AdminTaskSchema,
  AdminWithdrawalUpdateSchema,
  AdminSettingsUpdateSchema,
} from '../../../../packages/shared/src/schemas.ts';
import { ITask } from '../../../../packages/shared/src/types.ts';

export const apiRouter = Router();

// ========================================================
// 1. AUTHENTICATION
// ========================================================
apiRouter.post('/auth/telegram', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = TelegramAuthSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Invalid payload' });
      return;
    }

    const { initData, referrerId } = parseResult.data;
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';

    // Validate Telegram HMAC
    const validated = validateTelegramInitData(initData, botToken);
    if (!validated) {
      // In development / demo preview mode, support fallback mock identity if requested
      if (process.env.NODE_ENV !== 'production' && initData.includes('demo=true')) {
        const demoUser = {
          telegramId: '99887766',
          username: 'demo_player',
          firstName: 'Demo',
          lastName: 'Explorer',
        };
        const { user, balance, isNewUser } = await dbService.getOrCreateUser({
          ...demoUser,
          referrerId,
        });
        const token = signSessionToken({
          telegramId: demoUser.telegramId,
          username: demoUser.username,
          firstName: demoUser.firstName,
        });
        res.json({ token, user, balance, isNewUser });
        return;
      }

      res.status(401).json({ error: 'Invalid or expired Telegram signature' });
      return;
    }

    const tgUser = validated.user;
    const { user, balance, isNewUser } = await dbService.getOrCreateUser({
      telegramId: String(tgUser.id),
      username: tgUser.username,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      languageCode: tgUser.language_code,
      referrerId: validated.start_param || referrerId,
    });

    const token = signSessionToken({
      telegramId: String(tgUser.id),
      username: tgUser.username,
      firstName: tgUser.first_name,
    });

    res.json({
      token,
      user,
      balance,
      isNewUser,
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

// ========================================================
// 2. USER & PROFILE
// ========================================================
apiRouter.get('/user', requireTelegramAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const telegramId = req.user!.telegramId;
    const user = await dbService.getUser(telegramId);
    const balance = await dbService.getBalance(telegramId);
    const settings = await dbService.getSettings();

    if (!user || !balance) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    res.json({ user, balance, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
});

apiRouter.get('/user/profile', requireTelegramAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const telegramId = req.user!.telegramId;
    const user = await dbService.getUser(telegramId);
    const balance = await dbService.getBalance(telegramId);
    const refStats = await dbService.getReferralStats(telegramId);
    const { completedTaskIds } = await dbService.getTasks(telegramId);

    res.json({
      user,
      balance,
      referralCount: refStats.totalReferrals,
      referralEarnings: refStats.totalEarnedFromReferrals,
      tasksCompletedCount: completedTaskIds.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile details' });
  }
});

// ========================================================
// 3. TAP ENGINE
// ========================================================
apiRouter.post('/tap', requireTelegramAuth, tapAntiCheatLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parse = TapBatchSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Invalid tap payload' });
      return;
    }

    const { count, nonce } = parse.data;
    const telegramId = req.user!.telegramId;

    const result = await dbService.recordTaps(telegramId, count, nonce);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to record taps';
    res.status(400).json({ error: msg });
  }
});

// ========================================================
// 4. TASKS & REWARDS
// ========================================================
apiRouter.get('/tasks', requireTelegramAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const telegramId = req.user!.telegramId;
    const { tasks, completedTaskIds } = await dbService.getTasks(telegramId);
    res.json({ tasks, completedTaskIds });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

apiRouter.post('/tasks/verify', requireTelegramAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parse = TaskVerifySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Missing or invalid task ID' });
      return;
    }

    const telegramId = req.user!.telegramId;
    const result = await dbService.verifyAndRewardTask(telegramId, parse.data.taskId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Task verification failed' });
  }
});

// ========================================================
// 5. DAILY REWARDS
// ========================================================
apiRouter.post('/daily-reward/claim', requireTelegramAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const telegramId = req.user!.telegramId;
    const result = await dbService.claimDailyReward(telegramId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Daily claim failed' });
  }
});

// ========================================================
// 6. REFERRALS
// ========================================================
apiRouter.get('/referrals', requireTelegramAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const telegramId = req.user!.telegramId;
    const stats = await dbService.getReferralStats(telegramId);
    const settings = await dbService.getSettings();

    const botUsername = settings.botUsername || process.env.TELEGRAM_BOT_USERNAME || 'iwa_tap_bot';
    const referralLink = `https://t.me/${botUsername}?start=ref_${telegramId}`;

    res.json({
      ...stats,
      referralLink,
      referrerReward: settings.referralRewardReferrer,
      refereeReward: settings.referralRewardReferee,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve referral data' });
  }
});

// ========================================================
// 7. LEADERBOARD
// ========================================================
apiRouter.get('/leaderboard', requireTelegramAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = (req.query.category as 'coins' | 'referrals' | 'level') || 'coins';
    const leaderboard = await dbService.getLeaderboard(category, 100);

    const telegramId = req.user!.telegramId;
    const userRankIndex = leaderboard.findIndex((e) => e.telegramId === telegramId);
    const userRank = userRankIndex !== -1 ? userRankIndex + 1 : null;

    res.json({ leaderboard, userRank });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ========================================================
// 8. WALLET & WITHDRAWALS
// ========================================================
apiRouter.get('/wallet', requireTelegramAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const telegramId = req.user!.telegramId;
    const balance = await dbService.getBalance(telegramId);
    const transactions = await dbService.getUserTransactions(telegramId, 20);
    const settings = await dbService.getSettings();

    res.json({
      balance,
      transactions,
      settings: {
        minWithdrawalAmount: settings.minWithdrawalAmount,
        maxWithdrawalAmount: settings.maxWithdrawalAmount,
        withdrawalsEnabled: settings.withdrawalsEnabled,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve wallet information' });
  }
});

apiRouter.post('/withdraw', requireTelegramAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parse = WithdrawalRequestSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Invalid withdrawal parameters' });
      return;
    }

    const telegramId = req.user!.telegramId;
    const { pointsAmount, method, destinationAddress } = parse.data;

    const withdrawal = await dbService.submitWithdrawalRequest(
      telegramId,
      pointsAmount,
      method,
      destinationAddress
    );

    res.json({ success: true, withdrawal });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Withdrawal submission failed' });
  }
});

apiRouter.get('/transactions', requireTelegramAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const telegramId = req.user!.telegramId;
    const limitCount = parseInt(req.query.limit as string, 10) || 30;
    const transactions = await dbService.getUserTransactions(telegramId, limitCount);
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve transaction history' });
  }
});

// ========================================================
// 9. ADMIN DASHBOARD & CONTROLS
// ========================================================
apiRouter.get('/admin/dashboard', requireAdminAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await dbService.getAdminStats();
    const settings = await dbService.getSettings();
    res.json({ stats, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load admin stats' });
  }
});

apiRouter.patch('/admin/users/:id/status', requireAdminAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parse = AdminUserStatusSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid user status payload' });
      return;
    }

    const user = await dbService.updateUserStatus(
      req.params.id,
      parse.data.status,
      parse.data.reason || 'Admin status change',
      req.adminEmail!
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update user status' });
  }
});

apiRouter.post('/admin/users/:id/adjust-balance', requireAdminAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parse = AdminAdjustBalanceSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Invalid adjustment data' });
      return;
    }

    const balance = await dbService.adjustUserBalance(
      req.params.id,
      parse.data.amount,
      parse.data.reason,
      req.adminEmail!
    );
    res.json({ success: true, balance });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Balance adjustment failed' });
  }
});

apiRouter.post('/admin/tasks', requireAdminAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parse = AdminTaskSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Invalid task data' });
      return;
    }

    const taskId = `task_${Date.now()}`;
    const newTask: ITask = {
      ...parse.data,
      id: taskId,
      claimedCount: 0,
      createdAt: new Date().toISOString(),
    };

    // Save task in DB
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../../../../src/lib/firebase.ts');
    await setDoc(doc(db, 'tasks', taskId), newTask);

    await dbService.logAudit({
      adminEmail: req.adminEmail!,
      action: 'CREATE_TASK',
      targetUserId: taskId,
      newValue: JSON.stringify(newTask),
      reason: 'Admin created new task',
    });

    res.json({ success: true, task: newTask });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

apiRouter.patch('/admin/withdrawals/:id', requireAdminAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parse = AdminWithdrawalUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Invalid withdrawal data' });
      return;
    }

    const updated = await dbService.updateWithdrawalStatus(
      req.params.id,
      parse.data.status,
      req.adminEmail!,
      parse.data.adminNotes
    );
    res.json({ success: true, withdrawal: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Withdrawal update failed' });
  }
});

apiRouter.get('/admin/settings', requireAdminAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await dbService.getSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

apiRouter.patch('/admin/settings', requireAdminAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parse = AdminSettingsUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid settings update' });
      return;
    }

    const updated = await dbService.updateSettings(parse.data, req.adminEmail!);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update settings' });
  }
});
