import { EMILoan, Transaction, NotificationItem } from '../../types';
import { storageService, NOTIFY_EVENT } from '../storage/storage.service';

export interface EmiAlertConfig {
  enabled: boolean;
  remindDaysBefore: number; // e.g. 1, 3, 5, 7
  remindOnDueDate: boolean;
  overdueReminders: boolean;
  snoozedUntil: Record<string, string>; // loanId -> ISO timestamp
}

export type EmiDeadlineStatus =
  | 'paid'
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'upcoming'
  | 'scheduled';

export interface LoanDeadlineAnalysis {
  loan: EMILoan;
  status: EmiDeadlineStatus;
  dueDate: string; // YYYY-MM-DD
  daysRemaining: number; // negative if overdue
  isPaidThisCycle: boolean;
  paidTransaction?: Transaction;
  historicalPaymentsCount: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  typicalPaymentDay: number;
  isSnoozed: boolean;
  snoozedUntilDate?: string;
}

export interface UnlinkedEmiDetection {
  merchant: string;
  estimatedAmount: number;
  occurrences: number;
  dates: string[];
  dayOfMonth: number;
  sampleTransactionId: string;
}

export interface EmiDeadlineSummary {
  analyses: LoanDeadlineAnalysis[];
  unlinkedDetections: UnlinkedEmiDetection[];
  totalActiveLoans: number;
  totalMonthlyCommitment: number;
  dueThisMonthAmount: number;
  paidThisMonthAmount: number;
  overdueCount: number;
  dueSoonCount: number;
  paidCount: number;
  nextUrgentDeadline?: {
    loanName: string;
    dueDate: string;
    daysRemaining: number;
    amount: number;
  };
}

const STORAGE_KEY_EMI_CONFIG = 'ais_spend_emi_alerts_config_v1';

export const DEFAULT_EMI_ALERT_CONFIG: EmiAlertConfig = {
  enabled: true,
  remindDaysBefore: 3,
  remindOnDueDate: true,
  overdueReminders: true,
  snoozedUntil: {},
};

