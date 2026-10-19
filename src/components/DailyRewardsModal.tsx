import React, { useState } from 'react';
import { X, Calendar, Check, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DEFAULT_DAILY_REWARDS } from '../../packages/shared/src/defaults.ts';
import { api } from '../services/apiClient.ts';
import { triggerHaptic } from '../services/telegramSdk.ts';
import { sounds } from '../utils/audio.ts';

interface DailyRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStreak: number;
  lastClaimDate?: string;
  onClaimSuccess: (claimedAmount: number, newStreak: number, newBalance: number) => void;
}

export const DailyRewardsModal: React.FC<DailyRewardsModalProps> = ({
  isOpen,
  onClose,
  currentStreak,
  lastClaimDate,
  onClaimSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const todayUtc = new Date().toISOString().split('T')[0];
  const alreadyClaimedToday = lastClaimDate === todayUtc;

  // Next eligible day in 1..7 cycle
  const nextClaimDay = alreadyClaimedToday
    ? currentStreak % 7
    : ((currentStreak) % 7) + 1;

  const handleClaim = async () => {
    if (alreadyClaimedToday || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.claimDailyReward();
      triggerHaptic('success');
      sounds.playReward();

      // Launch celebratory confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'],
      });

      onClaimSuccess(res.rewardAmount, res.newStreak, res.newBalance);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      triggerHaptic('error');
      setError(err instanceof Error ? err.message : 'Failed to claim daily reward');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#0d1322] border border-cyan-500/30 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.05] border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-3 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Calendar className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Daily Streak Reward</h2>
          <p className="text-xs text-slate-400 mt-1">
            Check in every consecutive day to unlock up to 2,500 IWA Coins.
          </p>
        </div>

        {/* Calendar Grid (Days 1–7) */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {DEFAULT_DAILY_REWARDS.map((reward, index) => {
            const dayNum = index + 1;
            const isDayClaimed = alreadyClaimedToday
              ? dayNum <= (currentStreak % 7 || 7)
              : dayNum < (currentStreak % 7 + 1);
            const isToday = !alreadyClaimedToday && dayNum === nextClaimDay;
            const isDay7 = dayNum === 7;

            return (
              <div
                key={dayNum}
                className={`relative rounded-xl p-2.5 flex flex-col items-center justify-center border text-center transition-all ${
                  isDay7 ? 'col-span-2' : ''
                } ${
                  isDayClaimed
                    ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-300'
                    : isToday
                    ? 'bg-gradient-to-b from-cyan-500/20 to-violet-600/20 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse'
                    : 'bg-white/[0.02] border-slate-800 text-slate-500'
                }`}
              >
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 mb-1">
                  Day {dayNum}
                </span>

                <div className="my-1">
                  {isDayClaimed ? (
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-slate-100">+{reward.toLocaleString()}</span>
                  )}
                </div>

                <span className="text-[9px] text-slate-500">IWA</span>

                {isToday && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Claim Action Button */}
        <button
          onClick={handleClaim}
          disabled={alreadyClaimedToday || loading}
          className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg min-h-[48px] ${
            alreadyClaimedToday
              ? 'bg-slate-800/80 text-slate-400 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-cyan-500/25 hover:brightness-110 active:scale-[0.98]'
          }`}
        >
          {loading ? (
            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : alreadyClaimedToday ? (
            <>
              <Check className="w-4 h-4 text-cyan-400" />
              Claimed for Today (Streak: {currentStreak}d)
            </>
          ) : (
            <>
              <Flame className="w-4 h-4 text-amber-300" />
              Claim Day {nextClaimDay} Reward (+{DEFAULT_DAILY_REWARDS[nextClaimDay - 1]} IWA)
            </>
          )}
        </button>
      </div>
    </div>
  );
};
