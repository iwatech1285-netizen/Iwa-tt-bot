import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Users,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../services/apiClient.ts';
import { ISettings, ITask, IWithdrawal } from '../../packages/shared/src/types.ts';
import { triggerHaptic } from '../services/telegramSdk.ts';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AdminTab = 'overview' | 'users' | 'tasks' | 'withdrawals' | 'settings';

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const [adminSecret, setAdminSecret] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalCoinsIssued: 0,
    totalReferrals: 0,
    completedTasks: 0,
    pendingWithdrawals: 0,
  });
  const [currentSettings, setCurrentSettings] = useState<ISettings | null>(null);

  // User management state
  const [targetUserId, setTargetUserId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState<number>(1000);
  const [adjustReason, setAdjustReason] = useState('Promotional grant');
  const [suspensionReason, setSuspensionReason] = useState('Suspicious automated activity');

  // Task creation state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskReward, setNewTaskReward] = useState(1000);
  const [newTaskUrl, setNewTaskUrl] = useState('https://t.me/iwacoin_channel');
  const [newTaskType, setNewTaskType] = useState<ITask['type']>('telegram_channel');

  const handleClose = () => {
    setAdminSecret('');
    setIsAuthenticated(false);
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  // Load Dashboard Data
  const loadDashboard = async () => {
    if (!adminSecret.trim()) {
      setError('Please enter the Admin Setup Secret');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminDashboard(adminSecret);
      setStats(data.stats);
      setCurrentSettings(data.settings);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin authentication failed');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && adminSecret) {
      loadDashboard();
    }
  }, [isOpen]);

  const handleAdjustBalance = async () => {
    if (!targetUserId || !adjustAmount || !adjustReason) {
      setError('Please provide User ID, Amount, and Reason');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.adminAdjustBalance(targetUserId, adjustAmount, adjustReason, adminSecret);
      setSuccessMsg(`Successfully adjusted balance by ${adjustAmount} for ${targetUserId}`);
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Balance adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: 'active' | 'suspended') => {
    if (!targetUserId) {
      setError('Please enter a target User ID');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.adminUpdateUserStatus(targetUserId, status, suspensionReason, adminSecret);
      setSuccessMsg(`User ${targetUserId} status set to ${status}`);
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !newTaskReward || !newTaskUrl) {
      setError('Please fill out all task fields');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.adminCreateTask(
        {
          title: newTaskTitle,
          description: newTaskDesc,
          rewardAmount: newTaskReward,
          type: newTaskType,
          actionUrl: newTaskUrl,
          active: true,
        },
        adminSecret
      );
      setSuccessMsg(`Task "${newTaskTitle}" created successfully!`);
      setNewTaskTitle('');
      setNewTaskDesc('');
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSettings) return;
    setLoading(true);
    setError(null);
    try {
      await api.adminUpdateSettings(currentSettings, adminSecret);
      setSuccessMsg('Global settings updated and saved to Firestore!');
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-3xl bg-[#090d16] border border-violet-500/30 p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">IWA BOT Admin Console</h2>
              <p className="text-[11px] text-slate-400">Secure Firestore & Server Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={() => {
                  setAdminSecret('');
                  setIsAuthenticated(false);
                }}
                className="px-2.5 py-1 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                Lock Admin
              </button>
            )}
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/[0.05] border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Authentication Secret Gate */}
        {!isAuthenticated ? (
          <div className="py-8 text-center max-w-sm mx-auto">
            <Shield className="w-12 h-12 text-violet-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold">Admin Authorization Required</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Enter the admin secret password to unlock administrative controls.
            </p>
            <input
              type="password"
              placeholder="Enter Admin Password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm mb-3 text-center focus:border-violet-500 outline-none text-white placeholder-slate-500"
            />
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-sm transition-colors cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Unlock Admin Portal'}
            </button>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 py-3 border-b border-slate-800 overflow-x-auto">
              {(['overview', 'users', 'tasks', 'settings'] as AdminTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab(tab);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
              <button
                onClick={loadDashboard}
                title="Refresh Metrics"
                className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-cyan-400"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Notification Messages */}
            {error && (
              <div className="my-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="my-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
                {successMsg}
              </div>
            )}

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Total Users</span>
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="text-xl font-bold text-white">{stats.totalUsers.toLocaleString()}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Total Points Issued</span>
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="text-xl font-bold text-amber-400">{stats.totalCoinsIssued.toLocaleString()}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Referrals Formed</span>
                        <Users className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                      <div className="text-xl font-bold text-violet-400">{stats.totalReferrals.toLocaleString()}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Tasks Completed</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-xl font-bold text-emerald-400">{stats.completedTasks.toLocaleString()}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Pending Withdrawals</span>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      </div>
                      <div className="text-xl font-bold text-rose-400">{stats.pendingWithdrawals}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Engine Status</span>
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="text-sm font-semibold text-emerald-400 mt-1">OPERATIONAL</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: USERS */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Adjust User Balance & Status
                    </h4>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Target Telegram ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 99887766"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Coin Adjustment Amount</label>
                        <input
                          type="number"
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(parseInt(e.target.value, 10))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Mandatory Audit Reason</label>
                        <input
                          type="text"
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleAdjustBalance}
                        disabled={loading}
                        className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold transition-colors"
                      >
                        Execute Balance Adjustment
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus('suspended')}
                        disabled={loading}
                        className="flex-1 py-2 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 text-xs font-semibold hover:bg-rose-600/30"
                      >
                        Suspend User
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('active')}
                        disabled={loading}
                        className="flex-1 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30"
                      >
                        Reactivate User
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TASKS */}
              {activeTab === 'tasks' && (
                <form onSubmit={handleCreateTask} className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Create New Task
                  </h4>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Subscribe to IWA YouTube"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="Watch our tutorial video"
                      value={newTaskDesc}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Reward (IWA)</label>
                      <input
                        type="number"
                        value={newTaskReward}
                        onChange={(e) => setNewTaskReward(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Type</label>
                      <select
                        value={newTaskType}
                        onChange={(e) => setNewTaskType(e.target.value as ITask['type'])}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                      >
                        <option value="telegram_channel">Telegram Channel</option>
                        <option value="telegram_group">Telegram Group</option>
                        <option value="website">Website Visit</option>
                        <option value="social">Social Media</option>
                        <option value="custom">Custom Task</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Action URL</label>
                    <input
                      type="url"
                      value={newTaskUrl}
                      onChange={(e) => setNewTaskUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold transition-colors mt-2"
                  >
                    Publish Task to Firestore
                  </button>
                </form>
              )}

              {/* TAB 4: SETTINGS */}
              {activeTab === 'settings' && currentSettings && (
                <form onSubmit={handleUpdateSettings} className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Game Engine Parameters
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Max Energy Capacity</label>
                      <input
                        type="number"
                        value={currentSettings.maxEnergy}
                        onChange={(e) =>
                          setCurrentSettings({ ...currentSettings, maxEnergy: parseInt(e.target.value, 10) })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Energy Regen / Sec</label>
                      <input
                        type="number"
                        value={currentSettings.energyRegenRatePerSec}
                        onChange={(e) =>
                          setCurrentSettings({
                            ...currentSettings,
                            energyRegenRatePerSec: parseFloat(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Referral (Inviter)</label>
                      <input
                        type="number"
                        value={currentSettings.referralRewardReferrer}
                        onChange={(e) =>
                          setCurrentSettings({
                            ...currentSettings,
                            referralRewardReferrer: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Referral (New User)</label>
                      <input
                        type="number"
                        value={currentSettings.referralRewardReferee}
                        onChange={(e) =>
                          setCurrentSettings({
                            ...currentSettings,
                            referralRewardReferee: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold transition-colors mt-2"
                  >
                    Save Global Settings
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
