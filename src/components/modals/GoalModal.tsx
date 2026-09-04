import React, { useState, useEffect } from 'react';
import {
  X,
  Target,
  ShieldCheck,
  Plane,
  Laptop,
  Home,
  Car,
  GraduationCap,
  Trophy,
  Wallet,
  Heart,
  Sparkles,
  Calendar,
  DollarSign,
  Layers,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { FinancialGoal } from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { formatCurrency } from '../../utils/formatters';
import { useScrollLock } from '../../hooks/useScrollLock';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalToEdit?: FinancialGoal | null;
  currencySymbol: string;
  onSuccess?: () => void;
  onDelete?: (goal: FinancialGoal) => void;
}

const CATEGORY_PRESETS = [
  'Safety & Emergency',
  'Travel & Vacation',
  'Gadgets & Tech',
  'Home & Living',
  'Vehicle',
  'Education',
  'Investments',
  'Lifestyle & Luxury',
  'General Savings',
];

const COLOR_PRESETS = [
  { name: 'Emerald', value: '#10B981', bg: 'bg-emerald-500' },
  { name: 'Blue', value: '#3B82F6', bg: 'bg-blue-500' },
  { name: 'Purple', value: '#8B5CF6', bg: 'bg-purple-500' },
  { name: 'Amber', value: '#F59E0B', bg: 'bg-amber-500' },
  { name: 'Rose', value: '#F43F5E', bg: 'bg-rose-500' },
  { name: 'Cyan', value: '#06B6D4', bg: 'bg-cyan-500' },
  { name: 'Indigo', value: '#6366F1', bg: 'bg-indigo-500' },
];

