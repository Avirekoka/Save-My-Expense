import React, { useState } from 'react';
import {
  X,
  Zap,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  Coins,
  ArrowRight,
  Flame,
  AlertTriangle,
} from 'lucide-react';
import { EMILoan } from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { formatCurrency } from '../../utils/formatters';
import { useScrollLock } from '../../hooks/useScrollLock';

interface PrepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: EMILoan | null;
  currencySymbol: string;
  onSuccess?: () => void;
}

export const PrepaymentModal: React.FC<PrepaymentModalProps> = ({
  isOpen,
  onClose,
  loan,
  currencySymbol,
  onSuccess,
}) => {
  useScrollLock(isOpen && !!loan);

  const [amount, setAmount] = useState<string>('25000');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !loan) return null;

  const currentBal = loan.remainingAmount;
  const parsedAmt = Math.min(currentBal, parseFloat(amount) || 0);
  const newBal = Math.max(0, currentBal - parsedAmt);
  const isFullPreclosure = newBal === 0;

  // Calculate Interest and Tenure Savings
  const calculateSavings = () => {
    if (loan.interestRate === 0) {
      const origMonths = Math.ceil(currentBal / loan.emiAmount);
      const newMonths = Math.ceil(newBal / loan.emiAmount);
      return {
        interestSaved: 0,
        monthsSaved: Math.max(0, origMonths - newMonths),
        newTenureMonths: newMonths,
      };
    }

    const r = loan.interestRate / (12 * 100);
    const emi = loan.emiAmount;

    // Original remaining tenure
    let origMonths = loan.tenureMonths - loan.paidMonths;
    if (origMonths <= 0 || emi <= currentBal * r) {
      origMonths = Math.ceil(currentBal / emi);
    } else {
      const denom = Math.log(1 + r);
      const num = -Math.log(1 - (currentBal * r) / emi);
      origMonths = Math.max(1, Math.ceil(num / denom));
    }

    const origTotalInterest = Math.max(0, origMonths * emi - currentBal);

    if (newBal === 0) {
      return {
        interestSaved: Math.round(origTotalInterest),
        monthsSaved: origMonths,
        newTenureMonths: 0,
      };
    }

    let newMonths = 0;
    if (emi <= newBal * r) {
      newMonths = Math.ceil(newBal / emi);
    } else {
      const denom = Math.log(1 + r);
      const num = -Math.log(1 - (newBal * r) / emi);
      newMonths = Math.max(1, Math.ceil(num / denom));
    }

    const newTotalInterest = Math.max(0, newMonths * emi - newBal);
    const interestSaved = Math.max(0, Math.round(origTotalInterest - newTotalInterest));
    const monthsSaved = Math.max(0, origMonths - newMonths);

    return {
      interestSaved,
      monthsSaved,
      newTenureMonths: newMonths,
    };
  };

  const savings = calculateSavings();

  const handlePrepay = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmt <= 0) {
      setError('Please enter a valid prepayment amount.');
      return;
    }

    storageService.makeLoanPrepayment(loan.id, parsedAmt);
    if (onSuccess) onSuccess();
    onClose();
  };

  const quickPills = [10000, 25000, 50000, 100000].filter((p) => p < currentBal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#262626] bg-[#121212] p-6 text-white shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-xs"
              style={{ backgroundColor: loan.color || '#3B82F6' }}
            >
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Pre-pay / Pre-close Loan</h2>
              <p className="text-xs text-gray-400">
                Reduce principal balance on <strong className="text-gray-300">{loan.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-[#1f1f1f] hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Loan Metrics */}
        <div className="mt-4 rounded-xl bg-[#181818] border border-[#262626] p-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Current Balance</div>
            <div className="font-mono text-sm font-bold text-white mt-0.5">
              {formatCurrency(loan.remainingAmount, currencySymbol)}
            </div>
          </div>
          <div className="border-x border-[#262626]">
            <div className="text-[10px] uppercase font-bold text-gray-400">Interest Rate</div>
            <div className="font-mono text-sm font-bold text-amber-400 mt-0.5">
              {loan.interestRate}% APR
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Monthly EMI</div>
            <div className="font-mono text-sm font-bold text-blue-400 mt-0.5">
              {formatCurrency(loan.emiAmount, currencySymbol)}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handlePrepay} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-300">
                Pre-payment Amount ({currencySymbol})
              </label>
              <button
                type="button"
                onClick={() => setAmount(String(currentBal))}
                className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Flame size={12} /> Full Pre-Close ({formatCurrency(currentBal, currencySymbol)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                min="1"
                max={currentBal}
                step="any"
                required
                autoFocus
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] pl-8 pr-3 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Quick preset chips */}
          <div>
            <div className="text-[11px] font-semibold text-gray-400 mb-1.5">Quick Presets:</div>
            <div className="flex flex-wrap gap-1.5">
              {quickPills.map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setAmount(String(pill))}
                  className="rounded-lg bg-[#1a1a1a] border border-[#333] hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 px-2.5 py-1 text-xs font-medium text-gray-300 transition cursor-pointer"
                >
                  +{formatCurrency(pill, currencySymbol)}
                </button>
              ))}
            </div>
          </div>

          {/* Prepayment Impact Card */}
          {parsedAmt > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-300 border-b border-emerald-500/20 pb-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  {isFullPreclosure ? 'Full Loan Pre-Closure' : 'Accelerated Payoff Impact'}
                </span>
                <span>
                  {savings.interestSaved > 0
                    ? `Save ${formatCurrency(savings.interestSaved, currencySymbol)}`
                    : 'Tenure Reduced'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 text-[11px]">New Balance:</span>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {formatCurrency(newBal, currencySymbol)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-[11px]">Timeline Saved:</span>
                  <div className="font-mono font-bold text-emerald-400 mt-0.5">
                    {savings.monthsSaved > 0
                      ? `${savings.monthsSaved} Months Faster ⚡`
                      : 'Same Tenure'}
                  </div>
                </div>
              </div>

              {isFullPreclosure && (
                <div className="rounded-lg bg-emerald-500/20 p-2.5 text-xs text-emerald-200 font-medium">
                  🎉 Paying this amount will completely settle this loan and wipe out all future interest!
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#262626]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#333] px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-[#1e1e1e] hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-md shadow-emerald-900/30 cursor-pointer flex items-center gap-1.5"
            >
              <Zap size={14} />
              <span>
                {isFullPreclosure
                  ? 'Confirm Full Pre-Closure'
                  : `Apply ${formatCurrency(parsedAmt, currencySymbol)} Pre-payment`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
