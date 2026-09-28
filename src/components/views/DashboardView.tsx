import React, { useState, useEffect, useMemo } from 'react';
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
  BellRing,
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
import { formatCurrency, formatDate, formatShortDate, getMonthName, getCurrentMonth, getPreviousMonth } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { FriendDebtsSection } from './FriendDebtsSection';
import { emiDeadlineService, EmiDeadlineSummary } from '../../services/debt/emiDeadlineService';
import { useUpcomingLoanDeadlines } from '../../hooks/useUpcomingLoanDeadlines';

interface DashboardViewProps {
  currentMonth: string;
  currencySymbol: string;
  onNavigate: (viewId: string) => void;
  onOpenAddModal: (friendDebtMode?: { type: 'lent' | 'borrowed'; friendName?: string }) => void;
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
  const [emiSummary, setEmiSummary] = useState<EmiDeadlineSummary | null>(null);
  const urgentLoanDeadlines = useUpcomingLoanDeadlines();

  const activeMonthStr = currentMonth === 'all' ? getCurrentMonth() : currentMonth;
  const prevMonthStr = getPreviousMonth(activeMonthStr);
  const todayIso = new Date().toISOString().slice(0, 10);

  const loadData = () => {
    setCategories(storageService.getCategories());
    setHealthScore(storageService.calculateFinancialHealthScore());

    const allTxs = storageService.getTransactions();
    const currentTxs = allTxs.filter((t) => t.date.startsWith(activeMonthStr));
    const prevTxs = allTxs.filter((t) => t.date.startsWith(prevMonthStr));
    const cats = storageService.getCategories();
    const generated = InsightGenerator.generateDynamicInsights(currentTxs, prevTxs, cats);
    setInsights(generated);

    const loans = storageService.getEMILoans();
    const analysis = emiDeadlineService.analyzeDeadlines(loans, allTxs);
    setEmiSummary(analysis);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener(NOTIFY_EVENT, handleUpdate);
    return () => window.removeEventListener(NOTIFY_EVENT, handleUpdate);
  }, [currentMonth]);

  // Compute month summary
  const summary = storageService.calculateMonthSummary(activeMonthStr);
  const prevSummary = storageService.calculateMonthSummary(prevMonthStr);
  const momComparison = SpendingAnalyzer.compareMonths(
    summary.transactions,
    prevSummary.transactions,
    categories
  );

  // Filter state for pie chart in dashboard (defaults to 'all' so investments are included)
  const [pieFilter, setPieFilter] = useState<'all' | 'expense' | 'investment'>('all');

  // Compute recurring transactions summary
  const recurringSummary = recurringService.getRecurringMonthSummary(activeMonthStr, todayIso);

  // Pie chart data: include expenses, loan EMIs, and investments based on filter
  const pieData = useMemo(() => {
    const catMap: Record<string, number> = {};

    summary.transactions.forEach((tx) => {
      const isInv = tx.type === 'investment' || tx.categoryId === 'investments';
      const isExp = (tx.type === 'expense' || tx.type === 'loan_emi') && !isInv;

      if (pieFilter === 'all' && (isExp || isInv)) {
        const catId = isInv ? 'investments' : (tx.categoryId || 'miscellaneous');
        catMap[catId] = (catMap[catId] || 0) + tx.amount;
      } else if (pieFilter === 'expense' && isExp) {
        const catId = tx.categoryId || 'miscellaneous';
        catMap[catId] = (catMap[catId] || 0) + tx.amount;
      } else if (pieFilter === 'investment' && isInv) {
        const catId = tx.categoryId || 'investments';
        catMap[catId] = (catMap[catId] || 0) + tx.amount;
      } else if (tx.type === 'refund') {
        const catId = tx.categoryId || 'miscellaneous';
        if (catMap[catId]) {
          catMap[catId] = Math.max(0, catMap[catId] - tx.amount);
        }
      }
    });

    // Fallback if summary has categorySpending from storageService or totalInvestments
    if (Object.keys(catMap).length === 0) {
      if (pieFilter === 'all' || pieFilter === 'expense') {
        Object.entries(summary.categorySpending).forEach(([catId, amt]) => {
          if (pieFilter === 'expense' && catId === 'investments') return;
          catMap[catId] = amt;
        });
      }
      if ((pieFilter === 'all' || pieFilter === 'investment') && summary.totalInvestments > 0) {
        catMap['investments'] = Math.max(catMap['investments'] || 0, summary.totalInvestments);
      }
    } else {
      // Ensure totalInvestments is represented if not already in catMap
      if ((pieFilter === 'all' || pieFilter === 'investment') && summary.totalInvestments > 0 && !catMap['investments']) {
        catMap['investments'] = summary.totalInvestments;
      }
    }

    return Object.entries(catMap)
      .filter(([_, amount]) => amount > 0)
      .map(([catId, amount]) => {
        const cat = categories.find((c) => c.id === catId);
        const isInvestmentCat =
          catId === 'investments' ||
          cat?.name?.toLowerCase().includes('invest') ||
          cat?.name?.toLowerCase().includes('sip');
        return {
          id: catId,
          name: cat ? cat.name : (catId === 'investments' ? 'Investments & SIP' : catId),
          value: amount,
          color: cat?.color || (isInvestmentCat ? '#059669' : '#6366F1'),
          isInvestment: isInvestmentCat,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [summary.transactions, summary.categorySpending, summary.totalInvestments, pieFilter, categories]);

  const totalPieValue = useMemo(() => {
    return pieData.reduce((acc, item) => acc + item.value, 0);
  }, [pieData]);

  const allTxs = storageService.getTransactions();
  const recentTransactions = [...allTxs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const upcomingBills = recurringSummary.items
    .filter((item) => item.status !== 'paid' && item.status !== 'paused')
    .slice(0, 3);

  const handleInjectSingle = (scheduleId: string, dateStr: string) => {
    recurringService.injectSingleOccurrence(scheduleId, dateStr);
    loadData();
  };

  const handleRunAutoInject = () => {
    const res = recurringService.autoInjectDueTransactions(todayIso);
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
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {getMonthName(activeMonthStr)} Overview
            </h1>
            {healthScore && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                Score: {healthScore.score}/100
              </span>
            )}
            {urgentLoanDeadlines.hasUrgentDeadlines && (
              <button
                type="button"
                onClick={() => onNavigate('debt')}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-400 hover:bg-rose-500/25 transition-all shadow-xs cursor-pointer group"
                title={`${urgentLoanDeadlines.urgentCount} loan payment${urgentLoanDeadlines.urgentCount > 1 ? 's' : ''} due within 3 days! Click to review in Debt & Loans.`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <span>Urgent</span>
                {urgentLoanDeadlines.closestUrgent && (
                  <span className="hidden md:inline text-[11px] font-semibold text-rose-300">
                    ({urgentLoanDeadlines.closestUrgent.loan.name}: {urgentLoanDeadlines.closestUrgent.daysRemaining <= 0 ? (urgentLoanDeadlines.closestUrgent.daysRemaining === 0 ? 'Due Today' : 'Overdue') : `Due in ${urgentLoanDeadlines.closestUrgent.daysRemaining}d`})
                  </span>
                )}
              </button>
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
        <div className="rounded-xl border border-[#222] bg-[#121212] p-3 sm:p-4.5 lg:p-5 min-w-0">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Income</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
              <ArrowDownRight size={14} />
            </div>
          </div>
          <div className="mt-2 font-mono text-lg sm:text-xl font-bold text-white truncate" title={formatCurrency(summary.totalIncome, currencySymbol)}>
            {formatCurrency(summary.totalIncome, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 font-medium truncate">
            100% received
          </div>
        </div>

        {/* Outflow / Expenses */}
        <div className="rounded-xl border border-[#222] bg-[#121212] p-3 sm:p-4.5 lg:p-5 min-w-0">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Expenses</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-400">
              <ArrowUpRight size={14} />
            </div>
          </div>
          <div className="mt-2 font-mono text-lg sm:text-xl font-bold text-white truncate" title={formatCurrency(summary.totalExpenses, currencySymbol)}>
            {formatCurrency(summary.totalExpenses, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-gray-400 truncate">
            <span className={momComparison.totalChangePercentage > 0 ? 'text-rose-400' : 'text-emerald-400'}>
              {momComparison.totalChangePercentage > 0 ? '+' : ''}
              {momComparison.totalChangePercentage}%
            </span>{' '}
            vs last month
          </div>
        </div>

        {/* Net Savings */}
        <div className="rounded-xl border border-[#222] bg-[#121212] p-3 sm:p-4.5 lg:p-5 min-w-0">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Saved</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
              <Wallet size={14} />
            </div>
          </div>
          <div className="mt-2 font-mono text-lg sm:text-xl font-bold text-blue-400 truncate" title={formatCurrency(summary.saved, currencySymbol)}>
            {formatCurrency(summary.saved, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 font-medium truncate">
            {summary.savingsRate.toFixed(0)}% savings rate
          </div>
        </div>

        {/* Recurring / Fixed Bills */}
        <div
          onClick={() => setIsRecurringModalOpen(true)}
          className="rounded-xl border border-[#222] bg-[#121212] p-3 sm:p-4.5 lg:p-5 hover:border-purple-500/40 transition cursor-pointer group min-w-0"
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="group-hover:text-purple-300 transition truncate">Fixed Bills</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10 text-purple-400 shrink-0">
              <Repeat size={14} />
            </div>
          </div>
          <div className="mt-2 font-mono text-lg sm:text-xl font-bold text-white group-hover:text-purple-200 transition truncate" title={formatCurrency(recurringSummary.totalRecurringExpenses, currencySymbol)}>
            {formatCurrency(recurringSummary.totalRecurringExpenses, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-purple-400 font-medium truncate">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#222] pb-3.5 gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">Outflow & Category Breakdown</h2>
                  {summary.totalInvestments > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      <TrendingUp size={11} />
                      Includes Investments
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Where your money went this month, including expenses & SIPs
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Category filter pills */}
                <div className="inline-flex rounded-lg bg-[#1a1a1a] p-0.5 border border-[#2a2a2a] text-[11px]">
                  <button
                    onClick={() => setPieFilter('all')}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      pieFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPieFilter('expense')}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      pieFilter === 'expense'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Expenses
                  </button>
                  <button
                    onClick={() => setPieFilter('investment')}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      pieFilter === 'investment'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Investments
                  </button>
                </div>

                <button
                  onClick={() => onNavigate('analytics')}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer ml-1"
                >
                  Analytics <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* Donut Chart */}
              <div className="h-48 sm:col-span-5 relative flex items-center justify-center">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={68}
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
                        formatter={(val: any, name: any) => [
                          formatCurrency(Number(val), currencySymbol),
                          name?.toString().toLowerCase().includes('invest') ? 'Invested' : 'Amount',
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-xs text-gray-500">No records found for this filter</p>
                  </div>
                )}
                {pieData.length > 0 && (
                  <div className="absolute text-center pointer-events-none">
                    <span className="text-[9px] font-semibold text-gray-500 uppercase">
                      {pieFilter === 'investment' ? 'Invested' : pieFilter === 'expense' ? 'Spent' : 'Total'}
                    </span>
                    <div className="font-mono text-xs font-bold text-white">
                      {formatCurrency(totalPieValue, currencySymbol)}
                    </div>
                  </div>
                )}
              </div>

              {/* Category Bars */}
              <div className="sm:col-span-7 space-y-2 max-h-56 overflow-y-auto pr-1">
                {pieData.length > 0 ? (
                  pieData.map((item) => {
                    const pct =
                      totalPieValue > 0
                        ? Math.round((item.value / totalPieValue) * 100)
                        : 0;
                    return (
                      <div key={item.id || item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-gray-300 font-medium text-xs truncate">
                              {item.name}
                            </span>
                            {item.isInvestment && (
                              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 shrink-0">
                                SIP / Asset
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
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
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-xs text-gray-500">
                    No transactions recorded for this filter.
                  </div>
                )}
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

        {/* Right Column: Friends & Peer Money, Upcoming Bills & AI Assistant Tips (5 Cols) */}
        <div className="lg:col-span-5 space-y-5 sm:space-y-6">
          {/* Friends & Peer Money (Lend / Borrow Tracker) */}
          <FriendDebtsSection
            currencySymbol={currencySymbol}
            onOpenAddModal={onOpenAddModal}
            compact={true}
          />

          {/* Upcoming EMI Repayment Deadlines Alert */}
          {emiSummary && emiSummary.analyses.filter((a) => !a.isPaidThisCycle).length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                    <BellRing size={14} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Upcoming EMI Repayments</h2>
                    <p className="text-[11px] text-amber-300/80">Scheduled loan deadlines from transaction history</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('debt')}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  Debt Center <ChevronRight size={13} />
                </button>
              </div>

              <div className="mt-3 space-y-2.5">
                {emiSummary.analyses
                  .filter((a) => !a.isPaidThisCycle)
                  .slice(0, 2)
                  .map((item) => (
                    <div
                      key={item.loan.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#181818] border border-[#262626]"
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{item.loan.name}</span>
                          {item.status === 'overdue' && (
                            <span className="rounded bg-rose-500/20 text-rose-400 text-[9px] font-bold px-1.5 py-0.2">
                              Overdue
                            </span>
                          )}
                          {item.status === 'due_today' && (
                            <span className="rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold px-1.5 py-0.2">
                              Due Today
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {item.loan.lender} • Due {formatDate(item.dueDate)} ({item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)}d overdue` : item.daysRemaining === 0 ? 'Today' : `in ${item.daysRemaining}d`})
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-bold text-white">
                          {formatCurrency(item.loan.emiAmount, currencySymbol)}
                        </span>
                        <button
                          onClick={() => {
                            emiDeadlineService.recordEmiPayment(item.loan);
                            loadData();
                          }}
                          className="rounded-lg bg-blue-600/20 hover:bg-blue-600 hover:text-white text-blue-300 px-2 py-1 text-[10px] font-bold border border-blue-500/30 transition cursor-pointer"
                        >
                          Mark Paid
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

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

