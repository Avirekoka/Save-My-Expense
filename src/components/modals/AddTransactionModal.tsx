import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Plus,
  Calendar,
  Tag,
  ArrowRightLeft,
  CreditCard,
  Trash2,
  AlertTriangle,
  Camera,
  Receipt,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import {
  Transaction,
  Category,
  TransactionType,
  PaymentMethod,
} from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { ExpenseCategorizer } from '../../services/ai/expense-categorizer';
import { CategoryIcon } from '../common/CategoryIcon';
import { ReceiptScannerModal, ScannedReceiptData } from './ReceiptScannerModal';
import { useScrollLock } from '../../hooks/useScrollLock';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingTransaction?: Transaction | null;
  initialReceiptData?: ScannedReceiptData | null;
  currencySymbol: string;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingTransaction,
  initialReceiptData,
  currencySymbol,
}) => {
  useScrollLock(isOpen);

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
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannedReceipt, setScannedReceipt] = useState<ScannedReceiptData | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{
    catId: string;
    catName: string;
    confidence: number;
    reasoning: string;
  } | null>(null);

  const applyReceiptData = (receipt: ScannedReceiptData) => {
    setScannedReceipt(receipt);
    if (receipt.amount) {
      setAmount(receipt.amount.toString());
    }
    if (receipt.merchant) {
      setMerchant(receipt.merchant);
    }
    if (receipt.date) {
      setDate(receipt.date);
    }
    if (receipt.type) {
      setType(receipt.type);
    }
    if (receipt.categoryId) {
      setCategoryId(receipt.categoryId);
    }
    if (receipt.paymentMethod) {
      setPaymentMethod(receipt.paymentMethod);
    }
    if (receipt.notes) {
      setNotes(receipt.notes);
    }
    if (receipt.tags && receipt.tags.length > 0) {
      setTags(receipt.tags.join(', '));
    }
    setAiSuggestion(null);
  };

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
      setScannedReceipt(null);
    } else if (initialReceiptData) {
      applyReceiptData(initialReceiptData);
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
      setScannedReceipt(null);
    }
  }, [editingTransaction, initialReceiptData, isOpen]);

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
      source: scannedReceipt ? 'receipt_scan' : (editingTransaction ? editingTransaction.source : 'manual'),
      isRecurring,
      tags: parsedTags,
      notes: notes.trim() || undefined,
      confidenceScore: scannedReceipt ? scannedReceipt.confidenceScore : 98,
      createdAt: editingTransaction ? editingTransaction.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storageService.saveTransaction(tx);
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative w-full max-w-lg my-auto rounded-2xl border border-[#262626] bg-[#141414] shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#262626] shrink-0">
            <div className="pr-2">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>{editingTransaction ? 'Edit Transaction' : 'Record Transaction'}</span>
                {scannedReceipt && (
                  <span className="rounded-md bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                    Scanned Receipt
                  </span>
                )}
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                Manual entry, camera OCR scan, or intelligent AI categorization
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!editingTransaction && (
                <button
                  type="button"
                  id="scan-receipt-modal-btn"
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600/10 border border-blue-500/30 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-blue-400 hover:bg-blue-600/20 transition cursor-pointer"
                  title="Scan physical receipt with camera"
                >
                  <Camera size={14} />
                  <span className="hidden sm:inline">Scan Receipt</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-white transition cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Scrollable Form Body */}
          <div className="overflow-y-auto overscroll-contain p-4 sm:p-5">
            {/* Scanned Receipt Banner */}
            {scannedReceipt && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 text-xs text-blue-300">
                <div className="flex items-center gap-2.5">
                  {scannedReceipt.receiptImage ? (
                    <img
                      src={scannedReceipt.receiptImage}
                      alt="Receipt Thumbnail"
                      className="h-10 w-10 rounded-lg object-cover border border-blue-500/40 shrink-0"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 shrink-0">
                      <Receipt size={16} />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>Auto-filled from physical receipt</span>
                    </div>
                    <div className="text-[11px] text-blue-300/80">
                      Extracted with Gemini Vision AI ({scannedReceipt.confidenceScore}% confidence)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setScannedReceipt(null)}
                  className="rounded-lg p-1 text-gray-400 hover:text-white hover:bg-white/10"
                  title="Dismiss banner"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className={`rounded-lg py-1.5 px-1 text-center transition cursor-pointer truncate ${
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
                      className="w-full min-h-[42px] rounded-xl border border-[#262626] bg-[#0f0f0f] pl-8 pr-3 py-2 text-base sm:text-sm font-bold font-mono text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
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
                      className="w-full min-h-[42px] rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-base sm:text-xs font-medium text-gray-200 focus:border-blue-500 focus:outline-hidden"
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
                  placeholder="e.g. Swiggy, Amazon, Metro, Starbucks, Landlord"
                  value={merchant}
                  onChange={(e) => handleMerchantChange(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-base sm:text-xs font-medium text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* AI Category Suggestion Pill */}
              {aiSuggestion && aiSuggestion.catId !== categoryId && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 p-2.5 text-xs text-blue-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles size={15} className="text-blue-400 shrink-0" />
                    <span className="truncate">
                      AI suggests <strong>{aiSuggestion.catName}</strong> ({aiSuggestion.confidence}% match)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={applyAiSuggestion}
                    className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-500 cursor-pointer shrink-0"
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
                    className="w-full min-h-[42px] rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-base sm:text-xs font-medium text-gray-200 focus:border-blue-500 focus:outline-hidden"
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
                    className="w-full min-h-[42px] rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-base sm:text-xs font-medium text-gray-200 focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Net Banking">Net Banking / IMPS</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Cash">Cash</option>
                    <option value="Wallet">Digital Wallet</option>
                    <option value="Other">Other</option>
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
                    className="w-full min-h-[42px] rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-base sm:text-xs text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="Optional notes, item details or invoice #"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-base sm:text-xs text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-hidden"
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
                      className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Yes, Delete</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#1a1a1a] cursor-pointer"
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
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
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
                    className="rounded-xl border border-[#262626] bg-[#0f0f0f] px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 cursor-pointer transition"
                  >
                    {editingTransaction ? 'Save Changes' : 'Add Transaction'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Camera Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onReceiptScanned={(scannedData) => {
          applyReceiptData(scannedData);
          setIsScannerOpen(false);
        }}
        currencySymbol={currencySymbol}
      />
    </>
  );
};

