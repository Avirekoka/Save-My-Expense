import React from 'react';
import { AlertTriangle, Trash2, X, Layers } from 'lucide-react';
import { Transaction, Category } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { useScrollLock } from '../../hooks/useScrollLock';

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedTransactions: Transaction[];
  categories?: Category[];
  currencySymbol: string;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedTransactions,
  categories = [],
  currencySymbol,
}) => {
  useScrollLock(isOpen && selectedTransactions.length > 0);

  if (!isOpen || selectedTransactions.length === 0) return null;

  const totalExpense = selectedTransactions
    .filter((t) => t.type !== 'income' && t.type !== 'refund')
    .reduce((s, t) => s + t.amount, 0);

  const totalIncome = selectedTransactions
    .filter((t) => t.type === 'income' || t.type === 'refund')
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div
      id="bulk-delete-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-white transition"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0 shadow-xs">
            <Trash2 size={22} />
          </div>
          <div>
            <h3 id="bulk-delete-dialog-title" className="text-base font-bold text-white tracking-tight">
              Delete {selectedTransactions.length} Transactions?
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              This action is irreversible and will remove these records permanently.
            </p>
          </div>
        </div>

        {/* Selected Totals Summary Bar */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Records</span>
            <div className="text-base font-bold text-white font-mono">{selectedTransactions.length}</div>
          </div>
          <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Total Outflow Impact</span>
            <div className="text-base font-bold text-rose-400 font-mono">
              {formatCurrency(totalExpense, currencySymbol)}
            </div>
          </div>
        </div>

        {/* Transactions Preview List */}
        <div className="mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
            Selected Records Preview:
          </span>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-[#262626] bg-[#0f0f0f] divide-y divide-[#212121]">
            {selectedTransactions.slice(0, 10).map((tx) => {
              const cat = categories.find((c) => c.id === tx.categoryId);
              return (
                <div key={tx.id} className="flex items-center justify-between p-2.5 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <CategoryIcon category={cat} categoryId={tx.categoryId} size={15} />
                    <div className="truncate">
                      <span className="font-semibold text-white truncate block">{tx.merchant}</span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {formatDate(tx.date)} • {cat ? cat.name : tx.categoryId}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`font-mono text-xs font-bold shrink-0 ${
                      tx.type === 'income'
                        ? 'text-emerald-400'
                        : tx.type === 'refund'
                        ? 'text-blue-400'
                        : 'text-white'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'refund' ? '↺ ' : '-'}
                    {formatCurrency(tx.amount, currencySymbol)}
                  </div>
                </div>
              );
            })}
            {selectedTransactions.length > 10 && (
              <div className="p-2.5 text-center text-xs text-gray-400 font-medium bg-[#141414]">
                + {selectedTransactions.length - 10} more transactions
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 mb-5 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-300">
            Deleting these items will automatically re-calculate your monthly budgets, spending categories, and analytics immediately.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            id="cancel-bulk-delete-btn"
            onClick={onClose}
            className="rounded-xl border border-[#262626] bg-[#0f0f0f] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-bulk-delete-btn"
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition"
          >
            <Trash2 size={14} />
            <span>Delete {selectedTransactions.length} Transactions</span>
          </button>
        </div>
      </div>
    </div>
  );
};
