import React, { useState, useEffect } from 'react';
import {
  Settings,
  User,
  Shield,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Plus,
  Sparkles,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { UserProfile, Category } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';

interface SettingsViewProps {
  currencySymbol: string;
  onUpdateCurrency: (symbol: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currencySymbol,
  onUpdateCurrency,
}) => {
  const [profile, setProfile] = useState<UserProfile>(storageService.getUserProfile());
  const [categories, setCategories] = useState<Category[]>(storageService.getCategories());
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366F1');
  const [newCatBudget, setNewCatBudget] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const load = () => {
      setProfile(storageService.getUserProfile());
      setCategories(storageService.getCategories());
    };
    load();
    window.addEventListener(NOTIFY_EVENT, load);
    return () => window.removeEventListener(NOTIFY_EVENT, load);
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    storageService.saveUserProfile(profile);
    onUpdateCurrency(profile.currency);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newCat: Category = {
      id: `custom_${Date.now()}`,
      name: newCatName.trim(),
      icon: 'Tag',
      color: newCatColor,
      type: 'expense',
      isCustom: true,
      budgetMonthly: parseFloat(newCatBudget) || 5000,
    };

    storageService.saveCategory(newCat);
    setNewCatName('');
    setNewCatBudget('');
  };

  const handleConfirmResetData = () => {
    storageService.resetToSeedData();
    setShowResetConfirm(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3500);
  };

  const handleExportJSON = () => {
    const data = {
      profile: storageService.getUserProfile(),
      transactions: storageService.getTransactions(),
      categories: storageService.getCategories(),
      budgets: storageService.getBudgets(),
      goals: storageService.getGoals(),
      subscriptions: storageService.getSubscriptions(),
      statements: storageService.getStatements(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spend_intelligence_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Settings & Data Management
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Configure personal baseline preferences, custom category tax labels, and ledger export backups.
        </p>
      </div>

      {/* Profile Settings Card */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <User className="text-blue-400" size={18} />
            <h2 className="text-base font-bold text-white">User Profile & Currency</h2>
          </div>
          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle2 size={14} /> Saved
            </span>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Full Name</label>
              <input
                type="text"
                value={profile.name || ''}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Email Address</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Monthly Net Inflow Baseline
              </label>
              <input
                type="number"
                value={profile.monthlyIncome}
                onChange={(e) =>
                  setProfile({ ...profile, monthlyIncome: parseFloat(e.target.value) || 0 })
                }
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-mono font-bold text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Currency Symbol
              </label>
              <select
                value={profile.currency}
                onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-blue-500 focus:outline-hidden"
              >
                <option value="₹">INR (₹) - Indian Rupee</option>
                <option value="$">USD ($) - US Dollar</option>
                <option value="€">EUR (€) - Euro</option>
                <option value="£">GBP (£) - British Pound</option>
                <option value="S$">SGD (S$) - Singapore Dollar</option>
                <option value="¥">JPY (¥) - Japanese Yen</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500"
            >
              Update Preferences
            </button>
          </div>
        </form>
      </div>

      {/* Category Manager */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4">
          <h2 className="text-base font-bold text-white">Custom Category Taxonomies</h2>
          <span className="text-xs text-gray-400">{categories.length} total categories</span>
        </div>

        {/* Existing categories pill list */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs font-semibold text-gray-200"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.name}</span>
              {c.isCustom && (
                <span className="text-[10px] text-blue-400 font-bold ml-1">Custom</span>
              )}
            </div>
          ))}
        </div>

        {/* Add custom category form */}
        <form
          onSubmit={handleAddCategory}
          className="flex flex-col sm:flex-row items-end gap-3 rounded-xl bg-[#0f0f0f] p-4 border border-[#262626]"
        >
          <div className="w-full sm:flex-1">
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              New Category Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Pet Care, Gaming, Freelance Expense"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full rounded-xl border border-[#262626] bg-[#141414] px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="w-full sm:w-32">
            <label className="block text-xs font-semibold text-gray-300 mb-1">Color</label>
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="w-full h-9 rounded-xl border border-[#262626] bg-[#141414] p-1 cursor-pointer"
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
          >
            Add Category
          </button>
        </form>
      </div>

      {/* Backup & Ledger Controls */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs space-y-4">
        <div className="border-b border-[#262626] pb-4">
          <h2 className="text-base font-bold text-white">Ledger Backup & Seed Controls</h2>
          <p className="text-xs text-gray-400">
            Export a full offline JSON snapshot of your financial ledger or reset data to default demonstration state.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 rounded-xl border border-[#262626] bg-[#0f0f0f] px-4 py-2 text-xs font-bold text-gray-200 hover:bg-[#1a1a1a] shadow-xs"
          >
            <Download size={15} />
            <span>Export JSON Snapshot</span>
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/20 shadow-xs transition"
          >
            <RefreshCw size={15} />
            <span>Reset Demo Ledger Data</span>
          </button>
        </div>

        {resetSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 animate-in fade-in">
            <CheckCircle2 size={16} />
            <span>Demo ledger reset successfully to baseline curated records.</span>
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetConfirm(false);
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
            <h3 className="text-base font-bold text-white mb-2">Reset Ledger to Seed Data?</h3>
            <p className="text-xs text-gray-300 mb-6 leading-relaxed">
              Are you sure you want to restore the multi-month demonstration dataset? Any custom transactions, categories, budgets, and goals you added will be replaced by the default seed data.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetData}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 shadow-xs"
              >
                <RefreshCw size={14} />
                <span>Yes, Reset Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
