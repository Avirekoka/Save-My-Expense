import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  Plus,
  Camera,
  Repeat,
  ChevronRight,
  ShieldCheck,
  Zap,
  Calendar,
  CheckCircle2,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  Transaction,
  Category,
  FinancialHealthScore,
  AIInsight,
} from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { recurringService } from '../../services/recurring/recurring.service';
import { RecurringScheduleModal } from '../modals/RecurringScheduleModal';
import { SpendingAnalyzer } from '../../services/ai/spending-analyzer';
import { InsightGenerator } from '../../services/ai/insight-generator';
import { formatCurrency, formatDate, formatShortDate, getMonthName } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';

interface DashboardViewProps {
  currentMonth: string;
  currencySymbol: string;
  onNavigate: (viewId: string) => void;
  onOpenAddModal: () => void;
  onOpenBeforeSpend: () => void;
  onOpenAskMoney: () => void;
  onOpenScanReceipt?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentMonth,
  currencySymbol,
  onNavigate,
  onOpenAddModal,
  onOpenBeforeSpend,
  onOpenAskMoney,
  onOpenScanReceipt,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [healthScore, setHealthScore] = useState<FinancialHealthScore | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [autoInjectBanner, setAutoInjectBanner] = useState<{ count: number; amount: number } | null>(null);

  const activeMonthStr = currentMonth === 'all' ? '2026-08' : currentMonth;

