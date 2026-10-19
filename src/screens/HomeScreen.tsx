import React, { useState, useEffect } from 'react';
import { Zap, Flame, Award, ChevronRight, Gift } from 'lucide-react';
import { IUser, IBalance, ISettings } from '../../packages/shared/src/types.ts';
import { CoinTapButton } from '../components/CoinTapButton.tsx';
import { determineUserLevel } from '../../apps/api/src/services/tapEngine.ts';
import { DEFAULT_LEVELS } from '../../packages/shared/src/defaults.ts';

interface HomeScreenProps {
  user: IUser | null;
  balance: IBalance | null;
  settings: ISettings | null;
  onTapBatch: (count: number) => Promise<void>;
  onOpenDailyModal: () => void;
  onOpenLevelModal: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  balance,
  settings,
  onTapBatch,
  onOpenDailyModal,
  onOpenLevelModal,
}) => {
  const coins = balance?.coins || 0;
  const energy = balance?.energy || 1000;
  const maxEnergy = settings?.maxEnergy || balance?.maxEnergy || 1000;
  const totalEarned = balance?.totalEarned || 0;
  const streak = balance?.streakDays || 0;

  const { currentLevel, config, nextConfig, progressPercent } = determineUserLevel(
    totalEarned,
    settings?.levelsConfig || DEFAULT_LEVELS
  );

  const todayUtc = new Date().toISOString().split('T')[0];
  const isDailyClaimedToday = balance?.lastDailyClaimDate === todayUtc;

  // Energy percentage
  const energyPercent = Math.min(100, Math.max(0, Math.round((energy / maxEnergy) * 100)));

  return (
    <div className="flex flex-col h-full justify-between pb-24 px-4 max-w-lg mx-auto select-none">
      {/* 1. Header Level & Streak Strip */}
      <div className="grid grid-cols-2 gap-2.5 pt-2">
        {/* Level Card */}
        <button
          onClick={onOpenLevelModal}
          className="p-3 rounded-2xl bg-white/[0.03] border border-cyan-500/20 text-left hover:border-cyan-500/40 transition-colors flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-cyan-400 font-semibold">
              <Award className="w-3.5 h-3.5" />
              Level {currentLevel}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-300 transition-colors" />
          </div>
          <div className="text-sm font-bold text-slate-100 truncate mt-1">{config.title}</div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </button>

        {/* Daily Streak Card */}
        <button
          onClick={onOpenDailyModal}
          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between group cursor-pointer ${
            !isDailyClaimedToday
              ? 'bg-gradient-to-br from-violet-950/40 to-cyan-950/40 border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
              : 'bg-white/[0.03] border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-amber-400 font-semibold">
              <Flame className="w-3.5 h-3.5" />
              Streak {streak}d
            </span>
            {!isDailyClaimedToday && (
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
            )}
          </div>
          <div className="text-sm font-bold text-slate-100 mt-1 flex items-center justify-between">
            <span>Daily Reward</span>
            <Gift className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-[10px] text-slate-400 mt-2">
            {!isDailyClaimedToday ? (
              <span className="text-cyan-300 font-semibold">Ready to claim!</span>
            ) : (
              <span>Claimed for today</span>
            )}
          </div>
        </button>
      </div>

      {/* 2. Primary Balance Display */}
      <div className="text-center my-2">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          IWA Coin Balance
        </div>
        <div className="text-4xl sm:text-5xl font-black tracking-tight text-white mt-1 drop-shadow-[0_0_20px_rgba(6,182,212,0.35)] tabular-nums flex items-center justify-center gap-2">
          <span>{coins.toLocaleString()}</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-2">
          <span>Multiplier: <span className="text-cyan-400 font-semibold">x{config.tapMultiplier}</span></span>
          <span>·</span>
          <span>Earned: {totalEarned.toLocaleString()}</span>
        </div>
      </div>

      {/* 3. Interactive Central Coin Button */}
      <CoinTapButton
        energy={energy}
        maxEnergy={maxEnergy}
        multiplier={config.tapMultiplier}
        onTapBatch={onTapBatch}
      />

      {/* 4. Energy Meter Indicator */}
      <div className="w-full bg-white/[0.02] border border-cyan-500/15 rounded-2xl p-3.5 backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
          <div className="flex items-center gap-1.5 text-cyan-300">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Energy Capacity</span>
          </div>
          <span className="text-slate-200 tabular-nums font-semibold">
            {energy} / {maxEnergy}
          </span>
        </div>

        <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 p-0.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-cyan-400 to-violet-500 transition-all duration-300 shadow-[0_0_10px_#06b6d4]"
            style={{ width: `${energyPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5">
          <span>+1 Energy / second</span>
          <span>{energyPercent}% Charged</span>
        </div>
      </div>
    </div>
  );
};
