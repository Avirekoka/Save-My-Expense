import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Calendar,
  Layers,
  ChevronRight,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Transaction,
  Category,
  UserProfile,
  FinancialHealthScore,
  AIInsight,
} from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
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
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentMonth,
  currencySymbol,
  onNavigate,
  onOpenAddModal,
  onOpenBeforeSpend,
  onOpenAskMoney,
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [healthScore, setHealthScore] = useState<FinancialHealthScore | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);

  useEffect(() => {
    const load = () => {
      setCategories(storageService.getCategories());
      setHealthScore(storageService.calculateFinancialHealthScore());

      const currentTxs = storageService.getTransactions().filter((t) => t.date.startsWith('2026-08'));
      const prevTxs = storageService.getTransactions().filter((t) => t.date.startsWith('2026-07'));
      const cats = storageService.getCategories();
      const generated = InsightGenerator.generateDynamicInsights(currentTxs, prevTxs, cats);
      setInsights(generated);
    };

    load();

    const handleUpdate = () => {
      setRefreshKey((k) => k + 1);
      load();
    };

    window.addEventListener(NOTIFY_EVENT, handleUpdate);
    return () => window.removeEventListener(NOTIFY_EVENT, handleUpdate);
  }, [currentMonth]);

  // Compute month summary
  const summary = storageService.calculateMonthSummary(
    currentMonth === 'all' ? '2026-08' : currentMonth
  );
  const prevSummary = storageService.calculateMonthSummary('2026-07');
  const momComparison = SpendingAnalyzer.compareMonths(
    summary.transactions,
    prevSummary.transactions,
    categories
  );

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

  // Weekly spending bars for current month
  const weeklyData = [
    { name: 'Aug 1-7', amount: 38419 },
    { name: 'Aug 8-14', amount: 8218 },
    { name: 'Aug 15-21', amount: 23800 },
    { name: 'Aug 22-28', amount: 2013 },
  ];

  const recentTransactions = summary.transactions.slice(0, 6);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner: Financial Intelligence Pulse */}
      <div className="relative overflow-hidden rounded-2xl border border-[#262626] bg-[#111111] p-6 text-white shadow-lg">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute right-24 -bottom-12 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
              <Sparkles size={13} className="text-blue-400" />
              <span>AI Intelligence Overview • {getMonthName(currentMonth === 'all' ? '2026-08' : currentMonth)}</span>
            </div>
            <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Financial Health is{' '}
              <span className="text-emerald-400">{healthScore?.rating || 'Good'}</span> (
              {healthScore?.score || 78}/100)
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-gray-400 leading-relaxed">
              {healthScore?.summary ||
                'Your cash flow remains strong with a healthy savings margin. Review recent technology purchases and 1 inactive subscription.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenAskMoney}
              className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#252525] border border-[#333] shadow-xs"
            >
              <Sparkles size={15} className="text-blue-400" />
              <span>Ask AI Advisor</span>
            </button>
            <button
              onClick={() => onNavigate('statements')}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500 shadow-md shadow-blue-900/40"
            >
              <Receipt size={15} />
              <span>Upload Statement</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Core Financial Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Income Card */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>Total Monthly Inflow</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowDownRight size={17} />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-white">
            {formatCurrency(summary.totalIncome, currencySymbol)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span className="font-semibold">100% credited</span>
            <span className="text-gray-500">• Salary + Rewards</span>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>Total Outflow (Expenses)</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowUpRight size={17} />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-white">
            {formatCurrency(summary.totalExpenses, currencySymbol)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <span>
              {momComparison.totalChangePercentage >= 0 ? '+' : ''}
              {momComparison.totalChangePercentage}% vs last month
            </span>
            <span className="text-gray-500">• High-ticket tech</span>
          </div>
        </div>

        {/* Net Savings Card */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>Net Saved Amount</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <Wallet size={17} />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-blue-400">
            {formatCurrency(summary.saved, currencySymbol)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
            <span className="font-semibold text-emerald-400">
              {summary.savingsRate.toFixed(1)}% savings rate
            </span>
            <span className="text-gray-500">• Target: 40%</span>
          </div>
        </div>

        {/* Fixed Commitments & Subscriptions */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>Fixed & Recurring Burn</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-white">
            {formatCurrency(43265, currencySymbol)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
            <span className="text-gray-400">Rent (₹25k) + EMI (₹12.5k) + Subs</span>
          </div>
        </div>
      </div>

      {/* Row 2: "Where Did My Money Go?" & "What Changed This Month?" */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* "Where Did My Money Go?" (7 Cols) */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#262626] pb-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Where Did My Money Go?</h2>
              <p className="text-xs text-gray-500">Category spending distribution for this month</p>
            </div>
            <button
              onClick={() => onNavigate('analytics')}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 uppercase tracking-wider"
            >
              Deep Analytics <ChevronRight size={14} />
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Donut Chart */}
            <div className="h-52 md:col-span-5 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141414',
                      borderColor: '#262626',
                      borderRadius: '10px',
                      color: '#e5e5e5',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => [
                      formatCurrency(Number(value), currencySymbol),
                      'Spent',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center pointer-events-none">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Total</span>
                <div className="font-mono text-sm font-extrabold text-white">
                  {formatCurrency(summary.totalExpenses, currencySymbol)}
                </div>
              </div>
            </div>

            {/* Category Progress Bars */}
            <div className="space-y-3 md:col-span-7 max-h-56 overflow-y-auto pr-1">
              {pieData.slice(0, 5).map((item) => {
                const pct =
                  summary.totalExpenses > 0
                    ? Math.round((item.value / summary.totalExpenses) * 100)
                    : 0;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-gray-300">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-white">
                          {formatCurrency(item.value, currencySymbol)}
                        </span>
                        <span className="text-[11px] font-medium text-gray-500 w-8 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#262626]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* "What Changed This Month?" (5 Cols) */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white">What Changed This Month?</h2>
                <p className="text-xs text-gray-500">August vs July variance breakdown</p>
              </div>
              <div className="rounded-md bg-blue-600/10 border border-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-400">
                MoM Delta
              </div>
            </div>

            <p className="mt-4 text-xs font-medium text-gray-300 leading-relaxed">
              {momComparison.summaryNarration}
            </p>

            <div className="mt-4 space-y-2.5">
              {momComparison.items.slice(0, 3).map((item) => (
                <div
                  key={item.categoryId}
                  className="flex items-center justify-between rounded-lg bg-[#1a1a1a] border border-[#262626] p-2.5 text-xs"
                >
                  <div>
                    <span className="font-semibold text-gray-200">{item.categoryName}</span>
                    <div className="text-[11px] text-gray-500 font-mono">
                      {formatCurrency(item.previousAmount, currencySymbol)} →{' '}
                      {formatCurrency(item.currentAmount, currencySymbol)}
                    </div>
                  </div>

                  <div
                    className={`flex items-center gap-1 font-mono font-bold ${
                      item.diffAmount > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {item.diffAmount > 0 ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                    <span>
                      {item.diffAmount > 0 ? '+' : ''}
                      {formatCurrency(item.diffAmount, currencySymbol)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#262626] flex items-center justify-between">
            <span className="text-xs text-gray-500">Want to curb sudden spikes?</span>
            <button
              onClick={onOpenBeforeSpend}
              className="text-xs font-bold text-blue-400 hover:text-blue-300"
            >
              Run Purchase Check →
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: AI Intelligence Feed & Weekly Heatmap */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* AI Insight Highlights (7 Cols) */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-600/5 p-6 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#262626] pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-400">AI Intelligence Pulse</h2>
                <p className="text-xs text-gray-400">
                  Real-time anomalies, money leaks, and behavioral patterns
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('insights')}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider"
            >
              View All ({insights.length}) →
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {insights.slice(0, 3).map((ins) => (
              <div
                key={ins.id}
                className="rounded-xl border border-[#262626] bg-[#141414] p-4 transition hover:bg-[#1a1a1a]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-white">{ins.title}</span>
                    <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                      {ins.description}
                    </p>
                  </div>
                  <span className="rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold shrink-0">
                    {ins.confidenceScore}% AI Score
                  </span>
                </div>

                {ins.actionRecommendation && (
                  <div className="mt-2.5 rounded-lg bg-[#1a1a1a] p-2.5 text-[11px] font-medium text-gray-300 border border-[#262626]">
                    <strong className="text-blue-400 font-semibold">Recommendation:</strong>{' '}
                    {ins.actionRecommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Spending Rhythm (5 Cols) */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Weekly Outflow Cadence</h2>
                <p className="text-xs text-gray-500">Spending velocity across weeks</p>
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1a1a1a] text-gray-400">
                <Calendar size={15} />
              </div>
            </div>

            <div className="mt-4 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#666666" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#666666"
                    tickFormatter={(v) => `₹${v / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141414',
                      borderColor: '#262626',
                      borderRadius: '10px',
                      color: '#e5e5e5',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [
                      formatCurrency(Number(val), currencySymbol),
                      'Total Outflow',
                    ]}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-gray-500 mt-2 text-center">
              Week 1 was heavy due to Rent & monthly commitments; Week 3 spiked from gadget upgrade.
            </p>
          </div>
        </div>
      </div>

      {/* Row 4: Recent Transactions */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Recent Intelligence</h2>
            <p className="text-xs text-gray-500">Live recorded activity across your accounts</p>
          </div>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 uppercase tracking-wider"
          >
            All Transactions ({summary.transactions.length}) <ChevronRight size={14} />
          </button>
        </div>

        <div className="mt-4 divide-y divide-[#212121] overflow-hidden rounded-xl border border-[#262626] bg-[#141414]">
          {recentTransactions.map((tx) => {
            const cat = categories.find((c) => c.id === tx.categoryId);
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3.5 transition hover:bg-[#1a1a1a]"
              >
                <div className="flex items-center gap-3">
                  <CategoryIcon category={cat} categoryId={tx.categoryId} size={18} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{tx.merchant}</span>
                      {tx.isAnomaly && (
                        <span className="rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                          Unusual Spike
                        </span>
                      )}
                      {tx.type === 'refund' && (
                        <span className="rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                          Refund
                        </span>
                      )}
                      {tx.isRecurring && (
                        <span className="rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                          Recurring
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {formatDate(tx.date)} • {tx.paymentMethod} • {cat ? cat.name : tx.categoryId}
                    </div>
                  </div>
                </div>

                <div
                  className={`font-mono text-sm font-extrabold ${
                    tx.type === 'income'
                      ? 'text-emerald-400'
                      : tx.type === 'refund'
                      ? 'text-blue-400'
                      : 'text-gray-200'
                  }`}
                >
                  {tx.type === 'income' ? '+' : tx.type === 'refund' ? '↺ ' : '-'}
                  {formatCurrency(tx.amount, currencySymbol)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
