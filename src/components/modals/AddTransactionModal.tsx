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
  Users,
} from 'lucide-react';
import {
  Transaction,
  Category,
  TransactionType,
  PaymentMethod,
  FriendDebtType,
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
  initialFriendDebtMode?: { type: 'lent' | 'borrowed'; friendName?: string } | null;
  currencySymbol: string;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingTransaction,
  initialReceiptData,
  initialFriendDebtMode,
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
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isFriendDebt, setIsFriendDebt] = useState<boolean>(false);
  const [friendDebtType, setFriendDebtType] = useState<FriendDebtType>('lent');
  const [friendName, setFriendName] = useState<string>('');
  const [friendPhone, setFriendPhone] = useState<string>('');
  const [friendDueDate, setFriendDueDate] = useState<string>('');
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

      if (editingTransaction.friendDebtType) {
        setIsFriendDebt(true);
        setFriendDebtType(editingTransaction.friendDebtType);
        setFriendName(editingTransaction.friendName || editingTransaction.merchant || '');
        const debts = storageService.getFriendDebts();
        const matchDebt = editingTransaction.friendDebtId
          ? debts.find((d) => d.id === editingTransaction.friendDebtId)
          : debts.find((d) => d.friendName.toLowerCase() === (editingTransaction.friendName || editingTransaction.merchant).toLowerCase());
        if (matchDebt) {
          setFriendPhone(matchDebt.friendPhone || '');
          setFriendDueDate(matchDebt.dueDate || '');
        } else {
          setFriendPhone('');
          setFriendDueDate('');
        }
      } else {
        setIsFriendDebt(false);
        setFriendDebtType('lent');
        setFriendName('');
        setFriendPhone('');
        setFriendDueDate('');
      }
    } else if (initialReceiptData) {
      applyReceiptData(initialReceiptData);
      setIsFriendDebt(false);
      setFriendDebtType('lent');
      setFriendName('');
      setFriendPhone('');
      setFriendDueDate('');
    } else if (initialFriendDebtMode) {
      setAmount('');
      const defaultName = initialFriendDebtMode.friendName || '';
      setMerchant(defaultName);
      setFriendName(defaultName);
      setIsFriendDebt(true);
      setFriendDebtType(initialFriendDebtMode.type);
      setType(initialFriendDebtMode.type === 'lent' ? 'expense' : 'income');
      setCategoryId('transfers');
      setDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod('UPI');
      setTags('friend-debt');
      setNotes('');
      setFriendPhone('');
      setFriendDueDate('');
      setIsRecurring(false);
      setAiSuggestion(null);
      setScannedReceipt(null);
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
      setIsFriendDebt(false);
      setFriendDebtType('lent');
      setFriendName('');
      setFriendPhone('');
      setFriendDueDate('');
      setAiSuggestion(null);
      setScannedReceipt(null);
    }
  }, [editingTransaction, initialReceiptData, initialFriendDebtMode, isOpen]);

  // Real-time AI categorization suggestion while typing merchant
  const handleMerchantChange = (val: string) => {
    setMerchant(val);
    if (isFriendDebt && !friendName) {
      setFriendName(val);
    }
    if (val.trim().length >= 3 && type === 'expense' && !isFriendDebt) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }

    const effectiveFriendName = isFriendDebt ? (friendName.trim() || merchant.trim()) : undefined;
    if (isFriendDebt && !effectiveFriendName) {
      setFormError("Please enter your friend's name (who you lent to or borrowed from).");
      return;
    }

    const effectiveMerchant = isFriendDebt ? (effectiveFriendName || merchant.trim()) : merchant.trim();
    if (!effectiveMerchant) {
      setFormError('Please enter a payee or merchant name (e.g. Starbucks, Amazon).');
      return;
    }

    const effectiveType = isFriendDebt ? (friendDebtType === 'lent' ? 'expense' : 'income') : type;
    const effectiveCategoryId = isFriendDebt && categoryId === 'food' ? 'transfers' : categoryId;

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Save learning rule if user manually selected category for merchant
    if (!isFriendDebt) {
      ExpenseCategorizer.recordUserCorrection(effectiveMerchant, effectiveCategoryId);
    }

    const activeUid =
      storageService.getCurrentUserId() ||
      (storageService.isDemoUser() ? 'usr_main_demo' : 'usr_authenticated');

    const tx: Transaction = {
      id: editingTransaction ? editingTransaction.id : `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: editingTransaction ? editingTransaction.userId : activeUid,
      amount: numAmount,
      type: effectiveType,
      merchant: effectiveMerchant,
      categoryId: effectiveCategoryId,
      date,
      paymentMethod,
      source: scannedReceipt ? 'receipt' : (editingTransaction ? editingTransaction.source : 'manual'),
      isRecurring,
      tags: isFriendDebt ? Array.from(new Set([...parsedTags, 'friend-debt', friendDebtType])) : parsedTags,
      notes: notes.trim() || undefined,
      confidenceScore: scannedReceipt ? scannedReceipt.confidenceScore : 98,
      friendDebtType: isFriendDebt ? friendDebtType : undefined,
      friendName: isFriendDebt ? effectiveFriendName : undefined,
      friendDebtId: editingTransaction ? editingTransaction.friendDebtId : undefined,
      createdAt: editingTransaction ? editingTransaction.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      setIsSubmitting(true);
      setFormError(null);
      const res = await storageService.saveTransaction(tx);
      if (res && res.error) {
        console.warn('Transaction saved with warning/error:', res.error);
      }

      // If friend debt metadata like due date or phone was specified, persist to the friend debt document
      if (isFriendDebt && (friendDueDate || friendPhone)) {
        try {
          const debts = storageService.getFriendDebts();
          const targetDebt = tx.friendDebtId
            ? debts.find((d) => d.id === tx.friendDebtId)
            : debts.find((d) => d.friendName.toLowerCase() === effectiveFriendName?.toLowerCase());
          if (targetDebt) {
            if (friendDueDate) targetDebt.dueDate = friendDueDate;
            if (friendPhone) targetDebt.friendPhone = friendPhone;
            storageService.saveFriendDebt(targetDebt);
          }
        } catch (_) {}
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to save transaction:', err);
      setFormError(err?.message || 'Failed to record transaction. Please check console or try again.');
    } finally {
      setIsSubmitting(false);
    }
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
              {/* Form Validation Error Banner */}
              {formError && (
                <div
                  id="add-tx-form-error"
                  role="alert"
                  className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300"
                >
                  <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                  <span className="flex-1 font-medium">{formError}</span>
                  <button
                    type="button"
                    onClick={() => setFormError(null)}
                    className="p-1 text-rose-400 hover:text-white rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

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
                    onClick={() => {
                      setType(t.id);
                      if (isFriendDebt) {
                        if (t.id === 'income') setFriendDebtType('borrowed');
                        else if (t.id === 'expense') setFriendDebtType('lent');
                      }
                    }}
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

              {/* Friend Lending / Borrowing Card (Who owes who?) */}
              <div
                className={`rounded-xl border p-3 sm:p-3.5 transition ${
                  isFriendDebt
                    ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-950/30 to-[#121212]'
                    : 'border-[#262626] bg-[#0f0f0f] hover:border-[#383838]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 transition ${
                        isFriendDebt
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-[#1e1e1e] text-gray-400'
                      }`}
                    >
                      <Users size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                        <span>Friend Money (Lend / Borrow)</span>
                        {isFriendDebt && (
                          <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-bold text-indigo-300 border border-indigo-500/30">
                            Dashboard Sync Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">
                        Track who owes you money or who you owe, shown directly on the Dashboard
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !isFriendDebt;
                      setIsFriendDebt(next);
                      if (next) {
                        setType(friendDebtType === 'lent' ? 'expense' : 'income');
                        if (categoryId === 'food') setCategoryId('transfers');
                        if (friendName && !merchant) setMerchant(friendName);
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      isFriendDebt ? 'bg-indigo-600' : 'bg-[#2a2a2a]'
                    }`}
                    title="Toggle friend lending/borrowing tracking"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        isFriendDebt ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Expanded Friend Options */}
                {isFriendDebt && (
                  <div className="mt-3 pt-3 border-t border-indigo-500/20 space-y-3 animate-in fade-in duration-150">
                    {/* Direction: Lent vs Borrowed */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1.5">
                        Who gave money to whom?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFriendDebtType('lent');
                            setType('expense');
                          }}
                          className={`flex items-center justify-center gap-2 rounded-xl py-2 px-2.5 text-xs font-bold border transition cursor-pointer text-center ${
                            friendDebtType === 'lent'
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-xs'
                              : 'bg-[#161616] border-[#262626] text-gray-400 hover:text-white'
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                          <span className="truncate">I Lent Money (They owe me)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFriendDebtType('borrowed');
                            setType('income');
                          }}
                          className={`flex items-center justify-center gap-2 rounded-xl py-2 px-2.5 text-xs font-bold border transition cursor-pointer text-center ${
                            friendDebtType === 'borrowed'
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-xs'
                              : 'bg-[#161616] border-[#262626] text-gray-400 hover:text-white'
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                          <span className="truncate">I Borrowed (I owe them)</span>
                        </button>
                      </div>
                    </div>

                    {/* Friend Name & Phone Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          Friend's Name *
                        </label>
                        <input
                          type="text"
                          required={isFriendDebt}
                          placeholder="e.g. Rahul, Alex, Priya"
                          value={friendName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFriendName(val);
                            setMerchant(val);
                          }}
                          className="w-full min-h-[40px] rounded-xl border border-indigo-500/40 bg-[#161616] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-indigo-400 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          Friend's Phone / WhatsApp (Optional)
                        </label>
                        <input
                          type="tel"
                          placeholder="e.g. +91 98765 43210"
                          value={friendPhone}
                          onChange={(e) => setFriendPhone(e.target.value)}
                          className="w-full min-h-[40px] rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-indigo-400 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Return Date & Dashboard notice */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          Expected Return / Due Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={friendDueDate}
                          onChange={(e) => setFriendDueDate(e.target.value)}
                          className="w-full min-h-[40px] rounded-xl border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-xs text-gray-200 focus:border-indigo-400 focus:outline-hidden"
                        />
                      </div>

                      <div className="rounded-xl bg-indigo-950/40 border border-indigo-500/30 p-2.5 text-[11px] text-indigo-300 flex items-center gap-2">
                        <Sparkles size={14} className="text-indigo-400 shrink-0" />
                        <span>
                          {friendDebtType === 'lent'
                            ? "Will show on Dashboard under 'You'll Get'"
                            : "Will show on Dashboard under 'You Owe'"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingTransaction ? 'Save Changes' : 'Add Transaction'}</span>
                    )}
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

