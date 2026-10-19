import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, User } from 'lucide-react';
import { ILeaderboardEntry } from '../../packages/shared/src/types.ts';
import { api } from '../services/apiClient.ts';
import { triggerHaptic } from '../services/telegramSdk.ts';

type Category = 'coins' | 'referrals' | 'level';

export const LeaderboardScreen: React.FC = () => {
  const [category, setCategory] = useState<Category>('coins');
  const [entries, setEntries] = useState<ILeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async (cat: Category) => {
    try {
      setLoading(true);
      const res = await api.getLeaderboard(cat);
      setEntries(res.leaderboard);
      setUserRank(res.userRank);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(category);
  }, [category]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="flex flex-col h-full pb-24 px-4 max-w-lg mx-auto select-none overflow-y-auto">
      {/* Header */}
      <div className="pt-3 pb-3 text-center">
        <h1 className="text-2xl font-black text-white tracking-tight">Leaderboard</h1>
        <p className="text-xs text-slate-400 mt-1">
          Top players across the decentralized IWA ecosystem.
        </p>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-slate-800 rounded-xl mb-4">
        {(['coins', 'referrals', 'level'] as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => {
              triggerHaptic('light');
              setCategory(cat);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
              category === cat
                ? 'bg-gradient-to-r from-cyan-500/30 to-violet-500/30 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat === 'coins' ? 'Total Coins' : cat === 'referrals' ? 'Referrals' : 'Tier Level'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <span className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-2 items-end mb-6 pt-4">
              {/* Rank 2 (Silver) */}
              {top3[1] && (
                <div className="flex flex-col items-center">
                  <div className="relative mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-slate-400 flex items-center justify-center text-slate-300 font-bold shadow-lg">
                      {top3[1].firstName.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-400 text-slate-900 font-black text-[10px] flex items-center justify-center border border-slate-900">
                      2
                    </div>
                  </div>
                  <div className="text-xs font-bold text-slate-200 truncate max-w-[85px] text-center">
                    {top3[1].firstName}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 tabular-nums">
                    {top3[1].score.toLocaleString()}
                  </div>
                  <div className="w-full h-14 rounded-t-xl bg-slate-800/40 border-t border-slate-700/60 mt-2" />
                </div>
              )}

              {/* Rank 1 (Gold) */}
              {top3[0] && (
                <div className="flex flex-col items-center">
                  <Crown className="w-6 h-6 text-amber-400 mb-1 animate-bounce" />
                  <div className="relative mb-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-amber-300/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 font-bold shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                      {top3[0].firstName.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center border border-slate-900 shadow">
                      1
                    </div>
                  </div>
                  <div className="text-xs font-bold text-white truncate max-w-[95px] text-center">
                    {top3[0].firstName}
                  </div>
                  <div className="text-xs font-bold text-amber-300 tabular-nums">
                    {top3[0].score.toLocaleString()}
                  </div>
                  <div className="w-full h-20 rounded-t-xl bg-gradient-to-b from-amber-500/20 to-slate-900/60 border-t border-amber-400/40 mt-2 shadow-[0_0_15px_rgba(251,191,36,0.15)]" />
                </div>
              )}

              {/* Rank 3 (Bronze) */}
              {top3[2] && (
                <div className="flex flex-col items-center">
                  <div className="relative mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-amber-900/40 border-2 border-amber-700/80 flex items-center justify-center text-amber-400 font-bold shadow-lg">
                      {top3[2].firstName.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-700 text-white font-black text-[10px] flex items-center justify-center border border-slate-900">
                      3
                    </div>
                  </div>
                  <div className="text-xs font-bold text-slate-200 truncate max-w-[85px] text-center">
                    {top3[2].firstName}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 tabular-nums">
                    {top3[2].score.toLocaleString()}
                  </div>
                  <div className="w-full h-10 rounded-t-xl bg-amber-950/20 border-t border-amber-800/40 mt-2" />
                </div>
              )}
            </div>
          )}

          {/* User Rank Sticky Banner */}
          {userRank && (
            <div className="mb-4 p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-300 font-black text-xs">
                  #{userRank}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Your Global Position</div>
                  <div className="text-[10px] text-slate-400">Keep tapping to climb ranks</div>
                </div>
              </div>
              <span className="text-xs font-bold text-cyan-300">Top Ranker</span>
            </div>
          )}

          {/* Ranked List (Rank 4+) */}
          <div className="space-y-2">
            {rest.map((entry) => (
              <div
                key={entry.telegramId}
                className="p-3 rounded-xl bg-white/[0.02] border border-slate-800/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 text-center text-xs font-bold text-slate-500 tabular-nums">
                    #{entry.rank}
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-semibold text-xs">
                    {entry.firstName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                      {entry.firstName}
                    </div>
                    <div className="text-[10px] text-slate-500">Level {entry.level}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-200 tabular-nums">
                    {entry.score.toLocaleString()}
                  </span>
                  <div className="text-[10px] text-slate-500">IWA</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
