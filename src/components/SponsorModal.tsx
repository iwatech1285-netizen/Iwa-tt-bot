import React, { useState, useEffect } from 'react';
import { X, Gift, ExternalLink, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { triggerHaptic } from '../services/telegramSdk.ts';
import { sounds } from '../utils/audio.ts';

interface SponsorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimReward?: (amount: number) => void;
}

const SPONSOR_URL = 'https://auctionr.org/4/ad02e8c2da3bad7b121661fffaa4dbdd';

export const SponsorModal: React.FC<SponsorModalProps> = ({ isOpen, onClose, onClaimReward }) => {
  const [claimed, setClaimed] = useState(false);

  if (!isOpen) return null;

  const handleOpenLink = () => {
    triggerHaptic('success');
    sounds.playReward();

    // Trigger celebratory confetti
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.65 },
      colors: ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'],
    });

    if (!claimed && onClaimReward) {
      onClaimReward(500);
      setClaimed(true);
    }

    // Open sponsor URL
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(SPONSOR_URL);
    } else {
      window.open(SPONSOR_URL, '_blank', 'noopener,noreferrer');
    }

    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#0d1322] via-[#090d16] to-[#0d1322] border border-cyan-500/40 p-6 shadow-2xl text-slate-100 text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.05] border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Floating Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-cyan-500/20 blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-violet-500/30 to-amber-500/20 border-2 border-cyan-400/50 flex items-center justify-center text-cyan-300 mx-auto mb-4 shadow-[0_0_25px_rgba(6,182,212,0.3)] animate-bounce">
            <Gift className="w-8 h-8 text-amber-300" />
          </div>

          <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20 inline-flex items-center gap-1 mb-2">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Special Bonus Unlocked!
          </span>

          <h2 className="text-xl font-black tracking-tight text-white mt-1">
            Sponsored Reward Ready
          </h2>

          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            Thank you for playing IWA BOT! Visit our sponsored partner link to support the ecosystem and claim a bonus{' '}
            <span className="text-cyan-300 font-bold">+500 IWA Coins</span>!
          </p>

          <div className="my-5 p-3 rounded-2xl bg-white/[0.02] border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Bonus Reward:</span>
            <span className="font-bold text-amber-300 tabular-nums">+500 IWA</span>
          </div>

          <button
            onClick={handleOpenLink}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-violet-600 to-amber-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{claimed ? 'Opening Offer...' : 'Claim & Open Sponsor Link'}</span>
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
