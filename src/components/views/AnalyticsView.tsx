import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Download,
  FileText,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { Category, Transaction } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { SpendingAnalyzer, MoMComparisonItem } from '../../services/ai/spending-analyzer';
import { MonthlyReportGenerator } from '../../services/reports/pdf-report-generator';
import { formatCurrency, getMonthName, getCurrentMonth, getPreviousMonth, getLastThreeMonths } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { DailyExpenseHeatmapMatrix } from '../analytics/DailyExpenseHeatmapMatrix';

interface AnalyticsViewProps {
  currentMonth: string;
  currencySymbol: string;
  onNavigate?: (viewId: string) => void;
  onOpenAddModal?: (tx?: Transaction) => void;
  onNavigateToTransactions?: (startDate: string, endDate: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  currentMonth,
  currencySymbol,
  onNavigate,
  onOpenAddModal,
  onNavigateToTransactions,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'heatmap' | 'mom' | 'cashflow' | 'merchants' | 'methods'>('heatmap');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>(
    currentMonth && currentMonth !== 'all' ? currentMonth : getCurrentMonth()
  );

  const load = () => {
    setCategories(storageService.getCategories());
  };

  useEffect(() => {
    load();
    window.addEventListener(NOTIFY_EVENT, load);
    return () => window.removeEventListener(NOTIFY_EVENT, load);
  }, []);

  const activeMonthStr = currentMonth && currentMonth !== 'all' ? currentMonth : getCurrentMonth();
  const prevMonthStr = getPreviousMonth(activeMonthStr);
  const prev2MonthStr = getPreviousMonth(prevMonthStr);

  const curSummary = storageService.calculateMonthSummary(activeMonthStr);
  const prevSummary = storageService.calculateMonthSummary(prevMonthStr);
  const prev2Summary = storageService.calculateMonthSummary(prev2MonthStr);

  const momData = SpendingAnalyzer.compareMonths(
    curSummary.transactions,
    prevSummary.transactions,
    categories
  );

  // Multi-month trend comparison
  const monthlyTrendData = [
    { name: getMonthName(prev2MonthStr), income: prev2Summary.totalIncome, expenses: prev2Summary.totalExpenses, saved: prev2Summary.saved },
    { name: getMonthName(prevMonthStr), income: prevSummary.totalIncome, expenses: prevSummary.totalExpenses, saved: prevSummary.saved },
    { name: getMonthName(activeMonthStr), income: curSummary.totalIncome, expenses: curSummary.totalExpenses, saved: curSummary.saved },
  ];

  // Payment method data
  const paymentMethodData = Object.entries(curSummary.paymentMethodSpending).map(
    ([method, amount]) => ({
      name: method,
      value: amount,
    })
  );

  const METHOD_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#64748B'];

  // Top Merchants list
  const merchantList = Object.entries(curSummary.merchantSpending)
    .map(([merchant, data]) => ({
      merchant,
      total: data.total,
      count: data.count,
      highest: data.highest,
      average: Math.round(data.total / data.count),
    }))
    .sort((a, b) => b.total - a.total);

  // Calendar Heatmap data for active month
  const [yearNum, monthNum] = activeMonthStr.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${activeMonthStr}-${day.toString().padStart(2, '0')}`;
    const amount = curSummary.dailySpending[dateStr] || 0;
    return { day, dateStr, amount };
  });

  const handleDownloadReport = (targetMonth: string = selectedReportMonth) => {
    setIsGenerating(true);
    try {
      MonthlyReportGenerator.generateMonthlyReport({
        month: targetMonth,
        currencySymbol,
      });
      setReportSuccess(`Financial statement PDF generated for ${getMonthName(targetMonth)}`);
      setTimeout(() => setReportSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to generate PDF report', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
      {/* Toast Notification */}
      {reportSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{reportSuccess}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Analytics & Cash Flow Intelligence
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Deep forensic breakdown of month-over-month variances, true cash flow, and merchant concentration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector & Download PDF Report Button */}
          <div className="flex items-center gap-2">
            <select
              id="report-month-select"
              value={selectedReportMonth}
              onChange={(e) => setSelectedReportMonth(e.target.value)}
              className="rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-semibold text-gray-300 focus:border-blue-500 focus:outline-none"
              title="Select report period"
            >
              {getLastThreeMonths(activeMonthStr).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} {m.value === getCurrentMonth() ? '(Current)' : ''}
                </option>
              ))}
            </select>

            <button
              id="download-monthly-report-btn"
              onClick={() => handleDownloadReport(selectedReportMonth)}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              title={`Download comprehensive PDF financial report for ${getMonthName(selectedReportMonth)}`}
            >
              {isGenerating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              <span>Download Report</span>
            </button>
          </div>

          {/* View Tabs */}
          <div className="flex rounded-xl border border-[#262626] bg-[#0f0f0f] p-1 text-xs">
            <button
              onClick={() => setActiveTab('heatmap')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                activeTab === 'heatmap'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Daily Heatmap
            </button>
            <button
              onClick={() => setActiveTab('mom')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                activeTab === 'mom'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              MoM Variance
            </button>
            <button
              onClick={() => setActiveTab('cashflow')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                activeTab === 'cashflow'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              True Cash Flow
            </button>
            <button
              onClick={() => setActiveTab('merchants')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                activeTab === 'merchants'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Top Merchants
            </button>
            <button
              onClick={() => setActiveTab('methods')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                activeTab === 'methods'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Payment Rails
            </button>
          </div>
        </div>
      </div>

      {/* 3-Month Trend Chart */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 sm:p-5 lg:p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Income vs. Outflow Growth</h2>
            <p className="text-xs text-gray-400">3-month comparative velocity curve</p>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            Consistent Net Surplus
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrendData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#888' }} stroke="#333" />
              <YAxis
                tick={{ fontSize: 12, fill: '#888' }}
                stroke="#333"
                tickFormatter={(v) => `₹${v / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#141414',
                  borderColor: '#262626',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(val: any) => [
                  formatCurrency(Number(val), currencySymbol),
                ]}
              />
              <Bar dataKey="income" name="Salary Inflow" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Actual Outflow" fill="#6366F1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saved" name="Net Saved" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab 0: Daily Expense Concentration Heatmap Matrix */}
      {activeTab === 'heatmap' && (
        <DailyExpenseHeatmapMatrix
          currentMonth={activeMonthStr}
          currencySymbol={currencySymbol}
          onNavigateToTransactions={onNavigateToTransactions}
          onOpenAddModal={onOpenAddModal}
        />
      )}

      {/* Tab 1: Month-over-Month Variance Grid */}
      {activeTab === 'mom' && (
        <div className="space-y-5 sm:space-y-6">
          <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 sm:p-5 lg:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Category-by-Category Shift (August vs July)
                </h2>
                <p className="text-xs text-gray-400">
                  Highlighting where your outflow expanded or contracted
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {momData.items.map((item) => {
                const isUp = item.diffAmount > 0;
                return (
                  <div
                    key={item.categoryId}
                    className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-4 transition hover:bg-[#1a1a1a]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{item.categoryName}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          isUp
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isUp ? '+' : ''}
                        {item.changePercentage}%
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">
                          August 2026
                        </span>
                        <div className="font-mono text-sm font-bold text-white">
                          {formatCurrency(item.currentAmount, currencySymbol)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">
                          July 2026
                        </span>
                        <div className="font-mono text-xs text-gray-400">
                          {formatCurrency(item.previousAmount, currencySymbol)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Embedded Daily Expense Heatmap Matrix */}
          <DailyExpenseHeatmapMatrix
            currentMonth={activeMonthStr}
            currencySymbol={currencySymbol}
            onNavigateToTransactions={onNavigateToTransactions}
            onOpenAddModal={onOpenAddModal}
            embedded={true}
          />
        </div>
      )}

      {/* Tab 2: True Cash Flow */}
      {activeTab === 'cashflow' && (
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 sm:p-5 lg:p-6 shadow-xs space-y-5 sm:space-y-6">
          <div>
            <h2 className="text-base font-bold text-white">
              True Cash Flow Separation Engine
            </h2>
            <p className="text-xs text-gray-400">
              Internal bank transfers, ATM cash withdrawals, and investments do not equal burnt expense.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-4">
              <span className="text-xs font-bold text-gray-400">Self Bank Transfers</span>
              <div className="font-mono text-xl font-bold text-white mt-1">
                {formatCurrency(curSummary.totalTransfers, currencySymbol)}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                HDFC to ICICI account transfers excluded from lifestyle expense calculations.
              </p>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-600/10 p-4">
              <span className="text-xs font-bold text-blue-300">Mutual Fund SIPs / Assets</span>
              <div className="font-mono text-xl font-bold text-blue-400 mt-1">
                {formatCurrency(curSummary.totalInvestments, currencySymbol)}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Zerodha Coin SIP counted toward wealth generation instead of consumption.
              </p>
            </div>

            <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-4">
              <span className="text-xs font-bold text-gray-400">ATM Cash Stash</span>
              <div className="font-mono text-xl font-bold text-white mt-1">
                {formatCurrency(curSummary.totalCashWithdrawal, currencySymbol)}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Physical emergency cash reserve kept on hand.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Top Merchants */}
      {activeTab === 'merchants' && (
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 sm:p-5 lg:p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Merchant Concentration Matrix</h2>
              <p className="text-xs text-gray-400">
                Sorted by highest cumulative expenditure in current active period
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#212121]">
            {merchantList.map((m, idx) => (
              <div
                key={m.merchant}
                className="flex items-center justify-between py-3 hover:bg-[#1a1a1a] px-2 rounded-lg transition"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#262626] font-mono text-xs font-bold text-gray-300">
                    #{idx + 1}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white">{m.merchant}</span>
                    <div className="text-[11px] text-gray-500">
                      {m.count} transactions • Avg: {formatCurrency(m.average, currencySymbol)} • Peak:{' '}
                      {formatCurrency(m.highest, currencySymbol)}
                    </div>
                  </div>
                </div>

                <div className="font-mono text-sm font-bold text-white">
                  {formatCurrency(m.total, currencySymbol)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Payment Methods */}
      {activeTab === 'methods' && (
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 sm:p-5 lg:p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Payment Rails & Instrumentation</h2>
              <p className="text-xs text-gray-400">UPI vs Credit Cards vs Direct Net Banking</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentMethodData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={METHOD_COLORS[index % METHOD_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141414',
                      borderColor: '#262626',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [
                      formatCurrency(Number(val), currencySymbol),
                      'Total Spent',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {paymentMethodData.map((item, idx) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-xl bg-[#0f0f0f] border border-[#262626] p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: METHOD_COLORS[idx % METHOD_COLORS.length] }}
                    />
                    <span className="text-xs font-semibold text-gray-200">{item.name}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-white">
                    {formatCurrency(item.value, currencySymbol)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
