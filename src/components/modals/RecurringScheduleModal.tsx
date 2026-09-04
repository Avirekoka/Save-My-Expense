import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Repeat,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Trash2,
  Edit2,
  RefreshCw,
  Sparkles,
  Zap,
  ArrowRight,
  Shield,
  CreditCard,
} from 'lucide-react';
import {
  RecurringSchedule,
  RecurringCategoryType,
  RecurringFrequency,
  TransactionType,
  PaymentMethod,
  Category,
} from '../../types';
import { recurringService } from '../../services/recurring/recurring.service';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useScrollLock } from '../../hooks/useScrollLock';

interface RecurringScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
  onSchedulesUpdated?: () => void;
}

export const RecurringScheduleModal: React.FC<RecurringScheduleModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
  onSchedulesUpdated,
}) => {
  useScrollLock(isOpen);

  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [injectResult, setInjectResult] = useState<{
    count: number;
    amount: number;
    message: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    amount: string;
    type: TransactionType;
    categoryId: string;
    recurringType: RecurringCategoryType;
    frequency: RecurringFrequency;
    dayOfMonth: number;
    paymentMethod: PaymentMethod;
    autoInject: boolean;
    notes: string;
  }>({
    name: '',
    amount: '',
    type: 'expense',
    categoryId: 'subscriptions',
    recurringType: 'subscription',
    frequency: 'monthly',
    dayOfMonth: 1,
    paymentMethod: 'Credit Card',
    autoInject: true,
    notes: '',
  });

  const loadData = () => {
    setSchedules(recurringService.getSchedules());
    setCategories(storageService.getCategories());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      if (isOpen) loadData();
    };
    window.addEventListener(NOTIFY_EVENT, handleUpdate);
    return () => window.removeEventListener(NOTIFY_EVENT, handleUpdate);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setIsEditing(true);
    setEditingId(null);
    setFormData({
      name: '',
      amount: '',
      type: 'expense',
      categoryId: categories.find((c) => c.id === 'subscriptions')?.id || 'subscriptions',
      recurringType: 'subscription',
      frequency: 'monthly',
      dayOfMonth: 1,
      paymentMethod: 'Credit Card',
      autoInject: true,
      notes: '',
    });
    setInjectResult(null);
    setSyncResult(null);
  };

  const handleStartEdit = (schedule: RecurringSchedule) => {
    setIsEditing(true);
    setEditingId(schedule.id);
    setFormData({
      name: schedule.name,
      amount: schedule.amount.toString(),
      type: schedule.type,
      categoryId: schedule.categoryId,
      recurringType: schedule.recurringType,
      frequency: schedule.frequency,
      dayOfMonth: schedule.dayOfMonth,
      paymentMethod: schedule.paymentMethod,
      autoInject: schedule.autoInject,
      notes: schedule.notes || '',
    });
    setInjectResult(null);
    setSyncResult(null);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.amount || Number(formData.amount) <= 0) return;

    const scheduleToSave: RecurringSchedule = {
      id: editingId || `rec_${Date.now()}`,
      name: formData.name.trim(),
      amount: parseFloat(formData.amount),
      type: formData.type,
      categoryId: formData.categoryId,
      recurringType: formData.recurringType,
      frequency: formData.frequency,
      dayOfMonth: Number(formData.dayOfMonth),
      startDate: '2024-01-01',
      paymentMethod: formData.paymentMethod,
      autoInject: formData.autoInject,
      status: 'active',
      tags: ['recurring', formData.recurringType],
      notes: formData.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    recurringService.saveSchedule(scheduleToSave);
    setIsEditing(false);
    setEditingId(null);
    loadData();
    onSchedulesUpdated?.();
  };

  const handleDelete = (id: string) => {
    recurringService.deleteSchedule(id);
    loadData();
    onSchedulesUpdated?.();
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    recurringService.toggleStatus(id, nextStatus as any);
    loadData();
    onSchedulesUpdated?.();
  };

  const handleRunAutoInject = () => {
    const result = recurringService.autoInjectDueTransactions('2026-08-28');
    if (result.injectedCount > 0) {
      setInjectResult({
        count: result.injectedCount,
        amount: result.totalInjectedAmount,
        message: `Successfully generated ${result.injectedCount} scheduled transactions (${formatCurrency(result.totalInjectedAmount, currencySymbol)}) into your active ledger.`,
      });
    } else {
      setInjectResult({
        count: 0,
        amount: 0,
        message: 'All scheduled transactions for this period are already up to date!',
      });
    }
    loadData();
    onSchedulesUpdated?.();
    setTimeout(() => setInjectResult(null), 6000);
  };

  const handleSyncSubs = () => {
    const res = recurringService.syncFromSubscriptionsAndEMIs();
    if (res.addedCount > 0) {
      setSyncResult(`Synced ${res.addedCount} new subscription/loan rules into recurring schedules.`);
    } else {
      setSyncResult('All subscriptions & loans are already linked and synchronized.');
    }
    loadData();
    onSchedulesUpdated?.();
    setTimeout(() => setSyncResult(null), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-[#262626] bg-[#141414] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] px-6 py-4.5 bg-[#171717]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Repeat size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Recurring Schedule & Auto-Injection Service
              </h2>
              <p className="text-xs text-gray-400">
                Manage automated fixed commitments (Rent, EMIs, Subscriptions, SIPs) and ledger injection
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feedback banners */}
        {injectResult && (
          <div
            className={`px-6 py-3 border-b text-xs flex items-center gap-2.5 ${
              injectResult.count > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="font-medium">{injectResult.message}</span>
          </div>
        )}

        {syncResult && (
          <div className="px-6 py-3 border-b bg-purple-500/10 border-purple-500/30 text-purple-300 text-xs flex items-center gap-2.5">
            <Sparkles size={16} className="shrink-0" />
            <span className="font-medium">{syncResult}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isEditing ? (
            /* Edit / Add Schedule Form */
            <form onSubmit={handleSaveForm} className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                <h3 className="text-sm font-bold text-white">
                  {editingId ? 'Edit Recurring Schedule' : 'Add New Recurring Schedule'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Commitment / Merchant Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prestige Apartment Rent, Netflix, Car EMI"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3.5 py-2.5 text-xs font-medium text-white focus:border-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Amount ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3.5 py-2.5 font-mono text-xs font-bold text-white focus:border-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Recurring Classification
                  </label>
                  <select
                    value={formData.recurringType}
                    onChange={(e) => {
                      const rType = e.target.value as RecurringCategoryType;
                      let defaultTxType: TransactionType = 'expense';
                      let catId = 'subscriptions';
                      if (rType === 'rent') {
                        catId = 'rent';
                      } else if (rType === 'salary') {
                        defaultTxType = 'income';
                        catId = 'salary';
                      } else if (rType === 'emi') {
                        defaultTxType = 'loan_emi';
                        catId = 'loan_emi';
                      } else if (rType === 'investment') {
                        defaultTxType = 'investment';
                        catId = 'investments';
                      } else if (rType === 'utility') {
                        catId = 'utilities';
                      }
                      setFormData({
                        ...formData,
                        recurringType: rType,
                        type: defaultTxType,
                        categoryId: catId,
                      });
                    }}
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-purple-500 focus:outline-hidden"
                  >
                    <option value="rent">Rent / Housing Commitment</option>
                    <option value="subscription">Subscription / Membership</option>
                    <option value="emi">Loan / EMI Repayment</option>
                    <option value="utility">Utility / Broadband / Power</option>
                    <option value="salary">Salary / Recurring Inflow</option>
                    <option value="investment">SIP / Investment Contribution</option>
                    <option value="custom">Custom Recurring Commitment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Ledger Category
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-purple-500 focus:outline-hidden"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        frequency: e.target.value as RecurringFrequency,
                      })
                    }
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-purple-500 focus:outline-hidden"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly / Annual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Scheduled Day of Month (1 - 31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={formData.dayOfMonth}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)),
                      })
                    }
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3.5 py-2.5 font-mono text-xs font-bold text-white focus:border-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })
                    }
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white focus:border-purple-500 focus:outline-hidden"
                  >
                    <option value="Credit Card">Credit Card</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="UPI">UPI / AutoPay</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Auto-Injection Setting
                  </label>
                  <label className="flex items-center gap-2.5 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3.5 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoInject}
                      onChange={(e) => setFormData({ ...formData, autoInject: e.target.checked })}
                      className="rounded accent-purple-600"
                    />
                    <span className="text-xs font-medium text-gray-200">
                      Auto-inject into ledger on scheduled due date
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Notes / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Account details, mandate reference, renewal notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3.5 py-2 text-xs font-medium text-white focus:border-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-[#262626] bg-[#1a1a1a] px-4 py-2 text-xs font-bold text-gray-300 hover:bg-[#252525]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 shadow-md shadow-purple-900/30"
                >
                  {editingId ? 'Save Changes' : 'Create Schedule'}
                </button>
              </div>
            </form>
          ) : (
            /* Schedules List & Action Toolbar */
            <div className="space-y-4">
              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1a1a1a] border border-[#262626] rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartAdd}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-500 shadow-xs cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add New Rule</span>
                  </button>

                  <button
                    onClick={handleSyncSubs}
                    className="flex items-center gap-1.5 rounded-lg border border-[#333] bg-[#222] px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Sync Subscriptions & EMIs</span>
                  </button>
                </div>

                <button
                  onClick={handleRunAutoInject}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-600/30 shadow-xs cursor-pointer"
                >
                  <Zap size={14} className="text-emerald-400" />
                  <span>Auto-Inject Due Now</span>
                </button>
              </div>

              {/* Schedule cards */}
              <div className="space-y-2.5">
                {schedules.map((schedule) => {
                  const cat = categories.find((c) => c.id === schedule.categoryId);
                  return (
                    <div
                      key={schedule.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border p-4 transition ${
                        schedule.status === 'active'
                          ? 'border-[#262626] bg-[#171717] hover:border-[#333]'
                          : 'border-[#222] bg-[#111]/70 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs shrink-0 ${
                            schedule.recurringType === 'rent'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : schedule.recurringType === 'salary'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : schedule.recurringType === 'emi'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : schedule.recurringType === 'investment'
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                              : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          }`}
                        >
                          {schedule.recurringType.slice(0, 3).toUpperCase()}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">{schedule.name}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                schedule.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                              }`}
                            >
                              {schedule.status}
                            </span>
                            {schedule.autoInject && (
                              <span className="rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                                <Zap size={10} /> Auto-Inject
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span>Day {schedule.dayOfMonth} of month</span>
                            <span>•</span>
                            <span className="capitalize">{schedule.frequency}</span>
                            <span>•</span>
                            <span>{schedule.paymentMethod}</span>
                            <span>•</span>
                            <span>{cat?.name || schedule.categoryId}</span>
                            {schedule.lastInjectedDate && (
                              <>
                                <span>•</span>
                                <span className="text-gray-500">
                                  Last: {formatDate(schedule.lastInjectedDate)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 mt-3 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-[#222]">
                        <div className="text-left sm:text-right">
                          <div
                            className={`font-mono text-sm font-extrabold ${
                              schedule.type === 'income' ? 'text-emerald-400' : 'text-white'
                            }`}
                          >
                            {schedule.type === 'income' ? '+' : '-'}
                            {formatCurrency(schedule.amount, currencySymbol)}
                          </div>
                          <span className="text-[10px] text-gray-500 uppercase">
                            /{schedule.frequency}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(schedule.id, schedule.status)}
                            title={schedule.status === 'active' ? 'Pause Schedule' : 'Resume Schedule'}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#262626] hover:text-white transition"
                          >
                            {schedule.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                          </button>

                          <button
                            onClick={() => handleStartEdit(schedule)}
                            title="Edit Rule"
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#262626] hover:text-blue-400 transition"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            onClick={() => handleDelete(schedule.id)}
                            title="Delete Rule"
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#262626] hover:text-rose-400 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#262626] px-6 py-4 bg-[#171717]">
          <span className="text-xs text-gray-500">
            {schedules.filter((s) => s.status === 'active').length} active recurring schedules configured
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-[#262626] px-4 py-2 text-xs font-bold text-white hover:bg-[#333] transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
