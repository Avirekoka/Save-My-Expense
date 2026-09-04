import React, { useState } from 'react';
import { X, Target, Plus, CheckCircle2, Coins, ArrowUpRight } from 'lucide-react';
import { FinancialGoal } from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { formatCurrency } from '../../utils/formatters';
import { useScrollLock } from '../../hooks/useScrollLock';

interface DepositGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: FinancialGoal | null;
  currencySymbol: string;
  onSuccess?: () => void;
}

export const DepositGoalModal: React.FC<DepositGoalModalProps> = ({
  isOpen,
  onClose,
  goal,
  currencySymbol,
  onSuccess,
}) => {
  useScrollLock(isOpen && !!goal);

  const [amount, setAmount] = useState<string>('5000');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !goal) return null;

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setError('Please enter a valid deposit amount.');
      return;
    }

    storageService.contributeToGoal(goal.id, val);
    if (onSuccess) onSuccess();
    onClose();
  };

  const quickPills = [1000, 2500, 5000, 10000, 25000].filter((p) => p <= goal.targetAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl border border-[#262626] bg-[#121212] p-6 text-white shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: goal.color || '#10B981' }}
            >
              <Coins size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Add Savings / Deposit</h2>
              <p className="text-xs text-gray-400">Contribute towards {goal.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-[#1f1f1f] hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current status info */}
        <div className="mt-4 rounded-xl bg-[#181818] border border-[#262626] p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Currently Saved</div>
            <div className="font-mono text-base font-bold text-white mt-0.5">
              {formatCurrency(goal.currentAmount, currencySymbol)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-gray-400">Target Amount</div>
            <div className="font-mono text-base font-bold text-gray-300 mt-0.5">
              {formatCurrency(goal.targetAmount, currencySymbol)}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleDeposit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Deposit Amount ({currencySymbol})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                min="1"
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
            <div className="text-[11px] font-semibold text-gray-400 mb-1.5">Quick Add:</div>
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
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(remaining))}
                  className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 text-xs font-bold transition cursor-pointer hover:bg-emerald-500/20"
                >
                  Complete Full ({formatCurrency(remaining, currencySymbol)})
                </button>
              )}
            </div>
          </div>

          {/* New Projected Progress */}
          {parseFloat(amount) > 0 && (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 text-xs text-gray-300">
              <div className="flex items-center justify-between font-medium">
                <span>New Balance:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatCurrency(goal.currentAmount + (parseFloat(amount) || 0), currencySymbol)} (
                  {Math.min(
                    100,
                    Math.round(
                      ((goal.currentAmount + (parseFloat(amount) || 0)) / goal.targetAmount) * 100
                    )
                  )}
                  %)
                </span>
              </div>
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
              <Plus size={14} />
              <span>Confirm Deposit</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
