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
} from 'lucide-react';
import { Transaction, Category, TransactionType, PaymentMethod } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, formatDate, getMonthName } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { DeleteConfirmModal } from '../modals/DeleteConfirmModal';
import { ImportCSVModal } from '../modals/ImportCSVModal';

interface TransactionsViewProps {
  currentMonth: string;
  currencySymbol: string;
  onOpenAddModal: (tx?: Transaction) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  currentMonth,
  currencySymbol,
  onOpenAddModal,
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importNotification, setImportNotification] = useState<string | null>(null);

  const loadData = () => {
    setTransactions(storageService.getTransactions());
    setCategories(storageService.getCategories());
  };

  useEffect(() => {
    loadData();
    window.addEventListener(NOTIFY_EVENT, loadData);
    return () => window.removeEventListener(NOTIFY_EVENT, loadData);
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        // Month filter
        if (currentMonth !== 'all' && !tx.date.startsWith(currentMonth)) {
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
    searchQuery,
    selectedCategory,
    selectedType,
    selectedMethod,
    filterAnomaliesOnly,
    sortBy,
  ]);

  const handleDeleteClick = (tx: Transaction) => {
    setTxToDelete(tx);
  };

  const handleConfirmDelete = () => {
    if (txToDelete) {
      storageService.deleteTransaction(txToDelete.id);
      setTxToDelete(null);
      loadData();
    }
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
    <div className="space-y-6 pb-12">
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

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Transactions & Expenses
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Showing {filteredTransactions.length} records (Total Outflow:{' '}
            <strong className="text-white font-mono">
              {formatCurrency(totalFilteredExpense, currencySymbol)}
            </strong>
            )
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-[#262626] bg-[#141414] p-1 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                viewMode === 'table' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                viewMode === 'timeline' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Timeline
            </button>
          </div>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#262626] bg-[#141414] px-3 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] shadow-xs"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Import CSV</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#262626] bg-[#141414] px-3 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] shadow-xs"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => onOpenAddModal()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add Record</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 shadow-xs space-y-3">
        {/* Search row */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
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
              className="h-9 w-full sm:w-auto rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 text-xs font-medium text-gray-300 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="date_desc">Newest Date First</option>
              <option value="date_asc">Oldest Date First</option>
              <option value="amount_desc">Highest Amount First</option>
              <option value="amount_asc">Lowest Amount First</option>
            </select>
          </div>
        </div>

        {/* Dropdowns row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-8 rounded-lg border border-[#262626] bg-[#0f0f0f] px-2.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-hidden"
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
            className="h-8 rounded-lg border border-[#262626] bg-[#0f0f0f] px-2.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-hidden"
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
            className="h-8 rounded-lg border border-[#262626] bg-[#0f0f0f] px-2.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-hidden"
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
                  return (
                    <tr key={tx.id} className="hover:bg-[#1a1a1a] transition">
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
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-2 hover:bg-[#1a1a1a] rounded-lg px-2 transition"
                      >
                        <div className="flex items-center gap-3">
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
