import React, { useState } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';
import { storageService } from '../../services/storage/storage.service';
import { aiService, SpendAdvisorResult } from '../../services/ai/ai.service';
import { Category } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface BeforeYouSpendModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
}

export const BeforeYouSpendModal: React.FC<BeforeYouSpendModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('shopping');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpendAdvisorResult | null>(null);

  const categories = storageService.getCategories();
  const summary = storageService.calculateMonthSummary('2026-08');
  const budgets = storageService.getBudgets();

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numAmount) || numAmount <= 0) return;

    setLoading(true);

    const catObj = categories.find((c) => c.id === categoryId);
    const categoryName = catObj ? catObj.name : categoryId;
    const budgetObj = budgets.find((b) => b.categoryId === categoryId);
    const monthlyBudget = budgetObj ? budgetObj.monthlyLimit : (catObj?.budgetMonthly || 10000);
    const alreadySpent = summary.categorySpending[categoryId] || 0;

    try {
      const evaluation = await aiService.analyzeBeforeYouSpend(
        description,
        numAmount,
        categoryId,
        categoryName,
        monthlyBudget,
        alreadySpent
      );
      setResult(evaluation);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDescription('');
    setAmount('');
    setResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Before You Spend</h3>
              <p className="text-xs text-gray-400">AI Context-Aware Purchase Simulator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleEvaluate} className="mt-4 space-y-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              Evaluating an unplanned purchase? Tell AI what you want to buy, and we will calculate
              its mathematical impact against your active monthly envelope.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                What are you considering buying? *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Leather jacket, Dinner at fine dining, Noise canceling headphones"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Expected Cost ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-sm font-bold font-mono text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Target Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-gray-200 focus:border-blue-500 focus:outline-hidden"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#262626]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !description.trim() || !amount}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Analyzing Budget Impact...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Evaluate Purchase</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Verdict Badge */}
            <div
              className={`rounded-xl p-4 border ${
                result.decisionRecommendation === 'safe'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : result.decisionRecommendation === 'caution'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm mb-1">
                {result.decisionRecommendation === 'safe' ? (
                  <CheckCircle2 size={18} className="text-emerald-400" />
                ) : result.decisionRecommendation === 'caution' ? (
                  <AlertCircle size={18} className="text-amber-400" />
                ) : (
                  <AlertTriangle size={18} className="text-rose-400" />
                )}
                <span>
                  {result.decisionRecommendation === 'safe'
                    ? 'Safe to Spend'
                    : result.decisionRecommendation === 'caution'
                    ? 'Caution: Tight Allocation'
                    : 'Critical: Exceeds Budget'}
                </span>
              </div>
              <p className="text-xs font-medium leading-relaxed">{result.headline}</p>
            </div>

            {/* Numbers Breakdown */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3">
                <span className="text-[10px] font-bold text-gray-500 uppercase">
                  Remaining Category Budget
                </span>
                <div className="text-sm font-bold font-mono text-white mt-0.5">
                  {formatCurrency(result.budgetStatus.remainingBudget, currencySymbol)}
                </div>
              </div>

              <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3">
                <span className="text-[10px] font-bold text-gray-500 uppercase">
                  Buffer After Purchase
                </span>
                <div
                  className={`text-sm font-bold font-mono mt-0.5 ${
                    result.budgetStatus.afterPurchaseRemaining < 0
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(result.budgetStatus.afterPurchaseRemaining, currencySymbol)}
                </div>
              </div>
            </div>

            {/* Analysis & Tactical Advice */}
            <div className="space-y-2 text-xs text-gray-300 bg-[#0f0f0f] p-3.5 rounded-xl border border-[#262626]">
              <div>
                <strong className="text-white">Trade-Off Analysis:</strong>{' '}
                {result.tradeOffAnalysis}
              </div>
              <div>
                <strong className="text-white">Tactical Recommendation:</strong>{' '}
                {result.savingImpact}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#262626]">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300"
              >
                ← Test Another Purchase
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-[#262626] px-4 py-2 text-xs font-bold text-white hover:bg-[#333]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
