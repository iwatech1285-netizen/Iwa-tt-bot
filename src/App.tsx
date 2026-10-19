import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { IUser, IBalance, ISettings } from '../packages/shared/src/types.ts';
import { DEFAULT_SETTINGS } from '../packages/shared/src/defaults.ts';
import { api } from './services/apiClient.ts';
import { getTelegramWebApp, triggerHaptic } from './services/telegramSdk.ts';
import { sounds } from './utils/audio.ts';
import { testConnection } from './lib/firebase.ts';
import { TopBar } from './components/TopBar.tsx';
import { Navigation, NavTab } from './components/Navigation.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { EarnScreen } from './screens/EarnScreen.tsx';
import { FriendsScreen } from './screens/FriendsScreen.tsx';
import { LeaderboardScreen } from './screens/LeaderboardScreen.tsx';
import { WalletScreen } from './screens/WalletScreen.tsx';
import { ProfileScreen } from './screens/ProfileScreen.tsx';
import { DailyRewardsModal } from './components/DailyRewardsModal.tsx';
import { LevelModal } from './components/LevelModal.tsx';
import { AdminModal } from './components/AdminModal.tsx';
import { SponsorModal } from './components/SponsorModal.tsx';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [user, setUser] = useState<IUser | null>(null);
  const [balance, setBalance] = useState<IBalance | null>(null);
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);

  // 60 Coins Milestone Auto-Ad Opener
  const ADSTERRA_URL = 'https://auctionr.org/4/ad02e8c2da3bad7b121661fffaa4dbdd';
  const coinsCollectedCounterRef = useRef<number>(0);
  const nextCoinAdMilestoneRef = useRef<number>(60);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);

  const checkAndTriggerCoinAd = (earned: number) => {
    if (!earned || earned <= 0) return;
    coinsCollectedCounterRef.current += earned;

    if (coinsCollectedCounterRef.current >= nextCoinAdMilestoneRef.current) {
      nextCoinAdMilestoneRef.current += 60; // Advance to next 60-coin milestone
      setMilestoneToast('🎉 60 Coins Collected! Opening Sponsor Offer...');
      setTimeout(() => setMilestoneToast(null), 3500);

      triggerHaptic('success');
      sounds.playReward();

      try {
        if (window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(ADSTERRA_URL);
        } else {
          window.open(ADSTERRA_URL, '_blank', 'noopener,noreferrer');
        }
      } catch (err) {
        console.error('Failed to auto-open ad link:', err);
      }
    }
  };

  // 1. Initial Authentication & Firestore Boot
  useEffect(() => {
    async function initApp() {
      try {
        // Test connection to Firestore safely
        await testConnection().catch((e) => console.warn('Firestore connection check notice:', e));

        const tg = getTelegramWebApp();
        let initDataString = '';
        let startParam: string | undefined;

        if (tg && tg.initData && tg.initData.length > 0) {
          tg.ready();
          tg.expand();
          initDataString = tg.initData;
          startParam = tg.initDataUnsafe?.start_param;
        } else {
          // Fallback for browser preview / development test environment
          const queryParams = new URLSearchParams(window.location.search);
          const ref = queryParams.get('start') || undefined;
          initDataString =
            'demo=true&user=%7B%22id%22%3A99887766%2C%22first_name%22%3A%22IWA%22%2C%22username%22%3A%22iwa_explorer%22%7D&auth_date=1770000000&hash=demo';
          startParam = ref;
        }

        const authRes = await api.authenticateTelegram(initDataString, startParam);
        setUser(authRes.user);
        setBalance(authRes.balance);

        // Fetch settings
        const userRes = await api.getUser();
        setSettings(userRes.settings);
      } catch (err) {
        console.warn('Backend connection notice (running resilient client fallback mode):', err);
        // Resilient fallback: Prevents white screen if deployed statically on GitHub Pages
        setUser({
          telegramId: '99887766',
          username: 'iwa_explorer',
          firstName: 'IWA Explorer',
          status: 'active',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        });
        setBalance({
          userId: '99887766',
          coins: 0,
          totalEarned: 0,
          totalSpent: 0,
          totalTaps: 0,
          energy: 1000,
          maxEnergy: 1000,
          lastEnergyUpdateAt: Date.now(),
          level: 1,
          streakDays: 0,
          updatedAt: Date.now(),
        });
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    }

    initApp();
  }, []);

  // 2. Client-Side Energy Smooth Regeneration Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setBalance((prev) => {
        if (!prev) return prev;
        const maxEnergy = settings?.maxEnergy || prev.maxEnergy || 1000;
        const regenRate = settings?.energyRegenRatePerSec || 1;
        if (prev.energy >= maxEnergy) return prev;
        return {
          ...prev,
          energy: Math.min(maxEnergy, prev.energy + regenRate),
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [settings]);

  // 1-Minute Sponsor Offer Trigger
  useEffect(() => {
    const sponsorTimer = setTimeout(() => {
      setIsSponsorModalOpen(true);
    }, 60 * 1000); // 1 minute (60 seconds)

    return () => clearTimeout(sponsorTimer);
  }, []);

  // 3. Batched Tap Execution Handler
  const handleTapBatch = async (count: number) => {
    if (!balance || balance.energy < count) return;

    // Optimistically update energy for instant visual smoothness
    setBalance((prev) => (prev ? { ...prev, energy: Math.max(0, prev.energy - count) } : prev));

    const nonce = `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      const res = await api.sendTaps(count, nonce);

      // Confirm authoritative server balance and level
      setBalance((prev) =>
        prev
          ? {
              ...prev,
              coins: res.newBalance,
              energy: res.newEnergy,
              maxEnergy: res.maxEnergy,
              level: res.level,
            }
          : prev
      );

      // Check if 60 coins threshold collected
      checkAndTriggerCoinAd(res.coinsEarned);

      // Level-up celebration
      if (res.leveledUp) {
        triggerHaptic('success');
        sounds.playReward();
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981'],
        });
      }
    } catch (err) {
      console.warn('Tap batch network notice (applying client fallback):', err);
      setBalance((prev) => {
        if (!prev) return prev;
        const earned = count * (prev.level || 1);
        checkAndTriggerCoinAd(earned);
        return {
          ...prev,
          coins: prev.coins + earned,
          totalEarned: prev.totalEarned + earned,
          totalTaps: (prev.totalTaps || 0) + count,
        };
      });
    }
  };

  const handleDailyClaimSuccess = (
    claimedAmount: number,
    newStreak: number,
    newBalance: number
  ) => {
    setBalance((prev) =>
      prev
        ? {
            ...prev,
            coins: newBalance,
            streakDays: newStreak,
            lastDailyClaimDate: new Date().toISOString().split('T')[0],
          }
        : prev
    );
  };

  const handleRewardReceived = (amount: number, newBalance: number) => {
    setBalance((prev) => (prev ? { ...prev, coins: newBalance } : prev));
    checkAndTriggerCoinAd(amount);
  };

  const todayUtc = new Date().toISOString().split('T')[0];
  const hasUnclaimedDaily = balance?.lastDailyClaimDate !== todayUtc;

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#090d16] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <span className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-slate-300">
            Initializing IWA BOT...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans antialiased overflow-x-hidden">
      {/* Top Bar Header */}
      <TopBar
        user={user}
        balance={balance}
        onOpenLevelModal={() => setIsLevelModalOpen(true)}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onOpenProfile={() => setCurrentTab('profile')}
      />

      {/* 60 Coins Auto-Ad Milestone Toast */}
      {milestoneToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-violet-600 to-cyan-500 text-white font-bold text-xs shadow-2xl backdrop-blur-md animate-bounce border border-amber-300/40 flex items-center gap-2 max-w-[90vw] text-center">
          <span>{milestoneToast}</span>
        </div>
      )}

      {/* Main Viewport Screen Router */}
      <main className="flex-1 flex flex-col max-w-lg w-full mx-auto relative overflow-hidden">
        {currentTab === 'home' && (
          <HomeScreen
            user={user}
            balance={balance}
            settings={settings}
            onTapBatch={handleTapBatch}
            onOpenDailyModal={() => setIsDailyModalOpen(true)}
            onOpenLevelModal={() => setIsLevelModalOpen(true)}
          />
        )}
        {currentTab === 'earn' && (
          <EarnScreen
            balance={balance}
            onOpenDailyModal={() => setIsDailyModalOpen(true)}
            onRewardReceived={handleRewardReceived}
          />
        )}
        {currentTab === 'friends' && <FriendsScreen />}
        {currentTab === 'leaderboard' && <LeaderboardScreen />}
        {currentTab === 'wallet' && (
          <WalletScreen
            balance={balance}
            onBalanceUpdated={(newBal) =>
              setBalance((prev) => (prev ? { ...prev, coins: newBal } : prev))
            }
          />
        )}
        {currentTab === 'profile' && (
          <ProfileScreen
            user={user}
            balance={balance}
            onOpenLevelModal={() => setIsLevelModalOpen(true)}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        unclaimedDaily={hasUnclaimedDaily}
      />

      {/* Modals */}
      <DailyRewardsModal
        isOpen={isDailyModalOpen}
        onClose={() => setIsDailyModalOpen(false)}
        currentStreak={balance?.streakDays || 0}
        lastClaimDate={balance?.lastDailyClaimDate}
        onClaimSuccess={handleDailyClaimSuccess}
      />

      <LevelModal
        isOpen={isLevelModalOpen}
        onClose={() => setIsLevelModalOpen(false)}
        totalEarned={balance?.totalEarned || 0}
      />

      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

      <SponsorModal
        isOpen={isSponsorModalOpen}
        onClose={() => setIsSponsorModalOpen(false)}
        onClaimReward={(bonus) => {
          setBalance((prev) => (prev ? { ...prev, coins: prev.coins + bonus } : prev));
        }}
      />
    </div>
  );
}