class EmiDeadlineService {
  getConfig(): EmiAlertConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEY_EMI_CONFIG);
      if (data) {
        return { ...DEFAULT_EMI_ALERT_CONFIG, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn('Failed to parse EMI alert config', e);
    }
    return { ...DEFAULT_EMI_ALERT_CONFIG };
  }

  saveConfig(config: EmiAlertConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY_EMI_CONFIG, JSON.stringify(config));
      window.dispatchEvent(new CustomEvent(NOTIFY_EVENT));
    } catch (e) {
      console.warn('Failed to save EMI alert config', e);
    }
  }

  snoozeLoanAlert(loanId: string, hours = 24): void {
    const config = this.getConfig();
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    config.snoozedUntil = {
      ...(config.snoozedUntil || {}),
      [loanId]: until,
    };
    this.saveConfig(config);
  }

  unsnoozeLoanAlert(loanId: string): void {
    const config = this.getConfig();
    if (config.snoozedUntil && config.snoozedUntil[loanId]) {
      delete config.snoozedUntil[loanId];
      this.saveConfig(config);
    }
  }

  /**
   * Analyzes all loans against historical transactions and computes deadlines,
   * payment statuses, and recurrence patterns.
   */
  analyzeDeadlines(
    loans: EMILoan[],
    transactions: Transaction[],
    config: EmiAlertConfig = this.getConfig()
  ): EmiDeadlineSummary {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const currentYear = today.getFullYear();
    const currentMonthNum = today.getMonth() + 1; // 1-12
    const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

    const analyses: LoanDeadlineAnalysis[] = [];
    const matchedTxIds = new Set<string>();

    for (const loan of loans) {
      // 1. Find all past transactions matching this loan
      const matchingTxs = transactions.filter((tx) => {
        const isEmiType = tx.type === 'loan_emi' || tx.categoryId === 'loans' || tx.categoryId === 'loan_emi';
        const notes = (tx.notes || '').toLowerCase();
        const merchant = (tx.merchant || '').toLowerCase();
        const loanName = loan.name.toLowerCase();
        const lender = loan.lender.toLowerCase();

        const nameMatch =
          merchant.includes(loanName) ||
          merchant.includes(lender) ||
          notes.includes(loanName) ||
          notes.includes(lender) ||
          (loan.accountNumber && (merchant.includes(loan.accountNumber) || notes.includes(loan.accountNumber)));

        const amountMatch =
          isEmiType &&
          loan.emiAmount > 0 &&
          Math.abs(tx.amount - loan.emiAmount) / loan.emiAmount <= 0.15; // 15% tolerance

        return (nameMatch && (isEmiType || tx.type === 'expense')) || amountMatch;
      });

      // Mark matched transactions
      matchingTxs.forEach((tx) => matchedTxIds.add(tx.id));

      // Sort matching transactions descending by date
      matchingTxs.sort((a, b) => b.date.localeCompare(a.date));

      const historicalPaymentsCount = matchingTxs.length;
      const lastTx = matchingTxs[0];
      const lastPaymentDate = lastTx?.date;
      const lastPaymentAmount = lastTx?.amount;

      // Calculate typical payment day of the month from past transactions
      let typicalPaymentDay = 5;
      if (matchingTxs.length > 0) {
        const days = matchingTxs.map((t) => {
          const parts = t.date.split('-');
          return parseInt(parts[2], 10) || 5;
        });
        const sum = days.reduce((a, b) => a + b, 0);
        typicalPaymentDay = Math.round(sum / days.length);
      } else if (loan.nextDueDate) {
        const parts = loan.nextDueDate.split('-');
        typicalPaymentDay = parseInt(parts[2], 10) || 5;
      }

      // Check if current month cycle has already been paid or loan is resolved
      const paidThisCycleTx = matchingTxs.find((tx) => tx.date.startsWith(currentMonthStr));
      const isPaidThisCycle = Boolean(paidThisCycleTx) || loan.remainingAmount <= 0 || loan.status === 'resolved';

      // Determine due date for this cycle
      let dueDate: string;
      if (loan.nextDueDate && loan.nextDueDate.startsWith(currentMonthStr)) {
        dueDate = loan.nextDueDate;
      } else {
        const safeDay = Math.min(Math.max(1, typicalPaymentDay), 28);
        dueDate = `${currentMonthStr}-${String(safeDay).padStart(2, '0')}`;
      }

      // Calculate days remaining
      const dueDateObj = new Date(`${dueDate}T00:00:00`);
      const todayDateObj = new Date(`${todayIso}T00:00:00`);
      const diffMs = dueDateObj.getTime() - todayDateObj.getTime();
      const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Check snooze status
      const snoozedUntilStr = config.snoozedUntil?.[loan.id];
      const isSnoozed = Boolean(snoozedUntilStr && new Date(snoozedUntilStr) > today);

      // Determine status
      let status: EmiDeadlineStatus;
      if (isPaidThisCycle) {
        status = 'paid';
      } else if (daysRemaining < 0) {
        status = 'overdue';
      } else if (daysRemaining === 0) {
        status = 'due_today';
      } else if (daysRemaining <= 3) {
        status = 'due_soon';
      } else if (daysRemaining <= 7) {
        status = 'upcoming';
      } else {
        status = 'scheduled';
      }

      analyses.push({
        loan,
        status,
        dueDate,
        daysRemaining,
        isPaidThisCycle,
        paidTransaction: paidThisCycleTx,
        historicalPaymentsCount,
        lastPaymentDate,
        lastPaymentAmount,
        typicalPaymentDay,
        isSnoozed,
        snoozedUntilDate: isSnoozed ? snoozedUntilStr : undefined,
      });
    }

    // Sort analyses: overdue first, then due_today, due_soon, upcoming, scheduled, paid last
    const statusPriority: Record<EmiDeadlineStatus, number> = {
      overdue: 0,
      due_today: 1,
      due_soon: 2,
      upcoming: 3,
      scheduled: 4,
      paid: 5,
    };

    analyses.sort((a, b) => {
      const pDiff = statusPriority[a.status] - statusPriority[b.status];
      if (pDiff !== 0) return pDiff;
      return a.daysRemaining - b.daysRemaining;
    });

    // 2. Detect unlinked recurring EMI payments in transaction history
    const unlinkedMap = new Map<string, { amounts: number[]; dates: string[]; sampleId: string }>();

    transactions.forEach((tx) => {
      if (matchedTxIds.has(tx.id)) return;
      const isEmi =
        tx.type === 'loan_emi' ||
        tx.categoryId === 'loans' ||
        tx.categoryId === 'loan_emi' ||
        /emi|loan|instalment|mortgage/i.test(tx.notes || '') ||
        /emi|loan|finance|bajaj|capital/i.test(tx.merchant || '');

      if (isEmi && tx.amount >= 500) {
        const key = tx.merchant.trim().toLowerCase();
        const existing = unlinkedMap.get(key) || { amounts: [], dates: [], sampleId: tx.id };
        existing.amounts.push(tx.amount);
        existing.dates.push(tx.date);
        unlinkedMap.set(key, existing);
      }
    });

    const unlinkedDetections: UnlinkedEmiDetection[] = [];
    unlinkedMap.forEach((data, key) => {
      if (data.dates.length >= 2) {
        const avgAmt = Math.round(data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length);
        const dayOfMonth = parseInt(data.dates[0].split('-')[2], 10) || 5;
        // Capitalize merchant
        const merchantFormatted = key.charAt(0).toUpperCase() + key.slice(1);
        unlinkedDetections.push({
          merchant: merchantFormatted,
          estimatedAmount: avgAmt,
          occurrences: data.dates.length,
          dates: data.dates.sort().reverse(),
          dayOfMonth,
          sampleTransactionId: data.sampleId,
        });
      }
    });

    // Aggregate metrics
    let dueThisMonthAmount = 0;
    let paidThisMonthAmount = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;
    let paidCount = 0;

    analyses.forEach((a) => {
      if (a.isPaidThisCycle) {
        paidCount++;
        paidThisMonthAmount += a.loan.emiAmount;
      } else {
        dueThisMonthAmount += a.loan.emiAmount;
        if (a.status === 'overdue') overdueCount++;
        if (a.status === 'due_today' || a.status === 'due_soon') dueSoonCount++;
      }
    });

    const urgentList = analyses.filter((a) => !a.isPaidThisCycle && (a.status === 'overdue' || a.status === 'due_today' || a.status === 'due_soon'));
    const nextUrgent = urgentList[0];

    const nextUrgentDeadline = nextUrgent
      ? {
          loanName: nextUrgent.loan.name,
          dueDate: nextUrgent.dueDate,
          daysRemaining: nextUrgent.daysRemaining,
          amount: nextUrgent.loan.emiAmount,
        }
      : undefined;

    return {
      analyses,
      unlinkedDetections,
      totalActiveLoans: loans.length,
      totalMonthlyCommitment: loans.reduce((sum, l) => sum + l.emiAmount, 0),
      dueThisMonthAmount,
      paidThisMonthAmount,
      overdueCount,
      dueSoonCount,
      paidCount,
      nextUrgentDeadline,
    };
  }

  /**
   * Generates in-app system notification items in storageService if deadlines are approaching.
   */
  syncNotificationsWithStorage(summary: EmiDeadlineSummary, currencySymbol = '₹'): void {
    const config = this.getConfig();
    if (!config.enabled) return;

    const existingNotifs = storageService.getNotifications();
    const todayIso = new Date().toISOString().slice(0, 10);
    const monthKey = todayIso.slice(0, 7);

    summary.analyses.forEach((analysis) => {
      if (analysis.isPaidThisCycle || analysis.isSnoozed) return;

      const shouldAlert =
        (analysis.status === 'overdue' && config.overdueReminders) ||
        (analysis.status === 'due_today' && config.remindOnDueDate) ||
        (analysis.daysRemaining <= config.remindDaysBefore && analysis.daysRemaining >= 0);

      if (shouldAlert) {
        const notifId = `notif_emi_${analysis.loan.id}_${monthKey}`;
        const alreadyExists = existingNotifs.some((n) => n.id === notifId);

        if (!alreadyExists) {
          let title = `EMI Deadline Reminder: ${analysis.loan.name}`;
          let message = `Your monthly EMI of ${currencySymbol}${analysis.loan.emiAmount.toLocaleString('en-IN')} for ${analysis.loan.lender} is due on ${analysis.dueDate}.`;

          if (analysis.status === 'overdue') {
            title = `⚠️ Overdue Loan EMI: ${analysis.loan.name}`;
            message = `Urgent: EMI of ${currencySymbol}${analysis.loan.emiAmount.toLocaleString('en-IN')} was due on ${analysis.dueDate} (${Math.abs(analysis.daysRemaining)} days ago). Avoid late payment fee.`;
          } else if (analysis.status === 'due_today') {
            title = `🔔 EMI Due Today: ${analysis.loan.name}`;
            message = `Your EMI of ${currencySymbol}${analysis.loan.emiAmount.toLocaleString('en-IN')} for ${analysis.loan.lender} is due today! Ensure sufficient bank balance.`;
          }

          const notif: NotificationItem = {
            id: notifId,
            title,
            message,
            type: 'emi_due',
            date: todayIso,
            read: false,
            actionUrl: 'debt',
            overAmount: analysis.loan.emiAmount,
          };

          storageService.addNotification(notif);
        }
      }
    });
  }

  /**
   * Records payment of an EMI:
   * 1. Creates transaction in ledger
   * 2. Decrements loan remaining amount and increments paidMonths
   * 3. Advances nextDueDate by 1 month
   */
  recordEmiPayment(
    loan: EMILoan,
    customAmount?: number,
    customDate?: string,
    notes?: string
  ): { transaction: Transaction; updatedLoan: EMILoan } {
    const today = new Date();
    const payDate = customDate || today.toISOString().slice(0, 10);
    const amount = customAmount !== undefined && customAmount > 0 ? customAmount : loan.emiAmount;

    // Create transaction
    const txId = `tx_emi_${loan.id}_${Date.now()}`;
    const tx: Transaction = {
      id: txId,
      userId: storageService.isDemoUser() ? 'usr_main_demo' : (storageService.getUserProfile()?.id || 'usr_authenticated'),
      amount,
      type: 'loan_emi',
      merchant: `${loan.lender} - ${loan.name}`,
      categoryId: 'loans',
      date: payDate,
      paymentMethod: 'Net Banking',
      source: 'manual',
      tags: ['loan_emi', 'debt-repayment', loan.type || 'Loan'],
      notes: notes || `Monthly EMI installment for ${loan.name} (${loan.lender})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storageService.saveTransaction(tx);

    // Update loan
    const newRemaining = Math.max(0, loan.remainingAmount - amount);
    const newPaidMonths = (loan.paidMonths || 0) + 1;

    // Advance next due date to next month
    let nextDueDate = loan.nextDueDate;
    if (nextDueDate) {
      const d = new Date(nextDueDate);
      d.setMonth(d.getMonth() + 1);
      nextDueDate = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(payDate);
      d.setMonth(d.getMonth() + 1);
      nextDueDate = d.toISOString().slice(0, 10);
    }

    const updatedLoan: EMILoan = {
      ...loan,
      remainingAmount: newRemaining,
      paidMonths: newPaidMonths,
      nextDueDate,
    };

    storageService.saveEMILoan(updatedLoan);

    // Mark any existing EMI notification as read
    const monthKey = payDate.slice(0, 7);
    const notifId = `notif_emi_${loan.id}_${monthKey}`;
    storageService.markNotificationRead(notifId);

    window.dispatchEvent(new CustomEvent(NOTIFY_EVENT));

    return { transaction: tx, updatedLoan };
  }

  /**
   * Generates a pre-filled WhatsApp alert text for the user
   */
  generateWhatsAppReminder(analysis: LoanDeadlineAnalysis, currencySymbol = '₹'): string {
    const { loan, dueDate, daysRemaining, status } = analysis;
    let urgency = 'Due Soon';
    if (status === 'overdue') urgency = 'OVERDUE ⚠️';
    if (status === 'due_today') urgency = 'DUE TODAY 🚨';

    const text = `🔔 *EMI Repayment Reminder* [${urgency}]\n\n` +
      `📌 *Loan:* ${loan.name}\n` +
      `🏦 *Bank / Lender:* ${loan.lender}\n` +
      `💰 *EMI Amount:* ${currencySymbol}${loan.emiAmount.toLocaleString('en-IN')}\n` +
      `📅 *Deadline:* ${dueDate} (${daysRemaining < 0 ? `${Math.abs(daysRemaining)} days overdue` : daysRemaining === 0 ? 'Today' : `in ${daysRemaining} days`})\n` +
      `💳 *Pending Principal:* ${currencySymbol}${loan.remainingAmount.toLocaleString('en-IN')}\n\n` +
      `_Keep your bank account funded to avoid bounce charges and maintain a healthy credit score!_`;

    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }
}

export const emiDeadlineService = new EmiDeadlineService();
