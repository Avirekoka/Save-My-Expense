import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Receipt,
  FileSpreadsheet,
  BarChart3,
  PieChart,
  Target,
  Sparkles,
  Landmark,
  Settings,
  CalendarRange,
  X,
  Plus,
  Camera,
  Calendar,
  LogIn,
  LogOut,
  User,
  Shield,
  Check,
  Lock,
} from 'lucide-react';
import { formatCurrency, getLastThreeMonths, getCurrentMonth } from '../../utils/formatters';
import { useAuth } from '../../services/firebase/AuthContext';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useRouter, AppRoute } from '../../router/RouterContext';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  monthlyIncome: number;
  monthlyExpense: number;
  currencySymbol: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentMonth?: string;
  onMonthChange?: (month: string) => void;
  onOpenAddTransaction?: () => void;
  onOpenScanReceipt?: () => void;
  onOpenBeforeSpend?: () => void;
  onOpenAskMoney?: () => void;
  onOpenAuthModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  monthlyIncome,
  monthlyExpense,
  currencySymbol,
  isMobileOpen,
  onCloseMobile,
  currentMonth = getCurrentMonth(),
  onMonthChange,
  onOpenAddTransaction,
  onOpenScanReceipt,
  onOpenBeforeSpend,
  onOpenAskMoney,
  onOpenAuthModal,
}) => {
  const { user, logOut } = useAuth();
  const { currentRoute, navigate } = useRouter();
  const isUnverified = Boolean(user && user.emailVerified === false);

  const handleProtectedAction = (actionName: string, actionFn?: () => void) => {
    if (isUnverified) {
      window.dispatchEvent(
        new CustomEvent('spendai-toast', {
          detail: {
            type: 'warning',
            title: 'Email Confirmation Required',
            message: `Please verify your email (${user?.email}) to use ${actionName}.`,
          },
        })
      );
      return;
    }
    actionFn?.();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'transactions', label: 'Transactions', icon: Receipt, badge: null },
    { id: 'monthwise', label: 'Monthly Breakdown', icon: CalendarRange, badge: 'History' },
    { id: 'statements', label: 'Upload Statement', icon: FileSpreadsheet, badge: 'AI Parser' },
    { id: 'analytics', label: 'Analytics & Cash Flow', icon: BarChart3, badge: null },
    { id: 'budgets', label: 'Budgets & Planner', icon: PieChart, badge: null },
    { id: 'goals', label: 'Goals & Simulator', icon: Target, badge: null },
    { id: 'insights', label: 'AI Insights & Stories', icon: Sparkles, badge: 'Smart' },
    { id: 'debt', label: 'Debt & EMIs', icon: Landmark, badge: null },
    { id: 'settings', label: 'Settings & Data', icon: Settings, badge: null },
  ];

  const savings = Math.max(0, monthlyIncome - monthlyExpense);
  const savingsRate = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;
  const recentMonths = getLastThreeMonths(currentMonth === 'all' ? getCurrentMonth() : currentMonth);

  // Reactive Profile & Daily Spending Alert info
  const [profile, setProfile] = useState(storageService.getUserProfile());

  useEffect(() => {
    const handleUpdate = () => {
      setProfile(storageService.getUserProfile());
    };
    handleUpdate();
    window.addEventListener(NOTIFY_EVENT, handleUpdate);
    return () => window.removeEventListener(NOTIFY_EVENT, handleUpdate);
  }, [user]);

  const dailyAlert = profile.dailySpendingAlert;
  const todaySpend = storageService.getTodayOrLatestDailySpending();
  const goals = storageService.getGoals();
  const targetGoal = goals.find((g) => g.id === dailyAlert?.targetGoalId) || goals[0];
  const threshold = dailyAlert?.threshold || 2000;
  const isDailyOver = Boolean(dailyAlert?.enabled && todaySpend.total > threshold);
  const dailyPct = Math.round((todaySpend.total / threshold) * 100);

  const handleMonthSelect = (monthVal: string) => {
    if (onMonthChange) onMonthChange(monthVal);
    if (monthVal === 'all') {
      onSelectView('transactions');
    }
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile & Tablet Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer Container */}
      <aside
        id="desktop-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex h-full h-[100dvh] max-h-screen max-h-[100dvh] min-h-0 w-80 max-w-[86vw] md:w-72 lg:w-64 shrink-0 flex-col overflow-hidden border-r border-[#262626] bg-[#0d0d0d] shadow-2xl transition-transform duration-200 ease-in-out lg:static lg:h-full lg:max-h-full lg:min-h-0 lg:translate-x-0 lg:z-auto ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        {/* Mobile / Tablet Drawer Header with Close Button */}
        <div className="flex lg:hidden items-center justify-between border-b border-[#262626] px-4 py-3.5 bg-[#121212] shrink-0">
          <div className="flex items-center gap-2 font-bold tracking-tight text-white">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold shadow-xs">
              <Sparkles size={15} />
            </div>
            <div>
              <span className="text-sm font-extrabold text-white">Spend</span>
              <span className="text-sm font-extrabold text-blue-500">AI</span>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#262626] bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-[#222] transition cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X size={17} />
          </button>
        </div>

        {/* Scrollable Container */}
        <div
          id="sidebar-scrollable-content"
          onTouchMove={(e) => e.stopPropagation()}
          className="flex-1 min-h-0 h-full overflow-y-auto overflow-x-hidden px-3 py-3.5 space-y-3.5 overscroll-contain touch-pan-y"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehaviorY: 'contain',
          }}
        >
          {/* Quick Action Hub for primary actions & smart tools */}
          <div className="space-y-2 rounded-xl border border-[#262626] bg-[#121212] p-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                Quick Actions
              </span>
              <span className="text-[9px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20">
                AI Tools
              </span>
            </div>

            {/* Primary Add Expense Button */}
            {onOpenAddTransaction && (
              <button
                onClick={() => {
                  onCloseMobile();
                  handleProtectedAction('add expenses', onOpenAddTransaction);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 px-3 text-xs font-bold text-white shadow-xs transition hover:bg-blue-500 cursor-pointer"
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>Add New Expense</span>
              </button>
            )}

            {/* Secondary Tools Grid: Scan Receipt, Before You Spend, Ask AI */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {onOpenScanReceipt && (
                <button
                  onClick={() => {
                    onCloseMobile();
                    handleProtectedAction('scan receipts', onOpenScanReceipt);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[#262626] bg-[#171717] py-2 px-1 text-center text-gray-300 hover:border-blue-500/50 hover:bg-[#1f1f1f] hover:text-white transition cursor-pointer"
                  title="Scan physical receipt with Camera AI"
                >
                  <Camera size={15} className="text-blue-400" />
                  <span className="text-[10px] font-semibold leading-tight">Scan Receipt</span>
                </button>
              )}

              {onOpenBeforeSpend && (
                <button
                  onClick={() => {
                    onCloseMobile();
                    handleProtectedAction('use spend advisor', onOpenBeforeSpend);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[#262626] bg-[#171717] py-2 px-1 text-center text-gray-300 hover:border-amber-500/50 hover:bg-[#1f1f1f] hover:text-white transition cursor-pointer"
                  title="Before You Spend Decision Advisor"
                >
                  <Shield size={15} className="text-amber-400" />
                  <span className="text-[10px] font-semibold leading-tight">Spend Advisor</span>
                </button>
              )}

              {onOpenAskMoney && (
                <button
                  onClick={() => {
                    onCloseMobile();
                    handleProtectedAction('ask AI advisor', onOpenAskMoney);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[#262626] bg-[#171717] py-2 px-1 text-center text-gray-300 hover:border-purple-500/50 hover:bg-[#1f1f1f] hover:text-white transition cursor-pointer"
                  title="Ask AI about your money"
                >
                  <Sparkles size={15} className="text-purple-400" />
                  <span className="text-[10px] font-semibold leading-tight">Ask AI</span>
                </button>
              )}
            </div>
          </div>

          {/* Daily Spending Limit & Goal Nudge (when enabled) */}
          {dailyAlert?.enabled && (
            <div
              onClick={() => {
                onSelectView('settings');
                onCloseMobile();
              }}
              className={`rounded-xl border p-2.5 cursor-pointer transition ${
                isDailyOver
                  ? 'border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#141414] to-[#141414]'
                  : 'border-[#262626] bg-[#121212] hover:border-blue-500/30'
              }`}
              title="Click to adjust Daily Spending Limit in Settings"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Target size={14} className={isDailyOver ? 'text-amber-400' : 'text-blue-400'} />
                  <span className="text-[10px] font-bold tracking-wider uppercase text-gray-300">
                    Daily Spending Ceiling
                  </span>
                </div>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                    isDailyOver
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {isDailyOver ? 'Nudge Active' : `${dailyPct}% used`}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-sm font-bold font-mono text-white">
                  {formatCurrency(todaySpend.total, currencySymbol)}
                </div>
                <div className="text-[10px] text-gray-400">
                  Cap: {formatCurrency(threshold, currencySymbol)}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#222] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isDailyOver
                      ? 'bg-amber-500'
                      : dailyPct >= 80
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, dailyPct)}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                <span className="truncate">
                  {isDailyOver ? (
                    <span className="text-amber-300 font-medium">Protecting {targetGoal?.name || 'Goal'}</span>
                  ) : (
                    <span>Guarding {targetGoal?.name || 'Financial Goal'}</span>
                  )}
                </span>
                <button
                  onClick={() => {
                    navigate('settings');
                    onSelectView('settings');
                    if (isMobileOpen) onCloseMobile();
                  }}
                  className="text-blue-400 font-semibold hover:underline shrink-0 cursor-pointer"
                >
                  Adjust →
                </button>
              </div>
            </div>
          )}

          {/* Month / Time Period Switcher */}
          <div className="space-y-1.5 rounded-xl border border-[#262626] bg-[#121212] p-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase flex items-center gap-1">
                <Calendar size={12} className="text-blue-400" />
                Active Time Period
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                {currentMonth === 'all' ? 'All History' : currentMonth}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {recentMonths.map((m) => {
                const isSelected = currentMonth === m.value;
                const isCurrent = m.value === getCurrentMonth();
                return (
                  <button
                    key={m.value}
                    onClick={() => handleMonthSelect(m.value)}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                        : 'bg-[#171717] text-gray-400 hover:text-white border border-[#262626]'
                    }`}
                  >
                    <span className="truncate flex items-center gap-1">
                      <span>{m.label.split(' ')[0]}</span>
                      {isCurrent && (
                        <span className="text-[9px] font-medium text-blue-400">
                          (Now)
                        </span>
                      )}
                    </span>
                    {isSelected && <Check size={12} className="text-blue-400 shrink-0" />}
                  </button>
                );
              })}
              <button
                onClick={() => handleMonthSelect('all')}
                className={`col-span-2 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  currentMonth === 'all'
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                    : 'bg-[#171717] text-gray-400 hover:text-white border border-[#262626]'
                }`}
              >
                <span>All History & Records 📜</span>
                {currentMonth === 'all' && <Check size={12} className="text-blue-400 shrink-0" />}
              </button>
            </div>
          </div>

          {/* Navigation Items List */}
          <div>
            <div className="px-2 pb-2 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              Financial Suite
            </div>

            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = (currentRoute === item.id) || (activeView === item.id);
                const isItemLocked = isUnverified && item.id !== 'settings';
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigate(item.id as AppRoute);
                      onSelectView(item.id);
                      onCloseMobile();
                    }}
                    className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-500/20'
                        : 'text-gray-400 hover:bg-[#141414] hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        size={16}
                        className={isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}
                      />
                      <span>{item.label}</span>
                    </div>

                    {isItemLocked ? (
                      <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <Lock size={10} className="shrink-0" />
                        <span>Locked</span>
                      </span>
                    ) : item.badge ? (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? 'bg-blue-500/20 text-blue-300'
                            : item.badge === '1 Alert'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-[#1a1a1a] text-gray-400 border border-[#262626]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Account / Profile Section (Positioned directly below menu items) */}
          <div className="pt-2 border-t border-[#222222]">
            <div className="flex items-center justify-between rounded-xl border border-[#262626] bg-[#141414] p-2.5 shadow-xs">
              <div
                onClick={() => {
                  navigate('settings');
                  onSelectView('settings');
                  if (isMobileOpen) onCloseMobile();
                }}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-85 transition"
                title="Click to view Account Settings"
              >
                {profile?.photoURL || user?.photoURL ? (
                  <img
                    src={profile?.photoURL || user?.photoURL || ''}
                    alt={profile?.name || user?.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full object-cover shrink-0 border border-blue-500/30"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold shrink-0">
                    {(profile?.name || user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {profile?.name || user?.displayName || 'Personal Profile'}
                  </div>
                  {isUnverified ? (
                    <div className="text-[10px] text-amber-400 font-medium flex items-center gap-1 truncate">
                      <Lock size={10} className="shrink-0" />
                      <span>Email Unverified</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-500 truncate">
                      {user?.email || 'Logged in'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {user ? (
                  <button
                    onClick={async () => {
                      try {
                        await logOut();
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="flex h-7 items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                    title="Sign out of account"
                  >
                    <LogOut size={12} />
                    <span className="hidden xl:inline">Logout</span>
                  </button>
                ) : (
                  onOpenAuthModal && (
                    <button
                      onClick={() => {
                        if (isMobileOpen) onCloseMobile();
                        onOpenAuthModal();
                      }}
                      className="flex h-7 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 text-[11px] font-bold text-white hover:bg-blue-500 shadow-xs transition cursor-pointer"
                      title="Sign in"
                    >
                      <LogIn size={12} />
                      <span>Sign In</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Active Savings & Health Card (Positioned directly below Profile) */}
          <div className="pt-1">
            <div className="rounded-xl border border-[#262626] bg-[#141414] p-3 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-400 uppercase tracking-wider text-[10px]">
                  Active Savings
                </span>
                <span className="font-bold text-emerald-400">
                  {savingsRate.toFixed(0)}% Rate
                </span>
              </div>

              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#262626]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, savingsRate))}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                <span>Saved this month:</span>
                <span className="font-mono font-bold text-white">
                  {formatCurrency(savings, currencySymbol)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

