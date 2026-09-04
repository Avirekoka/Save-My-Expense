import React, { useState, useEffect } from 'react';
import {
  Target,
  Sparkles,
  Plus,
  TrendingUp,
  Calendar,
  Sliders,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Plane,
  Laptop,
  Home,
  Car,
  GraduationCap,
  Trophy,
  Wallet,
  Heart,
  Pencil,
  Trash2,
  Coins,
  Clock,
  Zap,
  RotateCcw,
  Check,
} from 'lucide-react';
import { FinancialGoal } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, formatDate, formatShortDate } from '../../utils/formatters';
import { GoalModal } from '../modals/GoalModal';
import { DepositGoalModal } from '../modals/DepositGoalModal';
import { ConfirmDeleteDialog } from '../common/ConfirmDeleteDialog';

interface GoalsViewProps {
  currencySymbol: string;
}

const getGoalIcon = (iconName?: string) => {
  switch (iconName) {
    case 'ShieldCheck':
      return ShieldCheck;
    case 'Plane':
      return Plane;
    case 'Laptop':
      return Laptop;
    case 'Home':
      return Home;
    case 'Car':
      return Car;
    case 'GraduationCap':
      return GraduationCap;
    case 'Trophy':
      return Trophy;
    case 'Wallet':
      return Wallet;
    case 'Heart':
      return Heart;
    case 'Sparkles':
      return Sparkles;
    case 'Target':
    default:
      return Target;
  }
};

