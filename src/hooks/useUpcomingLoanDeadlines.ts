import { useState, useEffect, useCallback } from 'react';
import { EMILoan } from '../types';
import { storageService, NOTIFY_EVENT } from '../services/storage/storage.service';
import { emiDeadlineService, LoanDeadlineAnalysis } from '../services/debt/emiDeadlineService';

export interface UpcomingLoanDeadlineInfo {
  loan: EMILoan;
  daysRemaining: number;
  dueDate: string;
  isUrgent: boolean; // due within 3 days (daysRemaining <= 3 and active)
  isDueWithin3Days: boolean; // 0 <= daysRemaining <= 3
  isOverdue: boolean; // daysRemaining < 0
  status: 'paid' | 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'scheduled';
  amount: number;
  lender: string;
}

export interface UseUpcomingLoanDeadlinesResult {
  hasUrgentDeadlines: boolean;
  urgentLoans: UpcomingLoanDeadlineInfo[];
  allDeadlines: UpcomingLoanDeadlineInfo[];
  urgentCount: number;
  closestUrgent: UpcomingLoanDeadlineInfo | null;
  refresh: () => void;
}

/**
 * Custom hook to monitor upcoming loan repayment deadlines.
 * Checks for loans that have a payment due within 3 days (or overdue)
 * and provides live updates whenever transactions or loans change.
 */
export function useUpcomingLoanDeadlines(): UseUpcomingLoanDeadlinesResult {
  const [result, setResult] = useState<Omit<UseUpcomingLoanDeadlinesResult, 'refresh'>>(() => {
    return computeLoanDeadlines();
  });

  const checkDeadlines = useCallback(() => {
    const computed = computeLoanDeadlines();
    setResult(computed);
  }, []);

  useEffect(() => {
    checkDeadlines();

    // Listen to storage notifications (e.g. loan payment, new loan, settle debt)
    window.addEventListener(NOTIFY_EVENT, checkDeadlines);
    window.addEventListener('storage', checkDeadlines);

    // Also periodic poll every 60 seconds to catch date changes
    const timer = setInterval(checkDeadlines, 60000);

    return () => {
      window.removeEventListener(NOTIFY_EVENT, checkDeadlines);
      window.removeEventListener('storage', checkDeadlines);
      clearInterval(timer);
    };
  }, [checkDeadlines]);

  return {
    ...result,
    refresh: checkDeadlines,
  };
}

/**
 * Helper to compute loan deadlines from storageService
 */
function computeLoanDeadlines(): Omit<UseUpcomingLoanDeadlinesResult, 'refresh'> {
  try {
    const loans = storageService.getEMILoans();
    const transactions = storageService.getTransactions();

    if (!loans || loans.length === 0) {
      return {
        hasUrgentDeadlines: false,
        urgentLoans: [],
        allDeadlines: [],
        urgentCount: 0,
        closestUrgent: null,
      };
    }

    const summary = emiDeadlineService.analyzeDeadlines(loans, transactions);
    const allDeadlines: UpcomingLoanDeadlineInfo[] = summary.analyses.map((analysis) => {
      const isResolved = analysis.loan.status === 'resolved' || analysis.loan.remainingAmount <= 0;
      const isPaid = analysis.isPaidThisCycle || isResolved;
      const days = analysis.daysRemaining;

      const isDueWithin3Days = !isPaid && days >= 0 && days <= 3;
      const isOverdue = !isPaid && days < 0;
      const isUrgent = !isPaid && (isDueWithin3Days || isOverdue);

      return {
        loan: analysis.loan,
        daysRemaining: days,
        dueDate: analysis.dueDate,
        isUrgent,
        isDueWithin3Days,
        isOverdue,
        status: isPaid ? 'paid' : analysis.status,
        amount: analysis.loan.emiAmount,
        lender: analysis.loan.lender,
      };
    });

    // Urgent loans: active loans with payment due within 3 days (or overdue)
    const urgentLoans = allDeadlines.filter((item) => item.isUrgent);

    // Sort by daysRemaining ascending (most urgent first)
    urgentLoans.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const closestUrgent = urgentLoans.length > 0 ? urgentLoans[0] : null;

    return {
      hasUrgentDeadlines: urgentLoans.length > 0,
      urgentLoans,
      allDeadlines,
      urgentCount: urgentLoans.length,
      closestUrgent,
    };
  } catch (err) {
    console.warn('Failed to compute loan deadlines:', err);
    return {
      hasUrgentDeadlines: false,
      urgentLoans: [],
      allDeadlines: [],
      urgentCount: 0,
      closestUrgent: null,
    };
  }
}
