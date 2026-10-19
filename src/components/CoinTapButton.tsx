import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ASSETS } from '../assets/assetRegistry.ts';
import { triggerHaptic } from '../services/telegramSdk.ts';
import { sounds } from '../utils/audio.ts';

interface FloatingText {
  id: number;
  x: number;
  y: number;
  value: number;
}

interface CoinTapButtonProps {
  energy: number;
  maxEnergy: number;
  multiplier: number;
  disabled?: boolean;
  onTapBatch: (count: number) => Promise<void>;
}

export const CoinTapButton: React.FC<CoinTapButtonProps> = ({
  energy,
  multiplier,
  disabled = false,
  onTapBatch,
}) => {
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [isPressing, setIsPressing] = useState(false);
  const nextId = useRef(1);

  // Batched tap accumulator
  const pendingTaps = useRef(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const flushTaps = useCallback(async () => {
    if (pendingTaps.current <= 0) return;
    const countToSend = pendingTaps.current;
    pendingTaps.current = 0;
    try {
      await onTapBatch(countToSend);
    } catch {
      // Revert if error
    }
  }, [onTapBatch]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || energy <= 0) {
      triggerHaptic('error');
      return;
    }

    setIsPressing(true);
    triggerHaptic('light');
    sounds.playTap();

    // Calculate coordinate relative to coin container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const reward = multiplier;
    const newParticle: FloatingText = {
      id: nextId.current++,
      x,
      y,
      value: reward,
    };

    setFloatingTexts((prev) => [...prev.slice(-15), newParticle]);

    // Schedule particle cleanup
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((p) => p.id !== newParticle.id));
    }, 900);

    // Increment pending taps
    pendingTaps.current += 1;

    // Reset debounce timer
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      flushTaps();
    }, 350);
  };

  const handlePointerUp = () => {
    setIsPressing(false);
  };

  return (
    <div className="relative flex items-center justify-center my-auto py-4 select-none touch-none">
      {/* Outer ambient glow circles */}
      <div className="absolute w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
      <div className="absolute w-60 h-60 rounded-full bg-violet-600/20 blur-2xl pointer-events-none" />

      {/* Main interactive Coin target */}
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`relative z-10 w-64 h-64 sm:w-72 sm:h-72 rounded-full p-2 cursor-pointer transition-transform duration-100 ease-out ${
          isPressing ? 'scale-[0.93]' : 'scale-100 hover:scale-[1.02]'
        } ${disabled || energy <= 0 ? 'opacity-60 cursor-not-allowed filter grayscale-[30%]' : ''}`}
      >
        {/* Animated Cybernetic Outer Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30 shadow-[0_0_25px_rgba(6,182,212,0.35)] animate-[spin_20s_linear_infinite]" />
        <div className="absolute inset-1.5 rounded-full border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)] animate-[spin_15s_linear_infinite_reverse]" />

        {/* Coin Image Container */}
        <div className="w-full h-full rounded-full overflow-hidden bg-[#0d1322] border-4 border-slate-900 shadow-2xl relative">
          <img
            src={ASSETS.coin}
            alt="IWA Coin"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover pointer-events-none drop-shadow-2xl"
          />
          {/* Subtle glossy sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/10 to-white/10 pointer-events-none" />
        </div>

        {/* Floating Reward Particle Numbers */}
        {floatingTexts.map((f) => (
          <span
            key={f.id}
            style={{ left: f.x, top: f.y }}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 font-extrabold text-2xl sm:text-3xl text-cyan-300 drop-shadow-[0_0_10px_#06b6d4] pointer-events-none animate-float-fade"
          >
            +{f.value}
          </span>
        ))}
      </div>
    </div>
  );
};
