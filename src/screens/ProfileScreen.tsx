import React, { useState, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Award,
  Zap,
  Users,
  CheckCircle2,
  Calendar,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { IUser, IBalance } from '../../packages/shared/src/types.ts';
import { api } from '../services/apiClient.ts';
import { triggerHaptic } from '../services/telegramSdk.ts';

interface ProfileScreenProps {
  user: IUser | null;
  balance: IBalance | null;
  onOpenLevelModal: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  balance,
  onOpenLevelModal,
}) => {
  const [profileDetails, setProfileDetails] = useState<{
    referralCount: number;
    referralEarnings: number;
    tasksCompletedCount: number;
  } | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await api.getProfile();
        setProfileDetails({
          referralCount: data.referralCount,
          referralEarnings: data.referralEarnings,
          tasksCompletedCount: data.tasksCompletedCount,
        });
      } catch (err) {
        console.error('Failed to load profile details:', err);
      }
    };
    loadProfile();
  }, []);

  const totalTaps = balance?.totalTaps || 0;
  const totalEarned = balance?.totalEarned || 0;
  const level = balance?.level || 1;

  return (
    <div className="flex flex-col h-full pb-24 px-4 max-w-lg mx-auto select-none overflow-y-auto">
      {/* Profile Header Card */}
      <div className="pt-4 pb-6 text-center">
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500/20 via-violet-500/20 to-slate-900 border-2 border-cyan-400/40 flex items-center justify-center text-cyan-300 font-black text-3xl mx-auto shadow-[0_0_25px_rgba(6,182,212,0.25)] mb-3">
          {user?.firstName ? user.firstName.charAt(0).toUpperCase() : <User className="w-10 h-10" />}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#090d16] flex items-center justify-center text-slate-950">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white flex items-center justify-center gap-1.5">
          <span>{user?.firstName || 'Player'}</span>
          {user?.lastName && <span>{user.lastName}</span>}
        </h2>

        {user?.username && (
          <div className="text-xs text-cyan-400 font-mono mt-0.5">@{user.username}</div>
        )}

        <div className="flex items-center justify-center gap-2 mt-2 text-xs text-slate-400">
          <span className="font-mono text-[11px]">ID: {user?.telegramId || '---'}</span>
          <span>·</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Verified Active
          </span>
        </div>
      </div>

      {/* Account Metric Grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Tier Status</span>
            <Award className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-white">Level {level}</div>
          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenLevelModal();
            }}
            className="text-[11px] text-cyan-400 hover:underline mt-1 block"
          >
            View Benefits & Progress →
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Taps</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-white tabular-nums">{totalTaps.toLocaleString()}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Manual Taps</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Referrals</span>
            <Users className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {profileDetails?.referralCount || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            +{(profileDetails?.referralEarnings || 0).toLocaleString()} IWA bonus
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Tasks Done</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {profileDetails?.tasksCompletedCount || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Completed missions</span>
        </div>
      </div>

      {/* Community Links & Support */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-slate-800 space-y-2.5">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          Community & Resources
        </h4>

        <a
          href="https://t.me/iwacoin_channel"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 text-xs text-slate-200 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span>Official Announcements Channel</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
        </a>

        <a
          href="https://t.me/iwacoin_community"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 text-xs text-slate-200 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-violet-400" />
            <span>Miners Discussion Group</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
        </a>
      </div>
    </div>
  );
};
