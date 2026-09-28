import React, { useState, useEffect } from 'react';
import {
  Users,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  CheckCircle2,
  Calendar,
  AlertCircle,
  MessageCircle,
  Share2,
  Trash2,
  Check,
  X,
  Clock,
  ChevronRight,
  Filter,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { FriendDebt, FriendDebtsSummary, FriendDebtType } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, formatDate, formatShortDate } from '../../utils/formatters';

interface FriendDebtsSectionProps {
  currencySymbol: string;
  compact?: boolean;
  onOpenAddModal?: (friendMode?: { type: 'lent' | 'borrowed'; friendName?: string }) => void;
  title?: string;
}

export const FriendDebtsSection: React.FC<FriendDebtsSectionProps> = ({
  currencySymbol,
  compact = false,
  onOpenAddModal,
  title = 'Friends & Peer Money',
}) => {
  const [debts, setDebts] = useState<FriendDebt[]>([]);
  const [filter, setFilter] = useState<'all' | 'lent' | 'borrowed' | 'settled'>('all');
  const [settlingDebt, setSettlingDebt] = useState<FriendDebt | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleDate, setSettleDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [settleNotes, setSettleNotes] = useState<string>('');
  const [isSettleSubmitting, setIsSettleSubmitting] = useState<boolean>(false);
  const [deletingDebt, setDeletingDebt] = useState<FriendDebt | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Direct Add Modal state (if user adds directly from the card)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [quickName, setQuickName] = useState<string>('');
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickType, setQuickType] = useState<FriendDebtType>('lent');
  const [quickPhone, setQuickPhone] = useState<string>('');
  const [quickDueDate, setQuickDueDate] = useState<string>('');
  const [quickNotes, setQuickNotes] = useState<string>('');
  const [quickFormError, setQuickFormError] = useState<string | null>(null);

  const loadData = () => {
    setDebts(storageService.getFriendDebts());
  };

  useEffect(() => {
    loadData();
    window.addEventListener(NOTIFY_EVENT, loadData);
    return () => window.removeEventListener(NOTIFY_EVENT, loadData);
  }, []);

  // Compute summary metrics
  let totalLent = 0; // Friends owe you
  let totalBorrowed = 0; // You owe friends
  let pendingLentCount = 0;
  let pendingBorrowedCount = 0;
  let settledCount = 0;

  debts.forEach((d) => {
    if (d.status === 'settled' || d.remainingAmount <= 0) {
      settledCount++;
    } else {
      if (d.type === 'lent') {
        totalLent += d.remainingAmount;
        pendingLentCount++;
      } else {
        totalBorrowed += d.remainingAmount;
        pendingBorrowedCount++;
      }
    }
  });

  const netBalance = totalLent - totalBorrowed;

  // Filtered items
  const filteredDebts = debts.filter((d) => {
    const isSettled = d.status === 'settled' || d.remainingAmount <= 0;
    if (filter === 'settled') return isSettled;
    if (isSettled) return false; // In other filters, only show pending/partial
    if (filter === 'lent') return d.type === 'lent';
    if (filter === 'borrowed') return d.type === 'borrowed';
    return true; // 'all' active
  });

  const handleOpenSettle = (debt: FriendDebt) => {
    setSettlingDebt(debt);
    setSettleAmount(debt.remainingAmount.toString());
    setSettleDate(new Date().toISOString().slice(0, 10));
    setSettleNotes('');
  };

  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingDebt) return;

    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      return;
    }

    try {
      setIsSettleSubmitting(true);
      const res = storageService.settleFriendDebt(
        settlingDebt.id,
        amt,
        settleDate,
        settleNotes.trim() || undefined
      );

      const isFull = res.isFull;
      const friend = settlingDebt.friendName;
      setToastMessage(
        isFull
          ? `Settled in full with ${friend}! Logged repayment of ${formatCurrency(amt, currencySymbol)}.`
          : `Recorded partial repayment of ${formatCurrency(amt, currencySymbol)} with ${friend}.`
      );
      setTimeout(() => setToastMessage(null), 4000);
      setSettlingDebt(null);
      loadData();
    } catch (err: any) {
      console.warn('Failed to settle friend debt:', err);
    } finally {
      setIsSettleSubmitting(false);
    }
  };

  const handleDelete = (debt: FriendDebt) => {
    storageService.deleteFriendDebt(debt.id);
    setToastMessage(`Removed record for ${debt.friendName}.`);
    setTimeout(() => setToastMessage(null), 3000);
    setDeletingDebt(null);
    loadData();
  };

  const handleWhatsAppReminder = (debt: FriendDebt) => {
    const cleanPhone = (debt.friendPhone || '').replace(/[^0-9]/g, '');
    const reminderMsg = `Hi ${debt.friendName}! Hope you're doing great. Just a friendly reminder about the ${currencySymbol}${debt.remainingAmount} from our split on ${debt.date}${debt.notes ? ` (${debt.notes})` : ''}. Let me know once you get a chance to UPI it over! 😊`;

    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(reminderMsg)}`, '_blank');
    } else {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(reminderMsg);
        setToastMessage(`Copied payment reminder for ${debt.friendName} to clipboard!`);
        setTimeout(() => setToastMessage(null), 3500);
      }
    }
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickFormError(null);

    const numAmount = parseFloat(quickAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setQuickFormError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!quickName.trim()) {
      setQuickFormError("Please enter your friend's name.");
      return;
    }

    const activeUid = storageService.getCurrentUserId() || (storageService.isDemoUser() ? 'usr_main_demo' : 'usr_authenticated');
    const newDebtId = `fdebt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const newDebt: FriendDebt = {
      id: newDebtId,
      userId: activeUid,
      friendName: quickName.trim(),
      friendPhone: quickPhone.trim() || undefined,
      type: quickType,
      amount: numAmount,
      settledAmount: 0,
      remainingAmount: numAmount,
      status: 'pending',
      date: new Date().toISOString().slice(0, 10),
      dueDate: quickDueDate || undefined,
      notes: quickNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storageService.saveFriendDebt(newDebt);

    // Also log a ledger transaction so finances match
    storageService.saveTransaction({
      id: `tx_${newDebtId}`,
      userId: activeUid,
      amount: numAmount,
      type: quickType === 'lent' ? 'expense' : 'income',
      merchant: quickName.trim(),
      categoryId: 'transfers',
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: 'UPI',
      source: 'manual',
      tags: ['friend-debt', quickType],
      notes: quickNotes.trim() || (quickType === 'lent' ? `Lent money to ${quickName}` : `Borrowed money from ${quickName}`),
      friendDebtId: newDebtId,
      friendDebtType: quickType,
      friendName: quickName.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setToastMessage(
      quickType === 'lent'
        ? `Recorded: Lent ${formatCurrency(numAmount, currencySymbol)} to ${quickName.trim()}!`
        : `Recorded: Borrowed ${formatCurrency(numAmount, currencySymbol)} from ${quickName.trim()}!`
    );
    setTimeout(() => setToastMessage(null), 4000);

    setIsQuickAddOpen(false);
    setQuickName('');
    setQuickAmount('');
    setQuickPhone('');
    setQuickDueDate('');
    setQuickNotes('');
    loadData();
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="rounded-xl border border-[#222] bg-[#121212] p-4 sm:p-5 lg:p-6 space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-300 flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-gray-400 hover:text-white text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header with Title and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#222] pb-3.5 gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-400">
              <Users size={14} />
            </div>
            <h2 className="text-sm font-bold text-white">{title}</h2>
            {pendingLentCount + pendingBorrowedCount > 0 && (
              <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                {pendingLentCount + pendingBorrowedCount} pending
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Track money lent to friends and money borrowed from friends
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAddModal ? (
            <button
              onClick={() => onOpenAddModal({ type: 'lent' })}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition cursor-pointer shadow-xs"
            >
              <Plus size={13} />
              <span>Record Loan</span>
            </button>
          ) : (
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition cursor-pointer shadow-xs"
            >
              <Plus size={13} />
              <span>Record Loan</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Badges (3-grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* You'll Get (Lent) */}
        <div
          onClick={() => setFilter('lent')}
          className={`rounded-xl border p-3 cursor-pointer transition ${
            filter === 'lent'
              ? 'border-emerald-500/50 bg-emerald-950/20 shadow-xs'
              : 'border-[#262626] bg-[#161616] hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <ArrowDownLeft size={13} /> You'll Get
            </span>
            <span className="text-[10px] text-gray-400">{pendingLentCount} friend{pendingLentCount === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-emerald-400">
            {formatCurrency(totalLent, currencySymbol)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Friends owe you</div>
        </div>

        {/* You Owe (Borrowed) */}
        <div
          onClick={() => setFilter('borrowed')}
          className={`rounded-xl border p-3 cursor-pointer transition ${
            filter === 'borrowed'
              ? 'border-amber-500/50 bg-amber-950/20 shadow-xs'
              : 'border-[#262626] bg-[#161616] hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="text-amber-400 font-medium flex items-center gap-1">
              <ArrowUpRight size={13} /> You Owe
            </span>
            <span className="text-[10px] text-gray-400">{pendingBorrowedCount} friend{pendingBorrowedCount === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-amber-400">
            {formatCurrency(totalBorrowed, currencySymbol)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">You owe friends</div>
        </div>

        {/* Net Balance */}
        <div
          onClick={() => setFilter('all')}
          className={`rounded-xl border p-3 cursor-pointer transition ${
            filter === 'all'
              ? 'border-indigo-500/50 bg-indigo-950/20 shadow-xs'
              : 'border-[#262626] bg-[#161616] hover:border-indigo-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="text-gray-300 font-medium">Net Position</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                netBalance > 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : netBalance < 0
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-gray-500/10 text-gray-400'
              }`}
            >
              {netBalance > 0 ? '+ Receivable' : netBalance < 0 ? '- Payable' : 'Even'}
            </span>
          </div>
          <div
            className={`mt-1 font-mono text-base sm:text-lg font-bold ${
              netBalance > 0
                ? 'text-emerald-400'
                : netBalance < 0
                ? 'text-amber-400'
                : 'text-gray-200'
            }`}
          >
            {netBalance >= 0 ? '+' : ''}
            {formatCurrency(netBalance, currencySymbol)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Overall friend balance</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1e1e1e]">
        <div className="inline-flex rounded-lg bg-[#181818] p-0.5 border border-[#2a2a2a] text-[11px] overflow-x-auto max-w-full">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All Active ({pendingLentCount + pendingBorrowedCount})
          </button>
          <button
            onClick={() => setFilter('lent')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap ${
              filter === 'lent'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            You'll Get ({pendingLentCount})
          </button>
          <button
            onClick={() => setFilter('borrowed')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap ${
              filter === 'borrowed'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            You Owe ({pendingBorrowedCount})
          </button>
          <button
            onClick={() => setFilter('settled')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap ${
              filter === 'settled'
                ? 'bg-[#333] text-white shadow-xs font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Settled ({settledCount})
          </button>
        </div>
      </div>

      {/* Debts List */}
      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {filteredDebts.length > 0 ? (
          filteredDebts.map((item) => {
            const isLent = item.type === 'lent';
            const isSettled = item.status === 'settled' || item.remainingAmount <= 0;
            const hasPartial = item.settledAmount > 0 && !isSettled;
            const progress = item.amount > 0 ? Math.round((item.settledAmount / item.amount) * 100) : 0;

            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition ${
                  isSettled
                    ? 'bg-[#151515] border-[#222] opacity-75'
                    : isLent
                    ? 'bg-[#171717] border-[#262626] hover:border-emerald-500/30'
                    : 'bg-[#171717] border-[#262626] hover:border-amber-500/30'
                }`}
              >
                {/* Friend Info & Avatar */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs shrink-0 ${
                      isSettled
                        ? 'bg-[#222] text-gray-400'
                        : isLent
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {getInitials(item.friendName)}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white truncate">
                        {item.friendName}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.2 text-[9px] font-bold ${
                          isSettled
                            ? 'bg-gray-500/20 text-gray-300'
                            : isLent
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isSettled
                          ? 'Settled'
                          : isLent
                          ? 'They owe you'
                          : 'You owe'}
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                      <span>{formatShortDate(item.date)}</span>
                      {item.dueDate && (
                        <span className="flex items-center gap-1 text-gray-300">
                          • Due {formatShortDate(item.dueDate)}
                        </span>
                      )}
                      {item.notes && (
                        <span className="truncate max-w-[200px] text-gray-400">
                          • {item.notes}
                        </span>
                      )}
                    </div>

                    {/* Partial settlement progress indicator */}
                    {hasPartial && (
                      <div className="pt-1 max-w-[180px]">
                        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                          <span>{progress}% returned</span>
                          <span>
                            {formatCurrency(item.settledAmount, currencySymbol)} of {formatCurrency(item.amount, currencySymbol)}
                          </span>
                        </div>
                        <div className="h-1 w-full bg-[#262626] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isLent ? 'bg-emerald-400' : 'bg-amber-400'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount and Action Buttons */}
                <div className="flex items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#222]">
                  <div className="text-left sm:text-right">
                    <div
                      className={`font-mono text-sm font-bold ${
                        isSettled
                          ? 'text-gray-400 line-through'
                          : isLent
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {formatCurrency(item.remainingAmount, currencySymbol)}
                    </div>
                    {hasPartial && (
                      <div className="text-[10px] text-gray-400">
                        orig. {formatCurrency(item.amount, currencySymbol)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* WhatsApp Reminder (for Lent debts) */}
                    {isLent && !isSettled && (
                      <button
                        type="button"
                        onClick={() => handleWhatsAppReminder(item)}
                        className="rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 p-1.5 text-xs transition cursor-pointer"
                        title={item.friendPhone ? `Send WhatsApp reminder to ${item.friendName}` : 'Copy reminder text'}
                      >
                        <MessageCircle size={14} />
                      </button>
                    )}

                    {/* Settle Debt Button */}
                    {!isSettled && (
                      <button
                        type="button"
                        onClick={() => handleOpenSettle(item)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
                          isLent
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                            : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
                        }`}
                        title="Automatically logs an offsetting transaction and marks debt as settled"
                      >
                        <Check size={12} />
                        <span>{isLent ? 'Settle (Received)' : 'Settle Debt'}</span>
                      </button>
                    )}

                    {/* Delete Icon */}
                    <button
                      type="button"
                      onClick={() => setDeletingDebt(item)}
                      className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                      title="Delete record"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-6 text-xs text-gray-500 space-y-2">
            <CheckCircle2 size={24} className="mx-auto text-emerald-400/60" />
            <p>
              {filter === 'settled'
                ? 'No settled friend loans on record yet.'
                : filter === 'lent'
                ? 'No one currently owes you money! You are all squared up.'
                : filter === 'borrowed'
                ? 'You do not owe money to any friends right now.'
                : 'No active friend loans. When you lend or borrow money with friends, it will show right here.'}
            </p>
          </div>
        )}
      </div>

      {/* Settle Repayment Dialog */}
      {settlingDebt && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#141414] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>
                    {settlingDebt.type === 'lent'
                      ? `Record Repayment from ${settlingDebt.friendName}`
                      : `Settle Debt with ${settlingDebt.friendName}`}
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Pending balance: {formatCurrency(settlingDebt.remainingAmount, currencySymbol)}
                </p>
              </div>
              <button
                onClick={() => setSettlingDebt(null)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Amount Received / Paid ({currencySymbol}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-500">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    max={settlingDebt.remainingAmount}
                    required
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] pl-8 pr-3 py-2 text-sm font-mono font-bold text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                  <button
                    type="button"
                    onClick={() => setSettleAmount(settlingDebt.remainingAmount.toString())}
                    className="text-emerald-400 hover:underline cursor-pointer"
                  >
                    Settle in full ({formatCurrency(settlingDebt.remainingAmount, currencySymbol)})
                  </button>
                  {settlingDebt.remainingAmount > 1000 && (
                    <button
                      type="button"
                      onClick={() => setSettleAmount((settlingDebt.remainingAmount / 2).toFixed(0))}
                      className="hover:underline cursor-pointer"
                    >
                      50% partial
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-xs text-gray-200 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via GPay, Cash repayment"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setSettlingDebt(null)}
                  className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1a1a1a] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSettleSubmitting}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition cursor-pointer disabled:opacity-50"
                >
                  {isSettleSubmitting ? 'Recording...' : 'Confirm Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingDebt && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-sm rounded-2xl border border-rose-500/30 bg-[#141414] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertCircle size={18} />
              <span>Remove Friend Loan Record?</span>
            </div>
            <p className="text-xs text-gray-300">
              Are you sure you want to remove the record for <strong>{deletingDebt.friendName}</strong> ({formatCurrency(deletingDebt.remainingAmount, currencySymbol)})?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#262626]">
              <button
                type="button"
                onClick={() => setDeletingDebt(null)}
                className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1a1a1a] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingDebt)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Modal (Standalone from Card) */}
      {isQuickAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-indigo-500/40 bg-[#141414] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users size={16} className="text-indigo-400" />
                  <span>Record Friend Loan</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Tracks debt and appears directly on your Dashboard
                </p>
              </div>
              <button
                onClick={() => setIsQuickAddOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X size={16} />
              </button>
            </div>

            {quickFormError && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2 text-xs text-rose-300">
                {quickFormError}
              </div>
            )}

            <form onSubmit={handleQuickAddSubmit} className="space-y-3.5">
              {/* Type Direction Selector */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1.5">
                  Transaction Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickType('lent')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold border transition cursor-pointer ${
                      quickType === 'lent'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-xs'
                        : 'bg-[#161616] border-[#262626] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>I Lent (They owe me)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickType('borrowed')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold border transition cursor-pointer ${
                      quickType === 'borrowed'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-xs'
                        : 'bg-[#161616] border-[#262626] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span>I Borrowed (I owe them)</span>
                  </button>
                </div>
              </div>

              {/* Friend Name & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Friend Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

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
                      value={quickAmount}
                      onChange={(e) => setQuickAmount(e.target.value)}
                      className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] pl-8 pr-3 py-2 text-xs font-mono font-bold text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Phone & Expected Return Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Phone / WhatsApp (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Expected Return Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={quickDueDate}
                    onChange={(e) => setQuickDueDate(e.target.value)}
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs text-gray-200 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Purpose / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Concert tickets, Weekend dinner split"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1a1a1a] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition cursor-pointer"
                >
                  Save Loan Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
