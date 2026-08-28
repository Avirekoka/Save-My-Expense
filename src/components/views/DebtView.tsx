import React, { useState } from 'react';
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
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface DebtViewProps {
  currencySymbol: string;
}

export const DebtView: React.FC<DebtViewProps> = ({ currencySymbol }) => {
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');

  const debts = [
    {
      id: 'loan_1',
      name: 'HDFC Personal Loan',
      type: 'Fixed Loan',
      totalPrincipal: 500000,
      remainingBalance: 350000,
      emi: 12500,
      interestRate: 11.5,
      nextDueDate: '2026-09-05',
      monthsLeft: 32,
    },
    {
      id: 'cc_1',
      name: 'HDFC Regalia Credit Card',
      type: 'Revolving Credit',
      totalPrincipal: 25000,
      remainingBalance: 18400,
      emi: 18400, // full payment
      interestRate: 42.0,
      nextDueDate: '2026-09-05',
      monthsLeft: 1,
    },
    {
      id: 'cc_2',
      name: 'ICICI Amazon Pay Card',
      type: 'Revolving Credit',
      totalPrincipal: 8000,
      remainingBalance: 4200,
      emi: 4200,
      interestRate: 36.0,
      nextDueDate: '2026-09-12',
      monthsLeft: 1,
    },
  ];

  const totalOutstanding = debts.reduce((sum, d) => sum + d.remainingBalance, 0);
  const monthlyCommitment = debts.reduce((sum, d) => sum + d.emi, 0);
  const monthlyIncome = 120000;
  const dtiRatio = ((monthlyCommitment / monthlyIncome) * 100).toFixed(1);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Debt & EMI Obligations
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Track outstanding credit balances, monthly amortizations, interest drag, and payoff timelines.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs">
          <span className="text-xs font-bold text-gray-400">Total Outstanding Debt</span>
          <div className="mt-1 font-mono text-2xl font-bold text-white">
            {formatCurrency(totalOutstanding, currencySymbol)}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Loan principal + active credit balances</p>
        </div>

        <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs">
          <span className="text-xs font-bold text-gray-400">Monthly EMI Burn</span>
          <div className="mt-1 font-mono text-2xl font-bold text-blue-400">
            {formatCurrency(monthlyCommitment, currencySymbol)}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Scheduled for September</p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-xs">
          <span className="text-xs font-bold text-emerald-300">Debt-to-Income (DTI) Ratio</span>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-400">
            {dtiRatio}% <span className="text-xs font-semibold">(Healthy)</span>
          </div>
          <p className="text-[11px] text-emerald-400/70 mt-1">Well below the 35% caution threshold</p>
        </div>
      </div>

      {/* Debt Obligations Breakdown */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Active Debt Accounts</h2>
            <p className="text-xs text-gray-400">Fixed rate EMIs and statement cycle balances</p>
          </div>
        </div>

        <div className="divide-y divide-[#212121]">
          {debts.map((debt) => (
            <div
              key={debt.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#262626] text-blue-400 font-bold shrink-0">
                  {debt.type === 'Fixed Loan' ? <Landmark size={20} /> : <CreditCard size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{debt.name}</span>
                    <span className="rounded bg-[#262626] border border-[#333] px-2 py-0.5 text-[10px] font-bold text-gray-300">
                      {debt.interestRate}% APR
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Due on {formatDate(debt.nextDueDate)} • {debt.monthsLeft} months remaining
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Balance</span>
                  <div className="font-mono text-sm font-bold text-white">
                    {formatCurrency(debt.remainingBalance, currencySymbol)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Next Outflow</span>
                  <div className="font-mono text-sm font-bold text-blue-400">
                    {formatCurrency(debt.emi, currencySymbol)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
