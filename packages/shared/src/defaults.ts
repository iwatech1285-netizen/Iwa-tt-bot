import { ISettings, ILevelConfig } from './types.ts';

export const DEFAULT_LEVELS: ILevelConfig[] = [
  { level: 1, title: 'Beginner', minCoinsRequired: 0, tapMultiplier: 1, bonusReward: 0 },
  { level: 2, title: 'Starter', minCoinsRequired: 5000, tapMultiplier: 2, bonusReward: 1000 },
  { level: 3, title: 'Explorer', minCoinsRequired: 25000, tapMultiplier: 3, bonusReward: 3000 },
  { level: 4, title: 'Pro', minCoinsRequired: 100000, tapMultiplier: 4, bonusReward: 10000 },
  { level: 5, title: 'Expert', minCoinsRequired: 500000, tapMultiplier: 5, bonusReward: 50000 },
  { level: 6, title: 'Master', minCoinsRequired: 2000000, tapMultiplier: 6, bonusReward: 150000 },
  { level: 7, title: 'Legend', minCoinsRequired: 10000000, tapMultiplier: 8, bonusReward: 500000 },
];

export const DEFAULT_DAILY_REWARDS = [100, 200, 300, 500, 750, 1000, 2500];

export const DEFAULT_SETTINGS: ISettings = {
  maxEnergy: 1000,
  baseTapReward: 1,
  energyRegenRatePerSec: 1, // 1 energy per second
  levelsConfig: DEFAULT_LEVELS,
  dailyRewardTiers: DEFAULT_DAILY_REWARDS,
  referralRewardReferrer: 1000,
  referralRewardReferee: 500,
  minWithdrawalAmount: 1000,
  maxWithdrawalAmount: 1000000,
  withdrawalsEnabled: true,
  maintenanceMode: false,
  supportUsername: 'iwatech1285',
  botUsername: 'iwa1285_bot',
  communityUrl: 'https://t.me/iwacoin_community',
};
