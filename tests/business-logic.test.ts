import { describe, it, expect } from 'vitest';
import {
  calculateRegeneratedEnergy,
  determineUserLevel,
  processTapEvent,
} from '../apps/api/src/services/tapEngine.ts';
import { validateTelegramInitData } from '../apps/api/src/services/telegramAuth.ts';
import { DEFAULT_LEVELS, DEFAULT_SETTINGS } from '../packages/shared/src/defaults.ts';
import { IBalance } from '../packages/shared/src/types.ts';
import { TapBatchSchema, WithdrawalRequestSchema } from '../packages/shared/src/schemas.ts';

describe('Tap Engine & Energy Business Rules', () => {
  const mockBalance: IBalance = {
    userId: '123456',
    coins: 500,
    totalEarned: 500,
    totalSpent: 0,
    totalTaps: 100,
    energy: 1000,
    maxEnergy: 1000,
    lastEnergyUpdateAt: Date.now(),
    level: 1,
    streakDays: 1,
    updatedAt: Date.now(),
  };

  it('valid tap: correctly deducts energy and awards coins based on multiplier', () => {
    const result = processTapEvent(mockBalance, 10, DEFAULT_SETTINGS, Date.now());
    expect(result.success).toBe(true);
    expect(result.coinsEarned).toBe(10); // 10 taps * 1 base * 1 multiplier
    expect(result.newBalance).toBe(510);
    expect(result.newEnergy).toBe(990);
  });

  it('insufficient energy: rejects tap when batch exceeds current energy', () => {
    const lowEnergyBalance: IBalance = { ...mockBalance, energy: 5 };
    const result = processTapEvent(lowEnergyBalance, 10, DEFAULT_SETTINGS, Date.now());
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient energy');
    expect(result.newBalance).toBe(500); // Unchanged
  });

  it('energy regeneration: restores energy over elapsed time up to max capacity', () => {
    const pastTimestamp = Date.now() - 60 * 1000; // 60 seconds ago
    const depletedBalance: IBalance = {
      ...mockBalance,
      energy: 100,
      lastEnergyUpdateAt: pastTimestamp,
    };

    const regen = calculateRegeneratedEnergy(depletedBalance, DEFAULT_SETTINGS, Date.now());
    expect(regen.energy).toBe(160); // 100 + (60 * 1 energy/sec)
  });

  it('energy regeneration: caps strictly at maxEnergy', () => {
    const veryPast = Date.now() - 3600 * 1000; // 1 hour ago
    const balance: IBalance = { ...mockBalance, energy: 900, lastEnergyUpdateAt: veryPast };
    const regen = calculateRegeneratedEnergy(balance, DEFAULT_SETTINGS, Date.now());
    expect(regen.energy).toBe(1000); // Capped at max
  });

  it('level progression: advances tier when coins threshold is passed', () => {
    const beginner = determineUserLevel(1000, DEFAULT_LEVELS);
    expect(beginner.currentLevel).toBe(1);
    expect(beginner.config.title).toBe('Beginner');

    const starter = determineUserLevel(5000, DEFAULT_LEVELS);
    expect(starter.currentLevel).toBe(2);
    expect(starter.config.title).toBe('Starter');
    expect(starter.config.tapMultiplier).toBe(2);

    const legend = determineUserLevel(15000000, DEFAULT_LEVELS);
    expect(legend.currentLevel).toBe(7);
    expect(legend.config.title).toBe('Legend');
    expect(legend.config.tapMultiplier).toBe(8);
  });
});

describe('Telegram HMAC & Security Verification Rules', () => {
  it('rejects empty or malformed initData', () => {
    const res = validateTelegramInitData('', 'bot_token_test');
    expect(res).toBeNull();
  });

  it('rejects expired initData (auth_date older than 24 hours)', () => {
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 90000; // ~25 hours ago
    const initData = `auth_date=${expiredTimestamp}&hash=abc123fake&user=%7B%22id%22%3A123%2C%22first_name%22%3A%22Test%22%7D`;
    const res = validateTelegramInitData(initData, 'bot_token_test');
    expect(res).toBeNull();
  });

  it('rejects tampered hash signature', () => {
    const recentTimestamp = Math.floor(Date.now() / 1000) - 60;
    const initData = `auth_date=${recentTimestamp}&hash=deadbeef0000&user=%7B%22id%22%3A123%2C%22first_name%22%3A%22Test%22%7D`;
    const res = validateTelegramInitData(initData, 'valid_bot_token_123');
    expect(res).toBeNull();
  });
});

describe('Input Validation & Anti-Cheat Schemas', () => {
  it('tap schema: enforces batch limits (1 to 100 taps)', () => {
    expect(TapBatchSchema.safeParse({ count: 10, clientTimestamp: Date.now(), nonce: 'nonce12345' }).success).toBe(true);
    expect(TapBatchSchema.safeParse({ count: 0, clientTimestamp: Date.now(), nonce: 'nonce12345' }).success).toBe(false);
    expect(TapBatchSchema.safeParse({ count: 105, clientTimestamp: Date.now(), nonce: 'nonce12345' }).success).toBe(false);
  });

  it('withdrawal schema: validates minimum amount and addresses', () => {
    expect(
      WithdrawalRequestSchema.safeParse({
        pointsAmount: 1000,
        method: 'TON',
        destinationAddress: 'EQC1234567890abcdef',
      }).success
    ).toBe(true);

    expect(
      WithdrawalRequestSchema.safeParse({
        pointsAmount: 50, // Less than minimum 100
        method: 'TON',
        destinationAddress: 'EQC1234567890abcdef',
      }).success
    ).toBe(false);
  });
});
