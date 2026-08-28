import React, { useState, useEffect } from 'react';
import { X, Sparkles, Plus, Calendar, Tag, ArrowRightLeft, CreditCard, Trash2, AlertTriangle } from 'lucide-react';
import {
  Transaction,
  Category,
  TransactionType,
  PaymentMethod,
} from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { ExpenseCategorizer } from '../../services/ai/expense-categorizer';
import { CategoryIcon } from '../common/CategoryIcon';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingTransaction?: Transaction | null;
  currencySymbol: string;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingTransaction,
  currencySymbol,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [amount, setAmount] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState<string>('food');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [tags, setTags] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    catId: string;
    catName: string;
    confidence: number;
    reasoning: string;
  } | null>(null);

  useEffect(() => {
    const cats = storageService.getCategories();
    setCategories(cats);
    setShowDeleteConfirm(false);

    if (editingTransaction) {
      setAmount(editingTransaction.amount.toString());
      setMerchant(editingTransaction.merchant);
      setType(editingTransaction.type);
      setCategoryId(editingTransaction.categoryId);
      setDate(editingTransaction.date);
      setPaymentMethod(editingTransaction.paymentMethod);
      setTags((editingTransaction.tags || []).join(', '));
      setNotes(editingTransaction.notes || '');
      setIsRecurring(!!editingTransaction.isRecurring);
    } else {
      setAmount('');
      setMerchant('');
      setType('expense');
      setCategoryId('food');
      setDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod('UPI');
      setTags('');
      setNotes('');
      setIsRecurring(false);
      setAiSuggestion(null);
    }
  }, [editingTransaction, isOpen]);

  // Real-time AI categorization suggestion while typing merchant
  const handleMerchantChange = (val: string) => {
    setMerchant(val);
    if (val.trim().length >= 3 && type === 'expense') {
      const suggestion = ExpenseCategorizer.suggestCategory(
        val,
        notes,
        parseFloat(amount) || 0,
        categories
      );
      if (suggestion.confidenceScore >= 70) {
        setAiSuggestion({
          catId: suggestion.categoryId,
          catName: suggestion.categoryName,
          confidence: suggestion.confidenceScore,
          reasoning: suggestion.reasoning,
        });
      }
    } else {
      setAiSuggestion(null);
    }
  };

  const applyAiSuggestion = () => {
    if (aiSuggestion) {
      setCategoryId(aiSuggestion.catId);
      setAiSuggestion(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    if (!merchant.trim()) return;

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Save learning rule if user manually selected category for merchant
    ExpenseCategorizer.recordUserCorrection(merchant, categoryId);

    const tx: Transaction = {
      id: editingTransaction ? editingTransaction.id : `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: 'usr_main_demo',
      amount: numAmount,
      type,
      merchant: merchant.trim(),
      categoryId,
      date,
      paymentMethod,
      source: editingTransaction ? editingTransaction.source : 'manual',
      isRecurring,
      tags: parsedTags,
      notes: notes.trim() || undefined,
      confidenceScore: 98,
      createdAt: editingTransaction ? editingTransaction.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storageService.saveTransaction(tx);
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
          <div>
            <h3 className="text-base font-bold text-white">
              {editingTransaction ? 'Edit Transaction' : 'Record Transaction'}
            </h3>
            <p className="text-xs text-gray-400">
              Manual entry with intelligent AI category detection
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Type Selector (Pills) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 rounded-xl bg-[#0f0f0f] border border-[#262626] p-1 text-xs font-semibold text-gray-400">
            {(
              [
                { id: 'expense', label: 'Expense' },
                { id: 'income', label: 'Income' },
                { id: 'transfer', label: 'Transfer' },
                { id: 'refund', label: 'Refund' },
                { id: 'investment', label: 'SIP/Asset' },
                { id: 'loan_emi', label: 'EMI' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`rounded-lg py-1.5 text-center transition ${
                  type === t.id
                    ? 'bg-[#262626] text-white font-bold shadow-xs'
                    : 'hover:text-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Amount ({currencySymbol}) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-500">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] pl-8 pr-3 py-2 text-sm font-bold font-mono text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Date *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-gray-200 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Merchant / Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Merchant / Counterparty *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Swiggy, Amazon, Metro, Landlord"
              value={merchant}
              onChange={(e) => handleMerchantChange(e.target.value)}
              className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* AI Category Suggestion Pill */}
          {aiSuggestion && aiSuggestion.catId !== categoryId && (
            <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-600/10 p-2.5 text-xs text-blue-300">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-blue-400 shrink-0" />
                <span>
                  AI suggests <strong>{aiSuggestion.catName}</strong> ({aiSuggestion.confidence}% match)
                </span>
              </div>
              <button
                type="button"
                onClick={applyAiSuggestion}
                className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-500"
              >
                Apply
              </button>
            </div>
          )}

          {/* Category Picker & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Category *</label>
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

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs font-medium text-gray-200 focus:border-blue-500 focus:outline-hidden"
              >
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Net Banking">Net Banking / IMPS</option>
                <option value="Bank Transfer">Bank Transfer / NEFT</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>

          {/* Tags & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                placeholder="e.g. dinner, weekend, work"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Notes</label>
              <input
                type="text"
                placeholder="Optional notes or details"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Recurring Toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-[#333] bg-[#0f0f0f] text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-gray-300">
              Recurring Monthly Commitment (Subscription, Rent, SIP, EMI)
            </span>
          </label>

          {/* Delete Confirmation Prompt */}
          {showDeleteConfirm && editingTransaction && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <AlertTriangle size={16} />
                <span>Delete this transaction?</span>
              </div>
              <p className="text-gray-300 text-[11px]">
                Are you sure you want to delete this record for <strong>{editingTransaction.merchant}</strong> ({currencySymbol}{editingTransaction.amount})? This cannot be undone.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    storageService.deleteTransaction(editingTransaction.id);
                    onSuccess?.();
                    onClose();
                  }}
                  className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition"
                >
                  <Trash2 size={13} />
                  <span>Yes, Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#1a1a1a]"
                >
                  Keep Record
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-[#262626]">
            <div>
              {editingTransaction && !showDeleteConfirm && (
                <button
                  type="button"
                  id="delete-edit-tx-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500"
              >
                {editingTransaction ? 'Save Changes' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
