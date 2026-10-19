import React from 'react';
import { X, Award, Zap, ChevronRight, Check } from 'lucide-react';
import { DEFAULT_LEVELS } from '../../packages/shared/src/defaults.ts';
import { determineUserLevel } from '../../apps/api/src/services/tapEngine.ts';

interface LevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalEarned: number;
}

export const LevelModal: React.FC<LevelModalProps> = ({ isOpen, onClose, totalEarned }) => {
  if (!isOpen) return null;

  const { currentLevel, config, nextConfig, progressPercent } = determineUserLevel(
    totalEarned,
    DEFAULT_LEVELS
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#0d1322] border border-cyan-500/30 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.05] border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-3 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Award className="w-6 h-6" />
          </div>
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">Tier Status</span>
          <h2 className="text-2xl font-bold tracking-tight text-white mt-0.5">
            Level {currentLevel}: {config.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tap multiplier: <span className="text-cyan-300 font-bold">x{config.tapMultiplier}</span> per tap
          </p>
        </div>

        {/* Level Progress Bar */}
        {nextConfig ? (
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.02] border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400">Progress to Level {nextConfig.level} ({nextConfig.title})</span>
              <span className="text-cyan-400 font-semibold">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2">
              <span>{totalEarned.toLocaleString()} IWA</span>
              <span>Need {nextConfig.minCoinsRequired.toLocaleString()} IWA</span>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-center text-xs text-cyan-300 font-semibold">
            👑 Maximum Tier Reached: Legend Status
          </div>
        )}

        {/* Levels List */}
        <div className="space-y-2">
          {DEFAULT_LEVELS.map((lvl) => {
            const isUnlocked = totalEarned >= lvl.minCoinsRequired;
            const isCurrent = lvl.level === currentLevel;

            return (
              <div
                key={lvl.level}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-r from-cyan-950/40 to-violet-950/40 border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                    : isUnlocked
                    ? 'bg-white/[0.02] border-slate-800/80 text-slate-300'
                    : 'bg-white/[0.01] border-slate-900 text-slate-600 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isCurrent
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : isUnlocked
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-slate-900 text-slate-600'
                    }`}
                  >
                    {isUnlocked && !isCurrent ? <Check className="w-4 h-4 text-cyan-500" /> : lvl.level}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                      {lvl.title}
                      {isCurrent && (
                        <span className="text-[9px] uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Req: {lvl.minCoinsRequired.toLocaleString()} IWA
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-cyan-300">x{lvl.tapMultiplier}</span>
                  {lvl.bonusReward > 0 && (
                    <div className="text-[9px] text-emerald-400">+{lvl.bonusReward.toLocaleString()} bonus</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
