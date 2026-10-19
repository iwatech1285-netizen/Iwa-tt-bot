import React, { useState, useEffect } from 'react';
import { Users, Copy, Check, Share2, Gift, Sparkles, UserPlus } from 'lucide-react';
import { api } from '../services/apiClient.ts';
import { triggerHaptic } from '../services/telegramSdk.ts';
import { sounds } from '../utils/audio.ts';

export const FriendsScreen: React.FC = () => {
  const [data, setData] = useState<{
    totalReferrals: number;
    totalEarnedFromReferrals: number;
    referralLink: string;
    referrerReward: number;
    refereeReward: number;
    referrals: Array<{ refereeId: string; date: string; reward: number }>;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        setLoading(true);
        const res = await api.getReferrals();
        setData(res);
      } catch (err) {
        console.error('Error fetching referrals:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReferrals();
  }, []);

  const handleCopyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    triggerHaptic('success');
    sounds.playTap();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTelegram = () => {
    if (!data?.referralLink) return;
    triggerHaptic('medium');
    const shareText = 'Join me on IWA BOT 🚀! Tap, earn, and collect your 500 IWA Coin welcome bonus!';
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      data.referralLink
    )}&text=${encodeURIComponent(shareText)}`;

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const referrerReward = data?.referrerReward || 1000;
  const refereeReward = data?.refereeReward || 500;

  return (
    <div className="flex flex-col h-full pb-24 px-4 max-w-lg mx-auto select-none overflow-y-auto">
      {/* Header */}
      <div className="pt-3 pb-3 text-center">
        <h1 className="text-2xl font-black text-white tracking-tight">Invite Friends</h1>
        <p className="text-xs text-slate-400 mt-1">
          Share your referral link to earn points whenever a friend joins IWA BOT.
        </p>
      </div>

      {/* Rewards Explainer Card */}
      <div className="mb-4 p-4 rounded-3xl bg-gradient-to-br from-cyan-950/40 via-[#0d1322] to-violet-950/40 border border-cyan-500/25 shadow-xl">
        <div className="grid grid-cols-2 gap-3 divide-x divide-slate-800">
          <div className="pr-2">
            <span className="text-[10px] uppercase font-semibold text-cyan-400 tracking-wider">
              For You
            </span>
            <div className="text-xl font-black text-white mt-0.5">
              +{referrerReward.toLocaleString()}{' '}
              <span className="text-xs font-normal text-cyan-300">IWA</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">For each friend invited</p>
          </div>

          <div className="pl-3">
            <span className="text-[10px] uppercase font-semibold text-violet-400 tracking-wider">
              For Your Friend
            </span>
            <div className="text-xl font-black text-white mt-0.5">
              +{refereeReward.toLocaleString()}{' '}
              <span className="text-xs font-normal text-violet-300">IWA</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Instant starter bonus</p>
          </div>
        </div>
      </div>

      {/* Referral Link & Share Buttons */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-slate-800 mb-5">
        <label className="text-xs font-semibold text-slate-300 block mb-2">Your Personal Invite Link</label>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            readOnly
            value={data?.referralLink || 'Loading link...'}
            className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 font-mono truncate select-all outline-none"
          />
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white hover:border-cyan-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-cyan-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <button
          onClick={handleShareTelegram}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
        >
          <Share2 className="w-4 h-4" />
          <span>Share on Telegram</span>
        </button>
      </div>

      {/* Referral Summary Counters */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-slate-800 text-center">
          <div className="text-xs text-slate-400">Total Friends</div>
          <div className="text-2xl font-bold text-white mt-1 tabular-nums">
            {data?.totalReferrals || 0}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-slate-800 text-center">
          <div className="text-xs text-slate-400">Total Referral Earnings</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1 tabular-nums">
            {(data?.totalEarnedFromReferrals || 0).toLocaleString()} <span className="text-xs">IWA</span>
          </div>
        </div>
      </div>

      {/* Friends List */}
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2.5 px-1">
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            Invited Friends ({data?.referrals.length || 0})
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <span className="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full" />
          </div>
        ) : !data?.referrals || data.referrals.length === 0 ? (
          <div className="py-10 text-center rounded-2xl bg-white/[0.01] border border-slate-800/60 p-6">
            <UserPlus className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No friends joined yet.</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Send your link to friends to start earning bonus coins together!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.referrals.map((ref, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-white/[0.02] border border-slate-800/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-mono text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      Player {ref.refereeId.slice(-4)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(ref.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-cyan-300 tabular-nums">
                    +{ref.reward.toLocaleString()} IWA
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
