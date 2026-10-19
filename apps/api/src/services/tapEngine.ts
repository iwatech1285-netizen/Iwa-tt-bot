import { IBalance, ILevelConfig, ISettings } from '../../../../packages/shared/src/types.ts';
import { DEFAULT_LEVELS, DEFAULT_SETTINGS } from '../../../../packages/shared/src/defaults.ts';

export interface TapResult {
  success: boolean;
  coinsEarned: number;
  newBalance: number;
  newEnergy: number;
  maxEnergy: number;
  newLevel: number;
  leveledUp: boolean;
  levelBonusAwarded: number;
  levelTitle: string;
  tapMultiplier: number;
  error?: string;
}

/**
 * Calculates regenerated energy based on authoritative server timestamps
 */
export function calculateRegeneratedEnergy(
  balance: IBalance,
  settings: ISettings = DEFAULT_SETTINGS,
  nowMs: number = Date.now()
): { energy: number; lastUpdateMs: number } {
  const maxEnergy = settings.maxEnergy || balance.maxEnergy || 1000;
  const regenRate = settings.energyRegenRatePerSec || 1; // 1 energy per sec
  const lastUpdate = balance.lastEnergyUpdateAt || nowMs;

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - lastUpdate) / 1000));
  if (elapsedSeconds <= 0) {
    return {
      energy: Math.min(balance.energy, maxEnergy),
      lastUpdateMs: lastUpdate,
    };
  }

  const addedEnergy = elapsedSeconds * regenRate;
  const newEnergy = Math.min(maxEnergy, (balance.energy || 0) + addedEnergy);

  return {
    energy: newEnergy,
    lastUpdateMs: nowMs,
  };
}

/**
 * Determines user level and checks for level up
 */
export function determineUserLevel(
  totalEarned: number,
  levels: ILevelConfig[] = DEFAULT_LEVELS
): { currentLevel: number; config: ILevelConfig; nextConfig?: ILevelConfig; progressPercent: number } {
  // Sort descending to find highest level reached
  const sorted = [...levels].sort((a, b) => b.level - a.level);
  const matched = sorted.find((l) => totalEarned >= l.minCoinsRequired) || levels[0];

  const currentLevelNum = matched.level;
  const nextConfig = levels.find((l) => l.level === currentLevelNum + 1);

  let progressPercent = 100;
  if (nextConfig) {
    const range = nextConfig.minCoinsRequired - matched.minCoinsRequired;
    const currentProgress = totalEarned - matched.minCoinsRequired;
    progressPercent = Math.min(100, Math.max(0, Math.floor((currentProgress / range) * 100)));
  }

  return {
    currentLevel: currentLevelNum,
    config: matched,
    nextConfig,
    progressPercent,
  };
}

/**
 * Validates and processes a batched tap event securely on the server
 */
export function processTapEvent(
  balance: IBalance,
  tapCount: number,
  settings: ISettings = DEFAULT_SETTINGS,
  nowMs: number = Date.now()
): TapResult {
  // 1. Anti-cheat check: Reject invalid tap counts
  if (!Number.isInteger(tapCount) || tapCount < 1 || tapCount > 100) {
    return {
      success: false,
      coinsEarned: 0,
      newBalance: balance.coins,
      newEnergy: balance.energy,
      maxEnergy: balance.maxEnergy,
      newLevel: balance.level,
      leveledUp: false,
      levelBonusAwarded: 0,
      levelTitle: 'Beginner',
      tapMultiplier: 1,
      error: 'Invalid tap batch size. Limit is 1 to 100 taps.',
    };
  }

  // 2. Authoritative energy calculation
  const { energy: currentEnergy, lastUpdateMs } = calculateRegeneratedEnergy(balance, settings, nowMs);

  if (currentEnergy < tapCount) {
    return {
      success: false,
      coinsEarned: 0,
      newBalance: balance.coins,
      newEnergy: currentEnergy,
      maxEnergy: settings.maxEnergy || balance.maxEnergy,
      newLevel: balance.level,
      leveledUp: false,
      levelBonusAwarded: 0,
      levelTitle: 'Beginner',
      tapMultiplier: 1,
      error: 'Insufficient energy for taps. Wait for energy to recharge.',
    };
  }

  // 3. Multiplier & Reward Calculation
  const levels = settings.levelsConfig || DEFAULT_LEVELS;
  const { currentLevel, config: currentConfig } = determineUserLevel(balance.totalEarned, levels);
  const tapMultiplier = currentConfig.tapMultiplier || 1;
  const baseReward = settings.baseTapReward || 1;
  const coinsEarned = tapCount * baseReward * tapMultiplier;

  const newCoins = balance.coins + coinsEarned;
  const newTotalEarned = balance.totalEarned + coinsEarned;
  const newEnergy = currentEnergy - tapCount;

  // 4. Level check after taps
  const { currentLevel: postLevel, config: postConfig } = determineUserLevel(newTotalEarned, levels);
  const leveledUp = postLevel > currentLevel;
  const levelBonus = leveledUp ? (postConfig.bonusReward || 0) : 0;
  const finalCoins = newCoins + levelBonus;
  const finalTotalEarned = newTotalEarned + levelBonus;

  return {
    success: true,
    coinsEarned,
    newBalance: finalCoins,
    newEnergy,
    maxEnergy: settings.maxEnergy || balance.maxEnergy,
    newLevel: postLevel,
    leveledUp,
    levelBonusAwarded: levelBonus,
    levelTitle: postConfig.title,
    tapMultiplier: postConfig.tapMultiplier,
  };
}
