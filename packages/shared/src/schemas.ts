import { z } from 'zod';

export const TelegramAuthSchema = z.object({
  initData: z.string().min(1, 'initData is required'),
  referrerId: z.string().optional(),
});

export const TapBatchSchema = z.object({
  count: z.number().int().min(1).max(100, 'Batch size must be between 1 and 100 taps'),
  clientTimestamp: z.number().int().positive(),
  nonce: z.string().min(6).max(64),
});

export const TaskVerifySchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
});

export const DailyRewardClaimSchema = z.object({
  clientDate: z.string().optional(),
});

export const WithdrawalRequestSchema = z.object({
  pointsAmount: z.number().int().min(100, 'Minimum withdrawal is 100 points'),
  method: z.string().min(2).max(50),
  destinationAddress: z.string().min(4).max(120),
});

export const AdminUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().min(3).max(255).optional(),
});

export const AdminAdjustBalanceSchema = z.object({
  amount: z.number().int(), // Can be positive or negative
  reason: z.string().min(3, 'A clear reason is required for audit logs').max(300),
});

export const AdminTaskSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(3).max(500),
  rewardAmount: z.number().int().positive(),
  type: z.enum(['daily_checkin', 'telegram_channel', 'telegram_group', 'website', 'social', 'custom']),
  actionUrl: z.string().url(),
  targetChatId: z.string().optional(),
  active: z.boolean().default(true),
  maxClaims: z.number().int().positive().optional(),
});

export const AdminWithdrawalUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'completed']),
  adminNotes: z.string().max(300).optional(),
});

export const AdminSettingsUpdateSchema = z.object({
  maxEnergy: z.number().int().positive().optional(),
  baseTapReward: z.number().int().positive().optional(),
  energyRegenRatePerSec: z.number().positive().optional(),
  referralRewardReferrer: z.number().int().positive().optional(),
  referralRewardReferee: z.number().int().positive().optional(),
  minWithdrawalAmount: z.number().int().positive().optional(),
  maxWithdrawalAmount: z.number().int().positive().optional(),
  withdrawalsEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  supportUsername: z.string().optional(),
  botUsername: z.string().optional(),
  communityUrl: z.string().optional(),
});