export const GoalsView: React.FC<GoalsViewProps> = ({ currencySymbol }) => {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [depositGoal, setDepositGoal] = useState<FinancialGoal | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<FinancialGoal | null>(null);
  const [appliedToast, setAppliedToast] = useState<string | null>(null);

  // Simplified Simulator State
  const [selectedGoalId, setSelectedGoalId] = useState<string>('all');
  const [monthlySavingsBoost, setMonthlySavingsBoost] = useState<number>(3000);
  const [activeCategoryTrims, setActiveCategoryTrims] = useState<{
    dining: boolean;
    shopping: boolean;
    entertainment: boolean;
    commute: boolean;
  }>({
    dining: false,
    shopping: false,
    entertainment: false,
    commute: false,
  });

  const load = () => {
    const list = storageService.getGoals();
    setGoals(list);
  };

  useEffect(() => {
    load();
    window.addEventListener(NOTIFY_EVENT, load);
    return () => window.removeEventListener(NOTIFY_EVENT, load);
  }, []);

  // When goals load, set default selected goal if not set
  useEffect(() => {
    if (goals.length > 0 && selectedGoalId === 'all') {
      setSelectedGoalId(goals[0].id);
    }
  }, [goals]);

  // Overall Goal Aggregates
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const overallPercentage = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
  const totalMonthlyCommitment = goals.reduce((s, g) => s + (g.monthlyContribution || 0), 0);

  const handleOpenCreate = () => {
    setEditingGoal(null);
    setIsGoalModalOpen(true);
  };

  const handleOpenEdit = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setIsGoalModalOpen(true);
  };

  const handleDeleteGoal = (goal: FinancialGoal) => {
    setGoalToDelete(goal);
  };

  const handleConfirmDeleteGoal = () => {
    if (!goalToDelete) return;
    storageService.deleteGoal(goalToDelete.id);
    const updatedGoals = goals.filter((g) => g.id !== goalToDelete.id);
    setGoals(updatedGoals);
    if (selectedGoalId === goalToDelete.id) {
      setSelectedGoalId(updatedGoals.length > 0 ? updatedGoals[0].id : 'all');
    }
    setAppliedToast(`Goal "${goalToDelete.name}" successfully deleted.`);
    setTimeout(() => setAppliedToast(null), 4000);
    setGoalToDelete(null);
  };

  // Simulator Calculations
  // Category trim estimates based on average spending patterns:
  // Dining (-15%): ~₹1,800/mo, Shopping (-20%): ~₹2,500/mo, Entertainment (-20%): ~₹1,200/mo, Commute (-10%): ~₹800/mo
  const categoryBoosts =
    (activeCategoryTrims.dining ? 1800 : 0) +
    (activeCategoryTrims.shopping ? 2500 : 0) +
    (activeCategoryTrims.entertainment ? 1200 : 0) +
    (activeCategoryTrims.commute ? 800 : 0);

  const effectiveMonthlyBoost = monthlySavingsBoost + categoryBoosts;
  const effectiveAnnualGain = effectiveMonthlyBoost * 12;

  // Selected Target Goal for Simulation
  const targetGoal = goals.find((g) => g.id === selectedGoalId) || goals[0];

  const calculateTimeline = () => {
    if (!targetGoal) {
      return {
        originalMonths: 12,
        newMonths: 8,
        monthsSaved: 4,
        originalDate: 'June 2027',
        newDate: 'February 2027',
      };
    }

    const remaining = Math.max(0, targetGoal.targetAmount - targetGoal.currentAmount);
    const baseMonthly = Math.max(500, targetGoal.monthlyContribution || 5000);
    const newMonthly = baseMonthly + effectiveMonthlyBoost;

    const originalMonths = Math.max(1, Math.ceil(remaining / baseMonthly));
    const newMonths = Math.max(1, Math.ceil(remaining / newMonthly));
    const monthsSaved = Math.max(0, originalMonths - newMonths);

    const now = new Date();
    const origD = new Date(now.getFullYear(), now.getMonth() + originalMonths, 1);
    const newD = new Date(now.getFullYear(), now.getMonth() + newMonths, 1);

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return {
      originalMonths,
      newMonths,
      monthsSaved,
      originalDate: `${monthNames[origD.getMonth()]} ${origD.getFullYear()}`,
      newDate: `${monthNames[newD.getMonth()]} ${newD.getFullYear()}`,
    };
  };

  const simResult = calculateTimeline();

  const handleApplyOptimizationToGoal = () => {
    if (!targetGoal) return;
    const currentContrib = targetGoal.monthlyContribution || 0;
    const updatedContrib = currentContrib + effectiveMonthlyBoost;

    const updatedGoal: FinancialGoal = {
      ...targetGoal,
      monthlyContribution: updatedContrib,
    };

    storageService.saveGoal(updatedGoal);
    load();

    setAppliedToast(
      `Applied +${formatCurrency(
        effectiveMonthlyBoost,
        currencySymbol
      )}/mo to "${targetGoal.name}". New contribution: ${formatCurrency(
        updatedContrib,
        currencySymbol
      )}/mo!`
    );
    setTimeout(() => setAppliedToast(null), 5000);
  };

  const handleResetSimulator = () => {
    setMonthlySavingsBoost(3000);
    setActiveCategoryTrims({
      dining: false,
      shopping: false,
      entertainment: false,
      commute: false,
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Financial Goals & Wealth Targets
            </h1>
            <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-400">
              {goals.length} Goals Active
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Create custom milestones, deposit savings directly, and simulate fast-track timelines.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500 shadow-md shadow-blue-900/30 cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>Create New Goal</span>
        </button>
      </div>

      {/* Applied Toast */}
      {appliedToast && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-xs font-semibold text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{appliedToast}</span>
          </div>
          <button
            onClick={() => setAppliedToast(null)}
            className="text-emerald-400 hover:text-white text-xs cursor-pointer ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
          <div className="text-xs text-gray-400">Total Goals Value</div>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {formatCurrency(totalTarget, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">{goals.length} milestones planned</div>
        </div>

        <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
          <div className="text-xs text-gray-400">Total Saved So Far</div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
            {formatCurrency(totalSaved, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400/80 font-medium">
            {overallPercentage}% of total target
          </div>
        </div>

        <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
          <div className="text-xs text-gray-400">Monthly Contribution</div>
          <div className="mt-1 font-mono text-xl font-bold text-blue-400">
            {formatCurrency(totalMonthlyCommitment, currencySymbol)}
            <span className="text-xs font-normal text-gray-400">/mo</span>
          </div>
          <div className="mt-1 text-[11px] text-gray-500">Automated savings stream</div>
        </div>

        <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
          <div className="text-xs text-gray-400">Remaining to Achieve</div>
          <div className="mt-1 font-mono text-xl font-bold text-amber-400">
            {formatCurrency(Math.max(0, totalTarget - totalSaved), currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">Across all milestone funds</div>
        </div>
      </div>

      {/* 3. Active Goals Grid */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Your Milestone Goals
          </h2>
          <span className="text-xs text-gray-400">
            Click "+ Deposit" to add funds or edit anytime
          </span>
        </div>

        {goals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#333] bg-[#121212] p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-400 mx-auto mb-3">
              <Target size={24} />
            </div>
            <h3 className="text-base font-bold text-white">No Financial Goals Yet</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto mt-1 mb-5">
              Define your first financial target—such as an emergency cushion, vacation trip, or gadget upgrade—and track your progress.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow-md cursor-pointer"
            >
              <Plus size={15} />
              <span>Create Your First Goal</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {goals.map((g) => {
              const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
              const remaining = Math.max(0, g.targetAmount - g.currentAmount);
              const monthly = g.monthlyContribution || 0;
              const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null;
              const GoalIconComp = getGoalIcon(g.icon);
              const isCompleted = pct >= 100;
              const goalColor = g.color || '#10B981';

              return (
                <div
                  key={g.id}
                  className="rounded-2xl border border-[#222] bg-[#121212] p-4 sm:p-5 shadow-xs hover:border-[#333] transition flex flex-col justify-between group"
                >
                  <div>
                    {/* Goal Card Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-[#1f1f1f] pb-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-xs shrink-0"
                          style={{ backgroundColor: goalColor }}
                        >
                          <GoalIconComp size={19} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-xs font-bold text-white group-hover:text-blue-300 transition">
                              {g.name}
                            </h3>
                            {isCompleted && (
                              <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold">
                                Completed 🎉
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {g.category || 'Savings'}
                            {g.targetDate ? ` • By ${formatDate(g.targetDate)}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Card Menu / Edit & Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(g)}
                          title="Edit Goal"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-[#202020] hover:text-white transition cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(g)}
                          title="Delete Goal"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-500/20 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Progress Numbers */}
                    <div className="mt-4 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Saved Amount
                        </span>
                        <div className="font-mono text-lg font-bold text-white">
                          {formatCurrency(g.currentAmount, currencySymbol)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Target Goal
                        </span>
                        <div className="font-mono text-xs font-semibold text-gray-400">
                          {formatCurrency(g.targetAmount, currencySymbol)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 font-medium">Progress</span>
                        <span className="font-mono font-bold" style={{ color: goalColor }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#202020] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: goalColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Plan Details */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 bg-[#171717] rounded-lg p-2 border border-[#222]">
                      <span>
                        Contrib: <strong className="text-white">{formatCurrency(monthly, currencySymbol)}/mo</strong>
                      </span>
                      <span>
                        {isCompleted
                          ? 'Goal reached!'
                          : monthsLeft !== null
                          ? `~${monthsLeft} mos left`
                          : 'Ongoing'}
                      </span>
                    </div>

                    {g.notes && (
                      <p className="mt-2 text-[11px] text-gray-400 line-clamp-1 italic">
                        "{g.notes}"
                      </p>
                    )}
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-[#1f1f1f] flex items-center justify-between gap-2">
                    <div className="text-[10px] text-gray-500 font-mono">
                      Needed: {formatCurrency(remaining, currencySymbol)}
                    </div>
                    <button
                      onClick={() => setDepositGoal(g)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-600/25 transition cursor-pointer"
                    >
                      <Coins size={13} />
                      <span>+ Deposit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Simplified "What-If" Expense Optimization Simulator */}
      <div className="rounded-2xl border border-[#222] bg-[#121212] p-4 sm:p-5 lg:p-6 shadow-xs space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Sliders size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Simple "What-If" Savings Simulator
                </h2>
                <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Instant Acceleration
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                See how small monthly trims speed up reaching your goals in real-time.
              </p>
            </div>
          </div>

          <button
            onClick={handleResetSimulator}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Controls (7 cols): Simple & Convenient */}
          <div className="lg:col-span-7 space-y-5">
            {/* Step 1: Select Target Goal */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                1. Select Goal to Accelerate:
              </label>
              {goals.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {goals.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGoalId(g.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        selectedGoalId === g.id
                          ? 'border-blue-500 bg-blue-600/15 text-white'
                          : 'border-[#262626] bg-[#171717] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: g.color || '#3b82f6' }}
                      />
                      <span className="text-xs font-bold truncate">{g.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Create a goal above to simulate acceleration.</p>
              )}
            </div>

            {/* Step 2: Choose Extra Monthly Savings Boost */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-2">
                <span>2. Extra Monthly Savings Boost:</span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  +{formatCurrency(effectiveMonthlyBoost, currencySymbol)} / month
                </span>
              </div>

              {/* Quick 1-tap Boost Chips */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[1000, 2500, 5000, 10000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setMonthlySavingsBoost(amount)}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      monthlySavingsBoost === amount
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-[#181818] border-[#2a2a2a] text-gray-300 hover:bg-[#202020]'
                    }`}
                  >
                    +{formatCurrency(amount, currencySymbol)}
                  </button>
                ))}
              </div>

              {/* Smooth Slider */}
              <input
                type="range"
                min="0"
                max="15000"
                step="500"
                value={monthlySavingsBoost}
                onChange={(e) => setMonthlySavingsBoost(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                <span>{currencySymbol}0</span>
                <span>{currencySymbol}5,000</span>
                <span>{currencySymbol}10,000</span>
                <span>{currencySymbol}15,000+</span>
              </div>
            </div>

            {/* Step 3: Quick Category Trims */}
            <div>
              <div className="text-xs font-semibold text-gray-300 mb-2">
                3. Or Toggle Quick Expense Trims:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setActiveCategoryTrims((prev) => ({ ...prev, dining: !prev.dining }))
                  }
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    activeCategoryTrims.dining
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-[#262626] bg-[#171717] text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-medium">🍽️ Trim Dining 15%</div>
                  <span className="font-mono text-xs font-bold">+₹1,800</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveCategoryTrims((prev) => ({ ...prev, shopping: !prev.shopping }))
                  }
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    activeCategoryTrims.shopping
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-[#262626] bg-[#171717] text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-medium">🛍️ Trim Shopping 20%</div>
                  <span className="font-mono text-xs font-bold">+₹2,500</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveCategoryTrims((prev) => ({
                      ...prev,
                      entertainment: !prev.entertainment,
                    }))
                  }
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    activeCategoryTrims.entertainment
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-[#262626] bg-[#171717] text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-medium">🎬 Entertainment 20%</div>
                  <span className="font-mono text-xs font-bold">+₹1,200</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveCategoryTrims((prev) => ({ ...prev, commute: !prev.commute }))
                  }
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    activeCategoryTrims.commute
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-[#262626] bg-[#171717] text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-medium">🚕 Commute / Cabs 10%</div>
                  <span className="font-mono text-xs font-bold">+₹800</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Output Panel (5 cols): Clear & Actionable Impact */}
          <div className="lg:col-span-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Simulated Impact
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                +{formatCurrency(effectiveAnnualGain, currencySymbol)} / year
              </span>
            </div>

            {/* Timeline Speedup */}
            <div className="space-y-1.5">
              <div className="text-xs text-gray-300">
                Accelerating:{' '}
                <strong className="text-white">{targetGoal?.name || 'Selected Goal'}</strong>
              </div>
              <div className="font-mono text-2xl font-black text-white">
                {simResult.monthsSaved > 0
                  ? `${simResult.monthsSaved} Months Faster! 🚀`
                  : 'On Track'}
              </div>
              <p className="text-xs text-gray-300">
                Target will be reached in <strong className="text-emerald-400">{simResult.newMonths} months</strong> ({simResult.newDate}) instead of {simResult.originalMonths} months ({simResult.originalDate}).
              </p>
            </div>

            {/* Comparison Details */}
            <div className="rounded-xl bg-[#141414] border border-[#262626] p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Extra Monthly Savings:</span>
                <span className="font-mono font-bold text-emerald-400">
                  +{formatCurrency(effectiveMonthlyBoost, currencySymbol)}/mo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">1-Year Wealth Retained:</span>
                <span className="font-mono font-bold text-white">
                  {formatCurrency(effectiveAnnualGain, currencySymbol)}
                </span>
              </div>
            </div>

            {/* Apply Action Button */}
            <button
              onClick={handleApplyOptimizationToGoal}
              disabled={!targetGoal || effectiveMonthlyBoost <= 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 transition shadow-md shadow-emerald-900/30 disabled:opacity-50 cursor-pointer"
            >
              <Zap size={15} />
              <span>Apply Boost to "{targetGoal?.name || 'Goal'}"</span>
            </button>
            <p className="text-[10px] text-gray-400 text-center">
              Automatically updates your monthly goal contribution in your financial plan.
            </p>
          </div>
        </div>
      </div>

      {/* Goal Modal for Create / Edit */}
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => {
          setIsGoalModalOpen(false);
          setEditingGoal(null);
        }}
        goalToEdit={editingGoal}
        currencySymbol={currencySymbol}
        onSuccess={load}
        onDelete={(g) => {
          setIsGoalModalOpen(false);
          setEditingGoal(null);
          setGoalToDelete(g);
        }}
      />

      {/* Quick Deposit Modal */}
      <DepositGoalModal
        isOpen={!!depositGoal}
        onClose={() => setDepositGoal(null)}
        goal={depositGoal}
        currencySymbol={currencySymbol}
        onSuccess={load}
      />

      {/* Goal Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={!!goalToDelete}
        onClose={() => setGoalToDelete(null)}
        onConfirm={handleConfirmDeleteGoal}
        title="Delete Financial Goal?"
        description="Are you sure you want to remove this milestone target?"
        itemName={goalToDelete?.name}
        itemDetails={
          goalToDelete
            ? `Target: ${formatCurrency(
                goalToDelete.targetAmount,
                currencySymbol
              )} • Saved: ${formatCurrency(
                goalToDelete.currentAmount,
                currencySymbol
              )}`
            : undefined
        }
        confirmButtonText="Yes, Delete Goal"
      />
    </div>
  );
};
