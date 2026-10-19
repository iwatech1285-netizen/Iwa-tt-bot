import React from 'react';
import { Home, Zap, Users, Trophy, Wallet } from 'lucide-react';
import { triggerHaptic } from '../services/telegramSdk.ts';
import { sounds } from '../utils/audio.ts';

export type NavTab = 'home' | 'earn' | 'friends' | 'leaderboard' | 'wallet' | 'profile';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unclaimedDaily?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab, unclaimedDaily }) => {
  const tabs = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'earn' as NavTab, label: 'Earn', icon: Zap, badge: unclaimedDaily },
    { id: 'friends' as NavTab, label: 'Friends', icon: Users },
    { id: 'leaderboard' as NavTab, label: 'Ranks', icon: Trophy },
    { id: 'wallet' as NavTab, label: 'Wallet', icon: Wallet },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/95 backdrop-blur-xl border-t border-cyan-500/15 max-w-lg mx-auto">
      <div className="grid grid-cols-5 items-center h-16 px-1 pb-safe">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('light');
                sounds.playTap();
                onSelectTab(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center min-h-[48px] py-1 transition-all duration-200 ${
                isActive ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''
                  }`}
                />
                {tab.badge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-violet-500 animate-ping" />
                )}
              </div>
              <span
                className={`text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap ${
                  isActive ? 'text-cyan-400 font-semibold' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute bottom-1 w-6 h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 shadow-[0_0_8px_#06b6d4]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
