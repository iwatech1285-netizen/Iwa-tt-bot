import React, { useState, useEffect } from 'react';
import {
  Zap,
  Check,
  ExternalLink,
  Flame,
  Globe,
  MessageCircle,
  Share2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ITask, IBalance } from '../../packages/shared/src/types.ts';
import { api } from '../services/apiClient.ts';
import { triggerHaptic } from '../services/telegramSdk.ts';
import { sounds } from '../utils/audio.ts';

interface EarnScreenProps {
  balance: IBalance | null;
  onOpenDailyModal: () => void;
  onRewardReceived: (rewardAmount: number, newBalance: number) => void;
}

export const EarnScreen: React.FC<EarnScreenProps> = ({
  balance,
  onOpenDailyModal,
  onRewardReceived,
}) => {
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [actionDoneMap, setActionDoneMap] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getTasks();
      setTasks(data.tasks);
      setCompletedIds(data.completedTaskIds);
    } catch (err) {
      setErrorMsg('Failed to load tasks. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleActionClick = (task: ITask) => {
    triggerHaptic('light');
    setActionDoneMap((prev) => ({ ...prev, [task.id]: true }));
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(task.actionUrl);
    } else {
      window.open(task.actionUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleVerify = async (task: ITask) => {
    setVerifyingTaskId(task.id);
    setErrorMsg(null);
    triggerHaptic('medium');

    try {
      const res = await api.verifyTask(task.id);
      triggerHaptic('success');
      sounds.playReward();

      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#06b6d4', '#8b5cf6', '#10b981'],
      });

      setCompletedIds((prev) => [...prev, task.id]);
      onRewardReceived(res.rewardAmount, res.newBalance);
    } catch (err) {
      triggerHaptic('error');
      setErrorMsg(err instanceof Error ? err.message : 'Task verification failed');
    } finally {
      setVerifyingTaskId(null);
    }
  };

  const getTaskIcon = (type: ITask['type']) => {
    switch (type) {
      case 'telegram_channel':
      case 'telegram_group':
        return MessageCircle;
      case 'website':
        return Globe;
      case 'social':
        return Share2;
      default:
        return Zap;
    }
  };

  const streak = balance?.streakDays || 0;
  const todayUtc = new Date().toISOString().split('T')[0];
  const isDailyClaimed = balance?.lastDailyClaimDate === todayUtc;

  return (
    <div className="flex flex-col h-full pb-24 px-4 max-w-lg mx-auto select-none overflow-y-auto">
      {/* Banner / Header */}
      <div className="pt-3 pb-4 text-center">
        <h1 className="text-2xl font-black text-white tracking-tight">Earn IWA Coins</h1>
        <p className="text-xs text-slate-400 mt-1">
          Complete verified missions and tasks to supercharge your point balance.
        </p>
      </div>

      {/* Featured: Daily Streak Banner */}
      <div
        onClick={onOpenDailyModal}
        className={`mb-5 p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between shadow-lg ${
          !isDailyClaimed
            ? 'bg-gradient-to-r from-violet-950/60 via-slate-900 to-cyan-950/60 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:border-cyan-400'
            : 'bg-white/[0.02] border-slate-800 text-slate-400'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.3)]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Daily Check-in</span>
              {streak > 0 && (
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center">
                  <Flame className="w-3 h-3 mr-0.5 inline" /> {streak}d Streak
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {!isDailyClaimed ? 'Claim your daily reward now' : 'Claimed for today'}
            </div>
          </div>
        </div>

        <button className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-colors">
          {!isDailyClaimed ? 'Claim' : 'View'}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Task List Section */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
        <span className="font-semibold uppercase tracking-wider text-slate-300">
          Available Tasks ({tasks.length})
        </span>
        <span>Verified Rewards</span>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <span className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const isCompleted = completedIds.includes(task.id);
            const isVerifying = verifyingTaskId === task.id;
            const hasClickedAction = actionDoneMap[task.id] || false;
            const Icon = getTaskIcon(task.type);

            return (
              <div
                key={task.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-2.5 ${
                  isCompleted
                    ? 'bg-white/[0.01] border-slate-800/60 opacity-60'
                    : 'bg-white/[0.03] border-cyan-500/15 hover:border-cyan-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? 'bg-slate-800 text-slate-500'
                          : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {isCompleted ? <Check className="w-5 h-5 text-cyan-500" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{task.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {task.description}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-cyan-300 tabular-nums">
                      +{task.rewardAmount.toLocaleString()}
                    </span>
                    <div className="text-[10px] text-slate-500">IWA</div>
                  </div>
                </div>

                {/* Task Actions */}
                {!isCompleted && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleActionClick(task)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-xs font-medium text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    <button
                      onClick={() => handleVerify(task)}
                      disabled={isVerifying || !hasClickedAction}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        hasClickedAction
                          ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white hover:brightness-110 shadow-md shadow-cyan-500/20'
                          : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-800'
                      }`}
                    >
                      {isVerifying ? (
                        <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <span>Verify & Claim</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