  const loadData = () => {
    setCategories(storageService.getCategories());
    setHealthScore(storageService.calculateFinancialHealthScore());

    const currentTxs = storageService.getTransactions().filter((t) => t.date.startsWith('2026-08'));
    const prevTxs = storageService.getTransactions().filter((t) => t.date.startsWith('2026-07'));
    const cats = storageService.getCategories();
    const generated = InsightGenerator.generateDynamicInsights(currentTxs, prevTxs, cats);
    setInsights(generated);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener(NOTIFY_EVENT, handleUpdate);
    return () => window.removeEventListener(NOTIFY_EVENT, handleUpdate);
  }, [currentMonth]);

  // Compute month summary
  const summary = storageService.calculateMonthSummary(activeMonthStr);
  const prevSummary = storageService.calculateMonthSummary('2026-07');
  const momComparison = SpendingAnalyzer.compareMonths(
    summary.transactions,
    prevSummary.transactions,
    categories
  );

  // Compute recurring transactions summary
  const recurringSummary = recurringService.getRecurringMonthSummary(activeMonthStr, '2026-08-28');

  // Pie chart data
  const pieData = Object.entries(summary.categorySpending)
    .filter(([_, amount]) => amount > 0)
    .map(([catId, amount]) => {
      const cat = categories.find((c) => c.id === catId);
      return {
        name: cat ? cat.name : catId,
        value: amount,
        color: cat?.color || '#6366F1',
      };
    })
    .sort((a, b) => b.value - a.value);

  const recentTransactions = summary.transactions.slice(0, 5);
  const upcomingBills = recurringSummary.items
    .filter((item) => item.status !== 'paid' && item.status !== 'paused')
    .slice(0, 3);

  const handleInjectSingle = (scheduleId: string, dateStr: string) => {
    recurringService.injectSingleOccurrence(scheduleId, dateStr);
    loadData();
  };

  const handleRunAutoInject = () => {
    const res = recurringService.autoInjectDueTransactions('2026-08-28');
    if (res.injectedCount > 0) {
      setAutoInjectBanner({ count: res.injectedCount, amount: res.totalInjectedAmount });
      setTimeout(() => setAutoInjectBanner(null), 5000);
    } else {
      setAutoInjectBanner({ count: 0, amount: 0 });
      setTimeout(() => setAutoInjectBanner(null), 3000);
    }
    loadData();
  };

  const topInsight = insights[0];

  // Daily Spending Alert & Goal Guard data
  const profile = storageService.getUserProfile();
  const dailyAlert = profile.dailySpendingAlert;
  const todaySpend = storageService.getTodayOrLatestDailySpending();
  const goals = storageService.getGoals();
  const linkedGoal = goals.find((g) => g.id === dailyAlert?.targetGoalId) || goals[0];
  const goalProgress =
    linkedGoal && linkedGoal.targetAmount > 0
      ? Math.round((linkedGoal.currentAmount / linkedGoal.targetAmount) * 100)
      : 0;
  const dailyThreshold = dailyAlert?.threshold || 2000;
  const isDailyOver = todaySpend.total > dailyThreshold;
  const dailyPct = Math.round((todaySpend.total / dailyThreshold) * 100);

  return (
    <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
      {/* 1. Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {getMonthName(activeMonthStr)} Overview
            </h1>
            {healthScore && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                Score: {healthScore.score}/100
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Track your income, daily expenses, and scheduled bills with ease.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenScanReceipt && (
            <button
              onClick={onOpenScanReceipt}
              className="flex items-center gap-1.5 rounded-lg border border-[#2e2e2e] bg-[#141414] px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-[#1f1f1f] hover:text-white transition cursor-pointer"
            >
              <Camera size={14} className="text-blue-400" />
              <span>Scan Receipt</span>
            </button>
          )}

          <button
            onClick={onOpenAskMoney}
            className="flex items-center gap-1.5 rounded-lg border border-[#2e2e2e] bg-[#141414] px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-[#1f1f1f] hover:text-white transition cursor-pointer"
          >
            <Sparkles size={14} className="text-purple-400" />
            <span>Ask AI</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Auto-injection status banner */}
      {autoInjectBanner && (
        <div
          className={`flex items-center justify-between rounded-lg border p-3 text-xs font-medium transition ${
            autoInjectBanner.count > 0
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>
              {autoInjectBanner.count > 0
                ? `Auto-injected ${autoInjectBanner.count} recurring bills (${formatCurrency(
                    autoInjectBanner.amount,
                    currencySymbol
                  )}) into your transactions.`
                : 'All recurring bills for this month are recorded and up to date.'}
            </span>
          </div>
          <button
            onClick={() => setAutoInjectBanner(null)}
            className="text-gray-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Key Metric Cards (Clean, 4-grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {/* Inflow / Income */}
        <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Income</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
              <ArrowDownRight size={14} />
            </div>
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-white">
            {formatCurrency(summary.totalIncome, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 font-medium">
            100% received
          </div>
        </div>

        {/* Outflow / Expenses */}
        <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Expenses</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-400">
              <ArrowUpRight size={14} />
            </div>
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-white">
            {formatCurrency(summary.totalExpenses, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            <span className={momComparison.totalChangePercentage > 0 ? 'text-rose-400' : 'text-emerald-400'}>
              {momComparison.totalChangePercentage > 0 ? '+' : ''}
              {momComparison.totalChangePercentage}%
            </span>{' '}
            vs last month
          </div>
        </div>

        {/* Net Savings */}
        <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Saved</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
              <Wallet size={14} />
            </div>
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-blue-400">
            {formatCurrency(summary.saved, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 font-medium">
            {summary.savingsRate.toFixed(0)}% savings rate
          </div>
        </div>

        {/* Recurring / Fixed Bills */}
        <div
          onClick={() => setIsRecurringModalOpen(true)}
          className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5 hover:border-purple-500/40 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="group-hover:text-purple-300 transition">Fixed Bills</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10 text-purple-400">
              <Repeat size={14} />
            </div>
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-white group-hover:text-purple-200 transition">
            {formatCurrency(recurringSummary.totalRecurringExpenses, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-purple-400 font-medium">
            {recurringSummary.pendingCount} bills pending →
          </div>
        </div>
      </div>

      {/* Daily Spending & Goal Guard Banner (when enabled) */}
      {dailyAlert?.enabled && (
        <div
          id="daily-spending-goal-guard-banner"
          className={`rounded-xl border p-4.5 transition relative overflow-hidden ${
            isDailyOver
              ? 'border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#141414] to-[#141414]'
              : 'border-[#222] bg-[#121212]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                  isDailyOver
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                }`}
              >
                <Target size={18} />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white">
                    {isDailyOver ? 'Daily Spending Limit Nudge' : "Today's Spending Ceiling"}
                  </span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                      isDailyOver
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {isDailyOver ? 'Goal Nudge Active' : 'On Track'}
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed max-w-2xl">
                  {isDailyOver ? (
                    <>
                      You've spent{' '}
                      <span className="font-semibold text-white font-mono">
                        {formatCurrency(todaySpend.total, currencySymbol)}
                      </span>{' '}
                      on {todaySpend.isToday ? 'today' : formatShortDate(todaySpend.date)}, exceeding your daily
                      threshold by{' '}
                      <span className="font-semibold text-amber-300 font-mono">
                        {formatCurrency(todaySpend.total - dailyThreshold, currencySymbol)}
                      </span>
                      . Pausing optional spends protects your{' '}
                      <span className="font-semibold text-white">{linkedGoal?.name || 'Financial Goal'}</span> (
                      {goalProgress}% funded)!
                    </>
                  ) : (
                    <>
                      Logged{' '}
                      <span className="font-semibold text-white font-mono">
                        {formatCurrency(todaySpend.total, currencySymbol)}
                      </span>{' '}
                      of {formatCurrency(dailyThreshold, currencySymbol)} daily allowance. You have{' '}
                      <span className="font-semibold text-emerald-400 font-mono">
                        {formatCurrency(dailyThreshold - todaySpend.total, currencySymbol)}
                      </span>{' '}
                      buffer remaining to keep{' '}
                      <span className="font-semibold text-white">{linkedGoal?.name || 'Financial Goal'}</span> on track.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold font-mono text-white">
                  {dailyPct}% of limit
                </div>
                <div className="text-[10px] text-gray-400">
                  {todaySpend.count} transaction{todaySpend.count === 1 ? '' : 's'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#2e2e2e] bg-[#1a1a1a] hover:bg-[#252525] text-gray-200 hover:text-white transition cursor-pointer"
              >
                Adjust Limit →
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full rounded-full bg-[#222] overflow-hidden">
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
        </div>
      )}

      {/* 3. Main Dashboard Layout (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Column: Spending Breakdown & Recent Activity (7 Cols) */}
        <div className="lg:col-span-7 space-y-5 sm:space-y-6">
          {/* Spending by Category */}
          <div className="rounded-xl border border-[#222] bg-[#121212] p-4 sm:p-5 lg:p-6">
            <div className="flex items-center justify-between border-b border-[#222] pb-3.5">
              <div>
                <h2 className="text-sm font-bold text-white">Spending by Category</h2>
                <p className="text-[11px] text-gray-400">Where your money went this month</p>
              </div>
              <button
                onClick={() => onNavigate('analytics')}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                Analytics <ChevronRight size={13} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* Donut Chart */}
              <div className="h-44 sm:col-span-5 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={66}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#171717',
                        borderColor: '#262626',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '11px',
                      }}
                      formatter={(val: any) => [
                        formatCurrency(Number(val), currencySymbol),
                        'Spent',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center pointer-events-none">
                  <span className="text-[9px] font-semibold text-gray-500 uppercase">Spent</span>
                  <div className="font-mono text-xs font-bold text-white">
                    {formatCurrency(summary.totalExpenses, currencySymbol)}
                  </div>
                </div>
              </div>

              {/* Category Bars */}
              <div className="sm:col-span-7 space-y-2.5">
                {pieData.slice(0, 4).map((item) => {
                  const pct =
                    summary.totalExpenses > 0
                      ? Math.round((item.value / summary.totalExpenses) * 100)
                      : 0;
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-gray-300 font-medium text-xs">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-white">
                            {formatCurrency(item.value, currencySymbol)}
                          </span>
                          <span className="text-[10px] text-gray-500 w-7 text-right">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#202020] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="rounded-xl border border-[#222] bg-[#121212] p-4 sm:p-5 lg:p-6">
            <div className="flex items-center justify-between border-b border-[#222] pb-3.5">
              <div>
                <h2 className="text-sm font-bold text-white">Recent Transactions</h2>
                <p className="text-[11px] text-gray-400">Latest recorded activity</p>
              </div>
              <button
                onClick={() => onNavigate('transactions')}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                View All ({summary.transactions.length}) <ChevronRight size={13} />
              </button>
            </div>

            <div className="mt-3 divide-y divide-[#1c1c1c]">
              {recentTransactions.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2.5 first:pt-1 last:pb-0 hover:bg-[#171717] px-2 rounded-lg transition"
                  >
                    <div className="flex items-center gap-3">
                      <CategoryIcon category={cat} categoryId={tx.categoryId} size={16} />
                      <div>
                        <div className="text-xs font-semibold text-white">{tx.merchant}</div>
                        <div className="text-[11px] text-gray-400">
                          {formatDate(tx.date)} • {cat ? cat.name : tx.categoryId}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`font-mono text-xs font-bold ${
                        tx.type === 'income' ? 'text-emerald-400' : 'text-gray-200'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount, currencySymbol)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming Bills & AI Assistant Tips (5 Cols) */}
        <div className="lg:col-span-5 space-y-5 sm:space-y-6">
          {/* Upcoming Bills & Subscriptions */}
          <div className="rounded-xl border border-[#222] bg-[#121212] p-4 sm:p-5 lg:p-6">
            <div className="flex items-center justify-between border-b border-[#222] pb-3.5">
              <div>
                <h2 className="text-sm font-bold text-white">Upcoming Bills</h2>
                <p className="text-[11px] text-gray-400">Scheduled auto-debits & payments</p>
              </div>
              <button
                onClick={() => setIsRecurringModalOpen(true)}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
              >
                Manage <ChevronRight size={13} />
              </button>
            </div>

            {upcomingBills.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {upcomingBills.map((item) => (
                  <div
                    key={`${item.scheduleId}-${item.date}`}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#181818] border border-[#262626]"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">{item.name}</div>
                      <div className="text-[11px] text-gray-400">
                        Due {formatShortDate(item.date)} • {item.recurringType.toUpperCase()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-white">
                        {formatCurrency(item.amount, currencySymbol)}
                      </span>
                      <button
                        onClick={() => handleInjectSingle(item.scheduleId, item.date)}
                        className="rounded bg-purple-600/20 hover:bg-purple-600 hover:text-white text-purple-300 px-2 py-1 text-[10px] font-bold border border-purple-500/30 transition cursor-pointer"
                      >
                        Settle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-center py-4 text-xs text-gray-500">
                <CheckCircle2 size={20} className="mx-auto mb-1 text-emerald-400" />
                All bills for this month have been settled!
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#222] flex items-center justify-between">
              <button
                onClick={handleRunAutoInject}
                className="text-[11px] font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Zap size={12} /> Auto-inject all due bills
              </button>
              <button
                onClick={() => onNavigate('goals')}
                className="text-[11px] font-medium text-gray-400 hover:text-white cursor-pointer"
              >
                Track Financial Goals →
              </button>
            </div>
          </div>

          {/* AI Smart Insight Card */}
          {topInsight && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-600/5 p-4 sm:p-5 lg:p-6">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Sparkles size={15} />
                <span className="text-xs font-bold uppercase tracking-wider">AI Financial Tip</span>
              </div>
              <h3 className="text-xs font-bold text-white">{topInsight.title}</h3>
              <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                {topInsight.description}
              </p>
              {topInsight.actionRecommendation && (
                <div className="mt-3 rounded-lg bg-[#141414] p-2.5 text-[11px] text-gray-300 border border-[#262626]">
                  <span className="text-blue-400 font-semibold">Tip: </span>
                  {topInsight.actionRecommendation}
                </div>
              )}
              <div className="mt-3 text-right">
                <button
                  onClick={() => onNavigate('insights')}
                  className="text-xs font-semibold text-blue-400 hover:underline cursor-pointer"
                >
                  View all smart insights →
                </button>
              </div>
            </div>
          )}

          {/* Quick Helpful Tools Card */}
          <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
              Helpful Tools
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onOpenBeforeSpend}
                className="p-2.5 rounded-lg bg-[#181818] border border-[#262626] hover:border-blue-500/30 text-left transition cursor-pointer"
              >
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-blue-400" />
                  <span>Spend Check</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Test large purchases</div>
              </button>

              <button
                onClick={() => onNavigate('statements')}
                className="p-2.5 rounded-lg bg-[#181818] border border-[#262626] hover:border-blue-500/30 text-left transition cursor-pointer"
              >
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Receipt size={13} className="text-emerald-400" />
                  <span>Import PDF</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Bank statements</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recurring Schedule Management Modal */}
      <RecurringScheduleModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        currencySymbol={currencySymbol}
        onSchedulesUpdated={loadData}
      />
    </div>
  );
};

