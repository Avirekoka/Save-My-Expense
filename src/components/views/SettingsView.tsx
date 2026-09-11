import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  User,
  Shield,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Plus,
  Sparkles,
  CheckCircle2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  Target,
  BellRing,
  Send,
  Check,
  Zap,
  Sliders,
  Heart,
  ArrowRight,
  Camera,
  Link as LinkIcon,
  Phone,
  Briefcase,
} from 'lucide-react';
import { UserProfile, Category, FinancialGoal, NudgeTone } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, SUPPORTED_CURRENCIES, getCurrencySymbol } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { useAuth } from '../../services/firebase/AuthContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { WhatsAppIntegrationCard } from '../whatsapp/WhatsAppIntegrationCard';
import { ThemeToggleCard } from '../settings/ThemeToggleCard';

const AVATAR_PRESETS = [
  { id: '1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', label: 'Preset 1' },
  { id: '2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', label: 'Preset 2' },
  { id: '3', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', label: 'Preset 3' },
  { id: '4', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', label: 'Preset 4' },
  { id: '5', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', label: 'Preset 5' },
  { id: '6', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', label: 'Preset 6' },
];

interface SettingsViewProps {
  currencySymbol: string;
  onUpdateCurrency: (symbol: string) => void;
  onOpenAuthModal?: () => void;
  onNavigate?: (view: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currencySymbol,
  onUpdateCurrency,
  onOpenAuthModal,
  onNavigate,
}) => {
  const { user, logOut, updateUserData } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(storageService.getUserProfile());
  const [categories, setCategories] = useState<Category[]>(storageService.getCategories());
  const [goals, setGoals] = useState<FinancialGoal[]>(storageService.getGoals());
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366F1');
  const [newCatBudget, setNewCatBudget] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useScrollLock(showResetConfirm);

  // Profile Picture Editor State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [imageError, setImageError] = useState(false);

  // Daily Spending Limit & Goal Nudge Alert State
  const [dailyAlertEnabled, setDailyAlertEnabled] = useState<boolean>(
    profile.dailySpendingAlert?.enabled ?? true
  );
  const [thresholdInput, setThresholdInput] = useState<string>(
    (profile.dailySpendingAlert?.threshold ?? 2000).toString()
  );
  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    profile.dailySpendingAlert?.targetGoalId || 'goal_01'
  );
  const [selectedTone, setSelectedTone] = useState<NudgeTone>(
    profile.dailySpendingAlert?.nudgeTone || 'gentle'
  );
  const [dailySavedSuccess, setDailySavedSuccess] = useState<boolean>(false);
  const [testSentMessage, setTestSentMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      const p = storageService.getUserProfile();
      setProfile(p);
      setCategories(storageService.getCategories());
      setGoals(storageService.getGoals());
      if (p.dailySpendingAlert) {
        setDailyAlertEnabled(p.dailySpendingAlert.enabled);
        setThresholdInput(p.dailySpendingAlert.threshold.toString());
        setSelectedGoalId(p.dailySpendingAlert.targetGoalId || 'goal_01');
        setSelectedTone(p.dailySpendingAlert.nudgeTone || 'gentle');
      }
    };
    load();
    window.addEventListener(NOTIFY_EVENT, load);
    return () => window.removeEventListener(NOTIFY_EVENT, load);
  }, []);

  useEffect(() => {
    if (user) {
      const p = storageService.getUserProfile();
      setProfile(p);
    }
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('Please choose an image smaller than 3MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setProfile((prev) => ({ ...prev, photoURL: reader.result as string }));
          setImageError(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUrl = () => {
    if (customImageUrl.trim()) {
      setProfile((prev) => ({ ...prev, photoURL: customImageUrl.trim() }));
      setImageError(false);
      setShowUrlInput(false);
      setCustomImageUrl('');
    }
  };

  const handleRemovePhoto = () => {
    setProfile((prev) => ({ ...prev, photoURL: '' }));
    setImageError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const canonicalSymbol = getCurrencySymbol(profile.currencySymbol || profile.currency || '₹');
    const updatedProfile: UserProfile = {
      ...profile,
      currency: canonicalSymbol,
      currencySymbol: canonicalSymbol,
    };
    try {
      storageService.saveUserProfile(updatedProfile);
      if (updateUserData) {
        await updateUserData({
          displayName: updatedProfile.name,
          photoURL: updatedProfile.photoURL || null,
        });
      }
      onUpdateCurrency(canonicalSymbol);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newCat: Category = {
      id: `custom_${Date.now()}`,
      name: newCatName.trim(),
      icon: 'Tag',
      color: newCatColor,
      type: 'expense',
      isCustom: true,
      budgetMonthly: parseFloat(newCatBudget) || 5000,
    };

    storageService.saveCategory(newCat);
    setNewCatName('');
    setNewCatBudget('');
  };

  const handleConfirmResetData = () => {
    storageService.resetToSeedData();
    setShowResetConfirm(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3500);
  };

  const handleExportJSON = () => {
    const data = {
      profile: storageService.getUserProfile(),
      transactions: storageService.getTransactions(),
      categories: storageService.getCategories(),
      budgets: storageService.getBudgets(),
      goals: storageService.getGoals(),
      subscriptions: storageService.getSubscriptions(),
      statements: storageService.getStatements(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spend_intelligence_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleDailyAlert = () => {
    const nextState = !dailyAlertEnabled;
    setDailyAlertEnabled(nextState);
    const numThreshold = Math.max(1, parseFloat(thresholdInput) || 2000);
    const updatedProfile: UserProfile = {
      ...profile,
      dailySpendingAlert: {
        enabled: nextState,
        threshold: numThreshold,
        targetGoalId: selectedGoalId,
        nudgeTone: selectedTone,
        lastAlertDate: profile.dailySpendingAlert?.lastAlertDate,
      },
    };
    setProfile(updatedProfile);
    storageService.saveUserProfile(updatedProfile);
    setDailySavedSuccess(true);
    setTimeout(() => setDailySavedSuccess(false), 2500);
  };

  const handleSaveDailyAlertSettings = () => {
    const numThreshold = Math.max(1, parseFloat(thresholdInput) || 2000);
    const updatedProfile: UserProfile = {
      ...profile,
      dailySpendingAlert: {
        enabled: dailyAlertEnabled,
        threshold: numThreshold,
        targetGoalId: selectedGoalId,
        nudgeTone: selectedTone,
        lastAlertDate: profile.dailySpendingAlert?.lastAlertDate,
      },
    };
    setProfile(updatedProfile);
    storageService.saveUserProfile(updatedProfile);
    setDailySavedSuccess(true);
    setTimeout(() => setDailySavedSuccess(false), 2500);
  };

  const handleSendTestAlert = () => {
    storageService.checkDailySpendingAlert(undefined, true);
    setTestSentMessage('Test alert sent! Check your notification bell 🔔');
    setTimeout(() => setTestSentMessage(null), 4000);
  };

  const canonicalSymbol = getCurrencySymbol(profile.currencySymbol || profile.currency || currencySymbol || '₹');
  const isRupee = canonicalSymbol === '₹';
  const quickPresets = isRupee ? [500, 1000, 2000, 3500, 5000] : [25, 50, 100, 150, 250];

  const latestSpend = storageService.getTodayOrLatestDailySpending();
  const numThreshold = Math.max(1, parseFloat(thresholdInput) || 2000);
  const isOverLimit = latestSpend.total > numThreshold;
  const spendPct = Math.round((latestSpend.total / numThreshold) * 100);

  const activeGoal = goals.find((g) => g.id === selectedGoalId) || goals[0];
  const goalProgressPct =
    activeGoal && activeGoal.targetAmount > 0
      ? Math.round((activeGoal.currentAmount / activeGoal.targetAmount) * 100)
      : 0;

  // Compute preview message
  const previewOverAmount = Math.max(450, latestSpend.total - numThreshold > 0 ? latestSpend.total - numThreshold : 450);
  const previewSpent = numThreshold + previewOverAmount;
  let previewNudgeMessage = '';
  if (selectedTone === 'mindful') {
    previewNudgeMessage = `Mindful Check-in: Today's spending has reached ${canonicalSymbol}${previewSpent.toLocaleString()}, which is ${canonicalSymbol}${previewOverAmount.toLocaleString()} over your daily target of ${canonicalSymbol}${numThreshold.toLocaleString()}. Pausing non-essential spends for the rest of today helps protect your '${activeGoal?.name || 'Emergency Fund'}' goal (currently ${goalProgressPct}% completed)!`;
  } else if (selectedTone === 'motivational') {
    previewNudgeMessage = `Goal Nudge: You're ${canonicalSymbol}${previewOverAmount.toLocaleString()} past your daily threshold of ${canonicalSymbol}${numThreshold.toLocaleString()} (${canonicalSymbol}${previewSpent.toLocaleString()} total). Every conscious pause between now and midnight preserves funds directly for '${activeGoal?.name || 'Emergency Fund'}'!`;
  } else {
    previewNudgeMessage = `Gentle Nudge: You've spent ${canonicalSymbol}${previewSpent.toLocaleString()} today, crossing your daily limit of ${canonicalSymbol}${numThreshold.toLocaleString()}. Taking a mindful breather from optional purchases today keeps your '${activeGoal?.name || 'Emergency Fund'}' comfortably on track! 🎯`;
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Settings & Data Management
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Manage your personal profile, currency preferences, daily spending alerts, and financial data.
        </p>
      </div>

      {/* User Profile & Account Card */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 sm:p-6 shadow-xs">
        {/* Account Header: Only Name, Profile Picture, and Logout Button */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-6">
          <div className="flex items-center gap-3.5 min-w-0">
            {profile.photoURL && !imageError ? (
              <img
                src={profile.photoURL}
                alt={profile.name || 'User'}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border-2 border-blue-500/40 shadow-xs shrink-0"
              />
            ) : (
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-white text-lg sm:text-xl shadow-xs shrink-0">
                {(profile.name || user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {profile.name || user?.displayName || 'Personal Account'}
              </h2>
            </div>
          </div>

          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => logOut()}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 sm:px-4 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                title="Sign out of account"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            ) : (
              onOpenAuthModal && (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition cursor-pointer shadow-xs"
                >
                  <LogIn size={14} />
                  <span>Sign In</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Profile Editing Form */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Profile Picture Editor */}
          <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Camera size={16} className="text-blue-400" />
              <span className="text-xs font-bold text-white">Profile Picture</span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              {/* Live Preview Avatar */}
              <div className="relative group shrink-0">
                {profile.photoURL && !imageError ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.name || 'User'}
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                    className="h-20 w-20 rounded-full object-cover border-2 border-blue-500/50 shadow-md"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-white text-2xl shadow-md">
                    {(profile.name || user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  title="Upload new image"
                >
                  <Camera size={20} />
                </button>
              </div>

              {/* Action Buttons & Presets */}
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#252525] hover:border-[#444] transition cursor-pointer"
                  >
                    <Upload size={13} />
                    <span>Upload Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#252525] transition cursor-pointer"
                  >
                    <LinkIcon size={13} />
                    <span>{showUrlInput ? 'Hide URL' : 'Image URL'}</span>
                  </button>

                  {profile.photoURL && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {/* Optional Image URL Input */}
                {showUrlInput && (
                  <div className="flex items-center gap-2 max-w-md pt-1">
                    <input
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                      className="flex-1 rounded-lg border border-[#333] bg-[#141414] px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleApplyUrl}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                )}

                {/* Quick Avatar Presets */}
                <div>
                  <div className="text-[11px] font-medium text-gray-400 mb-1.5">Or choose a preset avatar:</div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setProfile((prev) => ({ ...prev, photoURL: preset.url }));
                          setImageError(false);
                        }}
                        className={`relative rounded-full p-0.5 transition cursor-pointer shrink-0 ${
                          profile.photoURL === preset.url
                            ? 'ring-2 ring-blue-500 scale-105'
                            : 'hover:opacity-80 border border-transparent hover:border-gray-600'
                        }`}
                        title={preset.label}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-profile-name-input" className="block text-xs font-semibold text-gray-300 mb-1">
                Full Name
              </label>
              <input
                id="settings-profile-name-input"
                type="text"
                value={profile.name || ''}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Your Name"
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="settings-profile-email-input" className="block text-xs font-semibold text-gray-300 mb-1">
                Email Address
              </label>
              <input
                id="settings-profile-email-input"
                type="email"
                value={profile.email || ''}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="your.email@example.com"
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="settings-profile-phone-input" className="block text-xs font-semibold text-gray-300 mb-1">
                Phone / Contact Number
              </label>
              <input
                id="settings-profile-phone-input"
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="settings-profile-occupation-input" className="block text-xs font-semibold text-gray-300 mb-1">
                Occupation / Role
              </label>
              <input
                id="settings-profile-occupation-input"
                type="text"
                value={profile.occupation || ''}
                onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                placeholder="e.g. Software Engineer, Business Owner"
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="settings-profile-monthly-income-input" className="block text-xs font-semibold text-gray-300 mb-1">
                Monthly Net Inflow Baseline ({canonicalSymbol})
              </label>
              <input
                id="settings-profile-monthly-income-input"
                type="number"
                value={profile.monthlyIncome || ''}
                onChange={(e) =>
                  setProfile({ ...profile, monthlyIncome: parseFloat(e.target.value) || 0 })
                }
                placeholder="120000"
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-mono font-bold text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="settings-profile-currency-select" className="block text-xs font-semibold text-gray-300 mb-1">
                Currency & Symbol
              </label>
              <select
                id="settings-profile-currency-select"
                value={getCurrencySymbol(profile.currencySymbol || profile.currency || '₹')}
                onChange={(e) => {
                  const sym = getCurrencySymbol(e.target.value);
                  setProfile({ ...profile, currency: sym, currencySymbol: sym });
                }}
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-blue-500 focus:outline-hidden"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.symbol}>
                    {c.symbol} ({c.code}) - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="settings-profile-primary-goal-input" className="block text-xs font-semibold text-gray-300 mb-1">
                Primary Financial Goal / Focus
              </label>
              <input
                id="settings-profile-primary-goal-input"
                type="text"
                value={profile.primaryGoal || ''}
                onChange={(e) => setProfile({ ...profile, primaryGoal: e.target.value })}
                placeholder="e.g. Build 6-month emergency reserve & maximize monthly savings"
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              id="settings-save-profile-btn"
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save Profile Details</span>
                </>
              )}
            </button>
            {savedSuccess && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 animate-fade-in">
                <CheckCircle2 size={15} /> Saved successfully!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Manual Theme & Display Accessibility Selector */}
      <ThemeToggleCard />

      {/* WhatsApp Business Cloud API Webhook Integration & Live Simulator */}
      <WhatsAppIntegrationCard onNavigate={onNavigate} />

      {/* Daily Spending Limit & Financial Goal Nudge Setting Card */}
      <div id="daily-spending-alert-settings" className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs relative overflow-hidden">
        {/* Subtle accent backdrop */}
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#262626] pb-4 mb-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Target size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Daily Spending Alert & Goal Nudge</h2>
                <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  Mindful Guard
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Set a daily spending ceiling to receive mindful in-app nudges that protect your long-term financial goals.
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-300">
              {dailyAlertEnabled ? 'Alert Active' : 'Disabled'}
            </span>
            <button
              type="button"
              id="toggle-daily-alert-btn"
              onClick={handleToggleDailyAlert}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                dailyAlertEnabled ? 'bg-amber-500' : 'bg-gray-700'
              }`}
              role="switch"
              aria-checked={dailyAlertEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  dailyAlertEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {dailyAlertEnabled ? (
          <div className="space-y-6">
            {/* 1. Daily Threshold Amount Input & Quick Presets */}
            <div>
              <label className="block text-xs font-semibold text-gray-200 mb-1.5">
                Maximum Daily Spending Threshold ({canonicalSymbol})
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-400">
                    {canonicalSymbol}
                  </span>
                  <input
                    type="number"
                    id="daily-spending-threshold-input"
                    min="1"
                    step="50"
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    placeholder="2000"
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] pl-8 pr-3 py-2.5 text-sm font-mono font-bold text-white focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-gray-500 mr-1">Presets:</span>
                  {quickPresets.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setThresholdInput(val.toString())}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer border ${
                        parseFloat(thresholdInput) === val
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-[#0f0f0f] border-[#262626] text-gray-400 hover:text-white hover:border-[#404040]'
                      }`}
                    >
                      {formatCurrency(val, canonicalSymbol)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                Calculated across all expenses and loan EMIs for the calendar day. Exceeding this amount triggers an alert.
              </p>
            </div>

            {/* 2. Target Financial Goal to Nudge Towards */}
            <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-200">
                    Linked Financial Goal
                  </label>
                  <p className="text-[11px] text-gray-400">
                    The gentle nudge will remind you of the specific aspiration you are protecting.
                  </p>
                </div>
                <select
                  id="daily-alert-goal-select"
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="rounded-xl border border-[#262626] bg-[#141414] px-3 py-1.5 text-xs font-semibold text-white focus:border-amber-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">🌟 All Active Financial Goals</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      🎯 {g.name} ({Math.round((g.currentAmount / (g.targetAmount || 1)) * 100)}% funded)
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Linked Goal Snapshot */}
              {activeGoal && (
                <div className="rounded-lg border border-[#222] bg-[#141414] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{activeGoal.name}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                        {goalProgressPct}% saved
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono">
                      {formatCurrency(activeGoal.currentAmount, canonicalSymbol)} of{' '}
                      {formatCurrency(activeGoal.targetAmount, canonicalSymbol)} target
                    </div>
                  </div>
                  <div className="w-full sm:w-48">
                    <div className="h-2 w-full rounded-full bg-[#262626] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, goalProgressPct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Nudge Philosophy & Tone */}
            <div>
              <label className="block text-xs font-semibold text-gray-200 mb-2">
                Nudge Tone & Communication Style
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    id: 'gentle',
                    title: 'Gentle & Mindful',
                    desc: 'Calm, non-judgmental reminder to take a breath and pause discretionary spends.',
                    icon: '🌿',
                  },
                  {
                    id: 'motivational',
                    title: 'Goal Champion',
                    desc: 'Inspiring, highlighting fuel preserved towards achieving your aspirations.',
                    icon: '🚀',
                  },
                  {
                    id: 'practical',
                    title: 'Direct & Clear',
                    desc: 'Straightforward metric alert emphasizing your remaining daily allowance.',
                    icon: '📊',
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTone(t.id as any)}
                    className={`rounded-xl border p-3.5 text-left transition cursor-pointer flex flex-col justify-between ${
                      selectedTone === t.id
                        ? 'border-amber-500/50 bg-amber-500/10 text-white'
                        : 'border-[#262626] bg-[#0f0f0f] text-gray-400 hover:border-[#404040] hover:text-gray-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-1">
                        <span>{t.icon}</span>
                        <span>{t.title}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-gray-400">{t.desc}</p>
                    </div>
                    {selectedTone === t.id && (
                      <div className="mt-2 text-[10px] font-bold text-amber-400 flex items-center gap-1">
                        <Check size={12} /> Active Style
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Live Spending Status Meter */}
            <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-200">
                  {latestSpend.isToday ? "Today's Spending Status" : `Latest Activity (${latestSpend.date})`}
                </span>
                <span
                  className={`text-xs font-bold font-mono ${
                    isOverLimit ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(latestSpend.total, canonicalSymbol)} / {formatCurrency(numThreshold, canonicalSymbol)} ({spendPct}%)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#262626] overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isOverLimit
                      ? 'bg-rose-500'
                      : spendPct >= 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, spendPct)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>
                  {isOverLimit
                    ? `⚠️ Exceeded daily target by ${formatCurrency(latestSpend.total - numThreshold, canonicalSymbol)}`
                    : `🛡️ ${formatCurrency(numThreshold - latestSpend.total, canonicalSymbol)} buffer remaining today`}
                </span>
                <span>{latestSpend.count} transaction(s) logged</span>
              </div>
            </div>

            {/* 5. Live Interactive Nudge Notification Preview */}
            <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Sparkles size={13} />
                  <span>Preview of In-App Notification</span>
                </div>
                <button
                  type="button"
                  id="send-test-nudge-btn"
                  onClick={handleSendTestAlert}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 cursor-pointer transition"
                >
                  <Send size={11} />
                  <span>Send Test Alert to Bell</span>
                </button>
              </div>

              {testSentMessage && (
                <div className="mb-2 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1 flex items-center gap-1.5 animate-in fade-in duration-150">
                  <CheckCircle2 size={13} />
                  <span>{testSentMessage}</span>
                </div>
              )}

              <div className="rounded-xl border border-[#262626] bg-[#141414] p-3.5 shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                      <Target size={10} /> Daily Goal Nudge
                    </span>
                    <span className="text-xs font-bold text-white">Daily Spending Limit Nudge 🎯</span>
                  </div>
                  <span className="text-[10px] text-gray-500">Just now</span>
                </div>
                <p className="text-[11px] text-gray-300 mt-2 leading-relaxed">
                  {previewNudgeMessage}
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                id="save-daily-alert-settings-btn"
                onClick={handleSaveDailyAlertSettings}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-black hover:bg-amber-400 transition cursor-pointer shadow-xs"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Save Daily Spending Limit</span>
              </button>
              {dailySavedSuccess && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 animate-in fade-in duration-200">
                  <CheckCircle2 size={14} /> Daily alert setting updated!
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-gray-400 bg-[#0f0f0f] rounded-xl border border-[#262626]">
            Daily spending alert is currently disabled. Toggle the switch above to configure your daily spending ceiling and protect your financial goals.
          </div>
        )}
      </div>

      {/* Category Manager */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4">
          <h2 className="text-base font-bold text-white">Custom Category Taxonomies</h2>
          <span className="text-xs text-gray-400">{categories.length} total categories</span>
        </div>

        {/* Existing categories pill list */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs font-semibold text-gray-200"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.name}</span>
              {c.isCustom && (
                <span className="text-[10px] text-blue-400 font-bold ml-1">Custom</span>
              )}
            </div>
          ))}
        </div>

        {/* Add custom category form */}
        <form
          onSubmit={handleAddCategory}
          className="flex flex-col sm:flex-row items-end gap-3 rounded-xl bg-[#0f0f0f] p-4 border border-[#262626]"
        >
          <div className="w-full sm:flex-1">
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              New Category Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Pet Care, Gaming, Freelance Expense"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full rounded-xl border border-[#262626] bg-[#141414] px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="w-full sm:w-32">
            <label className="block text-xs font-semibold text-gray-300 mb-1">Color</label>
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="w-full h-9 rounded-xl border border-[#262626] bg-[#141414] p-1 cursor-pointer"
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
          >
            Add Category
          </button>
        </form>
      </div>

      {/* Backup & Ledger Controls */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs space-y-4">
        <div className="border-b border-[#262626] pb-4">
          <h2 className="text-base font-bold text-white">Ledger Backup & Seed Controls</h2>
          <p className="text-xs text-gray-400">
            Export a full offline JSON snapshot of your financial ledger or reset data to default demonstration state.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 rounded-xl border border-[#262626] bg-[#0f0f0f] px-4 py-2 text-xs font-bold text-gray-200 hover:bg-[#1a1a1a] shadow-xs"
          >
            <Download size={15} />
            <span>Export JSON Snapshot</span>
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/20 shadow-xs transition"
          >
            <RefreshCw size={15} />
            <span>Reset Demo Ledger Data</span>
          </button>
        </div>

        {resetSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 animate-in fade-in">
            <CheckCircle2 size={16} />
            <span>Demo ledger reset successfully to baseline curated records.</span>
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetConfirm(false);
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
            <h3 className="text-base font-bold text-white mb-2">Reset Ledger to Seed Data?</h3>
            <p className="text-xs text-gray-300 mb-6 leading-relaxed">
              Are you sure you want to restore the multi-month demonstration dataset? Any custom transactions, categories, budgets, and goals you added will be replaced by the default seed data.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetData}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 shadow-xs"
              >
                <RefreshCw size={14} />
                <span>Yes, Reset Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
