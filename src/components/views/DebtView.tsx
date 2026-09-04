import React, { useState, useEffect } from 'react';
import {
  Landmark,
  CreditCard,
  Percent,
  Calendar,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  Sparkles,
  Zap,
  Plus,
  Pencil,
  Trash2,
  Coins,
  Sliders,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  Flame,
  Clock,
  Car,
  Home,
  GraduationCap,
  Briefcase,
  Smartphone,
  HelpCircle,
  ChevronRight,
  Info,
} from 'lucide-react';
import { EMILoan, LoanType } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { DebtEmiModal } from '../modals/DebtEmiModal';
import { PrepaymentModal } from '../modals/PrepaymentModal';
import { ConfirmDeleteDialog } from '../common/ConfirmDeleteDialog';

interface DebtViewProps {
  currencySymbol: string;
}

const getLoanIcon = (type?: string) => {
  switch (type) {
    case 'Auto Loan':
      return Car;
    case 'Home Loan':
      return Home;
    case 'Credit Card EMI':
      return CreditCard;
    case 'Education Loan':
      return GraduationCap;
    case 'Consumer Durable':
      return Smartphone;
    case 'Business Loan':
      return Briefcase;
    case 'Personal Loan':
      return Landmark;
    default:
      return Landmark;
  }
};