const ICON_PRESETS = [
  { name: 'Target', icon: Target },
  { name: 'ShieldCheck', icon: ShieldCheck },
  { name: 'Plane', icon: Plane },
  { name: 'Laptop', icon: Laptop },
  { name: 'Home', icon: Home },
  { name: 'Car', icon: Car },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'Trophy', icon: Trophy },
  { name: 'Wallet', icon: Wallet },
  { name: 'Heart', icon: Heart },
  { name: 'Sparkles', icon: Sparkles },
];

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  goalToEdit,
  currencySymbol,
  onSuccess,
  onDelete,
}) => {
  useScrollLock(isOpen);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Safety & Emergency');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [currentAmount, setCurrentAmount] = useState<string>('0');
  const [monthlyContribution, setMonthlyContribution] = useState<string>('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedColor, setSelectedColor] = useState('#10B981');
  const [selectedIcon, setSelectedIcon] = useState('Target');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (goalToEdit) {
      setName(goalToEdit.name || '');
      setCategory(goalToEdit.category || 'General Savings');
      setTargetAmount(goalToEdit.targetAmount ? String(goalToEdit.targetAmount) : '');
      setCurrentAmount(goalToEdit.currentAmount !== undefined ? String(goalToEdit.currentAmount) : '0');
      setMonthlyContribution(
        goalToEdit.monthlyContribution ? String(goalToEdit.monthlyContribution) : ''
      );
      setTargetDate(
        goalToEdit.targetDate ||
          (goalToEdit as any).deadline ||
          new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      );
      setSelectedColor(goalToEdit.color || '#10B981');
      setSelectedIcon(goalToEdit.icon || 'Target');
      setPriority((goalToEdit as any).priority || 'medium');
      setNotes(goalToEdit.notes || '');
    } else {
      setName('');
      setCategory('Safety & Emergency');
      setTargetAmount('');
      setCurrentAmount('0');
      setMonthlyContribution('');
      // Default target date: 6 months from now
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 6);
      setTargetDate(defaultDate.toISOString().slice(0, 10));
      setSelectedColor('#10B981');
      setSelectedIcon('Target');
      setPriority('medium');
      setNotes('');
    }
    setError(null);
  }, [goalToEdit, isOpen]);

  // Auto-calculate suggested monthly contribution if target date and amount are provided
  const handleAutoSuggestMonthly = () => {
    const target = parseFloat(targetAmount) || 0;
    const current = parseFloat(currentAmount) || 0;
    const remaining = Math.max(0, target - current);

    if (remaining > 0 && targetDate) {
      const now = new Date();
      const targetD = new Date(targetDate);
      const diffMonths =
        (targetD.getFullYear() - now.getFullYear()) * 12 +
        (targetD.getMonth() - now.getMonth());
      const months = Math.max(1, diffMonths);
      const suggested = Math.ceil(remaining / months);
      setMonthlyContribution(String(suggested));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a goal name.');
      return;
    }

    const parsedTarget = parseFloat(targetAmount);
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      setError('Please enter a valid target amount greater than 0.');
      return;
    }

    const parsedCurrent = parseFloat(currentAmount) || 0;
    const parsedMonthly = parseFloat(monthlyContribution) || 0;

    const goalData: FinancialGoal = {
      id: goalToEdit ? goalToEdit.id : `goal_${Date.now()}`,
      name: name.trim(),
      category: category.trim(),
      targetAmount: parsedTarget,
      currentAmount: parsedCurrent,
      monthlyContribution: parsedMonthly,
      targetDate: targetDate || undefined,
      color: selectedColor,
      icon: selectedIcon,
      notes: notes.trim() || undefined,
      createdAt: goalToEdit ? goalToEdit.createdAt : new Date().toISOString(),
      ...(priority ? { priority } : {}),
    };

    storageService.saveGoal(goalData);
    if (onSuccess) onSuccess();
    onClose();
  };

  const SelectedIconComp =
    ICON_PRESETS.find((i) => i.name === selectedIcon)?.icon || Target;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#262626] bg-[#121212] p-6 text-white shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: selectedColor }}
            >
              <SelectedIconComp size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {goalToEdit ? 'Edit Financial Goal' : 'Create New Financial Goal'}
              </h2>
              <p className="text-xs text-gray-400">
                {goalToEdit
                  ? 'Update milestone targets, savings progress, and completion timeline.'
                  : 'Define a savings milestone, target amount, and monthly allocation.'}
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

        {error && (
          <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Goal Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Goal Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Emergency Fund, Japan Trip, New MacBook"
              className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-hidden"
              >
                {CATEGORY_PRESETS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Priority
              </label>
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`rounded-lg py-2 text-xs font-bold capitalize transition border cursor-pointer ${
                      priority === p
                        ? p === 'high'
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : p === 'medium'
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                          : 'bg-gray-500/20 border-gray-500/40 text-gray-300'
                        : 'bg-[#181818] border-[#2e2e2e] text-gray-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Target Amount & Already Saved */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Target Amount ({currencySymbol}) <span className="text-rose-400">*</span>
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
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="e.g., 200000"
                  className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] pl-8 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Current Saved Amount ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-400">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] pl-8 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Target Date & Monthly Contribution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-300">
                  Target Completion Date
                </label>
              </div>
              <div className="relative">
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] px-3.5 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-300">
                  Monthly Contribution
                </label>
                <button
                  type="button"
                  onClick={handleAutoSuggestMonthly}
                  className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                >
                  Auto-calculate
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-400">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                  placeholder="e.g., 10000"
                  className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] pl-8 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Color & Icon Customization */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Badge Color & Icon
            </label>
            <div className="space-y-2.5">
              {/* Colors */}
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((col) => (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() => setSelectedColor(col.value)}
                    className={`h-7 w-7 rounded-full transition cursor-pointer flex items-center justify-center ${
                      selectedColor === col.value
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121212] scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col.value }}
                    title={col.name}
                  >
                    {selectedColor === col.value && (
                      <CheckCircle2 size={14} className="text-white" />
                    )}
                  </button>
                ))}
              </div>

              {/* Icons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {ICON_PRESETS.map((ic) => {
                  const Icon = ic.icon;
                  const isSelected = selectedIcon === ic.name;
                  return (
                    <button
                      key={ic.name}
                      type="button"
                      onClick={() => setSelectedIcon(ic.name)}
                      className={`p-2 rounded-lg border transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                          : 'bg-[#181818] border-[#2e2e2e] text-gray-400 hover:text-white'
                      }`}
                      title={ic.name}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notes / Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Notes & Strategy (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Stashed in liquid mutual funds, auto-debit on 5th of every month..."
              className="w-full rounded-xl border border-[#2e2e2e] bg-[#181818] p-3 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-between gap-3 pt-3 border-t border-[#262626]">
            {goalToEdit && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(goalToEdit);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Delete Goal</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#333] px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-[#1e1e1e] hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow-md shadow-blue-900/30 cursor-pointer"
              >
                {goalToEdit ? 'Save Changes' : 'Create Goal'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
