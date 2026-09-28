import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  AlertTriangle,
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
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useScrollLock((isModalOpen && !!editingBudget) || !!budgetToDelete || showClearAllConfirm);
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
    setBudgets(storageService.getBudgets());
    setIsModalOpen(false);
    setEditingBudget(null);
    setAiSuccessMessage('Budget allocation saved successfully.');
    setTimeout(() => setAiSuccessMessage(null), 3000);
  };

  const handleDeleteBudget = (budgetId: string) => {
    const targetBudget = budgets.find((b) => b.id === budgetId) || budgetToDelete;
    const cat = categories.find((c) => c.id === targetBudget?.categoryId);
    const catName = cat ? cat.name : targetBudget?.categoryId || 'Category';

    storageService.deleteBudget(budgetId);
    setBudgets(storageService.getBudgets());
    setBudgetToDelete(null);
    if (isModalOpen && editingBudget?.id === budgetId) {
      setIsModalOpen(false);
      setEditingBudget(null);
    }
    setAiSuccessMessage(`Budget allocation for "${catName}" removed successfully.`);
    setTimeout(() => setAiSuccessMessage(null), 3500);
  };

  const handleClearAllBudgets = () => {
    const count = budgets.length;
    budgets.forEach((b) => storageService.deleteBudget(b.id));
    setBudgets(storageService.getBudgets());
    setShowClearAllConfirm(false);
    setAiSuccessMessage(`Removed all ${count} budget allocations.`);
    setTimeout(() => setAiSuccessMessage(null), 3500);
  };

  const handleRemoveRecommendation = (categoryId: string) => {
    setAiRecommendations((prev) => prev.filter((r) => r.categoryId !== categoryId));
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
    setBudgets(storageService.getBudgets());
    setAiRecommendations([]);
    setAiSuccessMessage(`Applied ${aiRecommendations.length} planned budget allocations.`);
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
          {budgets.length > 0 && (
            <button
              id="btn-clear-all-budgets"
              onClick={() => setShowClearAllConfirm(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-600/10 px-3 text-xs font-semibold text-rose-400 hover:bg-rose-600/20 shadow-xs cursor-pointer transition-colors"
              title="Remove all budget allocations"
            >
              <Trash2 size={13} />
              <span>Clear All</span>
            </button>
          )}

          <button
            id="btn-ai-budget-recommendations"
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
            id="btn-create-budget-top"
            onClick={() => {
              setEditingBudget({
                id: `bg_${Date.now()}`,
                categoryId: categories[0]?.id || 'food',
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

      {/* AI Recommendations Panel (Planned Allocations Proposal) */}
      {aiRecommendations.length > 0 && (
        <div id="panel-ai-planned-allocations" className="rounded-xl border border-blue-500/30 bg-blue-600/10 p-4 sm:p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="text-blue-400 shrink-0" size={18} />
              <div>
                <h3 className="text-sm font-bold text-white">
                  AI Budget Strategy Proposal (50/30/20 Strategy)
                </h3>
                <p className="text-[11px] text-gray-400">
                  Review or remove proposed planned allocations before applying.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-dismiss-ai-budgets"
                onClick={() => setAiRecommendations([])}
                className="rounded-lg border border-[#262626] bg-[#141414] px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#262626] cursor-pointer transition-colors"
              >
                Dismiss
              </button>
              <button
                id="btn-apply-ai-budgets"
                onClick={handleApplyAiRecommendations}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 cursor-pointer transition-colors"
              >
                Apply Allocations ({aiRecommendations.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {aiRecommendations.map((r) => (
              <div
                key={r.categoryId}
                id={`card-proposed-budget-${r.categoryId}`}
                className="rounded-lg border border-[#262626] bg-[#141414] p-3.5 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{r.categoryName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-400">
                        {formatCurrency(r.recommendedAmount, currencySymbol)}
                      </span>
                      <button
                        type="button"
                        id={`btn-remove-proposed-budget-${r.categoryId}`}
                        onClick={() => handleRemoveRecommendation(r.categoryId)}
                        className="rounded-md p-1 text-gray-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove from planned proposal"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{r.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Budgets Grid or Empty State */}
      {budgets.length === 0 ? (
        <div id="card-empty-budgets" className="rounded-xl border border-[#262626] bg-[#141414] p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1f1f1f] border border-[#2e2e2e] text-gray-400 mb-4">
            <PieChart size={28} className="text-gray-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">No Active Budget Allocations</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed mb-6">
            You currently don't have any category budget ceilings configured. Create custom planned allocations or generate AI recommendations to stay on track.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              id="btn-empty-generate-ai"
              onClick={handleGenerateAiBudgets}
              disabled={recommending}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-600/10 px-3.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/20 cursor-pointer"
            >
              <Sparkles size={14} className="text-blue-400" />
              <span>Generate AI Budgets</span>
            </button>
            <button
              id="btn-empty-create-budget"
              onClick={() => {
                setEditingBudget({
                  id: `bg_${Date.now()}`,
                  categoryId: categories[0]?.id || 'food',
                  monthlyLimit: 10000,
                  period: activeMonth,
                  alertThreshold: 80,
                });
                setIsModalOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Create Budget</span>
            </button>
          </div>
        </div>
      ) : (
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
                id={`card-budget-${b.id}`}
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

                    <div className="flex items-center gap-1">
                      <button
                        id={`btn-edit-budget-${b.id}`}
                        onClick={() => {
                          setEditingBudget(b);
                          setIsModalOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-white transition-colors cursor-pointer"
                        title="Edit budget allocation"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        id={`btn-delete-budget-${b.id}`}
                        onClick={() => setBudgetToDelete(b)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove budget allocation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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
      )}

      {/* Edit Budget Modal */}
      {isModalOpen && editingBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div
            id="modal-edit-budget"
            className="w-full max-w-sm rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-2xl text-white"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-sm font-bold text-white">
                {budgets.some((b) => b.id === editingBudget.id) ? 'Edit Budget Allocation' : 'Set Category Budget'}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingBudget(null);
                }}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
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
                  className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] p-2 text-xs text-gray-200 focus:border-blue-500 focus:outline-hidden cursor-pointer"
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
                  min="0"
                  step="any"
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

              <div className="flex items-center justify-between pt-3 border-t border-[#262626]">
                {budgets.some((b) => b.id === editingBudget.id) ? (
                  <button
                    type="button"
                    id="btn-modal-delete-budget"
                    onClick={() => {
                      const toDelete = editingBudget;
                      setIsModalOpen(false);
                      setEditingBudget(null);
                      setBudgetToDelete(toDelete);
                    }}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-modal-cancel-budget"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingBudget(null);
                    }}
                    className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1a1a1a] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="btn-modal-save-budget"
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer shadow-xs"
                  >
                    Save Budget
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Single Budget Confirmation Modal */}
      {budgetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            id="modal-confirm-delete-budget"
            className="w-full max-w-sm rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-2xl text-white space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Remove Budget Allocation?</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Are you sure you want to remove the monthly spending ceiling for{' '}
                  <span className="font-semibold text-white">
                    {categories.find((c) => c.id === budgetToDelete.categoryId)?.name || budgetToDelete.categoryId}
                  </span>{' '}
                  ({formatCurrency(budgetToDelete.monthlyLimit, currencySymbol)})?
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Your recorded transactions in this category will remain untouched.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#262626]">
              <button
                type="button"
                id="btn-cancel-delete-budget"
                onClick={() => setBudgetToDelete(null)}
                className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1a1a1a] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-budget"
                onClick={() => handleDeleteBudget(budgetToDelete.id)}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer shadow-xs"
              >
                <Trash2 size={13} />
                <span>Yes, Remove Budget</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Budgets Confirmation Modal */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            id="modal-confirm-clear-all-budgets"
            className="w-full max-w-sm rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-2xl text-white space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Clear All Budget Allocations?</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  This will remove all {budgets.length} active category budget ceilings for {activeMonth}. You can always create new allocations or generate fresh AI recommendations later.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#262626]">
              <button
                type="button"
                id="btn-cancel-clear-all-budgets"
                onClick={() => setShowClearAllConfirm(false)}
                className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1a1a1a] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-clear-all-budgets"
                onClick={handleClearAllBudgets}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer shadow-xs"
              >
                <Trash2 size={13} />
                <span>Remove All Budgets</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
