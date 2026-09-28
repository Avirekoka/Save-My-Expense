import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { EMILoan, PaymentMethod, Transaction } from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { formatCurrency } from '../../utils/formatters';
import { useScrollLock } from '../../hooks/useScrollLock';

interface SettleLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: EMILoan | null;
  currencySymbol: string;
  onSuccess: (loan: EMILoan, transaction: Transaction) => void;
}

export const SettleLoanModal: React.FC<SettleLoanModalProps> = ({
  isOpen,
  onClose,
  loan,
  currencySymbol,
  onSuccess,
}) => {
  useScrollLock(isOpen && !!loan);

  const [settleAmount, setSettleAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [settleDate, setSettleDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loan) {
      const balance = loan.remainingAmount > 0 ? loan.remainingAmount : loan.totalAmount;
      setSettleAmount(balance.toString());
      setPaymentMethod('Bank Transfer');
      setSettleDate(new Date().toISOString().slice(0, 10));
      setNotes(`Full loan closure & debt settlement for ${loan.name} (${loan.lender})`);
      setError(null);
    }
  }, [loan, isOpen]);

  if (!isOpen || !loan) return null;

  const currentBalance = loan.remainingAmount > 0 ? loan.remainingAmount : loan.totalAmount;
  const parsedAmount = parseFloat(settleAmount);

  const handleSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid settlement payoff amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = storageService.settleEMILoan(
        loan.id,
        parsedAmount,
        settleDate,
        paymentMethod,
        notes.trim() || undefined
      );

      if (result.loan && result.settlementTx) {
        onSuccess(result.loan, result.settlementTx);
        onClose();
      } else {
        setError('Failed to record settlement. Loan not found.');
      }
    } catch (err: any) {
      console.error('Error settling loan:', err);
      setError('An unexpected error occurred while settling the loan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[#2a2a2a] bg-[#121212] p-4 sm:p-6 text-white shadow-2xl animate-in zoom-in-95 max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-xs">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Settle Debt & Resolve Loan</span>
              </h2>
              <p className="text-xs text-gray-400">
                Automatically logs an offsetting transaction and marks loan as resolved.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-[#202020] hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Loan Obligation Summary Card */}
        <div className="mt-4 rounded-xl border border-[#262626] bg-[#171717] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: loan.color || '#3B82F6' }}
              />
              <span className="text-xs font-bold text-white">{loan.name}</span>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">
              {loan.lender} • {loan.interestRate}% APR
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#222]">
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-semibold block">
                Outstanding Balance
              </span>
              <span className="font-mono text-base font-bold text-amber-400">
                {formatCurrency(currentBalance, currencySymbol)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-semibold block">
                Original Principal
              </span>
              <span className="font-mono text-xs font-semibold text-gray-400">
                {formatCurrency(loan.totalAmount, currencySymbol)}
              </span>
            </div>
          </div>
        </div>

        {/* Informational Callout */}
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs text-emerald-300">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong>Ledger Synchronization:</strong> An offsetting expense transaction of{' '}
            <span className="font-mono font-bold text-white">
              {formatCurrency(parsedAmount || currentBalance, currencySymbol)}
            </span>{' '}
            under category <span className="font-semibold text-white">EMI / Loans</span> will be automatically added to your transactions ledger, and this loan will be marked as{' '}
            <span className="font-semibold text-emerald-400">Resolved</span>.
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Settlement Form */}
        <form onSubmit={handleSettle} className="mt-4 space-y-3.5">
          {/* Payoff Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-300">
                Offsetting Payoff Amount ({currencySymbol}) *
              </label>
              <button
                type="button"
                onClick={() => setSettleAmount(currentBalance.toString())}
                className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                Full Payoff ({formatCurrency(currentBalance, currencySymbol)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={settleAmount}
                onChange={(e) => {
                  setSettleAmount(e.target.value);
                  setError(null);
                }}
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] pl-8 pr-3 py-2 text-sm font-mono font-bold text-white focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Settlement Payment Rail
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-hidden cursor-pointer"
              >
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="Net Banking">Net Banking</option>
                <option value="UPI">UPI Payment</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Cash">Cash Settlement</option>
                <option value="Credit Card">Credit Card</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Settlement Date *
              </label>
              <input
                type="date"
                required
                value={settleDate}
                onChange={(e) => setSettleDate(e.target.value)}
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Transaction Notes / Reference
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Loan payoff ref #98213 via salary account"
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#262626]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#333] bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#222] hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-900/30 transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              <span>{isSubmitting ? 'Recording Settlement...' : 'Confirm & Settle Debt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
