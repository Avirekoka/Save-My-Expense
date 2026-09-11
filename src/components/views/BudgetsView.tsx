import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Sparkles,
  Plus,
  Edit2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  X,
  Loader2,
} from 'lucide-react';
import { Budget, Category } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, getCurrentMonth } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';
import { useScrollLock } from '../../hooks/useScrollLock';

interface BudgetsViewProps {
  currentMonth: string;
  currencySymbol: string;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  currentMonth,
  currencySymbol,
}) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useScrollLock(isModalOpen && !!editingBudget);
  const [recommending, setRecommending] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<
    Array<{ categoryId: string; categoryName: string; recommendedAmount: number; rationale: string }>
  >([]);

  const load = () => {
    setBudgets(storageService.getBudgets());
    setCategories(storageService.getCategories());
  };

  useEffect(() => {
    load();
    window.addEventListener(NOTIFY_EVENT, load);
    return () => window.removeEventListener(NOTIFY_EVENT, load);
  }, []);

  const activeMonth = currentMonth && currentMonth !== 'all' ? currentMonth : getCurrentMonth();
  const summary = storageService.calculateMonthSummary(activeMonth);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;
    storageService.saveBudget(editingBudget);
    setIsModalOpen(false);
    setEditingBudget(null);
  };

  const handleGenerateAiBudgets = async () => {
    setRecommending(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      // Smart AI Budget Recommendations tailored to ₹1,20,000 income
      const recs = [
        {
          categoryId: 'food',
          categoryName: 'Food & Dining',
          recommendedAmount: 10000,
          rationale: 'Reduced by ₹2,000 to rein in excessive weekend brunch and food delivery orders.',
        },
        {
          categoryId: 'shopping',
          categoryName: 'Shopping',
          recommendedAmount: 8000,
          rationale: 'Normalizing post-gadget upgrade to leave higher buffer for emergency liquidity.',
        },
        {
          categoryId: 'groceries',
          categoryName: 'Groceries',
          recommendedAmount: 8500,
          rationale: 'Slightly boosted to encourage home cooking over food delivery apps.',
        },
        {
          categoryId: 'entertainment',
          categoryName: 'Entertainment',
          recommendedAmount: 4000,
          rationale: 'Balanced leisure allocation for cinema and weekend events.',
        },
        {
          categoryId: 'subscriptions',
          categoryName: 'Subscriptions',
          recommendedAmount: 3000,
          rationale: 'Optimized allocation assuming 1 unused learning app is pruned.',
        },
      ];
      setAiRecommendations(recs);
    } finally {
      setRecommending(false);
    }
  };

  const handleApplyAiRecommendations = () => {
    aiRecommendations.forEach((r) => {
      storageService.saveBudget({
        id: `bg_${r.categoryId}`,
        categoryId: r.categoryId,
        monthlyLimit: r.recommendedAmount,
        period: activeMonth,
        alertThreshold: 80,
      });
    });
    setAiRecommendations([]);
    setAiSuccessMessage('AI recommended budget caps applied successfully.');
    setTimeout(() => setAiSuccessMessage(null), 3500);
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
      {aiSuccessMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{aiSuccessMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Budgets & Planned Allocations
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Active monthly spending ceilings and automated alerts to prevent lifestyle inflation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleGenerateAiBudgets}
            disabled={recommending}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-600/10 px-3 text-xs font-semibold text-blue-300 hover:bg-blue-600/20 shadow-xs cursor-pointer"
          >
            {recommending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} className="text-blue-400" />
            )}
            <span>AI Budget Recommendations</span>
          </button>

          <button
            onClick={() => {
              setEditingBudget({
                id: `bg_${Date.now()}`,
                categoryId: 'food',
                monthlyLimit: 10000,
                period: activeMonth,
                alertThreshold: 80,
              });
              setIsModalOpen(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Create Budget</span>
          </button>
        </div>
      </div>

      {/* AI Recommendations Panel */}
      {aiRecommendations.length > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-600/10 p-4 sm:p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="text-blue-400" size={18} />
              <h3 className="text-sm font-bold text-white">
                AI Budget Strategy Proposal (50/30/20 Strategy)
              </h3>
            </div>
            <button
              onClick={handleApplyAiRecommendations}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 cursor-pointer"
            >
              Apply All Recommendations
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {aiRecommendations.map((r) => (
              <div key={r.categoryId} className="rounded-lg border border-[#262626] bg-[#141414] p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{r.categoryName}</span>
                  <span className="font-mono text-xs font-bold text-blue-400">
                    {formatCurrency(r.recommendedAmount, currencySymbol)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{r.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {budgets.map((b) => {
          const cat = categories.find((c) => c.id === b.categoryId);
          const spent = summary.categorySpending[b.categoryId] || 0;
          const remaining = b.monthlyLimit - spent;
          const pct = Math.round((spent / b.monthlyLimit) * 100);
          const isOver = spent > b.monthlyLimit;
          const isWarning = pct >= (b.alertThreshold || 80);

          return (
            <div
              key={b.id}
              className="rounded-xl border border-[#262626] bg-[#141414] p-4 sm:p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon category={cat} categoryId={b.categoryId} size={16} />
                    <span className="text-xs font-bold text-white">
                      {cat ? cat.name : b.categoryId}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setEditingBudget(b);
                      setIsModalOpen(true);
                    }}
                    className="rounded-lg p-1 text-gray-400 hover:bg-[#262626] hover:text-white"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>

                {/* Numbers */}
                <div className="mt-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Spent</span>
                    <div
                      className={`font-mono text-lg font-bold ${
                        isOver ? 'text-rose-400' : 'text-white'
                      }`}
                    >
                      {formatCurrency(spent, currencySymbol)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Budget</span>
                    <div className="font-mono text-xs text-gray-400 font-bold">
                      {formatCurrency(b.monthlyLimit, currencySymbol)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#262626]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver
                          ? 'bg-rose-500'
                          : isWarning
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-gray-400">
                    <span>{pct}% consumed</span>
                    <span className={isOver ? 'text-rose-400 font-bold' : 'text-gray-300'}>
                      {isOver
                        ? `Over by ${formatCurrency(Math.abs(remaining), currencySymbol)}`
                        : `${formatCurrency(remaining, currencySymbol)} remaining`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status footer pill */}
              <div className="mt-4 pt-3 border-t border-[#262626]">
                {isOver ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400">
                    <AlertCircle size={14} />
                    <span>Exceeded limit by {pct - 100}%</span>
                  </div>
                ) : isWarning ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                    <AlertCircle size={14} />
                    <span>Approaching ceiling threshold</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 size={14} />
                    <span>Comfortably within target</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Budget Modal */}
      {isModalOpen && editingBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-sm font-bold text-white">Set Category Budget</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X size={16} className="text-gray-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Category</label>
                <select
                  value={editingBudget.categoryId}
                  onChange={(e) =>
                    setEditingBudget({ ...editingBudget, categoryId: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] p-2 text-xs text-gray-200 focus:border-blue-500 focus:outline-hidden"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Monthly Limit ({currencySymbol})
                </label>
                <input
                  type="number"
                  required
                  value={editingBudget.monthlyLimit}
                  onChange={(e) =>
                    setEditingBudget({
                      ...editingBudget,
                      monthlyLimit: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] p-2 text-sm font-mono font-bold text-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Alert Warning Threshold (%)
                </label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={editingBudget.alertThreshold || 80}
                  onChange={(e) =>
                    setEditingBudget({
                      ...editingBudget,
                      alertThreshold: parseInt(e.target.value, 10) || 80,
                    })
                  }
                  className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] p-2 text-xs text-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1a1a1a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
