import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Bell,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Info,
  Landmark,
  MessageSquare,
  Plus,
  RotateCcw,
  Settings,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { EMILoan, Transaction } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import {
  emiDeadlineService,
  EmiDeadlineSummary,
  LoanDeadlineAnalysis,
  EmiAlertConfig,
  UnlinkedEmiDetection,
} from '../../services/debt/emiDeadlineService';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface EmiDeadlineAlertsSectionProps {
  currencySymbol: string;
  onOpenAddLoan?: () => void;
  onSelectLoanForSimulator?: (loanId: string) => void;
}

export const EmiDeadlineAlertsSection: React.FC<EmiDeadlineAlertsSectionProps> = ({
  currencySymbol,
  onOpenAddLoan,
  onSelectLoanForSimulator,
}) => {
  const [loans, setLoans] = useState<EMILoan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [config, setConfig] = useState<EmiAlertConfig>(() => emiDeadlineService.getConfig());
  const [summary, setSummary] = useState<EmiDeadlineSummary | null>(null);

  const [activeFilter, setActiveFilter] = useState<'action_required' | 'all' | 'paid' | 'unlinked'>('action_required');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [payingLoan, setPayingLoan] = useState<EMILoan | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState<string>('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const loadData = () => {
    const l = storageService.getEMILoans();
    const t = storageService.getTransactions();
    const cfg = emiDeadlineService.getConfig();
    setLoans(l);
    setTransactions(t);
    setConfig(cfg);

    const calculatedSummary = emiDeadlineService.analyzeDeadlines(l, t, cfg);
    setSummary(calculatedSummary);

    // Sync in-app notification alerts
    emiDeadlineService.syncNotificationsWithStorage(calculatedSummary, currencySymbol);
  };

  useEffect(() => {
    loadData();
    window.addEventListener(NOTIFY_EVENT, loadData);
    return () => window.removeEventListener(NOTIFY_EVENT, loadData);
  }, [currencySymbol]);

  if (!summary) return null;

  const handleToggleRecurringAlerts = () => {
    const updated = { ...config, enabled: !config.enabled };
    emiDeadlineService.saveConfig(updated);
    setConfig(updated);
    setFeedbackToast(
      updated.enabled
        ? 'Recurring EMI repayment alerts enabled! You will receive in-app & deadline reminders.'
        : 'Recurring EMI alerts paused.'
    );
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const handleSaveConfig = (newConfig: EmiAlertConfig) => {
    emiDeadlineService.saveConfig(newConfig);
    setConfig(newConfig);
    setIsConfigOpen(false);
    loadData();
    setFeedbackToast('Alert reminder preferences updated successfully!');
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const handleSnooze = (loanId: string, loanName: string) => {
    emiDeadlineService.snoozeLoanAlert(loanId, 24);
    loadData();
    setFeedbackToast(`Snoozed deadline alert for "${loanName}" for 24 hours.`);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const handleOpenPayModal = (loan: EMILoan) => {
    setPayingLoan(loan);
    setPayAmount(loan.emiAmount);
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNotes(`Monthly EMI payment for ${loan.name} (${loan.lender})`);
  };

  const handleConfirmPayment = () => {
    if (!payingLoan || payAmount <= 0) return;
    const { updatedLoan } = emiDeadlineService.recordEmiPayment(
      payingLoan,
      payAmount,
      payDate,
      payNotes
    );
    setPayingLoan(null);
    loadData();
    setFeedbackToast(
      `Recorded EMI installment of ${formatCurrency(
        payAmount,
        currencySymbol
      )} for "${updatedLoan.name}". Remaining principal updated!`
    );
    setTimeout(() => setFeedbackToast(null), 5000);
  };

  // Filter analyses
  const filteredAnalyses = summary.analyses.filter((item) => {
    if (activeFilter === 'action_required') {
      return !item.isPaidThisCycle && (item.status === 'overdue' || item.status === 'due_today' || item.status === 'due_soon' || item.status === 'upcoming');
    }
    if (activeFilter === 'paid') {
      return item.isPaidThisCycle;
    }
    return true; // 'all'
  });

  const urgentCount = summary.overdueCount + summary.dueSoonCount;

  return (
    <div className="rounded-2xl border border-[#262626] bg-[#121212] p-4 sm:p-5 lg:p-6 space-y-5 shadow-xs">
      {/* 1. Header & Configuration Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222] pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BellRing size={16} />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Upcoming EMI & Repayment Deadline Alerts
            </h2>
            <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400 flex items-center gap-1">
              <History size={11} />
              Grounded in Transaction History
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Recurring schedule reminders auto-calculated from your historical debit patterns and loan agreements.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Quick Toggle Recurring Alerts */}
          <button
            type="button"
            onClick={handleToggleRecurringAlerts}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
              config.enabled
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-[#181818] border-[#2c2c2c] text-gray-400 hover:text-gray-200'
            }`}
            title={config.enabled ? 'Recurring reminders are active' : 'Recurring reminders are paused'}
          >
            <Bell size={13} className={config.enabled ? 'text-emerald-400 animate-pulse' : ''} />
            <span>{config.enabled ? 'Reminders Active' : 'Reminders Paused'}</span>
          </button>

          {/* Preferences Settings Button */}
          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#1b1b1b] border border-[#2a2a2a] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#222] transition cursor-pointer"
            title="Configure reminder lead days and notifications"
          >
            <Settings size={13} />
            <span className="hidden sm:inline">Preferences</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs font-semibold text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-emerald-400 hover:text-white text-xs cursor-pointer ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Urgent Attention Banner (If overdue or due soon) */}
      {urgentCount > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm">
                Attention: {urgentCount} Loan EMI{urgentCount > 1 ? 's' : ''} Require Immediate Action
              </div>
              <p className="text-rose-300 mt-0.5">
                {summary.overdueCount > 0
                  ? `${summary.overdueCount} installment is past due date. Settle promptly to prevent ECS/NACH bounce fees.`
                  : `Next repayment is due within 3 days. Ensure sufficient account balance.`}
              </p>
            </div>
          </div>

          {summary.nextUrgentDeadline && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono font-bold text-white text-sm">
                {formatCurrency(summary.nextUrgentDeadline.amount, currencySymbol)}
              </span>
              <button
                onClick={() => {
                  const target = loans.find((l) => l.name === summary.nextUrgentDeadline?.loanName);
                  if (target) handleOpenPayModal(target);
                }}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 text-xs transition cursor-pointer shadow-sm"
              >
                Record Payment
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Metric KPI Cards for Current Cycle */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#222] bg-[#161616] p-3.5 min-w-0">
          <span className="text-[11px] text-gray-400 truncate block">Due This Month</span>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-amber-400 truncate">
            {formatCurrency(summary.dueThisMonthAmount, currencySymbol)}
          </div>
          <div className="mt-0.5 text-[10px] text-gray-500 truncate">
            {loans.length - summary.paidCount} obligations pending
          </div>
        </div>

        <div className="rounded-xl border border-[#222] bg-[#161616] p-3.5 min-w-0">
          <span className="text-[11px] text-gray-400 truncate block">Paid so far (Current Cycle)</span>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-emerald-400 truncate">
            {formatCurrency(summary.paidThisMonthAmount, currencySymbol)}
          </div>
          <div className="mt-0.5 text-[10px] text-emerald-400/80 font-medium truncate">
            {summary.paidCount} of {loans.length} paid ✓
          </div>
        </div>

        <div className="rounded-xl border border-[#222] bg-[#161616] p-3.5 min-w-0">
          <span className="text-[11px] text-gray-400 truncate block">Next Upcoming Deadline</span>
          <div className="mt-1 font-mono text-xs sm:text-sm font-bold text-white truncate">
            {summary.nextUrgentDeadline ? formatDate(summary.nextUrgentDeadline.dueDate) : 'All Settled 🎉'}
          </div>
          <div className="mt-0.5 text-[10px] text-gray-400 truncate">
            {summary.nextUrgentDeadline
              ? `${summary.nextUrgentDeadline.loanName} (${summary.nextUrgentDeadline.daysRemaining < 0 ? `${Math.abs(summary.nextUrgentDeadline.daysRemaining)}d overdue` : summary.nextUrgentDeadline.daysRemaining === 0 ? 'Today' : `in ${summary.nextUrgentDeadline.daysRemaining}d`})`
              : 'No pending EMIs this cycle'}
          </div>
        </div>

        <div className="rounded-xl border border-[#222] bg-[#161616] p-3.5 min-w-0">
          <span className="text-[11px] text-gray-400 truncate block">Repayment Health</span>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-base sm:text-lg font-bold text-emerald-400">
              {loans.length > 0 ? `${Math.round((summary.paidCount / loans.length) * 100)}%` : '100%'}
            </span>
            <span className="text-[10px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5">
              Consistent
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-gray-500 truncate">
            {transactions.filter((t) => t.type === 'loan_emi').length} recorded EMI transactions
          </div>
        </div>
      </div>

      {/* 4. Filter Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-[#222] pb-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full flex-nowrap sm:flex-wrap pb-1">
          <button
            type="button"
            onClick={() => setActiveFilter('action_required')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'action_required'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Action Required</span>
            {urgentCount > 0 && (
              <span className="rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[9px] font-extrabold">
                {urgentCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All Accounts ({summary.analyses.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('paid')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              activeFilter === 'paid'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Paid This Month ({summary.paidCount})</span>
          </button>

          {summary.unlinkedDetections.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('unlinked')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                activeFilter === 'unlinked'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                  : 'text-gray-400 hover:text-purple-300'
              }`}
            >
              <Sparkles size={12} className="text-purple-400" />
              <span>Detected in History ({summary.unlinkedDetections.length})</span>
            </button>
          )}
        </div>

        <span className="text-[11px] text-gray-500 font-mono hidden sm:inline">
          Last analyzed {formatDate(new Date().toISOString().slice(0, 10))}
        </span>
      </div>

      {/* 5. Loans List or Unlinked Detected Items */}
      {activeFilter === 'unlinked' ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-3.5 text-xs text-purple-200">
            <div className="flex items-center gap-2 font-bold text-white mb-1">
              <Sparkles size={15} className="text-purple-400" />
              <span>AI Detected Recurring Loan Deductions from Transaction History</span>
            </div>
            <p className="text-purple-300">
              The following recurring debits match EMI patterns but are not currently tracked as structured loan obligations. Click &quot;Track as Loan&quot; to begin tracking principal payoff and amortization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.unlinkedDetections.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#222] bg-[#161616] p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-white text-xs">{item.merchant}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    ~{formatCurrency(item.estimatedAmount, currencySymbol)} • Around {item.dayOfMonth}th of every month
                  </div>
                  <div className="text-[10px] text-purple-400 mt-1 font-mono">
                    {item.occurrences} historical occurrences identified
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenAddLoan}
                  className="rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Plus size={13} />
                  <span>Track as Loan</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : filteredAnalyses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#262626] bg-[#161616] p-8 text-center">
          <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">No Deadlines in this Category</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            {activeFilter === 'action_required'
              ? 'Awesome job! All active EMI loan payments for the current cycle are settled.'
              : 'No obligations found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAnalyses.map((analysis) => {
            const { loan, status, dueDate, daysRemaining, isPaidThisCycle, paidTransaction, historicalPaymentsCount, typicalPaymentDay } = analysis;

            // Badges & styling per status
            let badgeBg = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
            let badgeText = `Due in ${daysRemaining} days`;
            let borderStyle = 'border-[#222]';

            if (isPaidThisCycle) {
              badgeBg = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
              badgeText = 'Paid for Current Cycle ✓';
            } else if (status === 'overdue') {
              badgeBg = 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold';
              badgeText = `⚠️ Overdue by ${Math.abs(daysRemaining)} Days`;
              borderStyle = 'border-rose-500/40 bg-rose-500/5';
            } else if (status === 'due_today') {
              badgeBg = 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold animate-pulse';
              badgeText = '🚨 Due Today!';
              borderStyle = 'border-amber-500/40 bg-amber-500/5';
            } else if (status === 'due_soon') {
              badgeBg = 'bg-amber-500/15 border-amber-500/30 text-amber-400';
              badgeText = `Due in ${daysRemaining} Days`;
            }

            return (
              <div
                key={loan.id}
                className={`rounded-2xl border ${borderStyle} bg-[#141414] p-4 sm:p-5 flex flex-col justify-between transition hover:border-[#333]`}
              >
                <div>
                  {/* Top Row: Name, Lender & Status Badge */}
                  <div className="flex items-start justify-between gap-3 border-b border-[#1f1f1f] pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold shrink-0 shadow-xs"
                        style={{ backgroundColor: loan.color || '#3B82F6' }}
                      >
                        <Landmark size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{loan.name}</div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <span>{loan.lender}</span>
                          <span>•</span>
                          <span className="font-semibold text-gray-300">
                            {loan.interestRate > 0 ? `${loan.interestRate}% APR` : '0% No-Cost'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${badgeBg}`}>
                      {badgeText}
                    </span>
                  </div>

                  {/* Middle Row: Monthly EMI and Due Date */}
                  <div className="mt-3.5 grid grid-cols-2 gap-3 bg-[#181818] rounded-xl p-3 border border-[#222]">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">
                        Monthly EMI
                      </span>
                      <div className="font-mono text-base font-bold text-blue-400 mt-0.5">
                        {formatCurrency(loan.emiAmount, currencySymbol)}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">
                        Repayment Deadline
                      </span>
                      <div className="text-xs font-semibold text-white mt-0.5 flex items-center gap-1">
                        <Calendar size={12} className="text-gray-400" />
                        <span>{formatDate(dueDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transaction History Insight */}
                  <div className="mt-3 rounded-lg bg-[#181818]/60 p-2.5 border border-[#222] text-[11px] text-gray-300 flex items-start gap-2">
                    <History size={14} className="text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      {isPaidThisCycle ? (
                        <span>
                          <strong className="text-emerald-400">Payment Verified:</strong> Recorded on{' '}
                          {paidTransaction ? formatDate(paidTransaction.date) : 'this month'} (
                          {formatCurrency(paidTransaction?.amount || loan.emiAmount, currencySymbol)}).
                        </span>
                      ) : (
                        <span>
                          <strong className="text-white">Pattern Insight:</strong> Historical debits occur around the{' '}
                          <strong>{typicalPaymentDay}th</strong> of every month. (
                          {historicalPaymentsCount > 0
                            ? `${historicalPaymentsCount} past payments analyzed`
                            : 'First installment'}
                          ).
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Row Actions */}
                <div className="mt-4 pt-3 border-t border-[#1f1f1f] flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {/* WhatsApp Reminder Link */}
                    <a
                      href={emiDeadlineService.generateWhatsAppReminder(analysis, currencySymbol)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20 px-2.5 py-1.5 text-[11px] font-semibold transition"
                      title="Send or copy WhatsApp reminder"
                    >
                      <MessageSquare size={12} />
                      <span className="hidden sm:inline">WhatsApp Alert</span>
                    </a>

                    {/* Snooze 24h */}
                    {!isPaidThisCycle && (
                      <button
                        type="button"
                        onClick={() => handleSnooze(loan.id, loan.name)}
                        className="flex items-center gap-1 rounded-lg bg-[#202020] text-gray-400 hover:text-white px-2.5 py-1.5 text-[11px] transition cursor-pointer"
                        title="Snooze reminder for 24 hours"
                      >
                        <Clock size={12} />
                        <span>Snooze</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onSelectLoanForSimulator && (
                      <button
                        type="button"
                        onClick={() => onSelectLoanForSimulator(loan.id)}
                        className="text-[11px] text-gray-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Simulate Pre-pay</span>
                      </button>
                    )}

                    {!isPaidThisCycle ? (
                      <button
                        type="button"
                        onClick={() => handleOpenPayModal(loan)}
                        className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 transition cursor-pointer shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={13} />
                        <span>Mark as Paid</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        Settled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Record Payment Modal */}
      {payingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-[#141414] p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Record EMI Installment</h3>
                  <p className="text-[11px] text-gray-400">{payingLoan.name} • {payingLoan.lender}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayingLoan(null)}
                className="text-gray-400 hover:text-white cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-gray-300 mb-1">
                  Payment Amount ({currencySymbol}):
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-white font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Scheduled EMI: {formatCurrency(payingLoan.emiAmount, currencySymbol)}
                </span>
              </div>

              <div>
                <label className="block font-medium text-gray-300 mb-1">Payment Date:</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-300 mb-1">Transaction Notes / Reference:</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Auto-debit from HDFC salary account"
                  className="w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-[11px] text-blue-300">
                Recording this will log a &quot;loan_emi&quot; expense transaction, reduce your remaining principal by {formatCurrency(payAmount, currencySymbol)}, and advance the next deadline by 1 month.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222]">
              <button
                type="button"
                onClick={() => setPayingLoan(null)}
                className="rounded-xl bg-[#202020] hover:bg-[#282828] text-gray-300 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-xs font-bold cursor-pointer transition shadow-md shadow-blue-900/30"
              >
                Confirm & Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Configuration Preferences Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-[#141414] p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-gray-400" />
                <h3 className="text-sm font-bold text-white">Alert & Recurring Notification Preferences</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Enable Recurring Reminders</div>
                  <div className="text-[11px] text-gray-400">Send notifications for approaching EMI deadlines</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="h-4 w-4 rounded-sm border-gray-600 bg-[#222] text-blue-600 focus:ring-0 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1.5">
                  Notification Lead Time (Days before due date):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 5, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setConfig({ ...config, remindDaysBefore: days })}
                      className={`rounded-xl py-2 text-xs font-bold border transition cursor-pointer ${
                        config.remindDaysBefore === days
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-400 hover:text-white'
                      }`}
                    >
                      {days} {days === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Remind On Due Date</div>
                  <div className="text-[11px] text-gray-400">Trigger high-priority alert on the exact repayment day</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.remindOnDueDate}
                  onChange={(e) => setConfig({ ...config, remindOnDueDate: e.target.checked })}
                  className="h-4 w-4 rounded-sm border-gray-600 bg-[#222] text-blue-600 focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Overdue Escalation Alerts</div>
                  <div className="text-[11px] text-gray-400">Daily reminder if an installment is past deadline</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.overdueReminders}
                  onChange={(e) => setConfig({ ...config, overdueReminders: e.target.checked })}
                  className="h-4 w-4 rounded-sm border-gray-600 bg-[#222] text-blue-600 focus:ring-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#222]">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="rounded-xl bg-[#202020] hover:bg-[#282828] text-gray-300 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveConfig(config)}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-xs font-bold cursor-pointer transition shadow-md shadow-blue-900/30"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
