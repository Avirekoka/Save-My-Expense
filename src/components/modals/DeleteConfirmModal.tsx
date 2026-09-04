import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Transaction, Category } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { useScrollLock } from '../../hooks/useScrollLock';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  transaction: Transaction | null;
  categories?: Category[];
  currencySymbol: string;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transaction,
  categories = [],
  currencySymbol,
}) => {
  useScrollLock(isOpen && !!transaction);

  if (!isOpen || !transaction) return null;

  const category = categories.find((c) => c.id === transaction.categoryId);

  return (
    <div
      id="delete-transaction-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-white transition"
        >
          <X size={18} />
        </button>

        {/* Warning Icon & Heading */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 id="delete-dialog-title" className="text-base font-bold text-white">
              Delete Transaction?
            </h3>
            <p className="text-xs text-gray-400">
              Are you sure you want to delete this record?
            </p>
          </div>
        </div>

        {/* Transaction Summary Card */}
        <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CategoryIcon category={category} categoryId={transaction.categoryId} size={18} />
              <div>
                <div className="text-xs font-bold text-white">{transaction.merchant}</div>
                <div className="text-[11px] text-gray-500">
                  {formatDate(transaction.date)} • {category ? category.name : transaction.categoryId}
                </div>
              </div>
            </div>
            <div
              className={`font-mono text-sm font-bold ${
                transaction.type === 'income'
                  ? 'text-emerald-400'
                  : transaction.type === 'refund'
                  ? 'text-blue-400'
                  : 'text-white'
              }`}
            >
              {transaction.type === 'income' ? '+' : transaction.type === 'refund' ? '↺ ' : '-'}
              {formatCurrency(transaction.amount, currencySymbol)}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-[#212121] pt-2">
            <span>Payment: <strong className="text-gray-300">{transaction.paymentMethod}</strong></span>
            <span>Type: <strong className="text-gray-300 capitalize">{transaction.type}</strong></span>
          </div>

          {transaction.notes && (
            <p className="text-[11px] text-gray-400 italic bg-[#141414] rounded-lg p-2 border border-[#262626]">
              "{transaction.notes}"
            </p>
          )}
        </div>

        <p className="text-xs text-gray-400 mb-6">
          This will permanently remove the transaction from your spending analytics, budget tracking, and monthly ledger calculations.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            id="cancel-delete-tx-btn"
            onClick={onClose}
            className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-delete-tx-btn"
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition"
          >
            <Trash2 size={14} />
            <span>Yes, Delete Transaction</span>
          </button>
        </div>
      </div>
    </div>
  );
};
