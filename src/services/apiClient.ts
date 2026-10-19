import {
  IUser,
  IBalance,
  ITask,
  ITransaction,
  IWithdrawal,
  ISettings,
  ILeaderboardEntry,
} from '../../packages/shared/src/types.ts';

const TOKEN_KEY = 'iwa_auth_token';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY);
    }
  }

  public setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY);
    }
    return this.token;
  }

  public clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}`);
    }

    return data as T;
  }

  // ==========================================
  // AUTH
  // ==========================================
  async authenticateTelegram(initData: string, referrerId?: string) {
    const data = await this.request<{
      token: string;
      user: IUser;
      balance: IBalance;
      isNewUser: boolean;
    }>('/api/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData, referrerId }),
    });

    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  // ==========================================
  // USER
  // ==========================================
  async getUser() {
    return this.request<{ user: IUser; balance: IBalance; settings: ISettings }>('/api/user');
  }

  async getProfile() {
    return this.request<{
      user: IUser;
      balance: IBalance;
      referralCount: number;
      referralEarnings: number;
      tasksCompletedCount: number;
    }>('/api/user/profile');
  }

  // ==========================================
  // TAP ENGINE
  // ==========================================
  async sendTaps(count: number, nonce: string) {
    return this.request<{
      coinsEarned: number;
      newBalance: number;
      newEnergy: number;
      maxEnergy: number;
      level: number;
      leveledUp: boolean;
      levelBonusAwarded: number;
      levelTitle: string;
      tapMultiplier: number;
    }>('/api/tap', {
      method: 'POST',
      body: JSON.stringify({
        count,
        nonce,
        clientTimestamp: Date.now(),
      }),
    });
  }

  // ==========================================
  // DAILY REWARDS
  // ==========================================
  async claimDailyReward() {
    return this.request<{
      dayNumber: number;
      rewardAmount: number;
      newStreak: number;
      newBalance: number;
    }>('/api/daily-reward/claim', {
      method: 'POST',
    });
  }

  // ==========================================
  // TASKS
  // ==========================================
  async getTasks() {
    return this.request<{ tasks: ITask[]; completedTaskIds: string[] }>('/api/tasks');
  }

  async verifyTask(taskId: string) {
    return this.request<{
      success: boolean;
      rewardAmount: number;
      newBalance: number;
    }>('/api/tasks/verify', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  }

  // ==========================================
  // REFERRALS
  // ==========================================
  async getReferrals() {
    return this.request<{
      totalReferrals: number;
      totalEarnedFromReferrals: number;
      referralLink: string;
      referrerReward: number;
      refereeReward: number;
      referrals: Array<{ refereeId: string; date: string; reward: number }>;
    }>('/api/referrals');
  }

  // ==========================================
  // LEADERBOARD
  // ==========================================
  async getLeaderboard(category: 'coins' | 'referrals' | 'level' = 'coins') {
    return this.request<{
      leaderboard: ILeaderboardEntry[];
      userRank: number | null;
    }>(`/api/leaderboard?category=${category}`);
  }

  // ==========================================
  // WALLET & WITHDRAWALS
  // ==========================================
  async getWallet() {
    return this.request<{
      balance: IBalance;
      transactions: ITransaction[];
      settings: {
        minWithdrawalAmount: number;
        maxWithdrawalAmount: number;
        withdrawalsEnabled: boolean;
      };
    }>('/api/wallet');
  }

  async requestWithdrawal(pointsAmount: number, method: string, destinationAddress: string) {
    return this.request<{ success: boolean; withdrawal: IWithdrawal }>('/api/withdraw', {
      method: 'POST',
      body: JSON.stringify({ pointsAmount, method, destinationAddress }),
    });
  }

  async getTransactions(limit: number = 30) {
    return this.request<{ transactions: ITransaction[] }>(`/api/transactions?limit=${limit}`);
  }

  // ==========================================
  // ADMIN DASHBOARD
  // ==========================================
  async getAdminDashboard(adminSecret?: string) {
    return this.request<{
      stats: {
        totalUsers: number;
        activeUsers: number;
        totalCoinsIssued: number;
        totalReferrals: number;
        completedTasks: number;
        pendingWithdrawals: number;
      };
      settings: ISettings;
    }>('/api/admin/dashboard', {
      headers: adminSecret ? { 'x-admin-secret': adminSecret } : undefined,
    });
  }

  async adminAdjustBalance(telegramId: string, amount: number, reason: string, adminSecret?: string) {
    return this.request<{ success: boolean; balance: IBalance }>(
      `/api/admin/users/${telegramId}/adjust-balance`,
      {
        method: 'POST',
        headers: adminSecret ? { 'x-admin-secret': adminSecret } : undefined,
        body: JSON.stringify({ amount, reason }),
      }
    );
  }

  async adminUpdateUserStatus(telegramId: string, status: 'active' | 'suspended', reason: string, adminSecret?: string) {
    return this.request<{ success: boolean; user: IUser }>(
      `/api/admin/users/${telegramId}/status`,
      {
        method: 'PATCH',
        headers: adminSecret ? { 'x-admin-secret': adminSecret } : undefined,
        body: JSON.stringify({ status, reason }),
      }
    );
  }

  async adminCreateTask(taskData: Partial<ITask>, adminSecret?: string) {
    return this.request<{ success: boolean; task: ITask }>('/api/admin/tasks', {
      method: 'POST',
      headers: adminSecret ? { 'x-admin-secret': adminSecret } : undefined,
      body: JSON.stringify(taskData),
    });
  }

  async adminUpdateWithdrawal(withdrawalId: string, status: string, adminNotes: string, adminSecret?: string) {
    return this.request<{ success: boolean; withdrawal: IWithdrawal }>(
      `/api/admin/withdrawals/${withdrawalId}`,
      {
        method: 'PATCH',
        headers: adminSecret ? { 'x-admin-secret': adminSecret } : undefined,
        body: JSON.stringify({ status, adminNotes }),
      }
    );
  }

  async adminUpdateSettings(settingsUpdates: Partial<ISettings>, adminSecret?: string) {
    return this.request<{ success: boolean; settings: ISettings }>('/api/admin/settings', {
      method: 'PATCH',
      headers: adminSecret ? { 'x-admin-secret': adminSecret } : undefined,
      body: JSON.stringify(settingsUpdates),
    });
  }
}

export const api = new ApiClient();
