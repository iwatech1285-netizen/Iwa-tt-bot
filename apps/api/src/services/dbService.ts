import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../../src/lib/firebase.ts';
import {
  IUser,
  IBalance,
  ITransaction,
  ITask,
  ITaskCompletion,
  IDailyRewardClaim,
  IWithdrawal,
  IAdminUser,
  ISettings,
  IAuditLog,
  ILeaderboardEntry,
} from '../../../../packages/shared/src/types.ts';
import { DEFAULT_SETTINGS } from '../../../../packages/shared/src/defaults.ts';
import { calculateRegeneratedEnergy, determineUserLevel, processTapEvent } from './tapEngine.ts';

// In-memory cache for high-frequency settings & fallback storage
let cachedSettings: ISettings = { ...DEFAULT_SETTINGS };

export const dbService = {
  // ========================================================
  // SETTINGS
  // ========================================================
  async getSettings(): Promise<ISettings> {
    try {
      const docRef = doc(db, 'settings', 'app_config');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        cachedSettings = { ...DEFAULT_SETTINGS, ...(snap.data() as ISettings) };
      } else {
        // Initialize default settings document
        await setDoc(docRef, DEFAULT_SETTINGS);
        cachedSettings = { ...DEFAULT_SETTINGS };
      }
      return cachedSettings;
    } catch (err) {
      console.warn('Using cached/default settings due to firestore read error:', err);
      return cachedSettings;
    }
  },

  async updateSettings(updates: Partial<ISettings>, adminEmail: string): Promise<ISettings> {
    const docRef = doc(db, 'settings', 'app_config');
    const current = await this.getSettings();
    const updated = { ...current, ...updates };
    await setDoc(docRef, updated, { merge: true });
    cachedSettings = updated;

    await this.logAudit({
      adminEmail,
      action: 'UPDATE_SETTINGS',
      previousValue: JSON.stringify(current),
      newValue: JSON.stringify(updated),
      reason: 'Admin modified global application configuration',
    });

    return updated;
  },

  // ========================================================
  // USERS & BALANCES
  // ========================================================
  async getOrCreateUser(userData: {
    telegramId: string;
    username?: string;
    firstName: string;
    lastName?: string;
    languageCode?: string;
    referrerId?: string;
  }): Promise<{ user: IUser; balance: IBalance; isNewUser: boolean }> {
    const userDocRef = doc(db, 'users', `telegram_${userData.telegramId}`);
    const balanceDocRef = doc(db, 'balances', `telegram_${userData.telegramId}`);

    const userSnap = await getDoc(userDocRef);
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    if (userSnap.exists()) {
      // User exists, update last active
      const user = userSnap.data() as IUser;
      await updateDoc(userDocRef, {
        lastActiveAt: nowIso,
        ...(userData.username ? { username: userData.username } : {}),
        ...(userData.firstName ? { firstName: userData.firstName } : {}),
      });

      const balanceSnap = await getDoc(balanceDocRef);
      let balance: IBalance;
      if (balanceSnap.exists()) {
        balance = balanceSnap.data() as IBalance;
        // Recalculate regenerated energy
        const settings = await this.getSettings();
        const { energy } = calculateRegeneratedEnergy(balance, settings, nowMs);
        if (energy !== balance.energy) {
          balance.energy = energy;
          balance.lastEnergyUpdateAt = nowMs;
          await updateDoc(balanceDocRef, {
            energy,
            lastEnergyUpdateAt: nowMs,
          });
        }
      } else {
        balance = {
          userId: userData.telegramId,
          coins: 0,
          totalEarned: 0,
          totalSpent: 0,
          totalTaps: 0,
          energy: 1000,
          maxEnergy: 1000,
          lastEnergyUpdateAt: nowMs,
          level: 1,
          streakDays: 0,
          updatedAt: nowMs,
        };
        await setDoc(balanceDocRef, balance);
      }

      return { user, balance, isNewUser: false };
    }

    // New User Registration
    const isSelfReferral = userData.referrerId === userData.telegramId;
    const validReferrerId = !isSelfReferral && userData.referrerId ? userData.referrerId : undefined;

    const newUser: Record<string, any> = {
      telegramId: userData.telegramId,
      firstName: userData.firstName,
      status: 'active',
      createdAt: nowIso,
      lastActiveAt: nowIso,
    };
    if (userData.username) newUser.username = userData.username;
    if (userData.lastName) newUser.lastName = userData.lastName;
    if (userData.languageCode) newUser.languageCode = userData.languageCode;
    if (validReferrerId) newUser.referrerId = validReferrerId;

    const initialCoins = validReferrerId ? DEFAULT_SETTINGS.referralRewardReferee : 0;
    const newBalance: IBalance = {
      userId: userData.telegramId,
      coins: initialCoins,
      totalEarned: initialCoins,
      totalSpent: 0,
      totalTaps: 0,
      energy: 1000,
      maxEnergy: 1000,
      lastEnergyUpdateAt: nowMs,
      level: 1,
      streakDays: 0,
      updatedAt: nowMs,
    };

    await setDoc(userDocRef, newUser);
    await setDoc(balanceDocRef, newBalance);

    // If referee got a starting bonus, record the transaction
    if (initialCoins > 0) {
      await this.recordTransaction({
        userId: userData.telegramId,
        type: 'referral_reward',
        amount: initialCoins,
        status: 'completed',
        description: `Welcome bonus for joining via invitation from ${validReferrerId}`,
      });
    }

    // Process referral reward for referrer if valid
    if (validReferrerId) {
      await this.processReferralReward(validReferrerId, userData.telegramId);
    }

    return { user: newUser as IUser, balance: newBalance, isNewUser: true };
  },

  async getUser(telegramId: string): Promise<IUser | null> {
    const userDoc = await getDoc(doc(db, 'users', `telegram_${telegramId}`));
    return userDoc.exists() ? (userDoc.data() as IUser) : null;
  },

  async getBalance(telegramId: string): Promise<IBalance | null> {
    const balDoc = await getDoc(doc(db, 'balances', `telegram_${telegramId}`));
    if (!balDoc.exists()) return null;
    const balance = balDoc.data() as IBalance;
    const settings = await this.getSettings();
    const { energy } = calculateRegeneratedEnergy(balance, settings, Date.now());
    balance.energy = energy;
    return balance;
  },

  // ========================================================
  // TAP ENGINE MUTATION (ATOMIC)
  // ========================================================
  async recordTaps(
    telegramId: string,
    tapCount: number,
    nonce: string
  ): Promise<{
    coinsEarned: number;
    newBalance: number;
    newEnergy: number;
    maxEnergy: number;
    level: number;
    leveledUp: boolean;
    levelBonusAwarded: number;
    levelTitle: string;
    tapMultiplier: number;
  }> {
    const user = await this.getUser(telegramId);
    if (!user) throw new Error('User not found');
    if (user.status === 'suspended') throw new Error('Account suspended');

    const settings = await this.getSettings();
    const balanceDocRef = doc(db, 'balances', `telegram_${telegramId}`);

    const result = await runTransaction(db, async (txn) => {
      const snap = await txn.get(balanceDocRef);
      if (!snap.exists()) throw new Error('Balance record missing');

      const currentBalance = snap.data() as IBalance;
      const tapResult = processTapEvent(currentBalance, tapCount, settings, Date.now());

      if (!tapResult.success) {
        throw new Error(tapResult.error || 'Failed to process taps');
      }

      const updatedBalance: Partial<IBalance> = {
        coins: tapResult.newBalance,
        totalEarned: currentBalance.totalEarned + tapResult.coinsEarned + tapResult.levelBonusAwarded,
        totalTaps: (currentBalance.totalTaps || 0) + tapCount,
        energy: tapResult.newEnergy,
        level: tapResult.newLevel,
        lastEnergyUpdateAt: Date.now(),
        updatedAt: Date.now(),
      };

      txn.update(balanceDocRef, updatedBalance);
      return tapResult;
    });

    // Record tap reward transaction asynchronously (outside transaction to avoid abort retries)
    if (result.coinsEarned > 0) {
      await this.recordTransaction({
        userId: telegramId,
        type: 'tap',
        amount: result.coinsEarned,
        status: 'completed',
        description: `Tapped ${tapCount} times (Multiplier: x${result.tapMultiplier})`,
        idempotencyKey: `tap_${telegramId}_${nonce}`,
      });
    }

    if (result.leveledUp && result.levelBonusAwarded > 0) {
      await this.recordTransaction({
        userId: telegramId,
        type: 'level_bonus',
        amount: result.levelBonusAwarded,
        status: 'completed',
        description: `Advancement bonus for reaching Level ${result.newLevel} (${result.levelTitle})`,
      });
    }

    return {
      coinsEarned: result.coinsEarned,
      newBalance: result.newBalance,
      newEnergy: result.newEnergy,
      maxEnergy: result.maxEnergy,
      level: result.newLevel,
      leveledUp: result.leveledUp,
      levelBonusAwarded: result.levelBonusAwarded,
      levelTitle: result.levelTitle,
      tapMultiplier: result.tapMultiplier,
    };
  },

  // ========================================================
  // DAILY REWARDS (7-DAY STREAK)
  // ========================================================
  async claimDailyReward(telegramId: string): Promise<{
    dayNumber: number;
    rewardAmount: number;
    newStreak: number;
    newBalance: number;
  }> {
    const user = await this.getUser(telegramId);
    if (!user) throw new Error('User not found');
    if (user.status === 'suspended') throw new Error('Account suspended');

    const settings = await this.getSettings();
    const dailyTiers = settings.dailyRewardTiers || [100, 200, 300, 500, 750, 1000, 2500];

    const todayUtc = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const balanceDocRef = doc(db, 'balances', `telegram_${telegramId}`);

    const result = await runTransaction(db, async (txn) => {
      const snap = await txn.get(balanceDocRef);
      if (!snap.exists()) throw new Error('Balance record missing');

      const balance = snap.data() as IBalance;

      // Check if already claimed today
      if (balance.lastDailyClaimDate === todayUtc) {
        throw new Error('Daily reward already claimed today. Come back tomorrow!');
      }

      // Check streak continuity: Was last claim yesterday?
      let currentStreak = balance.streakDays || 0;
      if (balance.lastDailyClaimDate) {
        const lastDate = new Date(balance.lastDailyClaimDate);
        const today = new Date(todayUtc);
        const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          // Consecutive day
          currentStreak = currentStreak % 7 + 1;
        } else {
          // Missed days, reset streak to Day 1
          currentStreak = 1;
        }
      } else {
        // First ever claim
        currentStreak = 1;
      }

      const rewardAmount = dailyTiers[currentStreak - 1] || 100;
      const newCoins = balance.coins + rewardAmount;
      const newTotalEarned = balance.totalEarned + rewardAmount;

      txn.update(balanceDocRef, {
        coins: newCoins,
        totalEarned: newTotalEarned,
        streakDays: currentStreak,
        lastDailyClaimDate: todayUtc,
        updatedAt: Date.now(),
      });

      return {
        dayNumber: currentStreak,
        rewardAmount,
        newStreak: currentStreak,
        newBalance: newCoins,
      };
    });

    // Record daily claim record & transaction
    const claimDocRef = doc(db, 'daily_rewards', `claim_${telegramId}_${todayUtc}`);
    await setDoc(claimDocRef, {
      userId: telegramId,
      dayNumber: result.dayNumber,
      rewardAmount: result.rewardAmount,
      claimedDateUTC: todayUtc,
      createdAt: new Date().toISOString(),
    });

    await this.recordTransaction({
      userId: telegramId,
      type: 'daily_reward',
      amount: result.rewardAmount,
      status: 'completed',
      description: `Claimed Day ${result.dayNumber} Daily Reward Streak`,
      idempotencyKey: `daily_${telegramId}_${todayUtc}`,
    });

    return result;
  },

  // ========================================================
  // TASKS & VERIFICATION
  // ========================================================
  async getTasks(telegramId?: string): Promise<{ tasks: ITask[]; completedTaskIds: string[] }> {
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('active', '==', true));
    const snap = await getDocs(q);

    let tasks: ITask[] = [];
    snap.forEach((d) => tasks.push(d.data() as ITask));

    // If no tasks exist in DB yet, seed default tasks
    if (tasks.length === 0) {
      await this.seedDefaultTasks();
      const freshSnap = await getDocs(q);
      freshSnap.forEach((d) => tasks.push(d.data() as ITask));
    }

    let completedTaskIds: string[] = [];
    if (telegramId) {
      const compRef = collection(db, 'task_completions');
      const compQ = query(compRef, where('userId', '==', telegramId));
      const compSnap = await getDocs(compQ);
      compSnap.forEach((d) => completedTaskIds.push((d.data() as ITaskCompletion).taskId));
    }

    return { tasks, completedTaskIds };
  },

  async verifyAndRewardTask(
    telegramId: string,
    taskId: string
  ): Promise<{ success: boolean; rewardAmount: number; newBalance: number }> {
    const user = await this.getUser(telegramId);
    if (!user) throw new Error('User not found');
    if (user.status === 'suspended') throw new Error('Account suspended');

    const completionDocRef = doc(db, 'task_completions', `comp_${telegramId}_${taskId}`);
    const compSnap = await getDoc(completionDocRef);
    if (compSnap.exists()) {
      throw new Error('Task has already been completed and rewarded');
    }

    const taskDocRef = doc(db, 'tasks', taskId);
    const taskSnap = await getDoc(taskDocRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as ITask;

    if (!task.active) throw new Error('Task is no longer active');
    if (task.maxClaims && task.claimedCount >= task.maxClaims) {
      throw new Error('Task maximum claims reached');
    }

    const balanceDocRef = doc(db, 'balances', `telegram_${telegramId}`);

    const newBalance = await runTransaction(db, async (txn) => {
      const snap = await txn.get(balanceDocRef);
      if (!snap.exists()) throw new Error('Balance record missing');
      const balance = snap.data() as IBalance;

      const updatedCoins = balance.coins + task.rewardAmount;
      const updatedTotal = balance.totalEarned + task.rewardAmount;

      txn.update(balanceDocRef, {
        coins: updatedCoins,
        totalEarned: updatedTotal,
        updatedAt: Date.now(),
      });

      txn.update(taskDocRef, {
        claimedCount: (task.claimedCount || 0) + 1,
      });

      txn.set(completionDocRef, {
        userId: telegramId,
        taskId: task.id,
        rewardAmount: task.rewardAmount,
        verifiedAt: new Date().toISOString(),
      });

      return updatedCoins;
    });

    await this.recordTransaction({
      userId: telegramId,
      type: 'task_reward',
      amount: task.rewardAmount,
      status: 'completed',
      description: `Completed task: ${task.title}`,
      idempotencyKey: `task_${telegramId}_${taskId}`,
    });

    return {
      success: true,
      rewardAmount: task.rewardAmount,
      newBalance,
    };
  },

  async seedDefaultTasks(): Promise<void> {
    const defaultTasks: ITask[] = [
      {
        id: 'task_channel',
        title: 'Join IWA BOT Official Telegram Channel',
        description: 'Stay updated with all announcements, airdrops, and token updates',
        rewardAmount: 2500,
        type: 'telegram_channel',
        actionUrl: 'https://t.me/iwacoin_channel',
        targetChatId: '@iwacoin_channel',
        active: true,
        claimedCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'task_group',
        title: 'Join IWA Community Discussion Group',
        description: 'Connect with fellow miners and participate in weekly giveaways',
        rewardAmount: 2000,
        type: 'telegram_group',
        actionUrl: 'https://t.me/iwacoin_community',
        targetChatId: '@iwacoin_community',
        active: true,
        claimedCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'task_website',
        title: 'Visit IWA Official Portal & Roadmap',
        description: 'Explore our upcoming 2026 decentralized ecosystem roadmap',
        rewardAmount: 1500,
        type: 'website',
        actionUrl: 'https://t.me/iwa_tap_bot',
        active: true,
        claimedCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'task_social',
        title: 'Follow IWA Network on X (Twitter)',
        description: 'Follow our official handle and repost the pinned announcement',
        rewardAmount: 3000,
        type: 'social',
        actionUrl: 'https://twitter.com/iwa_network',
        active: true,
        claimedCount: 0,
        createdAt: new Date().toISOString(),
      },
    ];

    for (const task of defaultTasks) {
      await setDoc(doc(db, 'tasks', task.id), task);
    }
  },

  // ========================================================
  // REFERRALS
  // ========================================================
  async processReferralReward(referrerId: string, refereeId: string): Promise<void> {
    const pairRef = doc(db, 'referrals', `ref_${referrerId}_${refereeId}`);
    const existing = await getDoc(pairRef);
    if (existing.exists()) return; // Already rewarded

    const settings = await this.getSettings();
    const referrerReward = settings.referralRewardReferrer || 1000;
    const refereeReward = settings.referralRewardReferee || 500;

    const referrerBalRef = doc(db, 'balances', `telegram_${referrerId}`);
    const referrerSnap = await getDoc(referrerBalRef);

    if (referrerSnap.exists()) {
      const current = referrerSnap.data() as IBalance;
      await updateDoc(referrerBalRef, {
        coins: current.coins + referrerReward,
        totalEarned: current.totalEarned + referrerReward,
        updatedAt: Date.now(),
      });

      await this.recordTransaction({
        userId: referrerId,
        type: 'referral_reward',
        amount: referrerReward,
        status: 'completed',
        description: `Referral bonus: Invited new player (${refereeId})`,
      });
    }

    await setDoc(pairRef, {
      referrerId,
      refereeId,
      rewardPaid: true,
      referrerCoins: referrerReward,
      refereeCoins: refereeReward,
      createdAt: new Date().toISOString(),
    });
  },

  async getReferralStats(telegramId: string): Promise<{
    totalReferrals: number;
    totalEarnedFromReferrals: number;
    referrals: Array<{ refereeId: string; date: string; reward: number }>;
  }> {
    const refCol = collection(db, 'referrals');
    const q = query(refCol, where('referrerId', '==', telegramId), limit(50));
    const snap = await getDocs(q);

    let totalReferrals = 0;
    let totalEarnedFromReferrals = 0;
    const referrals: Array<{ refereeId: string; date: string; reward: number }> = [];

    snap.forEach((d) => {
      const data = d.data();
      totalReferrals++;
      totalEarnedFromReferrals += data.referrerCoins || 1000;
      referrals.push({
        refereeId: data.refereeId,
        date: data.createdAt,
        reward: data.referrerCoins || 1000,
      });
    });

    return { totalReferrals, totalEarnedFromReferrals, referrals };
  },

  // ========================================================
  // LEADERBOARD
  // ========================================================
  async getLeaderboard(
    category: 'coins' | 'referrals' | 'level' = 'coins',
    limitCount: number = 100
  ): Promise<ILeaderboardEntry[]> {
    const balancesRef = collection(db, 'balances');
    const q = query(balancesRef, orderBy('coins', 'desc'), limit(limitCount));
    const snap = await getDocs(q);

    const entries: ILeaderboardEntry[] = [];
    let rank = 1;

    for (const docSnap of snap.docs) {
      const bal = docSnap.data() as IBalance;
      const user = await this.getUser(bal.userId);
      entries.push({
        rank: rank++,
        telegramId: bal.userId,
        username: user?.username,
        firstName: user?.firstName || `Player ${bal.userId.slice(-4)}`,
        score: bal.coins,
        level: bal.level || 1,
      });
    }

    return entries;
  },

  // ========================================================
  // WALLET & WITHDRAWALS
  // ========================================================
  async submitWithdrawalRequest(
    telegramId: string,
    pointsAmount: number,
    method: string,
    destinationAddress: string
  ): Promise<IWithdrawal> {
    const user = await this.getUser(telegramId);
    if (!user) throw new Error('User not found');
    if (user.status === 'suspended') throw new Error('Account suspended');

    const settings = await this.getSettings();
    if (!settings.withdrawalsEnabled) {
      throw new Error('Withdrawals are temporarily disabled for maintenance.');
    }
    if (pointsAmount < settings.minWithdrawalAmount) {
      throw new Error(`Minimum withdrawal amount is ${settings.minWithdrawalAmount.toLocaleString()} IWA Coins`);
    }
    if (pointsAmount > settings.maxWithdrawalAmount) {
      throw new Error(`Maximum withdrawal amount is ${settings.maxWithdrawalAmount.toLocaleString()} IWA Coins`);
    }

    const withdrawalId = `wdr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const withdrawalDocRef = doc(db, 'withdrawals', withdrawalId);
    const balanceDocRef = doc(db, 'balances', `telegram_${telegramId}`);

    const withdrawal: IWithdrawal = {
      id: withdrawalId,
      userId: telegramId,
      pointsAmount,
      method,
      destinationAddress,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Atomically reserve points from user balance
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(balanceDocRef);
      if (!snap.exists()) throw new Error('Balance record not found');
      const balance = snap.data() as IBalance;

      if (balance.coins < pointsAmount) {
        throw new Error('Insufficient IWA Coin balance for this withdrawal request');
      }

      txn.update(balanceDocRef, {
        coins: balance.coins - pointsAmount,
        totalSpent: (balance.totalSpent || 0) + pointsAmount,
        updatedAt: Date.now(),
      });

      txn.set(withdrawalDocRef, withdrawal);
    });

    await this.recordTransaction({
      userId: telegramId,
      type: 'withdrawal_reservation',
      amount: -pointsAmount,
      status: 'pending',
      description: `Withdrawal request submitted via ${method} to ${destinationAddress}`,
      idempotencyKey: withdrawalId,
    });

    return withdrawal;
  },

  async updateWithdrawalStatus(
    withdrawalId: string,
    newStatus: 'approved' | 'rejected' | 'completed',
    adminEmail: string,
    adminNotes?: string
  ): Promise<IWithdrawal> {
    const wDocRef = doc(db, 'withdrawals', withdrawalId);
    const snap = await getDoc(wDocRef);
    if (!snap.exists()) throw new Error('Withdrawal request not found');

    const wData = snap.data() as IWithdrawal;
    if (wData.status === 'completed' || wData.status === 'rejected') {
      throw new Error(`Withdrawal request is already in terminal state: ${wData.status}`);
    }

    // If rejected, refund the reserved points atomically
    if (newStatus === 'rejected') {
      const balRef = doc(db, 'balances', `telegram_${wData.userId}`);
      await runTransaction(db, async (txn) => {
        const balSnap = await txn.get(balRef);
        if (balSnap.exists()) {
          const bal = balSnap.data() as IBalance;
          txn.update(balRef, {
            coins: bal.coins + wData.pointsAmount,
            totalSpent: Math.max(0, (bal.totalSpent || 0) - wData.pointsAmount),
            updatedAt: Date.now(),
          });
        }
        txn.update(wDocRef, {
          status: 'rejected',
          adminNotes: adminNotes || 'Rejected by administrator',
          processedBy: adminEmail,
          updatedAt: new Date().toISOString(),
        });
      });

      await this.recordTransaction({
        userId: wData.userId,
        type: 'withdrawal_refund',
        amount: wData.pointsAmount,
        status: 'refunded',
        description: `Refund for rejected withdrawal request ${withdrawalId}`,
      });
    } else {
      await updateDoc(wDocRef, {
        status: newStatus,
        adminNotes: adminNotes || '',
        processedBy: adminEmail,
        updatedAt: new Date().toISOString(),
      });
    }

    await this.logAudit({
      adminEmail,
      action: `WITHDRAWAL_${newStatus.toUpperCase()}`,
      targetUserId: wData.userId,
      previousValue: wData.status,
      newValue: newStatus,
      reason: adminNotes || `Status changed to ${newStatus}`,
    });

    return { ...wData, status: newStatus, adminNotes, processedBy: adminEmail, updatedAt: new Date().toISOString() };
  },

  // ========================================================
  // TRANSACTIONS LEDGER
  // ========================================================
  async recordTransaction(tx: Omit<ITransaction, 'id' | 'createdAt'>): Promise<ITransaction> {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const fullTx: Record<string, any> = {
      ...tx,
      id,
      createdAt: new Date().toISOString(),
    };
    // Strip undefined properties for Firestore
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(fullTx)) {
      if (v !== undefined) cleaned[k] = v;
    }
    try {
      await setDoc(doc(db, 'transactions', id), cleaned);
    } catch (e) {
      console.error('Failed to write transaction record:', e);
    }
    return fullTx as ITransaction;
  },

  async getUserTransactions(telegramId: string, limitCount: number = 30): Promise<ITransaction[]> {
    const txRef = collection(db, 'transactions');
    const q = query(txRef, where('userId', '==', telegramId), orderBy('createdAt', 'desc'), limit(limitCount));
    try {
      const snap = await getDocs(q);
      const list: ITransaction[] = [];
      snap.forEach((d) => list.push(d.data() as ITransaction));
      return list;
    } catch {
      // Fallback query without compound index if index is building
      const fallbackQ = query(txRef, where('userId', '==', telegramId), limit(limitCount));
      const snap = await getDocs(fallbackQ);
      const list: ITransaction[] = [];
      snap.forEach((d) => list.push(d.data() as ITransaction));
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  // ========================================================
  // AUDIT LOGGING
  // ========================================================
  async logAudit(entry: Omit<IAuditLog, 'id' | 'timestamp'>): Promise<void> {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullEntry: IAuditLog = {
      ...entry,
      id,
      timestamp: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'audit_logs', id), fullEntry);
    } catch (e) {
      console.error('Audit log failed:', e);
    }
  },

  // ========================================================
  // ADMIN OPERATIONS
  // ========================================================
  async getAdminStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalCoinsIssued: number;
    totalReferrals: number;
    completedTasks: number;
    pendingWithdrawals: number;
  }> {
    const usersSnap = await getDocs(collection(db, 'users'));
    const balancesSnap = await getDocs(collection(db, 'balances'));
    const referralsSnap = await getDocs(collection(db, 'referrals'));
    const completionsSnap = await getDocs(collection(db, 'task_completions'));
    const withdrawalsSnap = await getDocs(collection(db, 'withdrawals'));

    let totalCoinsIssued = 0;
    balancesSnap.forEach((d) => {
      totalCoinsIssued += (d.data() as IBalance).totalEarned || 0;
    });

    let pendingWithdrawals = 0;
    withdrawalsSnap.forEach((d) => {
      if ((d.data() as IWithdrawal).status === 'pending') pendingWithdrawals++;
    });

    return {
      totalUsers: usersSnap.size,
      activeUsers: usersSnap.size,
      totalCoinsIssued,
      totalReferrals: referralsSnap.size,
      completedTasks: completionsSnap.size,
      pendingWithdrawals,
    };
  },

  async adjustUserBalance(
    telegramId: string,
    amount: number,
    reason: string,
    adminEmail: string
  ): Promise<IBalance> {
    const balRef = doc(db, 'balances', `telegram_${telegramId}`);
    const snap = await getDoc(balRef);
    if (!snap.exists()) throw new Error('User balance record not found');

    const bal = snap.data() as IBalance;
    const newCoins = Math.max(0, bal.coins + amount);
    const newTotal = amount > 0 ? bal.totalEarned + amount : bal.totalEarned;

    await updateDoc(balRef, {
      coins: newCoins,
      totalEarned: newTotal,
      updatedAt: Date.now(),
    });

    await this.recordTransaction({
      userId: telegramId,
      type: 'admin_adjustment',
      amount,
      status: 'completed',
      description: `Admin balance adjustment by ${adminEmail}: ${reason}`,
    });

    await this.logAudit({
      adminEmail,
      action: 'ADJUST_BALANCE',
      targetUserId: telegramId,
      previousValue: String(bal.coins),
      newValue: String(newCoins),
      reason,
    });

    return { ...bal, coins: newCoins, totalEarned: newTotal };
  },

  async updateUserStatus(
    telegramId: string,
    status: 'active' | 'suspended',
    reason: string,
    adminEmail: string
  ): Promise<IUser> {
    const userRef = doc(db, 'users', `telegram_${telegramId}`);
    const snap = await getDoc(userRef);
    if (!snap.exists()) throw new Error('User not found');

    const user = snap.data() as IUser;
    await updateDoc(userRef, { status });

    await this.logAudit({
      adminEmail,
      action: `USER_${status.toUpperCase()}`,
      targetUserId: telegramId,
      previousValue: user.status,
      newValue: status,
      reason,
    });

    return { ...user, status };
  },
};
