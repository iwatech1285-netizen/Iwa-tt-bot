import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Coins,
  Send,
} from 'lucide-react';
import { IBalance, ITransaction, IWithdrawal } from '../../packages/shared/src/types.ts';
import { api } from '../services/apiClient.ts';
import { triggerHaptic } from '../services/telegramSdk.ts';
import { sounds } from '../utils/audio.ts';

interface WalletScreenProps {
  balance: IBalance | null;
  onBalanceUpdated: (newBalance: number) => void;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({ balance, onBalanceUpdated }) => {
  const [transactions, setTransactions] = useState<ITransaction[]>([]);
  const [settings, setSettings] = useState<{
    minWithdrawalAmount: number;
    maxWithdrawalAmount: number;
    withdrawalsEnabled: boolean;
  } | null>(null);

  // Withdrawal Form State
  const [pointsAmount, setPointsAmount] = useState<number>(1000);
  const [method, setMethod] = useState<'TON' | 'USDT_TRC20' | 'PAYPAL'>('TON');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchWalletData = async () => {
    try {
      const res = await api.getWallet();
      setTransactions(res.transactions);
      setSettings(res.settings);
    } catch (err) {
      console.error('Failed to load wallet data:', err);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationAddress.trim()) {
      setErrorMsg('Please enter a destination address or account');
      return;
    }
    if (!balance || pointsAmount > balance.coins) {
      setErrorMsg('Insufficient IWA Coin balance');
      return;
    }
    if (settings && pointsAmount < settings.minWithdrawalAmount) {
      setErrorMsg(`Minimum withdrawal is ${settings.minWithdrawalAmount.toLocaleString()} IWA Coins`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    triggerHaptic('medium');

    try {
      const res = await api.requestWithdrawal(pointsAmount, method, destinationAddress);
      triggerHaptic('success');
      sounds.playReward();

      setSuccessMsg(
        `Withdrawal request for ${pointsAmount.toLocaleString()} IWA Points submitted! Status: Pending review.`
      );
      onBalanceUpdated(balance.coins - pointsAmount);
      setDestinationAddress('');
      fetchWalletData();
    } catch (err) {
      triggerHaptic('error');
      setErrorMsg(err instanceof Error ? err.message : 'Withdrawal request failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ITransaction['status']) => {
    switch (status) {
      case 'completed':
        return <span className="text-[10px] text-emerald-400 font-semibold">Completed</span>;
      case 'pending':
        return <span className="text-[10px] text-amber-400 font-semibold">Pending</span>;
      case 'refunded':
        return <span className="text-[10px] text-cyan-400 font-semibold">Refunded</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full pb-24 px-4 max-w-lg mx-auto select-none overflow-y-auto">
      {/* Header */}
      <div className="pt-3 pb-3 text-center">
        <h1 className="text-2xl font-black text-white tracking-tight">Points Wallet</h1>
        <p className="text-xs text-slate-400 mt-1">
          Review your points ledger and manage redemption requests.
        </p>
      </div>

      {/* Primary Balance Summary Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-cyan-950/40 via-[#0d1322] to-violet-950/40 border border-cyan-500/25 shadow-xl mb-4">
        <div className="text-xs text-slate-400">Available Points Balance</div>
        <div className="text-3xl sm:text-4xl font-black text-white mt-1 tabular-nums">
          {(balance?.coins || 0).toLocaleString()} <span className="text-sm font-bold text-cyan-400">IWA</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500">Lifetime Earned:</span>
            <div className="font-semibold text-slate-200">
              {(balance?.totalEarned || 0).toLocaleString()} IWA
            </div>
          </div>
          <div>
            <span className="text-slate-500">Spent / Reserved:</span>
            <div className="font-semibold text-slate-200">
              {(balance?.totalSpent || 0).toLocaleString()} IWA
            </div>
          </div>
        </div>

        {/* Regulatory Disclaimer */}
        <div className="mt-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 leading-relaxed">
          ⚠️ <span className="font-semibold text-slate-300">Disclaimer:</span> IWA Coin is an in-app reward point unit
          used for gamified engagement. It does not represent legal tender, investment, or cryptocurrency.
        </div>
      </div>

      {/* Withdrawal Form */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-slate-800 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Submit Redemption Request
          </h3>
          <span className="text-[10px] text-slate-400">
            Min: {settings?.minWithdrawalAmount.toLocaleString() || '1,000'} IWA
          </span>
        </div>

        {errorMsg && (
          <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleWithdrawalSubmit} className="space-y-3">
          {/* Method Selector */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Redemption Route</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['TON', 'USDT_TRC20', 'PAYPAL'] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => {
                    triggerHaptic('light');
                    setMethod(m);
                  }}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-colors ${
                    method === m
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m === 'USDT_TRC20' ? 'USDT TRC20' : m}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Points Amount to Redeem</label>
            <input
              type="number"
              min={settings?.minWithdrawalAmount || 1000}
              max={balance?.coins || 1000000}
              value={pointsAmount}
              onChange={(e) => setPointsAmount(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500"
            />
          </div>

          {/* Destination Address */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              Destination Address / Account
            </label>
            <input
              type="text"
              placeholder={
                method === 'TON'
                  ? 'EQ...'
                  : method === 'USDT_TRC20'
                  ? 'T...'
                  : 'user@example.com'
              }
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !settings?.withdrawalsEnabled}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold text-xs transition-all shadow-md shadow-cyan-500/20 hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Request for Verification</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Transaction History Ledger */}
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            Transaction Ledger
          </span>
          <span>{transactions.length} Records</span>
        </div>

        {transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 bg-white/[0.01] border border-slate-800 rounded-xl p-4">
            No transactions recorded yet. Tap or claim rewards to build your history!
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const isPositive = tx.amount > 0;

              return (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-white/[0.02] border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                        isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 capitalize">
                        {tx.type.replace('_', ' ')}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[170px]">
                        {tx.description}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-xs font-bold tabular-nums ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} IWA
                    </div>
                    <div>{getStatusBadge(tx.status)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
