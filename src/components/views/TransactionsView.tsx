import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
  ArrowUpDown,
  Tag,
  Clock,
  Layers,
  Repeat,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Camera,
  CalendarRange,
} from 'lucide-react';
import { Transaction, Category, TransactionType, PaymentMethod } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, formatDate, getMonthName, getCurrentMonth, getLastThreeMonths } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { DeleteConfirmModal } from '../modals/DeleteConfirmModal';
import { BulkDeleteModal } from '../modals/BulkDeleteModal';
import { ImportCSVModal } from '../modals/ImportCSVModal';

interface TransactionsViewProps {
  currentMonth: string;
  currencySymbol: string;
  onOpenAddModal: (tx?: Transaction) => void;
  onOpenScanReceipt?: () => void;
  onSelectMonth?: (month: string) => void;
  initialStartDate?: string;
  initialEndDate?: string;
  onClearDateRange?: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  currentMonth,
  currencySymbol,
  onOpenAddModal,
  onOpenScanReceipt,
  onSelectMonth,
  initialStartDate,
  initialEndDate,
  onClearDateRange,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [filterAnomaliesOnly, setFilterAnomaliesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importNotification, setImportNotification] = useState<string | null>(null);

  // Date Range state
  const [startDate, setStartDate] = useState<string>(initialStartDate || '');
  const [endDate, setEndDate] = useState<string>(initialEndDate || initialStartDate || '');
  const [datePreset, setDatePreset] = useState<string>(initialStartDate ? 'custom' : 'month');

  // Respond to changes in initialStartDate/initialEndDate (e.g. from Heatmap navigation)
  useEffect(() => {
    if (initialStartDate) {
      setStartDate(initialStartDate);
      setEndDate(initialEndDate || initialStartDate);
      setDatePreset('custom');
    }
  }, [initialStartDate, initialEndDate]);

