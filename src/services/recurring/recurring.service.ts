import {
  Transaction,
  RecurringSchedule,
  RecurringProjectedOccurrence,
  RecurringMonthSummary,
  RecurringCategoryType,
  PaymentMethod,
  TransactionType,
} from '../../types';
import { storageService, NOTIFY_EVENT } from '../storage/storage.service';
import { getCurrentMonth } from '../../utils/formatters';

const getTodayIso = () => new Date().toISOString().slice(0, 10);

class RecurringTransactionService {
  /**
   * Returns all stored recurring schedules.
   */
  getSchedules(): RecurringSchedule[] {
    return storageService.getRecurringSchedules();
  }

  /**
   * Saves or updates a recurring schedule.
   */
  saveSchedule(schedule: RecurringSchedule): void {
    storageService.saveRecurringSchedule(schedule);
  }

  /**
   * Deletes a recurring schedule.
   */
  deleteSchedule(id: string): void {
    storageService.deleteRecurringSchedule(id);
  }

  /**
   * Toggles active/paused status of a schedule.
   */
  toggleStatus(id: string, status?: 'active' | 'paused' | 'completed'): void {
    storageService.toggleRecurringScheduleStatus(id, status);
  }

  /**
   * Synchronizes active subscriptions & EMI loans into recurring schedules
   * if they are not already tracked.
   */
  syncFromSubscriptionsAndEMIs(): { addedCount: number } {
    const existing = this.getSchedules();
    const subs = storageService.getSubscriptions();
    const emis = storageService.getEMILoans();
    let addedCount = 0;

    // Sync subscriptions
    for (const sub of subs) {
      const alreadyExists = existing.some(
        (s) => s.sourceRefId === sub.id || s.name.toLowerCase() === sub.name.toLowerCase()
      );
      if (!alreadyExists) {
        // Derive day of month from nextBillingDate or default to 10
        let dayOfMonth = 10;
        if (sub.nextBillingDate) {
          const parsed = parseInt(sub.nextBillingDate.split('-')[2], 10);
          if (!isNaN(parsed)) dayOfMonth = parsed;
        }

        const newSchedule: RecurringSchedule = {
          id: `rec_sync_sub_${sub.id}`,
          name: sub.name,
          amount: sub.amount,
          type: 'expense',
          categoryId: sub.categoryId || 'subscriptions',
          recurringType: 'subscription',
          frequency: (sub.billingCycle as any) || 'monthly',
          dayOfMonth: Math.min(Math.max(1, dayOfMonth), 28),
          startDate: '2024-01-01',
          paymentMethod: sub.paymentMethod || 'Credit Card',
          autoInject: true,
          status: sub.status === 'active' ? 'active' : 'paused',
          tags: ['subscription', 'auto-synced'],
          notes: sub.notes,
          sourceRefId: sub.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        existing.push(newSchedule);
        addedCount++;
      }
    }

    // Sync EMI Loans
    for (const emi of emis) {
      const alreadyExists = existing.some(
        (s) => s.sourceRefId === emi.id || s.name.toLowerCase() === emi.name.toLowerCase()
      );
      if (!alreadyExists) {
        let dayOfMonth = 5;
        if (emi.nextDueDate) {
          const parsed = parseInt(emi.nextDueDate.split('-')[2], 10);
          if (!isNaN(parsed)) dayOfMonth = parsed;
        }

        const newSchedule: RecurringSchedule = {
          id: `rec_sync_emi_${emi.id}`,
          name: `${emi.name} EMI`,
          amount: emi.emiAmount,
          type: 'loan_emi',
          categoryId: 'loan_emi',
          recurringType: 'emi',
          frequency: 'monthly',
          dayOfMonth: Math.min(Math.max(1, dayOfMonth), 28),
          startDate: emi.startDate || '2024-01-01',
          paymentMethod: 'Net Banking',
          autoInject: true,
          status: 'active',
          tags: ['loan-emi', 'auto-synced'],
          notes: `Monthly EMI for ${emi.lender}`,
          sourceRefId: emi.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        existing.push(newSchedule);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      storageService.saveRecurringSchedules(existing);
    }

    return { addedCount };
  }

  /**
   * Calculates all scheduled occurrences for a given month (e.g., '2026-08')
   * and matches them against existing transactions in the ledger.
   */
  computeMonthOccurrences(
    monthStr: string,
    currentDateStr: string = getTodayIso()
  ): RecurringProjectedOccurrence[] {
    const schedules = this.getSchedules();
    const transactions = storageService.getTransactions();

    // Parse year and month
    const effectiveMonth = monthStr === 'all' || !monthStr ? getCurrentMonth() : monthStr;
    const [yearPart, monthPart] = effectiveMonth.split('-');
    const year = parseInt(yearPart, 10);
    const month = parseInt(monthPart, 10); // 1-indexed

    // Days in this month
    const daysInMonth = new Date(year, month, 0).getDate();

    const occurrences: RecurringProjectedOccurrence[] = [];

    // Filter transactions that belong to this target month
    const monthTxs = transactions.filter((t) => t.date.startsWith(`${yearPart}-${monthPart}`));

    for (const schedule of schedules) {
      // Validate active date range
      const scheduleMonthDay = Math.min(schedule.dayOfMonth || 1, daysInMonth);
      const dayStr = String(scheduleMonthDay).padStart(2, '0');
      const occurrenceDate = `${yearPart}-${monthPart}-${dayStr}`;

      if (schedule.startDate && occurrenceDate < schedule.startDate.slice(0, 10)) {
        continue;
      }
      if (schedule.endDate && occurrenceDate > schedule.endDate.slice(0, 10)) {
        continue;
      }

      // Check quarterly or yearly frequency filtering
      if (schedule.frequency === 'quarterly') {
        const startMonth = schedule.startDate ? parseInt(schedule.startDate.split('-')[1], 10) : 1;
        const diffMonths = Math.abs(month - startMonth);
        if (diffMonths % 3 !== 0) continue;
      } else if (schedule.frequency === 'yearly') {
        const startMonth = schedule.startDate ? parseInt(schedule.startDate.split('-')[1], 10) : 1;
        if (month !== startMonth) continue;
      }

      // Find if an actual transaction already matches this recurring item in this month
      const matchedTx = monthTxs.find((tx) => {
        // Direct reference match
        if (tx.id.includes(schedule.id)) return true;

        // Anomaly / refund transactions should not match
        if (tx.type === 'refund') return false;

        // Check if types match or are compatible
        const typeMatch =
          tx.type === schedule.type ||
          (schedule.type === 'expense' && tx.type === 'loan_emi') ||
          (schedule.type === 'loan_emi' && tx.type === 'expense');

        // Check amount match (within small rounding margin)
        const amountMatch = Math.abs(tx.amount - schedule.amount) <= 1.0;

        // Check merchant / name similarity
        const sNorm = schedule.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const mNorm = (tx.merchant || tx.rawDescription || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

        const nameMatch =
          sNorm === mNorm ||
          mNorm.includes(sNorm) ||
          sNorm.includes(mNorm) ||
          (schedule.recurringType === 'rent' && (mNorm.includes('rent') || tx.categoryId === 'rent')) ||
          (schedule.recurringType === 'salary' && (mNorm.includes('salary') || mNorm.includes('payroll') || tx.categoryId === 'salary')) ||
          (schedule.recurringType === 'emi' && (mNorm.includes('emi') || mNorm.includes('loan') || tx.categoryId === 'loan_emi'));

        return typeMatch && amountMatch && nameMatch;
      });

      const isMaterialized = !!matchedTx;
      let status: 'paid' | 'due_today' | 'upcoming' | 'overdue' | 'paused' = 'upcoming';

      if (schedule.status === 'paused') {
        status = 'paused';
      } else if (isMaterialized) {
        status = 'paid';
      } else {
        if (occurrenceDate === currentDateStr) {
          status = 'due_today';
        } else if (occurrenceDate < currentDateStr) {
          status = 'overdue';
        } else {
          status = 'upcoming';
        }
      }

      // Calculate days until due
      const curDateObj = new Date(currentDateStr);
      const occDateObj = new Date(occurrenceDate);
      const diffTime = occDateObj.getTime() - curDateObj.getTime();
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      occurrences.push({
        scheduleId: schedule.id,
        name: schedule.name,
        amount: schedule.amount,
        type: schedule.type,
        categoryId: schedule.categoryId,
        recurringType: schedule.recurringType,
        frequency: schedule.frequency,
        date: occurrenceDate,
        paymentMethod: schedule.paymentMethod,
        isMaterialized,
        materializedTransactionId: matchedTx?.id,
        status,
        daysUntilDue,
        autoInject: schedule.autoInject,
      });
    }

    // Sort chronologically by day of month
    return occurrences.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Generates summary metrics for recurring commitments in a given month.
   */
  getRecurringMonthSummary(
    monthStr: string,
    currentDateStr: string = getTodayIso()
  ): RecurringMonthSummary {
    const occurrences = this.computeMonthOccurrences(monthStr, currentDateStr);

    let totalRecurringExpenses = 0;
    let totalInjectedOrPaid = 0;
    let totalPendingUpcoming = 0;
    let totalRecurringIncome = 0;

    const breakdownByType: Record<RecurringCategoryType, number> = {
      rent: 0,
      subscription: 0,
      emi: 0,
      utility: 0,
      salary: 0,
      investment: 0,
      insurance: 0,
      custom: 0,
    };

    let activeCount = 0;
    let settledCount = 0;
    let pendingCount = 0;

    for (const occ of occurrences) {
      if (occ.status === 'paused') continue;

      if (occ.type === 'income') {
        totalRecurringIncome += occ.amount;
        breakdownByType[occ.recurringType] =
          (breakdownByType[occ.recurringType] || 0) + occ.amount;
      } else {
        // Expenses, EMIs, Investments
        totalRecurringExpenses += occ.amount;
        breakdownByType[occ.recurringType] =
          (breakdownByType[occ.recurringType] || 0) + occ.amount;
        activeCount++;

        if (occ.isMaterialized || occ.status === 'paid') {
          totalInjectedOrPaid += occ.amount;
          settledCount++;
        } else {
          totalPendingUpcoming += occ.amount;
          pendingCount++;
        }
      }
    }

    return {
      monthStr,
      totalRecurringExpenses,
      totalInjectedOrPaid,
      totalPendingUpcoming,
      totalRecurringIncome,
      items: occurrences,
      activeCount,
      settledCount,
      pendingCount,
      breakdownByType,
    };
  }

  /**
   * Automatically injects due recurring transactions into the ledger for a target date/month.
   * Only active schedules with autoInject = true and whose scheduled date <= targetDate
   * and NOT already present in transactions will be injected.
   */
  autoInjectDueTransactions(
    targetDateStr: string = getTodayIso()
  ): {
    injectedCount: number;
    injectedTransactions: Transaction[];
    totalInjectedAmount: number;
  } {
    const monthStr = targetDateStr.slice(0, 7); // 'YYYY-MM'
    const occurrences = this.computeMonthOccurrences(monthStr, targetDateStr);
    const existingTransactions = storageService.getTransactions();
    const schedules = this.getSchedules();

    const injectedTransactions: Transaction[] = [];
    let totalInjectedAmount = 0;

    for (const occ of occurrences) {
      // Must be due or due today (date <= targetDateStr), active, autoInject = true, and not already materialized
      if (
        occ.autoInject &&
        occ.status !== 'paused' &&
        !occ.isMaterialized &&
        occ.date <= targetDateStr
      ) {
        const schedule = schedules.find((s) => s.id === occ.scheduleId);
        if (!schedule) continue;

        const newTx: Transaction = {
          id: `tx_rec_${schedule.id}_${occ.date.replace(/-/g, '')}`,
          userId: 'usr_main_demo',
          amount: occ.amount,
          type: occ.type,
          merchant: occ.name,
          categoryId: occ.categoryId,
          date: occ.date,
          paymentMethod: occ.paymentMethod,
          source: 'manual',
          confidenceScore: 100,
          isRecurring: true,
          tags: ['recurring', schedule.recurringType, 'auto-injected', ...schedule.tags],
          notes: schedule.notes
            ? `${schedule.notes} (Scheduled Auto-Debit)`
            : `Scheduled ${schedule.recurringType} payment auto-injected on ${occ.date}`,
          rawDescription: `SCHEDULED_AUTO_DEBIT / ${schedule.name.toUpperCase()} / ${occ.date}`,
          createdAt: `${occ.date}T09:00:00Z`,
          updatedAt: new Date().toISOString(),
        };

        injectedTransactions.push(newTx);
        totalInjectedAmount += occ.amount;

        // Update schedule lastInjectedDate
        schedule.lastInjectedDate = occ.date;
        schedule.updatedAt = new Date().toISOString();
      }
    }

    if (injectedTransactions.length > 0) {
      // Prepend or add new transactions
      const updatedList = [...injectedTransactions, ...existingTransactions];
      storageService.saveAllTransactions(updatedList);
      storageService.saveRecurringSchedules(schedules);
    }

    return {
      injectedCount: injectedTransactions.length,
      injectedTransactions,
      totalInjectedAmount,
    };
  }

  /**
   * Manually forces the injection of a specific scheduled occurrence into the ledger.
   */
  injectSingleOccurrence(scheduleId: string, dateStr: string): Transaction | null {
    const schedules = this.getSchedules();
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return null;

    const existingTransactions = storageService.getTransactions();

    const newTx: Transaction = {
      id: `tx_rec_${schedule.id}_${dateStr.replace(/-/g, '')}_${Date.now()}`,
      userId: 'usr_main_demo',
      amount: schedule.amount,
      type: schedule.type,
      merchant: schedule.name,
      categoryId: schedule.categoryId,
      date: dateStr,
      paymentMethod: schedule.paymentMethod,
      source: 'manual',
      confidenceScore: 100,
      isRecurring: true,
      tags: ['recurring', schedule.recurringType, 'manual-injected', ...schedule.tags],
      notes: schedule.notes
        ? `${schedule.notes} (Manual Recurring Injection)`
        : `Manual recurring ${schedule.recurringType} payment injected for ${dateStr}`,
      rawDescription: `MANUAL_RECURRING_INJECT / ${schedule.name.toUpperCase()} / ${dateStr}`,
      createdAt: `${dateStr}T10:00:00Z`,
      updatedAt: new Date().toISOString(),
    };

    const updatedList = [newTx, ...existingTransactions];
    storageService.saveAllTransactions(updatedList);

    schedule.lastInjectedDate = dateStr;
    schedule.updatedAt = new Date().toISOString();
    storageService.saveRecurringSchedule(schedule);

    return newTx;
  }
}

export const recurringService = new RecurringTransactionService();
