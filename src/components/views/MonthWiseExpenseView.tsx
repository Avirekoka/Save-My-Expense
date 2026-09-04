import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarRange,
  TrendingDown,
  TrendingUp,
  Receipt,
  ArrowRight,
  Download,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  PieChart,
  Wallet,
  Landmark,
} from 'lucide-react';
import { Transaction, Category } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, getMonthName } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';

interface MonthWiseExpenseViewProps {
  currencySymbol: string;
  onNavigate: (viewId: string) => void;
  onSelectMonth: (month: string) => void;
  onOpenAddModal?: () => void;
}

interface MonthSummaryData {
  monthKey: string; // '2026-08'
  monthLabel: string; // 'August 2026'
  year: string; // '2026'
  totalIncome: number;
  totalExpense: number;
  totalLoanEMI: number;
  totalOutflow: number;
  netSavings: number;
  savingsRate: number;
  transactionCount: number;
  topCategory?: { category: Category | undefined; amount: number };
}

export const MonthWiseExpenseView: React.FC<MonthWiseExpenseViewProps> = ({
  currencySymbol,
  onNavigate,
  onSelectMonth,
  onOpenAddModal,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');

  const loadData = () => {
    setTransactions(storageService.getTransactions());
    setCategories(storageService.getCategories());
  };

  useEffect(() => {
    loadData();
    window.addEventListener(NOTIFY_EVENT, loadData);
    return () => window.removeEventListener(NOTIFY_EVENT, loadData);
  }, []);

  // Extract all unique years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 4) {
        years.add(tx.date.slice(0, 4));
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Aggregate by month
  const monthSummaries = useMemo(() => {
    const map: Record<string, Transaction[]> = {};

    transactions.forEach((tx) => {
      const monthKey = tx.date.slice(0, 7); // 'YYYY-MM'
      if (!map[monthKey]) {
        map[monthKey] = [];
      }
      map[monthKey].push(tx);
    });

    const summaries: MonthSummaryData[] = Object.entries(map).map(
      ([monthKey, txList]) => {
        let totalIncome = 0;
        let totalExpense = 0;
        let totalLoanEMI = 0;
        const categorySpending: Record<string, number> = {};

        txList.forEach((tx) => {
          if (tx.type === 'income') {
            totalIncome += tx.amount;
          } else if (tx.type === 'loan_emi') {
            totalLoanEMI += tx.amount;
          } else if (tx.type === 'expense') {
            totalExpense += tx.amount;
            categorySpending[tx.categoryId] =
              (categorySpending[tx.categoryId] || 0) + tx.amount;
          }
        });

        const totalOutflow = totalExpense + totalLoanEMI;
        const netSavings = totalIncome - totalOutflow;
        const savingsRate =
          totalIncome > 0 ? Math.max(0, (netSavings / totalIncome) * 100) : 0;

        // Find top category
        let topCatId = '';
        let maxCatAmount = 0;
        Object.entries(categorySpending).forEach(([catId, amt]) => {
          if (amt > maxCatAmount) {
            maxCatAmount = amt;
            topCatId = catId;
          }
        });

        const topCategory = topCatId
          ? {
              category: categories.find((c) => c.id === topCatId),
              amount: maxCatAmount,
            }
          : undefined;

        const year = monthKey.slice(0, 4);

        return {
          monthKey,
          monthLabel: getMonthName(monthKey),
          year,
          totalIncome,
          totalExpense,
          totalLoanEMI,
          totalOutflow,
          netSavings,
          savingsRate,
          transactionCount: txList.length,
          topCategory,
        };
      }
    );

    // Sort newest month first
    return summaries.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [transactions, categories]);

  // Filtered month summaries based on year and search
  const filteredSummaries = useMemo(() => {
    return monthSummaries.filter((m) => {
      if (selectedYear !== 'all' && m.year !== selectedYear) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.monthLabel.toLowerCase().includes(q) ||
          m.monthKey.includes(q) ||
          m.year.includes(q)
        );
      }
      return true;
    });
  }, [monthSummaries, selectedYear, searchQuery]);

  // Overall lifetime stats
  const lifetimeStats = useMemo(() => {
    let lifetimeOutflow = 0;
    let lifetimeInflow = 0;
    transactions.forEach((tx) => {
      if (tx.type === 'income') {
        lifetimeInflow += tx.amount;
      } else if (tx.type === 'expense' || tx.type === 'loan_emi') {
        lifetimeOutflow += tx.amount;
      }
    });

    const netLifetime = lifetimeInflow - lifetimeOutflow;
    const avgMonthlyOutflow =
      monthSummaries.length > 0 ? lifetimeOutflow / monthSummaries.length : 0;

    let peakMonth: MonthSummaryData | null = null;
    monthSummaries.forEach((m) => {
      if (!peakMonth || m.totalOutflow > peakMonth.totalOutflow) {
        peakMonth = m;
      }
    });

    return {
      lifetimeOutflow,
      lifetimeInflow,
      netLifetime,
      avgMonthlyOutflow,
      peakMonth,
      totalMonths: monthSummaries.length,
    };
  }, [transactions, monthSummaries]);

  const handleSelectMonthAndGo = (monthKey: string) => {
    onSelectMonth(monthKey);
    onNavigate('transactions');
  };

  const handleGoToAllHistory = () => {
    onSelectMonth('all');
    onNavigate('transactions');
  };

  const handleExportCSV = () => {
    const csv = storageService.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `month_wise_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <CalendarRange size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Month-Wise Expenses
            </h1>
            <span className="rounded-md bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-xs font-bold text-blue-300">
              All History
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Compare monthly spending trends, income velocity, and savings across your entire financial history.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleGoToAllHistory}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/20 px-3 text-xs font-bold text-blue-300 hover:bg-blue-600/30 shadow-xs transition cursor-pointer"
          >
            <SlidersHorizontal size={14} />
            <span>Filter Transactions by Date Range</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#262626] bg-[#141414] px-3 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] shadow-xs cursor-pointer"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {onOpenAddModal && (
            <button
              onClick={onOpenAddModal}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-500 shadow-xs cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Add Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* Lifetime Stats KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {/* Lifetime Outflow */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-3.5 sm:p-4.5 lg:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-medium uppercase tracking-wider text-[10px]">
              Total Lifetime Outflow
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown size={14} />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-white">
            {formatCurrency(lifetimeStats.lifetimeOutflow, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Across {lifetimeStats.totalMonths} calendar months
          </div>
        </div>

        {/* Lifetime Inflow */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-3.5 sm:p-4.5 lg:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-medium uppercase tracking-wider text-[10px]">
              Total Lifetime Inflow
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-emerald-400">
            {formatCurrency(lifetimeStats.lifetimeInflow, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Earned income & refunds
          </div>
        </div>

        {/* Net Savings */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-3.5 sm:p-4.5 lg:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-medium uppercase tracking-wider text-[10px]">
              Cumulative Savings
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Wallet size={14} />
            </div>
          </div>
          <div
            className={`mt-2 text-xl sm:text-2xl font-bold font-mono ${
              lifetimeStats.netLifetime >= 0 ? 'text-blue-400' : 'text-rose-400'
            }`}
          >
            {formatCurrency(lifetimeStats.netLifetime, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            {lifetimeStats.lifetimeInflow > 0
              ? `${(
                  (lifetimeStats.netLifetime / lifetimeStats.lifetimeInflow) *
                  100
                ).toFixed(1)}% lifetime retention`
              : 'Lifetime net balance'}
          </div>
        </div>

        {/* Average Outflow */}
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-3.5 sm:p-4.5 lg:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-medium uppercase tracking-wider text-[10px]">
              Avg Monthly Outflow
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Receipt size={14} />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-white">
            {formatCurrency(lifetimeStats.avgMonthlyOutflow, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-gray-400 truncate">
            {lifetimeStats.peakMonth
              ? `Peak: ${lifetimeStats.peakMonth.monthLabel}`
              : 'Based on recorded months'}
          </div>
        </div>
      </div>

      {/* Quick Date Range Banner */}
      <div className="rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-900/20 via-[#141414] to-purple-900/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} />
            <span>Detailed Date Range Filtering Available</span>
          </div>
          <p className="text-xs text-gray-200">
            Need to analyze spending between arbitrary dates (e.g. 15th of last month to 15th of this month)?
            Jump directly to the interactive Transactions ledger with custom From and To date pickers.
          </p>
        </div>

        <button
          onClick={handleGoToAllHistory}
          className="shrink-0 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow-md cursor-pointer"
        >
          <span>Open Date Range Selector</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-[#262626] bg-[#141414] p-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search month or year (e.g. August, 2026)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
            Year:
          </span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-8 rounded-lg border border-[#262626] bg-[#0f0f0f] px-2.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Month-by-Month Cards / Table */}
      {filteredSummaries.length === 0 ? (
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a1a1a] text-gray-500">
            <CalendarRange size={24} />
          </div>
          <h3 className="mt-4 text-sm font-bold text-white">
            No monthly records found
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Try adjusting your search criteria or add new transactions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSummaries.map((item) => (
            <div
              key={item.monthKey}
              className="group rounded-xl border border-[#262626] bg-[#141414] p-4 sm:p-5 transition hover:border-[#383838] hover:bg-[#161616] shadow-xs"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Month info */}
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] text-blue-400 font-bold text-xs">
                    {item.monthKey.slice(5, 7)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition">
                        {item.monthLabel}
                      </h3>
                      <span className="rounded-md bg-[#222] px-2 py-0.5 text-[10px] font-semibold text-gray-400">
                        {item.transactionCount} transactions
                      </span>
                    </div>
                    {item.topCategory?.category && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                        <span>Top spend:</span>
                        <span className="font-semibold text-gray-200">
                          {item.topCategory.category.name}
                        </span>
                        <span className="font-mono text-gray-400">
                          ({formatCurrency(item.topCategory.amount, currencySymbol)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Numbers breakdown */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-8 border-t lg:border-t-0 border-[#222] pt-3 lg:pt-0">
                  {/* Total Outflow */}
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">
                      Total Outflow
                    </div>
                    <div className="text-sm sm:text-base font-bold font-mono text-white mt-0.5">
                      {formatCurrency(item.totalOutflow, currencySymbol)}
                    </div>
                  </div>

                  {/* Total Inflow */}
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">
                      Inflow
                    </div>
                    <div className="text-sm sm:text-base font-bold font-mono text-emerald-400 mt-0.5">
                      {formatCurrency(item.totalIncome, currencySymbol)}
                    </div>
                  </div>

                  {/* Net Savings */}
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">
                      Net Savings
                    </div>
                    <div
                      className={`text-sm sm:text-base font-bold font-mono mt-0.5 ${
                        item.netSavings >= 0 ? 'text-blue-400' : 'text-rose-400'
                      }`}
                    >
                      {item.netSavings >= 0 ? '+' : ''}
                      {formatCurrency(item.netSavings, currencySymbol)}
                    </div>
                  </div>

                  {/* Savings Rate */}
                  <div className="hidden sm:block">
                    <div className="text-[10px] uppercase font-bold text-gray-400">
                      Savings Rate
                    </div>
                    <div className="text-sm font-bold text-gray-200 mt-0.5">
                      {item.savingsRate.toFixed(0)}%
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleSelectMonthAndGo(item.monthKey)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#333] bg-[#1a1a1a] px-3.5 py-2 text-xs font-bold text-blue-300 hover:bg-blue-600 hover:text-white transition cursor-pointer ml-auto lg:ml-0 shadow-xs"
                  >
                    <span>View Ledger</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