  const handleSetPreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === 'all' || preset === 'month') {
      setStartDate('');
      setEndDate('');
    } else if (preset === '30d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === '90d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 90);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'year') {
      setStartDate(`${today.getFullYear()}-01-01`);
      setEndDate(`${today.getFullYear()}-12-31`);
    }
  };

  const loadData = () => {
    setTransactions(storageService.getTransactions());
    setCategories(storageService.getCategories());
  };

  useEffect(() => {
    loadData();
    window.addEventListener(NOTIFY_EVENT, loadData);
    return () => window.removeEventListener(NOTIFY_EVENT, loadData);
  }, []);

  const otherMonthsCount = useMemo(() => {
    if (currentMonth === 'all') return 0;
    return transactions.filter((t) => !t.date.startsWith(currentMonth)).length;
  }, [transactions, currentMonth]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        // Date range filter
        if (startDate && tx.date < startDate) {
          return false;
        }
        if (endDate && tx.date > endDate) {
          return false;
        }

        // Only restrict to currentMonth if the user explicitly chooses the Month preset
        if (datePreset === 'month' && currentMonth !== 'all' && !tx.date.startsWith(currentMonth)) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchMerchant = tx.merchant.toLowerCase().includes(q);
          const matchNotes = tx.notes?.toLowerCase().includes(q);
          const matchRaw = tx.rawDescription?.toLowerCase().includes(q);
          const matchTags = (tx.tags || []).some((t) => t.toLowerCase().includes(q));
          if (!matchMerchant && !matchNotes && !matchRaw && !matchTags) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory !== 'all' && tx.categoryId !== selectedCategory) {
          return false;
        }

        // Type filter
        if (selectedType !== 'all' && tx.type !== selectedType) {
          return false;
        }

        // Payment Method filter
        if (selectedMethod !== 'all' && tx.paymentMethod !== selectedMethod) {
          return false;
        }

        // Anomalies only
        if (filterAnomaliesOnly && !tx.isAnomaly) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return b.date.localeCompare(a.date);
        if (sortBy === 'date_asc') return a.date.localeCompare(b.date);
        if (sortBy === 'amount_desc') return b.amount - a.amount;
        if (sortBy === 'amount_asc') return a.amount - b.amount;
        return 0;
      });
  }, [
    transactions,
    currentMonth,
    datePreset,
    startDate,
    endDate,
    searchQuery,
    selectedCategory,
    selectedType,
    selectedMethod,
    filterAnomaliesOnly,
    sortBy,
  ]);

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllFilteredSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((tx) => selectedTxIds.has(tx.id));

  const isSomeFilteredSelected =
    filteredTransactions.some((tx) => selectedTxIds.has(tx.id)) && !isAllFilteredSelected;

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedTxIds((prev) => {
        const next = new Set(prev);
        filteredTransactions.forEach((tx) => next.delete(tx.id));
        return next;
      });
    } else {
      setSelectedTxIds((prev) => {
        const next = new Set(prev);
        filteredTransactions.forEach((tx) => next.add(tx.id));
        return next;
      });
    }
  };

  const clearSelection = () => {
    setSelectedTxIds(new Set());
  };

  const selectedTransactionsList = useMemo(() => {
    return transactions.filter((tx) => selectedTxIds.has(tx.id));
  }, [transactions, selectedTxIds]);

  const selectedExpenseSum = useMemo(() => {
    return selectedTransactionsList
      .filter((tx) => tx.type !== 'income' && tx.type !== 'refund')
      .reduce((s, tx) => s + tx.amount, 0);
  }, [selectedTransactionsList]);

  const handleDeleteClick = (tx: Transaction) => {
    setTxToDelete(tx);
  };

  const handleConfirmDelete = () => {
    if (txToDelete) {
      storageService.deleteTransaction(txToDelete.id);
      // Also remove from selected if present
      setSelectedTxIds((prev) => {
        const next = new Set(prev);
        next.delete(txToDelete.id);
        return next;
      });
      setTxToDelete(null);
      loadData();
    }
  };

  const handleBulkDeleteConfirm = () => {
    const count = selectedTxIds.size;
    storageService.deleteTransactions(Array.from(selectedTxIds));
    setSelectedTxIds(new Set());
    setIsBulkDeleteModalOpen(false);
    loadData();
    setImportNotification(`Successfully deleted ${count} transactions.`);
    setTimeout(() => setImportNotification(null), 5000);
  };

  const handleBulkConvertToRupees = () => {
    const count = selectedTxIds.size;
    storageService.convertPaiseToRupees(Array.from(selectedTxIds));
    setSelectedTxIds(new Set());
    loadData();
    setImportNotification(`Successfully converted ${count} transactions from Paise to Rupees (÷100).`);
    setTimeout(() => setImportNotification(null), 5000);
  };

  const handleExportCSV = () => {
    const csv = storageService.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Group by date for Timeline view
  const groupedByDate = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const tx of filteredTransactions) {
      if (!map[tx.date]) map[tx.date] = [];
      map[tx.date].push(tx);
    }
    return map;
  }, [filteredTransactions]);

  const totalFilteredExpense = filteredTransactions
    .filter((t) => t.type === 'expense' || t.type === 'loan_emi')
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
      {/* Import Notification */}
      {importNotification && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{importNotification}</span>
          </div>
          <button
            onClick={() => setImportNotification(null)}
            className="text-gray-400 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Date Range Filter Banner from Heatmap or Custom Selection */}
      {startDate && (
        <div className="flex items-center justify-between rounded-xl bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-300">
          <div className="flex items-center gap-2">
            <CalendarRange size={16} className="text-blue-400 shrink-0" />
            <span>
              Filtered Date Range:{' '}
              <strong className="text-white font-bold">{formatDate(startDate)}</strong>
              {endDate && endDate !== startDate && (
                <>
                  {' '}to <strong className="text-white font-bold">{formatDate(endDate)}</strong>
                </>
              )}
              {initialStartDate && (
                <span className="ml-2 rounded-sm bg-blue-600/30 px-1.5 py-0.5 text-[10px] text-blue-200">
                  from Heatmap
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setDatePreset('month');
              if (onClearDateRange) onClearDateRange();
            }}
            className="text-xs text-blue-400 hover:text-white font-semibold underline ml-2 cursor-pointer"
          >
            Show full month
          </button>
        </div>
      )}

      {/* Bulk Action Sticky Bar */}
      {selectedTxIds.size > 0 && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/40 bg-[#101726]/95 backdrop-blur-md px-4 py-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-mono text-xs font-bold shadow-xs">
              {selectedTxIds.size}
            </div>
            <div className="text-xs text-gray-200 font-medium">
              <span>
                Selected <strong className="text-white font-bold">{selectedTxIds.size}</strong> of{' '}
                <span className="text-gray-400">{filteredTransactions.length}</span> records
              </span>
              <span className="hidden sm:inline text-gray-600 ml-2">|</span>
              <span className="hidden sm:inline text-gray-300 ml-2">
                Outflow:{' '}
                <strong className="text-rose-400 font-mono">
                  -{formatCurrency(selectedExpenseSum, currencySymbol)}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAllFilteredSelected && (
              <button
                onClick={toggleSelectAllFiltered}
                className="rounded-lg border border-[#2e3b52] bg-[#1a2333] px-2.5 py-1.5 text-xs font-semibold text-blue-300 hover:bg-[#232f45] transition"
              >
                Select all ({filteredTransactions.length})
              </button>
            )}
            <button
              onClick={clearSelection}
              className="rounded-lg border border-[#2e3b52] bg-[#1a2333] px-2.5 py-1.5 text-xs font-semibold text-gray-300 hover:bg-[#232f45] transition"
            >
              Clear selection
            </button>
            <button
              onClick={handleBulkConvertToRupees}
              title="Divide selected transaction amounts by 100 (if they were imported in paise)"
              className="flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-600/20 px-3 py-1.5 text-xs font-bold text-blue-300 hover:bg-blue-600/30 transition cursor-pointer"
            >
              <span>Paise → ₹ (÷100)</span>
            </button>
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Delete Selected ({selectedTxIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Transactions & Expenses
            </h1>
            {currentMonth === 'all' && (
              <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-blue-300">
                All History
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Showing {filteredTransactions.length} records (Total Outflow:{' '}
            <strong className="text-white font-mono">
              {formatCurrency(totalFilteredExpense, currencySymbol)}
            </strong>
            )
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-[#262626] bg-[#141414] p-1 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`rounded-md px-2.5 sm:px-3 py-1 font-semibold transition cursor-pointer ${
                viewMode === 'table' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`rounded-md px-2.5 sm:px-3 py-1 font-semibold transition cursor-pointer ${
                viewMode === 'timeline' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Timeline
            </button>
          </div>

          {onOpenScanReceipt && (
            <button
              onClick={onOpenScanReceipt}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-600/10 px-2.5 sm:px-3 text-xs font-semibold text-blue-400 hover:bg-blue-600/20 shadow-xs transition cursor-pointer"
              title="Scan physical receipt using device camera"
            >
              <Camera size={14} />
              <span className="hidden md:inline">Scan Receipt</span>
            </button>
          )}

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#262626] bg-[#141414] px-2.5 sm:px-3 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] shadow-xs cursor-pointer"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Import CSV</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#262626] bg-[#141414] px-2.5 sm:px-3 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] shadow-xs cursor-pointer"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => onOpenAddModal()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 sm:px-3.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add Record</span>
          </button>
        </div>
      </div>

      {/* Filter & Date Range Bar */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-3.5 sm:p-4.5 lg:p-5 shadow-xs space-y-3 sm:space-y-3.5">
        {/* Search & Sort row */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1 w-full">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              placeholder="Search merchant, tags, notes, or bank narration..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] pl-9 pr-4 py-2 text-xs font-medium text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 w-full sm:w-auto rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 text-xs font-medium text-gray-300 focus:border-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="date_desc">Newest Date First</option>
              <option value="date_asc">Oldest Date First</option>
              <option value="amount_desc">Highest Amount First</option>
              <option value="amount_asc">Lowest Amount First</option>
            </select>
          </div>
        </div>

        {/* Date Range Selection Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[#262626] bg-[#0c0c0c] p-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 text-gray-300 font-semibold mr-1">
              <Calendar size={14} className="text-blue-400" />
              <span>Date Range:</span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                {
                  id: 'month',
                  label: currentMonth !== 'all' ? `${getMonthName(currentMonth)} (Current)` : 'Current Month',
                },
                { id: 'all', label: 'All Time' },
                { id: '30d', label: 'Last 30D' },
                { id: '90d', label: 'Last 90D' },
                { id: 'year', label: 'This Year' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSetPreset(p.id)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                    datePreset === p.id && !startDate && !endDate
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'bg-[#181818] text-gray-400 hover:text-white border border-[#262626]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Quick Month Dropdown Switcher */}
            {onSelectMonth && (
              <div className="flex items-center gap-1.5 pl-1 sm:border-l sm:border-[#262626]">
                <span className="text-[11px] text-gray-400 hidden sm:inline">Month:</span>
                <select
                  value={currentMonth}
                  onChange={(e) => {
                    const val = e.target.value;
                    onSelectMonth(val);
                    if (val === 'all') {
                      setDatePreset('all');
                    } else {
                      setDatePreset('month');
                    }
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="h-7 rounded-md border border-[#262626] bg-[#141414] px-2 text-[11px] font-medium text-gray-200 focus:border-blue-500 focus:outline-hidden cursor-pointer"
                  title="Select Active Month Filter"
                >
                  <option value={getCurrentMonth()}>
                    {getMonthName(getCurrentMonth())} (Current)
                  </option>
                  {getLastThreeMonths(currentMonth)
                    .filter((m) => m.value !== getCurrentMonth())
                    .map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  <option value="all">All Months</option>
                </select>
              </div>
            )}
          </div>

          {/* Date Picker inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="h-7 rounded-md border border-[#262626] bg-[#141414] px-2 text-[11px] font-medium text-gray-200 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="h-7 rounded-md border border-[#262626] bg-[#141414] px-2 text-[11px] font-medium text-gray-200 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setDatePreset('all');
                }}
                className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer px-1 py-0.5"
                title="Reset date range filter"
              >
                <span>✕ Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Notice if user is viewing Month view but has transactions in other months */}
        {otherMonthsCount > 0 && datePreset === 'month' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg bg-blue-950/30 border border-blue-500/20 px-3 py-2 text-xs text-blue-300">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-blue-400 shrink-0" />
              <span>
                Filtering by <strong>{getMonthName(currentMonth)}</strong> ({filteredTransactions.length} records). You have <strong>{otherMonthsCount} transaction(s)</strong> in other months (e.g. recent WhatsApp entries).
              </span>
            </div>
            <button
              onClick={() => handleSetPreset('all')}
              className="text-xs font-bold text-white bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 px-2.5 py-1 rounded cursor-pointer shrink-0 transition"
            >
              Show All Time
            </button>
          </div>
        )}

        {/* Dropdowns row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-8 rounded-lg border border-[#262626] bg-[#0f0f0f] px-2.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Type */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-8 rounded-lg border border-[#262626] bg-[#0f0f0f] px-2.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="expense">Expenses Only</option>
            <option value="income">Income Only</option>
            <option value="transfer">Transfers (Self)</option>
            <option value="refund">Refunds</option>
            <option value="investment">Investments & SIP</option>
            <option value="loan_emi">Loan EMIs</option>
            <option value="cash_withdrawal">Cash ATM</option>
          </select>

          {/* Payment Method */}
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="h-8 rounded-lg border border-[#262626] bg-[#0f0f0f] px-2.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Payment Methods</option>
            <option value="UPI">UPI</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Debit Card">Debit Card</option>
            <option value="Net Banking">Net Banking</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
          </select>

          {/* Anomaly Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer ml-auto text-xs font-semibold text-gray-300 bg-[#1a1a1a] px-2.5 py-1.5 rounded-lg border border-[#262626]">
            <input
              type="checkbox"
              checked={filterAnomaliesOnly}
              onChange={(e) => setFilterAnomaliesOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[#333] text-blue-500 focus:ring-blue-500 bg-[#0f0f0f]"
            />
            <span className="flex items-center gap-1">
              <AlertTriangle size={13} className="text-amber-400" />
              Anomalies Only
            </span>
          </label>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredTransactions.length === 0 ? (
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a1a1a] text-gray-500">
            <Search size={24} />
          </div>
          <h3 className="mt-4 text-sm font-bold text-white">No matching transactions found</h3>
          <p className="mt-1 text-xs text-gray-500">
            Try adjusting your search query, filters, or selected month.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="overflow-hidden rounded-xl border border-[#262626] bg-[#141414] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="border-b border-[#262626] bg-[#0f0f0f] font-semibold uppercase tracking-wider text-gray-500 text-[10px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      title="Select all visible transactions"
                      checked={isAllFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      className="h-4 w-4 rounded border-[#333] text-blue-500 focus:ring-blue-500 bg-[#0f0f0f] cursor-pointer align-middle"
                    />
                  </th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Merchant / Narration</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#212121] font-medium">
                {filteredTransactions.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.categoryId);
                  const isSelected = selectedTxIds.has(tx.id);
                  return (
                    <tr
                      key={tx.id}
                      className={`transition ${
                        isSelected ? 'bg-blue-600/10 hover:bg-blue-600/15' : 'hover:bg-[#1a1a1a]'
                      }`}
                    >
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectTx(tx.id)}
                          className="h-4 w-4 rounded border-[#333] text-blue-500 focus:ring-blue-500 bg-[#0f0f0f] cursor-pointer align-middle"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-400 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <CategoryIcon category={cat} categoryId={tx.categoryId} size={16} />
                          <div>
                            <div className="font-bold text-white">{tx.merchant}</div>
                            {tx.rawDescription && tx.rawDescription !== tx.merchant && (
                              <div className="text-[10px] text-gray-500 truncate max-w-xs font-mono">
                                {tx.rawDescription}
                              </div>
                            )}
                            {tx.notes && (
                              <div className="text-[10px] text-gray-400 italic mt-0.5">
                                Note: {tx.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#1a1a1a] border border-[#262626] px-2 py-0.5 text-xs font-medium text-gray-300">
                          {cat ? cat.name : tx.categoryId}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-gray-400 text-[11px]">
                        {tx.paymentMethod}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            tx.type === 'income'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : tx.type === 'refund'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : tx.type === 'transfer'
                              ? 'bg-gray-500/10 text-gray-300 border border-gray-500/20'
                              : tx.type === 'investment'
                              ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                              : tx.type === 'loan_emi'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-[#1a1a1a] text-gray-400 border border-[#262626]'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-mono text-sm font-extrabold ${
                            tx.type === 'income'
                              ? 'text-emerald-400'
                              : tx.type === 'refund'
                              ? 'text-blue-400'
                              : 'text-white'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'refund' ? '↺ ' : '-'}
                          {formatCurrency(tx.amount, currencySymbol)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenAddModal(tx)}
                            title="Edit transaction"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-blue-400"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(tx)}
                            title="Delete record"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-rose-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Timeline View */
        <div className="space-y-6">
          {(Object.entries(groupedByDate) as [string, Transaction[]][]).map(([date, txs]) => {
            const dayTotal = txs
              .filter((t) => t.type === 'expense' || t.type === 'loan_emi')
              .reduce((s, t) => s + t.amount, 0);

            return (
              <div key={date} className="rounded-xl border border-[#262626] bg-[#141414] p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#262626] pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-blue-400" />
                    <span className="font-bold text-xs text-white">{formatDate(date)}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-gray-400">
                    Day Total: {formatCurrency(dayTotal, currencySymbol)}
                  </span>
                </div>

                <div className="divide-y divide-[#212121] space-y-1">
                  {txs.map((tx) => {
                    const cat = categories.find((c) => c.id === tx.categoryId);
                    const isSelected = selectedTxIds.has(tx.id);
                    return (
                      <div
                        key={tx.id}
                        className={`flex items-center justify-between py-2 rounded-lg px-2.5 transition ${
                          isSelected ? 'bg-blue-600/10 hover:bg-blue-600/15' : 'hover:bg-[#1a1a1a]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectTx(tx.id)}
                            className="h-4 w-4 rounded border-[#333] text-blue-500 focus:ring-blue-500 bg-[#0f0f0f] cursor-pointer shrink-0 align-middle"
                          />
                          <CategoryIcon category={cat} categoryId={tx.categoryId} size={16} />
                          <div>
                            <span className="text-xs font-bold text-white">{tx.merchant}</span>
                            <div className="text-[11px] text-gray-500 font-mono">
                              {tx.paymentMethod} • {cat ? cat.name : tx.categoryId}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono text-xs font-bold ${
                              tx.type === 'income' ? 'text-emerald-400' : 'text-white'
                            }`}
                          >
                            {formatCurrency(tx.amount, currencySymbol)}
                          </span>
                          <button
                            onClick={() => onOpenAddModal(tx)}
                            className="rounded-md p-1 text-gray-400 hover:bg-[#262626] hover:text-blue-400 transition"
                            title="Edit transaction"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(tx)}
                            className="rounded-md p-1 text-gray-400 hover:bg-[#262626] hover:text-rose-400 transition"
                            title="Delete transaction"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        selectedTransactions={selectedTransactionsList}
        categories={categories}
        currencySymbol={currencySymbol}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!txToDelete}
        onClose={() => setTxToDelete(null)}
        onConfirm={handleConfirmDelete}
        transaction={txToDelete}
        categories={categories}
        currencySymbol={currencySymbol}
      />

      {/* CSV Import Modal */}
      <ImportCSVModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(count) => {
          loadData();
          setImportNotification(`Successfully imported ${count} transactions into your ledger.`);
          setTimeout(() => setImportNotification(null), 6000);
        }}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