export const DebtView: React.FC<DebtViewProps> = ({ currencySymbol }) => {
  const [loans, setLoans] = useState<EMILoan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loanToEdit, setLoanToEdit] = useState<EMILoan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<EMILoan | null>(null);
  const [prepaymentLoan, setPrepaymentLoan] = useState<EMILoan | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Strategy & Simulator States
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [selectedSimLoanId, setSelectedSimLoanId] = useState<string>('all');
  const [simExtraMonthly, setSimExtraMonthly] = useState<number>(3000);
  const [simLumpSum, setSimLumpSum] = useState<number>(25000);

  const loadLoans = () => {
    const list = storageService.getEMILoans();
    setLoans(list);
  };

  useEffect(() => {
    loadLoans();
    window.addEventListener(NOTIFY_EVENT, loadLoans);
    return () => window.removeEventListener(NOTIFY_EVENT, loadLoans);
  }, []);

  // When loans load, adjust simulator target if needed
  useEffect(() => {
    if (loans.length > 0 && selectedSimLoanId !== 'all' && !loans.some((l) => l.id === selectedSimLoanId)) {
      setSelectedSimLoanId(loans[0].id);
    }
  }, [loans, selectedSimLoanId]);

  // Aggregate Metrics
  const totalBorrowed = loans.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalOutstanding = loans.reduce((sum, d) => sum + d.remainingAmount, 0);
  const totalPrincipalRepaid = Math.max(0, totalBorrowed - totalOutstanding);
  const monthlyCommitment = loans.reduce((sum, d) => sum + d.emiAmount, 0);
  const totalPrepaymentsLogged = loans.reduce((sum, d) => sum + (d.prepaymentsMade || 0), 0);

  // Monthly Income for DTI estimate (from profile or benchmark)
  const profile = storageService.getProfile();
  const monthlyIncome = profile?.monthlyIncome || 120000;
  const dtiRatio = monthlyIncome > 0 ? ((monthlyCommitment / monthlyIncome) * 100).toFixed(1) : '0';
  const dtiNum = parseFloat(dtiRatio);

  const handleOpenCreate = () => {
    setLoanToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (loan: EMILoan) => {
    setLoanToEdit(loan);
    setIsModalOpen(true);
  };

  const handleDeleteLoan = (loan: EMILoan) => {
    setLoanToDelete(loan);
  };

  const handleConfirmDeleteLoan = () => {
    if (!loanToDelete) return;
    storageService.deleteEMILoan(loanToDelete.id);
    const updatedLoans = loans.filter((l) => l.id !== loanToDelete.id);
    setLoans(updatedLoans);
    if (selectedSimLoanId === loanToDelete.id) {
      setSelectedSimLoanId('all');
    }
    setToastMessage(`Removed loan obligation "${loanToDelete.name}".`);
    setTimeout(() => setToastMessage(null), 4000);
    setLoanToDelete(null);
  };

  // --- AMORTIZATION & SIMULATOR LOGIC ---
  const activeSimLoan =
    selectedSimLoanId === 'all'
      ? null
      : loans.find((l) => l.id === selectedSimLoanId) || loans[0] || null;

  const calculateLoanAmortization = (
    loan: EMILoan,
    extraMonthly: number = 0,
    lumpSum: number = 0
  ) => {
    const principal = Math.max(0, loan.remainingAmount - lumpSum);
    const emi = loan.emiAmount + extraMonthly;
    const r = (loan.interestRate || 0) / (12 * 100);

    if (principal <= 0) {
      return {
        remainingMonths: 0,
        totalInterest: 0,
        totalPayable: 0,
      };
    }

    if (loan.interestRate === 0 || r === 0) {
      const months = Math.ceil(principal / emi);
      return {
        remainingMonths: months,
        totalInterest: 0,
        totalPayable: principal,
      };
    }

    // If EMI is less than monthly interest, loan cannot be amortized
    if (emi <= principal * r) {
      return {
        remainingMonths: 999,
        totalInterest: principal * 2,
        totalPayable: principal * 3,
      };
    }

    const denom = Math.log(1 + r);
    const num = -Math.log(1 - (principal * r) / emi);
    const remainingMonths = Math.max(1, Math.ceil(num / denom));
    const totalPayable = remainingMonths * emi;
    const totalInterest = Math.max(0, totalPayable - principal);

    return {
      remainingMonths,
      totalInterest,
      totalPayable,
    };
  };

  // Overall Simulation Result
  const calculateCombinedSimulation = () => {
    if (loans.length === 0) {
      return {
        originalMonths: 0,
        newMonths: 0,
        monthsSaved: 0,
        originalInterest: 0,
        newInterest: 0,
        interestSaved: 0,
        originalDate: 'N/A',
        newDate: 'N/A',
      };
    }

    if (activeSimLoan) {
      // Single loan simulation
      const original = calculateLoanAmortization(activeSimLoan, 0, 0);
      const accelerated = calculateLoanAmortization(
        activeSimLoan,
        simExtraMonthly,
        simLumpSum
      );

      const monthsSaved = Math.max(0, original.remainingMonths - accelerated.remainingMonths);
      const interestSaved = Math.max(0, original.totalInterest - accelerated.totalInterest);

      const now = new Date();
      const origD = new Date(now.getFullYear(), now.getMonth() + original.remainingMonths, 1);
      const newD = new Date(now.getFullYear(), now.getMonth() + accelerated.remainingMonths, 1);
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];

      return {
        originalMonths: original.remainingMonths,
        newMonths: accelerated.remainingMonths,
        monthsSaved,
        originalInterest: Math.round(original.totalInterest),
        newInterest: Math.round(accelerated.totalInterest),
        interestSaved: Math.round(interestSaved),
        originalDate: `${monthNames[origD.getMonth()]} ${origD.getFullYear()}`,
        newDate: `${monthNames[newD.getMonth()]} ${newD.getFullYear()}`,
      };
    }

    // All loans simulation (Avalanche distribution of extra money)
    let totalOrigInterest = 0;
    let maxOrigMonths = 0;

    loans.forEach((l) => {
      const orig = calculateLoanAmortization(l, 0, 0);
      totalOrigInterest += orig.totalInterest;
      maxOrigMonths = Math.max(maxOrigMonths, orig.remainingMonths);
    });

    // Approximate acceleration across portfolio
    // Allocate lump sum to highest interest loan first
    const sortedLoans = [...loans].sort((a, b) => b.interestRate - a.interestRate);
    let remainingLump = simLumpSum;
    let totalNewInterest = 0;
    let maxNewMonths = 0;

    sortedLoans.forEach((l, idx) => {
      const lumpForThis = Math.min(l.remainingAmount, remainingLump);
      remainingLump -= lumpForThis;
      // Extra monthly goes to top priority loan
      const extraForThis = idx === 0 ? simExtraMonthly : 0;
      const acc = calculateLoanAmortization(l, extraForThis, lumpForThis);
      totalNewInterest += acc.totalInterest;
      maxNewMonths = Math.max(maxNewMonths, acc.remainingMonths);
    });

    const monthsSaved = Math.max(0, maxOrigMonths - maxNewMonths);
    const interestSaved = Math.max(0, totalOrigInterest - totalNewInterest);

    const now = new Date();
    const origD = new Date(now.getFullYear(), now.getMonth() + maxOrigMonths, 1);
    const newD = new Date(now.getFullYear(), now.getMonth() + maxNewMonths, 1);
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    return {
      originalMonths: maxOrigMonths,
      newMonths: maxNewMonths,
      monthsSaved,
      originalInterest: Math.round(totalOrigInterest),
      newInterest: Math.round(totalNewInterest),
      interestSaved: Math.round(interestSaved),
      originalDate: `${monthNames[origD.getMonth()]} ${origD.getFullYear()}`,
      newDate: `${monthNames[newD.getMonth()]} ${newD.getFullYear()}`,
    };
  };

  const simResult = calculateCombinedSimulation();

  // Apply Prepayment Directly from Simulator
  const handleApplySimulatorPrepayment = () => {
    const target = activeSimLoan || [...loans].sort((a, b) => b.interestRate - a.interestRate)[0];
    if (!target) return;

    if (simLumpSum > 0) {
      storageService.makeLoanPrepayment(target.id, simLumpSum);
      loadLoans();
      setToastMessage(
        `Applied part-payment of ${formatCurrency(
          simLumpSum,
          currencySymbol
        )} to "${target.name}". Outstanding balance updated!`
      );
      setSimLumpSum(0);
      setTimeout(() => setToastMessage(null), 5000);
    } else if (simExtraMonthly > 0) {
      // Increase EMI amount on this loan
      const updated: EMILoan = {
        ...target,
        emiAmount: target.emiAmount + simExtraMonthly,
      };
      storageService.saveEMILoan(updated);
      loadLoans();
      setToastMessage(
        `Increased monthly EMI on "${target.name}" by +${formatCurrency(
          simExtraMonthly,
          currencySymbol
        )}/mo. New EMI: ${formatCurrency(updated.emiAmount, currencySymbol)}/mo.`
      );
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Strategy Sorting
  const sortedStrategyLoans = [...loans].sort((a, b) => {
    if (strategy === 'avalanche') {
      return b.interestRate - a.interestRate; // Highest interest first
    } else {
      return a.remainingAmount - b.remainingAmount; // Lowest balance first
    }
  });

  return (
    <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
      {/* 1. Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Debt & EMI Obligations
            </h1>
            <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-400">
              {loans.length} Active Accounts
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Track pending loan balances, pre-close debts with lump sums, and simulate accelerated payoff timelines.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500 shadow-md shadow-blue-900/30 cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>Add Debt / EMI</span>
        </button>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-xs font-semibold text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-400 hover:text-white text-xs cursor-pointer ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
          <div className="text-xs text-gray-400">Total Outstanding Principal</div>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {formatCurrency(totalOutstanding, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            {totalBorrowed > 0
              ? `${Math.round(((totalBorrowed - totalOutstanding) / totalBorrowed) * 100)}% repaid of ${formatCurrency(
                  totalBorrowed,
                  currencySymbol
                )}`
              : 'No debt registered'}
          </div>
        </div>

        <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
          <div className="text-xs text-gray-400">Monthly EMI Outflow</div>
          <div className="mt-1 font-mono text-xl font-bold text-blue-400">
            {formatCurrency(monthlyCommitment, currencySymbol)}
            <span className="text-xs font-normal text-gray-400">/mo</span>
          </div>
          <div className="mt-1 text-[11px] text-gray-500">{loans.length} active scheduled EMIs</div>
        </div>

        <div className="rounded-xl border border-[#222] bg-[#121212] p-3.5 sm:p-4.5 lg:p-5">
          <div className="text-xs text-gray-400">Estimated Total Interest Drag</div>
          <div className="mt-1 font-mono text-xl font-bold text-amber-400">
            {formatCurrency(simResult.originalInterest, currencySymbol)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 font-medium">
            Pre-payments can save up to {formatCurrency(simResult.interestSaved, currencySymbol)}
          </div>
        </div>

        <div
          className={`rounded-xl border p-3.5 sm:p-4.5 lg:p-5 ${
            dtiNum <= 20
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : dtiNum <= 35
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-rose-500/30 bg-rose-500/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Debt-to-Income (DTI)</span>
            <span
              className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${
                dtiNum <= 20
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : dtiNum <= 35
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {dtiNum <= 20 ? 'Healthy' : dtiNum <= 35 ? 'Moderate' : 'High Risk'}
            </span>
          </div>
          <div
            className={`mt-1 font-mono text-xl font-bold ${
              dtiNum <= 20
                ? 'text-emerald-400'
                : dtiNum <= 35
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {dtiRatio}%
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            {dtiNum <= 20
              ? 'Safe financial cushion (<20%)'
              : dtiNum <= 35
              ? 'Within standard threshold (<35%)'
              : 'Consider aggressive pre-closure (>35%)'}
          </div>
        </div>
      </div>

      {/* 3. Active Loans & EMIs List */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Active Loans & EMI Obligations
            </h2>
            <p className="text-xs text-gray-400">
              Click "+ Pre-pay" on any loan to make part-payments or calculate complete pre-closure.
            </p>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {loans.length} Accounts Active
          </span>
        </div>

        {loans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#333] bg-[#121212] p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-400 mx-auto mb-3">
              <Landmark size={24} />
            </div>
            <h3 className="text-base font-bold text-white">No Loans or EMIs Registered</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto mt-1 mb-5">
              You are currently debt-free! If you have any personal loans, home mortgages, auto loans, or credit card EMIs, add them here to track interest savings.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow-md cursor-pointer"
            >
              <Plus size={15} />
              <span>Add First Loan / EMI</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {loans.map((loan) => {
              const paidPct =
                loan.totalAmount > 0
                  ? Math.min(
                      100,
                      Math.round(
                        ((loan.totalAmount - loan.remainingAmount) / loan.totalAmount) * 100
                      )
                    )
                  : 100;

              const isSettled = loan.remainingAmount <= 0;
              const IconComp = getLoanIcon(loan.type);
              const loanColor = loan.color || '#3B82F6';

              // Tenure left estimation
              const tenureMonthsLeft = Math.max(
                0,
                loan.tenureMonths - (loan.paidMonths || 0)
              );

              return (
                <div
                  key={loan.id}
                  className="rounded-2xl border border-[#222] bg-[#121212] p-4 sm:p-5 shadow-xs hover:border-[#333] transition flex flex-col justify-between group"
                >
                  <div>
                    {/* Loan Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-[#1f1f1f] pb-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-xs shrink-0"
                          style={{ backgroundColor: loanColor }}
                        >
                          <IconComp size={19} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-xs font-bold text-white group-hover:text-blue-300 transition">
                              {loan.name}
                            </h3>
                            {isSettled && (
                              <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold">
                                Paid Off 🎉
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                            <span>{loan.lender}</span>
                            <span>•</span>
                            <span className="font-semibold text-amber-400">
                              {loan.interestRate > 0 ? `${loan.interestRate}% APR` : '0% No-Cost'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Edit / Delete Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(loan)}
                          title="Edit Loan"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-[#202020] hover:text-white transition cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteLoan(loan)}
                          title="Delete Loan"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-500/20 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Pending Balance vs Original */}
                    <div className="mt-4 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Pending Loan Balance
                        </span>
                        <div className="font-mono text-lg font-bold text-white">
                          {formatCurrency(loan.remainingAmount, currencySymbol)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Original Principal
                        </span>
                        <div className="font-mono text-xs font-semibold text-gray-400">
                          {formatCurrency(loan.totalAmount, currencySymbol)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 font-medium">Principal Paid Off</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {paidPct}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#202020] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                    </div>

                    {/* EMI Outflow & Due Date */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-[#171717] rounded-lg p-2.5 border border-[#222]">
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Monthly EMI</span>
                        <span className="font-mono font-bold text-blue-400">
                          {formatCurrency(loan.emiAmount, currencySymbol)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Next Due Date</span>
                        <span className="text-gray-300 font-medium truncate block">
                          {loan.nextDueDate ? formatDate(loan.nextDueDate) : 'Auto-Debit'}
                        </span>
                      </div>
                    </div>

                    {/* Tenure Details */}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 px-1">
                      <span>
                        Paid: <strong>{loan.paidMonths || 0}</strong> of {loan.tenureMonths} mos
                      </span>
                      <span>
                        Remaining: <strong className="text-white">{tenureMonthsLeft} mos</strong>
                      </span>
                    </div>

                    {loan.notes && (
                      <p className="mt-2 text-[11px] text-gray-400 line-clamp-1 italic px-1">
                        "{loan.notes}"
                      </p>
                    )}
                  </div>

                  {/* Quick Action Button */}
                  <div className="mt-4 pt-3 border-t border-[#1f1f1f] flex items-center justify-between gap-2">
                    <div className="text-[10px] text-gray-500">
                      {loan.prepaymentsMade
                        ? `Prepaid: ${formatCurrency(loan.prepaymentsMade, currencySymbol)}`
                        : 'No prepayments yet'}
                    </div>

                    {!isSettled ? (
                      <button
                        onClick={() => setPrepaymentLoan(loan)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-600/25 transition cursor-pointer"
                      >
                        <Zap size={13} />
                        <span>+ Pre-pay / Settle</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={13} /> Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Interactive Visual EMI & Pre-closure Simulator */}
      <div className="rounded-2xl border border-[#222] bg-[#121212] p-4 sm:p-5 lg:p-6 shadow-xs space-y-5 sm:space-y-6">
        {/* Simulator Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Sliders size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Visual EMI Pre-Closure & Acceleration Simulator
                </h2>
                <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Real-time Amortization
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                See exact interest saved and how many years you shave off your loans by adding extra prepayments.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setSimExtraMonthly(3000);
              setSimLumpSum(25000);
            }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw size={13} />
            <span>Reset Simulator</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controls (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Step 1: Select Target Loan */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                1. Select Loan to Simulate Pre-closure:
              </label>
              {loans.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSimLoanId('all')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      selectedSimLoanId === 'all'
                        ? 'border-blue-500 bg-blue-600/15 text-white'
                        : 'border-[#262626] bg-[#171717] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-xs font-bold truncate">All Debts Combined</span>
                  </button>

                  {loans.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedSimLoanId(l.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        selectedSimLoanId === l.id
                          ? 'border-blue-500 bg-blue-600/15 text-white'
                          : 'border-[#262626] bg-[#171717] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: l.color || '#3B82F6' }}
                      />
                      <span className="text-xs font-bold truncate">{l.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Add an active loan above to run live simulation.</p>
              )}
            </div>

            {/* Step 2: One-Time Lump Sum Prepayment */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-2">
                <span>2. One-Time Lump Sum Prepayment:</span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  {formatCurrency(simLumpSum, currencySymbol)}
                </span>
              </div>

              {/* Quick 1-tap Chips */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[0, 10000, 25000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setSimLumpSum(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      simLumpSum === amt
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-[#181818] border-[#2a2a2a] text-gray-300 hover:bg-[#202020]'
                    }`}
                  >
                    {amt === 0 ? '₹0 (None)' : `+${formatCurrency(amt, currencySymbol)}`}
                  </button>
                ))}
              </div>

              {/* Slider */}
              <input
                type="range"
                min="0"
                max={Math.max(100000, totalOutstanding)}
                step="5000"
                value={simLumpSum}
                onChange={(e) => setSimLumpSum(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                <span>{currencySymbol}0</span>
                <span>{currencySymbol}50,000</span>
                <span>{currencySymbol}1,00,000</span>
                <span>{formatCurrency(Math.max(100000, totalOutstanding), currencySymbol)}</span>
              </div>
            </div>

            {/* Step 3: Extra Monthly EMI Top-Up */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-2">
                <span>3. Extra Monthly EMI Top-Up (Every Month):</span>
                <span className="font-mono text-sm font-bold text-blue-400">
                  +{formatCurrency(simExtraMonthly, currencySymbol)} / mo
                </span>
              </div>

              {/* Quick 1-tap Chips */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[0, 1000, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setSimExtraMonthly(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      simExtraMonthly === amt
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-[#181818] border-[#2a2a2a] text-gray-300 hover:bg-[#202020]'
                    }`}
                  >
                    {amt === 0 ? '₹0 (None)' : `+${formatCurrency(amt, currencySymbol)}`}
                  </button>
                ))}
              </div>

              {/* Slider */}
              <input
                type="range"
                min="0"
                max="20000"
                step="500"
                value={simExtraMonthly}
                onChange={(e) => setSimExtraMonthly(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                <span>{currencySymbol}0</span>
                <span>{currencySymbol}5,000</span>
                <span>{currencySymbol}10,000</span>
                <span>{currencySymbol}20,000+</span>
              </div>
            </div>
          </div>

          {/* Output Visualizer (5 Cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Simulated Pre-Closure Impact
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                Save {formatCurrency(simResult.interestSaved, currencySymbol)} Interest 💰
              </span>
            </div>

            {/* Timeline Speedup */}
            <div className="space-y-1.5">
              <div className="text-xs text-gray-300">
                Target Debt:{' '}
                <strong className="text-white">
                  {activeSimLoan ? activeSimLoan.name : 'All Active Loans Combined'}
                </strong>
              </div>
              <div className="font-mono text-2xl font-black text-white">
                {simResult.monthsSaved > 0
                  ? `${simResult.monthsSaved} Months Faster! 🚀`
                  : 'Current Amortization'}
              </div>
              <p className="text-xs text-gray-300">
                Debt-free by <strong className="text-emerald-400">{simResult.newDate}</strong> ({simResult.newMonths} months) instead of {simResult.originalDate} ({simResult.originalMonths} months).
              </p>
            </div>

            {/* Visual Comparison Breakdown */}
            <div className="rounded-xl bg-[#141414] border border-[#262626] p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Original Total Interest:</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatCurrency(simResult.originalInterest, currencySymbol)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">New Reduced Interest:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatCurrency(simResult.newInterest, currencySymbol)}
                </span>
              </div>
              <div className="border-t border-[#262626] pt-2 flex items-center justify-between">
                <span className="text-white font-semibold">Net Interest Saved:</span>
                <span className="font-mono font-extrabold text-emerald-400 text-sm">
                  {formatCurrency(simResult.interestSaved, currencySymbol)}
                </span>
              </div>
            </div>

            {/* Principal vs Interest Amortization Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400">Payment Breakdown:</span>
                <span className="text-[10px] text-gray-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
                  Principal vs{' '}
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />
                  Interest
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-[#202020] flex overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{
                    width: `${Math.max(
                      10,
                      Math.min(
                        90,
                        Math.round(
                          (totalOutstanding / (totalOutstanding + (simResult.newInterest || 1))) * 100
                        )
                      )
                    )}%`,
                  }}
                  title="Principal"
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-500 flex-1"
                  title="Bank Interest"
                />
              </div>
            </div>

            {/* Apply Action Button */}
            <button
              onClick={handleApplySimulatorPrepayment}
              disabled={loans.length === 0 || (simLumpSum === 0 && simExtraMonthly === 0)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 transition shadow-md shadow-emerald-900/30 disabled:opacity-50 cursor-pointer"
            >
              <Zap size={15} />
              <span>
                {simLumpSum > 0
                  ? `Apply ${formatCurrency(simLumpSum, currencySymbol)} Part-Payment Now`
                  : `Apply +${formatCurrency(simExtraMonthly, currencySymbol)}/mo EMI Boost`}
              </span>
            </button>
            <p className="text-[10px] text-gray-400 text-center">
              Directly logs this payment towards your loan balance in storage.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Payoff Strategy Matrix (Avalanche vs Snowball) */}
      <div className="rounded-2xl border border-[#222] bg-[#121212] p-4 sm:p-5 lg:p-6 shadow-xs space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222] pb-4">
          <div>
            <h2 className="text-base font-bold text-white">
              Debt Payoff Strategy & Priority Ranking
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Choose an algorithmic debt elimination order to maximize savings or build psychological momentum.
            </p>
          </div>

          {/* Strategy Toggle */}
          <div className="flex rounded-xl bg-[#171717] border border-[#262626] p-1 self-start sm:self-auto">
            <button
              onClick={() => setStrategy('avalanche')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                strategy === 'avalanche'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Flame size={13} />
              <span>Debt Avalanche (Save Most Interest)</span>
            </button>
            <button
              onClick={() => setStrategy('snowball')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                strategy === 'snowball'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <TrendingDown size={13} />
              <span>Debt Snowball (Quick Wins)</span>
            </button>
          </div>
        </div>

        {/* Strategy Description Banner */}
        <div className="rounded-xl bg-[#171717] border border-[#262626] p-4 text-xs">
          {strategy === 'avalanche' ? (
            <div className="flex items-start gap-2.5 text-gray-300">
              <Flame size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Debt Avalanche Method:</strong> Pay minimum EMIs on all loans, and direct all extra cash toward the debt with the <span className="text-amber-400 font-semibold">highest interest rate (APR)</span>. This mathematically minimizes the total interest you pay banks.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 text-gray-300">
              <TrendingDown size={18} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Debt Snowball Method:</strong> Pay minimum EMIs on all loans, and direct extra cash toward the account with the <span className="text-blue-400 font-semibold">smallest outstanding balance</span>. Eliminating whole accounts quickly provides psychological momentum.
              </div>
            </div>
          )}
        </div>

        {/* Priority Ranked Table */}
        <div className="divide-y divide-[#212121]">
          {sortedStrategyLoans.map((loan, idx) => {
            const IconComp = getLoanIcon(loan.type);
            return (
              <div
                key={loan.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e1e1e] border border-[#333] text-xs font-bold text-gray-300 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-white shrink-0"
                      style={{ backgroundColor: loan.color || '#3b82f6' }}
                    >
                      <IconComp size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{loan.name}</span>
                        {idx === 0 && (
                          <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold">
                            Priority #1 Target 🎯
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {loan.lender} • {loan.interestRate}% APR
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">Balance</span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(loan.remainingAmount, currencySymbol)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">Monthly EMI</span>
                    <span className="font-mono font-bold text-blue-400">
                      {formatCurrency(loan.emiAmount, currencySymbol)}
                    </span>
                  </div>

                  <button
                    onClick={() => setPrepaymentLoan(loan)}
                    className="rounded-lg bg-[#202020] hover:bg-emerald-600 hover:text-white text-gray-300 px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                  >
                    Pre-pay
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Debt / EMI Add & Edit Modal */}
      <DebtEmiModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setLoanToEdit(null);
        }}
        loanToEdit={loanToEdit}
        currencySymbol={currencySymbol}
        onSuccess={loadLoans}
        onDelete={(loan) => {
          setIsModalOpen(false);
          setLoanToEdit(null);
          setLoanToDelete(loan);
        }}
      />

      {/* Prepayment / Pre-close Modal */}
      <PrepaymentModal
        isOpen={!!prepaymentLoan}
        onClose={() => setPrepaymentLoan(null)}
        loan={prepaymentLoan}
        currencySymbol={currencySymbol}
        onSuccess={loadLoans}
      />

      {/* Debt Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={!!loanToDelete}
        onClose={() => setLoanToDelete(null)}
        onConfirm={handleConfirmDeleteLoan}
        title="Remove Loan Obligation?"
        description="Are you sure you want to remove this loan / EMI from your active tracker?"
        itemName={
          loanToDelete
            ? `${loanToDelete.name} • ${loanToDelete.lender}`
            : undefined
        }
        itemDetails={
          loanToDelete
            ? `Outstanding: ${formatCurrency(
                loanToDelete.remainingAmount,
                currencySymbol
              )} • Monthly EMI: ${formatCurrency(
                loanToDelete.emiAmount,
                currencySymbol
              )}`
            : undefined
        }
        confirmButtonText="Yes, Remove Loan"
      />
    </div>
  );
};
