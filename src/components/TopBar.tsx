import React, { useState } from 'react';
import { Volume2, VolumeX, Shield, User, Flame } from 'lucide-react';
import { IUser, IBalance } from '../../packages/shared/src/types.ts';
import { sounds } from '../utils/audio.ts';
import { triggerHaptic } from '../services/telegramSdk.ts';

interface TopBarProps {
  user: IUser | null;
  balance: IBalance | null;
  onOpenLevelModal: () => void;
  onOpenAdminModal: () => void;
  onOpenProfile: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  balance,
  onOpenLevelModal,
  onOpenAdminModal,
  onOpenProfile,
}) => {
  const [muted, setMuted] = useState(!sounds.isEnabled());

  const handleToggleSound = () => {
    const isNowEnabled = sounds.toggleSound();
    setMuted(!isNowEnabled);
    triggerHaptic('light');
  };

  const streak = balance?.streakDays || 0;
  const level = balance?.level || 1;

  return (
    <header className="sticky top-0 z-30 w-full bg-[#090d16]/90 backdrop-blur-md border-b border-cyan-500/10 px-4 py-2.5 max-w-lg mx-auto">
      <div className="flex items-center justify-between gap-3">
        {/* Left: User Profile Pill */}
        <button
          onClick={() => {
            triggerHaptic('light');
            onOpenProfile();
          }}
          className="flex items-center gap-2 text-left group min-h-[44px] cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-sm shadow-[0_0_12px_rgba(6,182,212,0.15)]">
            {user?.firstName ? user.firstName.charAt(0).toUpperCase() : <User className="w-4 h-4 text-cyan-400" />}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-100 truncate max-w-[110px] group-hover:text-cyan-300 transition-colors">
              {user?.firstName || 'Player'}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="text-cyan-400 font-medium">Lvl {level}</span>
              {streak > 0 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center text-amber-400">
                    <Flame className="w-3 h-3 inline mr-0.5" />
                    {streak}d
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2">
          {/* Level Progress Trigger */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenLevelModal();
            }}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-cyan-500/20 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/10 transition-colors flex items-center gap-1 min-h-[38px]"
          >
            <span>Level {level}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            aria-label="Toggle sound"
            className="w-9 h-9 rounded-lg bg-white/[0.04] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Admin Dashboard Trigger */}
          <button
            onClick={() => {
              triggerHaptic('medium');
              onOpenAdminModal();
            }}
            title="Administrator Portal"
            className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 transition-colors"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
