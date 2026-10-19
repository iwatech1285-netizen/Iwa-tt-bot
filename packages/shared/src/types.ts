export type UserStatus = 'active' | 'suspended';

export interface IUser {
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  languageCode?: string;
  referrerId?: string;
  status: UserStatus;
  createdAt: string;
  lastActiveAt: string;
  isBot?: boolean;
}

export interface IBalance {
  userId: string;
  coins: number;
  totalEarned: number;
  totalSpent: number;
  totalTaps: number;
  energy: number;
  maxEnergy: number;
  lastEnergyUpdateAt: number; // Server timestamp in ms
  level: number;
  streakDays: number;
  lastDailyClaimDate?: string; // YYYY-MM-DD
  updatedAt: number;
}

export type TransactionType =
  | 'tap'
  | 'daily_reward'
  | 'referral_reward'
  | 'task_reward'
  | 'level_bonus'
  | 'admin_adjustment'
  | 'withdrawal_reservation'
  | 'withdrawal_refund';

export type TransactionStatus = 'completed' | 'pending' | 'refunded';

export interface ITransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string;
  idempotencyKey?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export type TaskType =
  | 'daily_checkin'
  | 'telegram_channel'
  | 'telegram_group'
  | 'website'
  | 'social'
  | 'custom';

export interface ITask {
  id: string;
  title: string;
  description: string;
  rewardAmount: number;
  type: TaskType;
  actionUrl: string;
  targetChatId?: string; // Telegram channel/group chat ID (e.g. @iwacoin_channel)
  active: boolean;
  maxClaims?: number;
  claimedCount: number;
  createdAt: string;
  icon?: string;
}

export interface ITaskCompletion {
  id?: string;
  userId: string;
  taskId: string;
  rewardAmount: number;
  verifiedAt: string;
}

export interface IDailyRewardCycle {
  day: number;
  reward: number;
}

export interface IDailyRewardClaim {
  id: string;
  userId: string;
  dayNumber: number;
  rewardAmount: number;
  claimedDateUTC: string;
  createdAt: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface IWithdrawal {
  id: string;
  userId: string;
  pointsAmount: number;
  method: string;
  destinationAddress: string;
  status: WithdrawalStatus;
  adminNotes?: string;
  processedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminUser {
  uid: string;
  email: string;
  role: 'superadmin' | 'admin' | 'moderator';
  isActive: boolean;
  createdAt: string;
}

export interface ILevelConfig {
  level: number;
  title: string;
  minCoinsRequired: number;
  tapMultiplier: number;
  bonusReward: number;
}

export interface ISettings {
  maxEnergy: number;
  baseTapReward: number;
  energyRegenRatePerSec: number;
  levelsConfig: ILevelConfig[];
  dailyRewardTiers: number[];
  referralRewardReferrer: number;
  referralRewardReferee: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number;
  withdrawalsEnabled: boolean;
  maintenanceMode: boolean;
  supportUsername: string;
  botUsername: string;
  communityUrl: string;
}

export interface IAuditLog {
  id: string;
  adminEmail: string;
  action: string;
  targetUserId?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  ip?: string;
  timestamp: string;
}

export interface ILeaderboardEntry {
  rank: number;
  telegramId: string;
  username?: string;
  firstName: string;
  score: number;
  level: number;
  referralCount?: number;
  tasksCompleted?: number;
}
