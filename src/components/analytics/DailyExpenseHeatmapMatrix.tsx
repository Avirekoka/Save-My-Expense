import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Filter,
  Search,
  Plus,
  ArrowRight,
  Check,
  RotateCcw,
  X,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Edit2,
  Trash2,
  Info,
  CalendarRange,
  Flame,
  Award,
} from 'lucide-react';
import { Transaction, Category } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, formatDate, formatShortDate, getMonthName, getCurrentMonth, getPreviousMonth } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { AddTransactionModal } from '../modals/AddTransactionModal';
import { DeleteConfirmModal } from '../modals/DeleteConfirmModal';

interface DailyExpenseHeatmapMatrixProps {
  currentMonth: string;
  currencySymbol: string;
  onOpenAddModal?: (tx?: Transaction) => void;
  onNavigateToTransactions?: (startDate: string, endDate: string) => void;
  onSelectDateRange?: (startDate: string, endDate: string) => void;
  embedded?: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DailyExpenseHeatmapMatrix: React.FC<DailyExpenseHeatmapMatrixProps> = ({
  currentMonth,
  currencySymbol,
  onOpenAddModal,
  onNavigateToTransactions,
  onSelectDateRange,
  embedded = false,
}) => {
  // Normalize current active month
  const [activeMonth, setActiveMonth] = useState<string>(() => {
    return currentMonth && currentMonth !== 'all' ? currentMonth : getCurrentMonth();
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Selection states (consecutive range support)
  const [selectedStartDate, setSelectedStartDate] = useState<string | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'single' | 'range'>('single');
  const [isRangeAnchorSet, setIsRangeAnchorSet] = useState<boolean>(false);

  // Drag selection states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartDate, setDragStartDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Display options
  const [viewFormat, setViewFormat] = useState<'calendar' | 'compact'>('calendar');

  // Search & Filter inside Transaction History
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'expense' | 'income'>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [initialTxDate, setInitialTxDate] = useState<string | undefined>(undefined);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Ref to scroll to history section smoothly
  const historyRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    setTransactions(storageService.getTransactions());
    setCategories(storageService.getCategories());
  };

  useEffect(() => {
    loadData();
    window.addEventListener(NOTIFY_EVENT, loadData);
    return () => window.removeEventListener(NOTIFY_EVENT, loadData);
  }, []);

  // Synchronize when currentMonth prop updates
  useEffect(() => {
    if (currentMonth && currentMonth !== 'all' && currentMonth !== activeMonth) {
      setActiveMonth(currentMonth);
      setSelectedStartDate(null);
      setSelectedEndDate(null);
    }
  }, [currentMonth]);

  // Compute calendar days for activeMonth
  const { yearNum, monthNum, daysInMonth, firstDayWeekdayOffset } = useMemo(() => {
    const [y, m] = activeMonth.split('-').map(Number);
    const totalDays = new Date(y, m, 0).getDate();
    // Monday as 0, Sunday as 6
    const firstDay = new Date(y, m - 1, 1).getDay();
    const offset = (firstDay + 6) % 7;
    return {
      yearNum: y,
      monthNum: m,
      daysInMonth: totalDays,
      firstDayWeekdayOffset: offset,
    };
  }, [activeMonth]);

  // Daily map of transactions and totals
  const dailyDataMap = useMemo(() => {
    const map = new Map<
      string,
      {
        dateStr: string;
        dayNum: number;
        weekday: string;
        expenseTotal: number;
        incomeTotal: number;
        txCount: number;
        txs: Transaction[];
        topMerchant: string | null;
        topCategory: Category | null;
      }
    >();

    // Initialize all days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${activeMonth}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(yearNum, monthNum - 1, d);
      const weekday = WEEKDAYS[(dayDate.getDay() + 6) % 7];
      map.set(dateStr, {
        dateStr,
        dayNum: d,
        weekday,
        expenseTotal: 0,
        incomeTotal: 0,
        txCount: 0,
        txs: [],
        topMerchant: null,
        topCategory: null,
      });
    }

    // Populate with actual transactions
    transactions.forEach((tx) => {
      if (tx.date.startsWith(activeMonth)) {
        const item = map.get(tx.date);
        if (item) {
          item.txs.push(tx);
          item.txCount += 1;
          if (tx.type === 'expense' || tx.type === 'loan_emi') {
            item.expenseTotal += tx.amount;
          } else if (tx.type === 'income' || tx.type === 'refund') {
            item.incomeTotal += tx.amount;
          }
        }
      }
    });

    // Determine top merchant and category per day
    map.forEach((item) => {
      if (item.txs.length > 0) {
        // Sort expenses to find top expense merchant
        const expenses = item.txs.filter((t) => t.type === 'expense' || t.type === 'loan_emi');
        if (expenses.length > 0) {
          const sorted = [...expenses].sort((a, b) => b.amount - a.amount);
          item.topMerchant = sorted[0].merchant;
          item.topCategory = categories.find((c) => c.id === sorted[0].categoryId) || null;
        } else {
          item.topMerchant = item.txs[0].merchant;
          item.topCategory = categories.find((c) => c.id === item.txs[0].categoryId) || null;
        }
      }
    });

    return map;
  }, [activeMonth, daysInMonth, yearNum, monthNum, transactions, categories]);

  // Calculate month metrics & concentration scale
  const { monthExpenses, monthIncomes, maxDayExpense, zeroSpendCount, activeSpendDays } = useMemo(() => {
    let expSum = 0;
    let incSum = 0;
    let maxExp = 0;
    let zeroCount = 0;
    let activeDays = 0;

    dailyDataMap.forEach((data) => {
      expSum += data.expenseTotal;
      incSum += data.incomeTotal;
      if (data.expenseTotal > maxExp) {
        maxExp = data.expenseTotal;
      }
      if (data.expenseTotal === 0) {
        zeroCount++;
      } else {
        activeDays++;
      }
    });

    return {
      monthExpenses: expSum,
      monthIncomes: incSum,
      maxDayExpense: Math.max(maxExp, 3000),
      zeroSpendCount: zeroCount,
      activeSpendDays: activeDays,
    };
  }, [dailyDataMap]);

  // Concentration level calculator (0 to 4)
  const getConcentrationLevel = (amount: number): number => {
    if (amount <= 0) return 0;
    // Scale against month's maximum spend with reasonable absolute floors
    const ratio = amount / maxDayExpense;
    if (ratio < 0.15 || amount < 800) return 1;
    if (ratio < 0.45 || amount < 3000) return 2;
    if (ratio < 0.75 || amount < 8000) return 3;
    return 4;
  };

  // Color classes for concentration levels (dark mode default, index.css auto-maps for light theme)
  const getConcentrationColorClasses = (level: number, isSelected: boolean) => {
    if (isSelected) {
      return 'bg-blue-600 text-white font-bold ring-2 ring-blue-400 ring-offset-2 ring-offset-[#0d0d0d] shadow-lg shadow-blue-600/30 scale-[1.02] z-10';
    }

    switch (level) {
      case 4: // Peak
        return 'bg-blue-500 text-white font-bold border border-blue-400/80 shadow-xs shadow-blue-500/20';
      case 3: // Elevated
        return 'bg-blue-600/80 text-blue-100 font-semibold border border-blue-500/60';
      case 2: // Moderate
        return 'bg-blue-800/40 text-blue-200 border border-blue-700/50';
      case 1: // Low
        return 'bg-blue-950/40 text-blue-300 border border-blue-900/40';
      case 0: // Zero spend
      default:
        return 'bg-[#0f0f0f] text-gray-400 border border-[#212121] hover:border-gray-700';
    }
  };

  // Helper to check if a date is within the selected consecutive range
  const isDateSelected = (dateStr: string) => {
    if (!selectedStartDate) return false;
    if (!selectedEndDate) return dateStr === selectedStartDate;
    return dateStr >= selectedStartDate && dateStr <= selectedEndDate;
  };

  const isRangeStart = (dateStr: string) => selectedStartDate === dateStr;
  const isRangeEnd = (dateStr: string) => selectedEndDate === dateStr;

  // Handle Day Click Selection
  const handleDayClick = (dateStr: string, e?: React.MouseEvent) => {
    const isShiftKey = e?.shiftKey;

    if (selectionMode === 'single' && !isShiftKey) {
      // Single day mode
      if (selectedStartDate === dateStr && selectedEndDate === dateStr) {
        // Toggle off if already selected
        setSelectedStartDate(null);
        setSelectedEndDate(null);
      } else {
        setSelectedStartDate(dateStr);
        setSelectedEndDate(dateStr);
        scrollToHistory();
      }
    } else {
      // Range mode or Shift+click
      if (!selectedStartDate || !isRangeAnchorSet) {
        // First click sets anchor
        setSelectedStartDate(dateStr);
        setSelectedEndDate(dateStr);
        setIsRangeAnchorSet(true);
        scrollToHistory();
      } else {
        // Second click completes range from min to max
        const start = dateStr < selectedStartDate ? dateStr : selectedStartDate;
        const end = dateStr > selectedStartDate ? dateStr : selectedStartDate;
        setSelectedStartDate(start);
        setSelectedEndDate(end);
        setIsRangeAnchorSet(false);
        scrollToHistory();
      }
    }

    if (onSelectDateRange) {
      onSelectDateRange(dateStr, dateStr);
    }
  };

  // Mouse Drag selection handlers for desktop swipe
  const handleMouseDown = (dateStr: string) => {
    setIsDragging(true);
    setDragStartDate(dateStr);
    setSelectedStartDate(dateStr);
    setSelectedEndDate(dateStr);
  };

  const handleMouseEnter = (dateStr: string) => {
    setHoveredDate(dateStr);
    if (isDragging && dragStartDate) {
      const start = dateStr < dragStartDate ? dateStr : dragStartDate;
      const end = dateStr > dragStartDate ? dateStr : dragStartDate;
      setSelectedStartDate(start);
      setSelectedEndDate(end);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragStartDate(null);
      scrollToHistory();
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragStartDate(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);

  const scrollToHistory = () => {
    setTimeout(() => {
      if (historyRef.current) {
        historyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    setActiveMonth((prev) => getPreviousMonth(prev));
    setSelectedStartDate(null);
    setSelectedEndDate(null);
  };

  const handleNextMonth = () => {
    setActiveMonth((prev) => {
      const [y, m] = prev.split('-').map(Number);
      const nextDate = new Date(y, m, 1);
      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
      return `${yyyy}-${mm}`;
    });
    setSelectedStartDate(null);
    setSelectedEndDate(null);
  };

  const handleResetToCurrentMonth = () => {
    setActiveMonth(getCurrentMonth());
    setSelectedStartDate(null);
    setSelectedEndDate(null);
  };

  // Quick range presets
  const selectToday = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (todayStr.startsWith(activeMonth)) {
      setSelectedStartDate(todayStr);
      setSelectedEndDate(todayStr);
      scrollToHistory();
    } else {
      setActiveMonth(todayStr.slice(0, 7));
      setSelectedStartDate(todayStr);
      setSelectedEndDate(todayStr);
      scrollToHistory();
    }
  };

  const selectLast7Days = () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const past7 = new Date(today);
    past7.setDate(past7.getDate() - 6);
    const past7Str = past7.toISOString().slice(0, 10);

    setActiveMonth(todayStr.slice(0, 7));
    setSelectedStartDate(past7Str);
    setSelectedEndDate(todayStr);
    scrollToHistory();
  };

  const selectLastWeekend = () => {
    // Find last Saturday and Sunday within activeMonth
    let sat: string | null = null;
    let sun: string | null = null;

    for (let d = daysInMonth; d >= 1; d--) {
      const date = new Date(yearNum, monthNum - 1, d);
      if (date.getDay() === 0 && !sun) {
        sun = `${activeMonth}-${String(d).padStart(2, '0')}`;
      } else if (date.getDay() === 6 && !sat && sun) {
        sat = `${activeMonth}-${String(d).padStart(2, '0')}`;
        break;
      }
    }

    if (sat && sun) {
      setSelectedStartDate(sat);
      setSelectedEndDate(sun);
      scrollToHistory();
    }
  };

  const selectFullMonth = () => {
    const start = `${activeMonth}-01`;
    const end = `${activeMonth}-${String(daysInMonth).padStart(2, '0')}`;
    setSelectedStartDate(start);
    setSelectedEndDate(end);
    scrollToHistory();
  };

  const clearSelection = () => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
    setIsRangeAnchorSet(false);
  };

  // Compute transactions belonging to the selected consecutive date range
  const selectedRangeTransactions = useMemo(() => {
    if (!selectedStartDate) return [];
    const end = selectedEndDate || selectedStartDate;

    return transactions.filter((t) => {
      if (t.date < selectedStartDate || t.date > end) return false;

      // Filter by search query
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const matchMerchant = t.merchant.toLowerCase().includes(q);
        const matchNotes = t.notes?.toLowerCase().includes(q);
        const matchTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
        if (!matchMerchant && !matchNotes && !matchTags) return false;
      }

      // Filter by category
      if (historyCategoryFilter !== 'all' && t.categoryId !== historyCategoryFilter) {
        return false;
      }

      // Filter by type
      if (historyTypeFilter === 'expense' && t.type !== 'expense' && t.type !== 'loan_emi') {
        return false;
      }
      if (historyTypeFilter === 'income' && t.type !== 'income' && t.type !== 'refund') {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort newest date and time first
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.amount - a.amount;
    });
  }, [transactions, selectedStartDate, selectedEndDate, historySearchQuery, historyCategoryFilter, historyTypeFilter]);

  // Selected range metrics
  const selectedRangeStats = useMemo(() => {
    if (!selectedStartDate) return null;
    const end = selectedEndDate || selectedStartDate;

    // Count consecutive days in range
    const startD = new Date(selectedStartDate);
    const endD = new Date(end);
    const diffTime = Math.abs(endD.getTime() - startD.getTime());
    const daysCount = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let expenseSum = 0;
    let incomeSum = 0;
    let peakDay = { date: selectedStartDate, amount: 0 };

    // Check every day in map within range
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${activeMonth}-${String(d).padStart(2, '0')}`;
      if (dateStr >= selectedStartDate && dateStr <= end) {
        const dayInfo = dailyDataMap.get(dateStr);
        if (dayInfo) {
          expenseSum += dayInfo.expenseTotal;
          incomeSum += dayInfo.incomeTotal;
          if (dayInfo.expenseTotal > peakDay.amount) {
            peakDay = { date: dateStr, amount: dayInfo.expenseTotal };
          }
        }
      }
    }

    return {
      daysCount,
      totalExpenses: expenseSum,
      totalIncome: incomeSum,
      netBurn: expenseSum - incomeSum,
      dailyAverage: Math.round(expenseSum / daysCount),
      transactionCount: selectedRangeTransactions.length,
      peakDay,
    };
  }, [selectedStartDate, selectedEndDate, daysInMonth, activeMonth, dailyDataMap, selectedRangeTransactions]);

  // Open add transaction modal prefilled with selected date
  const handleOpenAddForSelectedDate = () => {
    const targetDate = selectedStartDate || new Date().toISOString().slice(0, 10);
    setInitialTxDate(targetDate);
    setEditingTx(null);
    setIsAddModalOpen(true);
  };

  const handleEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setInitialTxDate(tx.date);
    setIsAddModalOpen(true);
  };

  const handleDeleteTx = (tx: Transaction) => {
    setTxToDelete(tx);
  };

  const confirmDeleteTx = () => {
    if (txToDelete) {
      storageService.deleteTransaction(txToDelete.id);
      setTxToDelete(null);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Matrix Card Container */}
      <div
        id="expense-heatmap-matrix-card"
        className="rounded-2xl border border-[#262626] bg-[#141414] p-4 sm:p-6 shadow-xl transition-all"
      >
        {/* Header with Title & Month Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <CalendarRange size={16} />
              </span>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                Daily Expense Concentration Heatmap
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">
              Visual matrix tracking intensity of daily burn. Click a single day to inspect its full transactions, or select consecutive days to analyze spending clusters.
            </p>
          </div>

          {/* Month Navigator & Format Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Switcher */}
            <div className="flex items-center rounded-xl border border-[#262626] bg-[#0d0d0d] p-1 shadow-inner">
              <button
                onClick={handlePrevMonth}
                title="Previous Month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#212121] transition cursor-pointer"
                aria-label="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="px-3 text-xs font-bold text-white min-w-[120px] text-center">
                {getMonthName(activeMonth)}
              </div>

              <button
                onClick={handleNextMonth}
                title="Next Month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#212121] transition cursor-pointer"
                aria-label="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Current Month Button */}
            {activeMonth !== getCurrentMonth() && (
              <button
                onClick={handleResetToCurrentMonth}
                className="rounded-xl border border-blue-500/30 bg-blue-600/10 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-600/20 transition cursor-pointer"
              >
                Current Month
              </button>
            )}

            {/* Grid View Toggle */}
            <div className="flex rounded-xl border border-[#262626] bg-[#0d0d0d] p-1 text-xs">
              <button
                onClick={() => setViewFormat('calendar')}
                className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer ${
                  viewFormat === 'calendar'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setViewFormat('compact')}
                className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer ${
                  viewFormat === 'compact'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Strip
              </button>
            </div>
          </div>
        </div>

        {/* Monthly Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-[#212121]">
          <div className="rounded-xl bg-[#0d0d0d] p-3 border border-[#212121]">
            <span className="text-[11px] font-medium text-gray-400">Total Monthly Outflow</span>
            <div className="font-mono text-base sm:text-lg font-bold text-white mt-0.5">
              {formatCurrency(monthExpenses, currencySymbol)}
            </div>
          </div>

          <div className="rounded-xl bg-[#0d0d0d] p-3 border border-[#212121]">
            <span className="text-[11px] font-medium text-gray-400">Daily Average Spend</span>
            <div className="font-mono text-base sm:text-lg font-bold text-blue-400 mt-0.5">
              {formatCurrency(Math.round(monthExpenses / daysInMonth), currencySymbol)}
            </div>
          </div>

          <div className="rounded-xl bg-[#0d0d0d] p-3 border border-[#212121]">
            <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
              <Award size={13} /> Zero-Spend Days
            </span>
            <div className="font-mono text-base sm:text-lg font-bold text-emerald-300 mt-0.5">
              {zeroSpendCount} <span className="text-xs text-gray-500 font-normal">of {daysInMonth}</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#0d0d0d] p-3 border border-[#212121]">
            <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
              <Flame size={13} /> Peak Daily Burn
            </span>
            <div className="font-mono text-base sm:text-lg font-bold text-amber-300 mt-0.5">
              {formatCurrency(maxDayExpense, currencySymbol)}
            </div>
          </div>
        </div>

        {/* Selection & Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-2">
          {/* Mode switch and Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-400">Selection Mode:</span>
            <div className="flex rounded-lg border border-[#262626] bg-[#0d0d0d] p-0.5 text-xs">
              <button
                onClick={() => {
                  setSelectionMode('single');
                  setIsRangeAnchorSet(false);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  selectionMode === 'single'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Single Day
              </button>
              <button
                onClick={() => setSelectionMode('range')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  selectionMode === 'range'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Consecutive Range
              </button>
            </div>

            {/* Quick consecutive presets */}
            <div className="flex flex-wrap items-center gap-1 pl-1">
              <button
                onClick={selectToday}
                className="rounded-lg border border-[#262626] bg-[#1a1a1a] px-2 py-1 text-[11px] text-gray-300 hover:text-white hover:border-gray-600 transition cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={selectLast7Days}
                className="rounded-lg border border-[#262626] bg-[#1a1a1a] px-2 py-1 text-[11px] text-gray-300 hover:text-white hover:border-gray-600 transition cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                onClick={selectLastWeekend}
                className="rounded-lg border border-[#262626] bg-[#1a1a1a] px-2 py-1 text-[11px] text-gray-300 hover:text-white hover:border-gray-600 transition cursor-pointer"
              >
                Weekend
              </button>
              <button
                onClick={selectFullMonth}
                className="rounded-lg border border-[#262626] bg-[#1a1a1a] px-2 py-1 text-[11px] text-gray-300 hover:text-white hover:border-gray-600 transition cursor-pointer"
              >
                Full Month
              </button>
              {selectedStartDate && (
                <button
                  onClick={clearSelection}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20 transition cursor-pointer flex items-center gap-1"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Interactive Concentration Legend */}
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <span className="font-semibold text-gray-400">Intensity:</span>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1" title="Zero spend: ₹0">
                <span className="h-3 w-3 rounded-xs bg-[#0f0f0f] border border-[#262626]" />
                <span className="text-[10px]">₹0</span>
              </div>
              <div className="flex items-center gap-1" title="Low spend">
                <span className="h-3 w-3 rounded-xs bg-blue-950/40 border border-blue-900/40" />
                <span className="text-[10px]">Low</span>
              </div>
              <div className="flex items-center gap-1" title="Moderate spend">
                <span className="h-3 w-3 rounded-xs bg-blue-800/40 border border-blue-700/50" />
                <span className="text-[10px]">Mid</span>
              </div>
              <div className="flex items-center gap-1" title="Elevated spend">
                <span className="h-3 w-3 rounded-xs bg-blue-600/80 border border-blue-500/60" />
                <span className="text-[10px]">High</span>
              </div>
              <div className="flex items-center gap-1" title="Peak spend">
                <span className="h-3 w-3 rounded-xs bg-blue-500 border border-blue-400" />
                <span className="text-[10px]">Peak</span>
              </div>
            </div>
          </div>
        </div>

        {/* Informative Hint Banner */}
        <div className="flex items-center justify-between text-[11px] text-gray-400 bg-[#0c0c0c] border border-[#1f1f1f] rounded-xl px-3 py-2 my-2">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-blue-400 shrink-0" />
            <span>
              {selectionMode === 'range'
                ? isRangeAnchorSet
                  ? '📌 Anchor set. Click on an end day to complete your consecutive range selection.'
                  : '💡 Click a start day, then click an end day to select all consecutive days. You can also drag across days.'
                : '💡 Click any day cell to open its transaction history. Hold Shift while clicking to select consecutive days.'}
            </span>
          </div>
          {selectedStartDate && selectedEndDate && (
            <span className="text-blue-400 font-semibold shrink-0 ml-2">
              {selectedStartDate === selectedEndDate ? '1 day active' : `${selectedRangeStats?.daysCount} days active`}
            </span>
          )}
        </div>

        {/* Heatmap Matrix Display */}
        {viewFormat === 'calendar' ? (
          /* Calendar 7-Column Grid (Mon - Sun) */
          <div className="mt-4">
            {/* Weekday Labels Header */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-1.5 text-center text-xs font-bold text-gray-400">
              {WEEKDAYS.map((w, idx) => (
                <div
                  key={w}
                  className={`py-1 rounded-md ${idx >= 5 ? 'text-blue-400/80' : 'text-gray-400'}`}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 select-none">
              {/* Preceding empty cells */}
              {Array.from({ length: firstDayWeekdayOffset }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-square rounded-xl bg-[#0a0a0a]/30 border border-transparent opacity-20"
                />
              ))}

              {/* Real Days of Active Month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${activeMonth}-${String(dayNum).padStart(2, '0')}`;
                const dayData = dailyDataMap.get(dateStr);
                const expense = dayData?.expenseTotal || 0;
                const txCount = dayData?.txCount || 0;
                const concentrationLevel = getConcentrationLevel(expense);
                const isSelected = isDateSelected(dateStr);
                const isStart = isRangeStart(dateStr);
                const isEnd = isRangeEnd(dateStr);
                const isToday = dateStr === new Date().toISOString().slice(0, 10);

                const colorClass = getConcentrationColorClasses(concentrationLevel, isSelected);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={(e) => handleDayClick(dateStr, e)}
                    onMouseDown={() => handleMouseDown(dateStr)}
                    onMouseEnter={() => handleMouseEnter(dateStr)}
                    title={`${dateStr} (${dayData?.weekday})
Daily Expense: ${formatCurrency(expense, currencySymbol)}
${txCount} transactions${dayData?.topMerchant ? `\nTop: ${dayData.topMerchant}` : ''}`}
                    className={`relative aspect-square rounded-xl p-1.5 sm:p-2.5 flex flex-col justify-between text-left transition-all duration-150 cursor-pointer ${colorClass} ${
                      isSelected ? 'shadow-md' : 'hover:scale-[1.03] hover:z-10'
                    }`}
                  >
                    {/* Top Row: Day Number & Indicators */}
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs sm:text-sm font-bold leading-none ${
                          isSelected ? 'text-white' : 'opacity-90'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1">
                        {isToday && (
                          <span
                            title="Today"
                            className="h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-emerald-500/30"
                          />
                        )}
                        {isSelected && (isStart || isEnd) && (
                          <span className="hidden sm:inline-block text-[9px] font-extrabold uppercase px-1 rounded-sm bg-white/25 text-white">
                            {isStart && isEnd ? 'Day' : isStart ? 'Start' : 'End'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Expense Amount & Transaction Count */}
                    <div className="mt-auto overflow-hidden">
                      <div className="font-mono text-[11px] sm:text-xs leading-tight font-bold truncate">
                        {expense > 0 ? (
                          expense >= 1000 ? (
                            `₹${(expense / 1000).toFixed(expense % 1000 === 0 ? 0 : 1)}k`
                          ) : (
                            `₹${Math.round(expense)}`
                          )
                        ) : (
                          <span className="text-[10px] opacity-40 font-normal">₹0</span>
                        )}
                      </div>

                      <div className="hidden sm:flex items-center justify-between text-[9px] opacity-70 mt-0.5">
                        <span>{txCount > 0 ? `${txCount} tx` : 'No spend'}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Compact Strip View */
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 lg:grid-cols-16 gap-2 mt-4 select-none">
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${activeMonth}-${String(dayNum).padStart(2, '0')}`;
              const dayData = dailyDataMap.get(dateStr);
              const expense = dayData?.expenseTotal || 0;
              const txCount = dayData?.txCount || 0;
              const concentrationLevel = getConcentrationLevel(expense);
              const isSelected = isDateSelected(dateStr);
              const colorClass = getConcentrationColorClasses(concentrationLevel, isSelected);

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={(e) => handleDayClick(dateStr, e)}
                  onMouseDown={() => handleMouseDown(dateStr)}
                  onMouseEnter={() => handleMouseEnter(dateStr)}
                  title={`${dateStr}: ${formatCurrency(expense, currencySymbol)} (${txCount} tx)`}
                  className={`rounded-xl p-2 text-center transition-all cursor-pointer ${colorClass} ${
                    isSelected ? 'scale-105' : 'hover:scale-105'
                  }`}
                >
                  <div className="text-[10px] opacity-70 font-semibold">Day {dayNum}</div>
                  <div className="font-mono text-xs font-bold mt-0.5">
                    {expense > 0 ? (
                      expense >= 1000 ? `₹${Math.round(expense / 1000)}k` : `₹${Math.round(expense)}`
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="text-[9px] opacity-60 mt-0.5">{txCount} tx</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SELECTED RANGE TRANSACTION HISTORY SECTION */}
      {selectedStartDate && (
        <div
          ref={historyRef}
          id="selected-days-transaction-history"
          className="rounded-2xl border border-blue-500/30 bg-[#121212] p-4 sm:p-6 shadow-2xl space-y-6 transition-all animate-in fade-in slide-in-from-top-4"
        >
          {/* Header Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#262626] pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
                  <CalendarIcon size={16} />
                </span>
                <h3 className="text-lg font-extrabold text-white tracking-tight">
                  Transaction History: {formatDate(selectedStartDate)}
                  {selectedEndDate && selectedEndDate !== selectedStartDate && ` – ${formatDate(selectedEndDate)}`}
                </h3>

                <span className="rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 text-xs font-bold">
                  {selectedRangeStats?.daysCount === 1
                    ? '1 Day Selected'
                    : `${selectedRangeStats?.daysCount} Consecutive Days`}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Showing all recorded transactions, lifestyle expenses, and cash flows for this period.
              </p>
            </div>

            {/* Actions for the Selected Range */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleOpenAddForSelectedDate}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 text-xs font-bold shadow-md transition cursor-pointer"
              >
                <Plus size={15} />
                <span>Add Expense for this Day</span>
              </button>

              {onNavigateToTransactions && (
                <button
                  onClick={() => {
                    const end = selectedEndDate || selectedStartDate;
                    onNavigateToTransactions(selectedStartDate, end);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-[#333] bg-[#1a1a1a] hover:bg-[#252525] text-gray-200 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
                >
                  <span>Open in Full Transactions Tab</span>
                  <ArrowRight size={14} />
                </button>
              )}

              <button
                onClick={clearSelection}
                title="Deselect and Close"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#222] transition cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Metric Highlights for Selected Date Range */}
          {selectedRangeStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1">
                  <ArrowDownRight size={14} /> Total Outflow
                </span>
                <div className="font-mono text-lg sm:text-xl font-extrabold text-rose-400 mt-1">
                  {formatCurrency(selectedRangeStats.totalExpenses, currencySymbol)}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  Across {selectedRangeStats.transactionCount} transactions
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                  <ArrowUpRight size={14} /> Total Inflow / Salary
                </span>
                <div className="font-mono text-lg sm:text-xl font-extrabold text-emerald-400 mt-1">
                  {formatCurrency(selectedRangeStats.totalIncome, currencySymbol)}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">Credits & refunds</div>
              </div>

              <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3.5">
                <span className="text-xs font-bold text-gray-400">Daily Average Spend</span>
                <div className="font-mono text-lg sm:text-xl font-extrabold text-white mt-1">
                  {formatCurrency(selectedRangeStats.dailyAverage, currencySymbol)}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  Over {selectedRangeStats.daysCount} consecutive day(s)
                </div>
              </div>

              <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3.5">
                <span className="text-xs font-bold text-amber-400">Peak Day Burn</span>
                <div className="font-mono text-lg sm:text-xl font-extrabold text-amber-300 mt-1">
                  {selectedRangeStats.peakDay.amount > 0
                    ? formatCurrency(selectedRangeStats.peakDay.amount, currencySymbol)
                    : '₹0'}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                  {selectedRangeStats.peakDay.amount > 0
                    ? formatShortDate(selectedRangeStats.peakDay.date)
                    : 'Zero spend'}
                </div>
              </div>
            </div>
          )}

          {/* Filtering & Search Bar within the selected day(s) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0a0a] p-3 rounded-xl border border-[#212121]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search by merchant, notes, or tags in this period..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[#262626] bg-[#141414] pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
              />
              {historySearchQuery && (
                <button
                  onClick={() => setHistorySearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Type tabs */}
            <div className="flex rounded-lg border border-[#262626] bg-[#141414] p-0.5 text-xs">
              <button
                onClick={() => setHistoryTypeFilter('all')}
                className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
                  historyTypeFilter === 'all'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setHistoryTypeFilter('expense')}
                className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
                  historyTypeFilter === 'expense'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Expenses
              </button>
              <button
                onClick={() => setHistoryTypeFilter('income')}
                className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
                  historyTypeFilter === 'income'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Income
              </button>
            </div>

            {/* Category Dropdown */}
            <select
              value={historyCategoryFilter}
              onChange={(e) => setHistoryCategoryFilter(e.target.value)}
              className="rounded-lg border border-[#262626] bg-[#141414] px-3 py-1.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Transactions List */}
          {selectedRangeTransactions.length > 0 ? (
            <div className="space-y-3">
              <div className="divide-y divide-[#212121] rounded-xl border border-[#262626] bg-[#0c0c0c] overflow-hidden">
                {selectedRangeTransactions.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.categoryId);
                  const isExp = tx.type === 'expense' || tx.type === 'loan_emi';
                  const isInc = tx.type === 'income' || tx.type === 'refund';

                  return (
                    <div
                      key={tx.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 hover:bg-[#141414] transition"
                    >
                      {/* Left: Category Icon, Merchant, Date & Tags */}
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIcon category={cat} categoryId={tx.categoryId} size={20} className="w-10 h-10 shrink-0" />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-white truncate">
                              {tx.merchant}
                            </span>
                            <span
                              className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: cat ? `${cat.color}20` : '#333',
                                color: cat ? cat.color : '#aaa',
                              }}
                            >
                              {cat?.name || tx.categoryId}
                            </span>
                            {tx.isRecurring && (
                              <span className="rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium">
                                Recurring
                              </span>
                            )}
                            {tx.isAnomaly && (
                              <span className="rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-medium">
                                Anomaly
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-1">
                            <span className="font-medium text-gray-300">{formatDate(tx.date)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <CreditCard size={12} /> {tx.paymentMethod}
                            </span>
                            {tx.notes && (
                              <>
                                <span>•</span>
                                <span className="italic text-gray-400 truncate max-w-[200px]">"{tx.notes}"</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Action buttons */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-13 sm:pl-0">
                        <div className="text-right">
                          <div
                            className={`font-mono text-base font-extrabold ${
                              isExp
                                ? 'text-rose-400'
                                : isInc
                                ? 'text-emerald-400'
                                : 'text-blue-400'
                            }`}
                          >
                            {isExp ? '-' : isInc ? '+' : ''}
                            {formatCurrency(tx.amount, currencySymbol)}
                          </div>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">
                            {tx.type}
                          </span>
                        </div>

                        {/* Edit and Delete buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditTx(tx)}
                            title="Edit transaction"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#222] transition cursor-pointer"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTx(tx)}
                            title="Delete transaction"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Zero Transactions on this Day */
            <div className="rounded-xl border border-dashed border-[#262626] bg-[#0c0c0c] p-8 text-center space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles size={24} />
              </div>
              <h4 className="text-base font-bold text-white">
                Zero Expenses on this Day!
              </h4>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                No transactions were recorded on {formatDate(selectedStartDate)}
                {selectedEndDate && selectedEndDate !== selectedStartDate && ` through ${formatDate(selectedEndDate)}`}.
                You maintained a clean zero-spend record!
              </p>
              <div className="pt-2">
                <button
                  onClick={handleOpenAddForSelectedDate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-xs font-bold transition cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Log a transaction for this date</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Embedded Modals for direct editing & deleting from the Heatmap */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTx(null);
        }}
        editingTransaction={editingTx}
        currencySymbol={currencySymbol}
        onSuccess={loadData}
      />

      <DeleteConfirmModal
        isOpen={!!txToDelete}
        onClose={() => setTxToDelete(null)}
        onConfirm={confirmDeleteTx}
        transaction={txToDelete}
        categories={categories}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
