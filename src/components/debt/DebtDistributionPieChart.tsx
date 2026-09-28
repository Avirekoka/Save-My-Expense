import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  Users,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart as PieChartIcon,
  Layers,
  Scale,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { FriendDebt, EMILoan } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface DebtDistributionPieChartProps {
  friendDebts: FriendDebt[];
  loans: EMILoan[];
  currencySymbol: string;
  onSelectEntity?: (entityName: string) => void;
  className?: string;
}

export type DistributionFilter =
  | 'all'
  | 'friends_only'
  | 'lent_only'
  | 'borrowed_only'
  | 'macro_summary';

interface EntitySliceItem {
  id: string;
  name: string;
  displayName: string;
  category: 'friend' | 'bank';
  debtType: 'lent' | 'borrowed';
  value: number;
  color: string;
  subtext?: string;
  notes?: string;
}

// Harmonious color palettes
const LENT_PALETTE = [
  '#10B981', // emerald-500
  '#059669', // emerald-600
  '#14B8A6', // teal-500
  '#06B6D4', // cyan-500
  '#2DD4BF', // teal-400
  '#34D399', // emerald-400
  '#0D9488', // teal-600
];

const BORROWED_PALETTE = [
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#F97316', // orange-500
  '#8B5CF6', // purple-500
  '#EC4899', // pink-500
  '#6366F1', // indigo-500
  '#DC2626', // red-600
  '#D97706', // amber-600
];

export const DebtDistributionPieChart: React.FC<DebtDistributionPieChartProps> = ({
  friendDebts,
  loans,
  currencySymbol,
  onSelectEntity,
  className = '',
}) => {
  const [filter, setFilter] = useState<DistributionFilter>('all');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 1. Compile all active lent and borrowed items
  const { allItems, totalLent, totalBorrowed, totalLentFriends, totalBorrowedFriends } = useMemo(() => {
    const items: EntitySliceItem[] = [];
    let lentSum = 0;
    let borrowedSum = 0;
    let lentFriendsSum = 0;
    let borrowedFriendsSum = 0;

    let lentColorIdx = 0;
    let borrowedColorIdx = 0;

    // Process FriendDebts
    friendDebts.forEach((debt) => {
      const isSettled = debt.status === 'settled' || debt.remainingAmount <= 0;
      if (isSettled) return;

      const amt = debt.remainingAmount;
      if (debt.type === 'lent') {
        lentSum += amt;
        lentFriendsSum += amt;
        items.push({
          id: `friend_${debt.id}`,
          name: debt.friendName,
          displayName: `${debt.friendName} (Friend)`,
          category: 'friend',
          debtType: 'lent',
          value: amt,
          color: LENT_PALETTE[lentColorIdx % LENT_PALETTE.length],
          subtext: debt.notes || 'Money lent to friend',
          notes: debt.dueDate ? `Due by ${debt.dueDate}` : undefined,
        });
        lentColorIdx++;
      } else {
        borrowedSum += amt;
        borrowedFriendsSum += amt;
        items.push({
          id: `friend_${debt.id}`,
          name: debt.friendName,
          displayName: `${debt.friendName} (Friend)`,
          category: 'friend',
          debtType: 'borrowed',
          value: amt,
          color: BORROWED_PALETTE[borrowedColorIdx % BORROWED_PALETTE.length],
          subtext: debt.notes || 'Money borrowed from friend',
          notes: debt.dueDate ? `Return by ${debt.dueDate}` : undefined,
        });
        borrowedColorIdx++;
      }
    });

    // Process Institutional EMILoans (all represent borrowed liabilities)
    loans.forEach((loan) => {
      const isSettled = loan.remainingAmount <= 0 || loan.status === 'resolved';
      if (isSettled) return;

      const amt = loan.remainingAmount;
      borrowedSum += amt;
      items.push({
        id: `loan_${loan.id}`,
        name: loan.lender || loan.name,
        displayName: `${loan.lender} • ${loan.name}`,
        category: 'bank',
        debtType: 'borrowed',
        value: amt,
        color: loan.color || BORROWED_PALETTE[borrowedColorIdx % BORROWED_PALETTE.length],
        subtext: `${loan.interestRate}% APR • ${loan.type || 'Bank Loan'}`,
        notes: `EMI: ${formatCurrency(loan.emiAmount, currencySymbol)}/mo`,
      });
      borrowedColorIdx++;
    });

    return {
      allItems: items,
      totalLent: lentSum,
      totalBorrowed: borrowedSum,
      totalLentFriends: lentFriendsSum,
      totalBorrowedFriends: borrowedFriendsSum,
    };
  }, [friendDebts, loans, currencySymbol]);

  // 2. Filter chart data based on active view mode
  const chartData = useMemo(() => {
    if (filter === 'macro_summary') {
      const macro: EntitySliceItem[] = [];
      if (totalLent > 0) {
        macro.push({
          id: 'macro_lent',
          name: 'Total Lent (Receivables)',
          displayName: 'Money Lent to Friends & Entities',
          category: 'friend',
          debtType: 'lent',
          value: totalLent,
          color: '#10B981',
          subtext: 'Money owed to you',
        });
      }
      if (totalBorrowed > 0) {
        macro.push({
          id: 'macro_borrowed',
          name: 'Total Borrowed (Payables)',
          displayName: 'Money Borrowed (Friends & Loans)',
          category: 'bank',
          debtType: 'borrowed',
          value: totalBorrowed,
          color: '#EF4444',
          subtext: 'Money you owe others',
        });
      }
      return macro;
    }

    if (filter === 'friends_only') {
      return allItems.filter((i) => i.category === 'friend');
    }
    if (filter === 'lent_only') {
      return allItems.filter((i) => i.debtType === 'lent');
    }
    if (filter === 'borrowed_only') {
      return allItems.filter((i) => i.debtType === 'borrowed');
    }

    // Default 'all'
    return allItems;
  }, [filter, allItems, totalLent, totalBorrowed]);

  const viewTotalAmount = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  const netBalance = totalLent - totalBorrowed;
  const activeEntity = activeIndex !== null && chartData[activeIndex] ? chartData[activeIndex] : null;

  return (
    <div
      className={`rounded-2xl border border-[#222] bg-[#121212] p-4 sm:p-5 lg:p-6 shadow-xs space-y-5 ${className}`}
    >
      {/* Header and View Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#222] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 text-white shadow-xs shrink-0">
            <PieChartIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                Lent vs. Borrowed Distribution
              </h2>
              <span className="rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                Entity Breakdown
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Visualize how peer loans and borrowings are allocated across friends, entities, and institutions.
            </p>
          </div>
        </div>

        {/* View Filter Buttons */}
        <div className="flex rounded-xl bg-[#171717] border border-[#262626] p-1 flex-wrap text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setActiveIndex(null);
            }}
            className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All Entities ({allItems.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter('friends_only');
              setActiveIndex(null);
            }}
            className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer flex items-center gap-1 ${
              filter === 'friends_only'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users size={12} />
            <span>Friends Only</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter('lent_only');
              setActiveIndex(null);
            }}
            className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer flex items-center gap-1 ${
              filter === 'lent_only'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowUpRight size={12} className="text-emerald-400" />
            <span>Lent (You'll Get)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter('borrowed_only');
              setActiveIndex(null);
            }}
            className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer flex items-center gap-1 ${
              filter === 'borrowed_only'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft size={12} className="text-amber-400" />
            <span>Borrowed (You Owe)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter('macro_summary');
              setActiveIndex(null);
            }}
            className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer flex items-center gap-1 ${
              filter === 'macro_summary'
                ? 'bg-purple-600 text-white shadow-xs font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Scale size={12} />
            <span>Macro Split</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Lent */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <ArrowUpRight size={14} />
              <span>Total Lent (Receivables)</span>
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-white">
              {formatCurrency(totalLent, currencySymbol)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {allItems.filter((i) => i.debtType === 'lent').length} active entity records
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
            {totalLent > 0 && viewTotalAmount > 0
              ? `${Math.round((totalLent / (totalLent + totalBorrowed || 1)) * 100)}%`
              : '0%'}
          </div>
        </div>

        {/* Total Borrowed */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <ArrowDownLeft size={14} />
              <span>Total Borrowed (Payables)</span>
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-white">
              {formatCurrency(totalBorrowed, currencySymbol)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {allItems.filter((i) => i.debtType === 'borrowed').length} active entity records
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
            {totalBorrowed > 0 && viewTotalAmount > 0
              ? `${Math.round((totalBorrowed / (totalLent + totalBorrowed || 1)) * 100)}%`
              : '0%'}
          </div>
        </div>

        {/* Net Debt Position */}
        <div
          className={`rounded-xl border p-3.5 flex items-center justify-between ${
            netBalance >= 0
              ? 'border-teal-500/20 bg-teal-500/5 text-teal-400'
              : 'border-rose-500/20 bg-rose-500/5 text-rose-400'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Scale size={14} />
              <span>Net Position ({netBalance >= 0 ? 'Net Inflow' : 'Net Outflow'})</span>
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-white">
              {formatCurrency(Math.abs(netBalance), currencySymbol)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {netBalance >= 0 ? "You're owed more than you owe" : 'Obligations exceed receivables'}
            </div>
          </div>
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
              netBalance >= 0 ? 'bg-teal-500/20 text-teal-300' : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {netBalance >= 0 ? '+' : '-'}
          </div>
        </div>
      </div>

      {/* Main Chart + Interactive Entity Distribution Grid */}
      {chartData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2b2b2b] bg-[#141414] p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 mb-3">
            <PieChartIcon size={24} />
          </div>
          <h3 className="text-sm font-bold text-white">No active records for this filter</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
            {filter === 'lent_only'
              ? 'You currently have no money lent to friends or entities.'
              : filter === 'borrowed_only'
              ? 'You have zero borrowed money recorded across friends or institutions.'
              : 'Add personal loans or peer debt entries to populate the distribution graph.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Pie Chart Visualizer (5 Cols) */}
          <div className="lg:col-span-5 relative flex flex-col items-center justify-center min-h-[280px]">
            <div className="w-full h-64 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="displayName"
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={entry.color}
                        stroke="#121212"
                        strokeWidth={2}
                        className="transition-all duration-200 cursor-pointer"
                        style={{
                          filter:
                            activeIndex === index
                              ? 'drop-shadow(0px 0px 8px rgba(255,255,255,0.4))'
                              : 'none',
                          transform: activeIndex === index ? 'scale(1.04)' : 'scale(1)',
                          transformOrigin: 'center center',
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload as EntitySliceItem;
                      const pct = viewTotalAmount > 0 ? ((item.value / viewTotalAmount) * 100).toFixed(1) : '0';

                      return (
                        <div className="rounded-xl border border-[#333] bg-[#181818]/95 p-3 text-white shadow-xl backdrop-blur-md">
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-xs font-bold truncate max-w-[180px]">
                              {item.displayName}
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-400 flex items-center gap-2 mb-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                item.debtType === 'lent'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {item.debtType === 'lent' ? 'Lent (They Owe You)' : 'Borrowed (You Owe)'}
                            </span>
                            <span>{item.category === 'friend' ? 'Friend / Peer' : 'Bank / Lender'}</span>
                          </div>

                          <div className="border-t border-[#2a2a2a] pt-1.5 flex items-baseline justify-between gap-4">
                            <span className="font-mono text-sm font-bold text-white">
                              {formatCurrency(item.value, currencySymbol)}
                            </span>
                            <span className="text-xs font-bold text-gray-400">{pct}%</span>
                          </div>

                          {item.subtext && (
                            <div className="text-[10px] text-gray-400 mt-1 italic max-w-[200px] truncate">
                              {item.subtext}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Hole Content */}
              <div className="absolute pointer-events-none text-center flex flex-col items-center justify-center max-w-[110px]">
                {activeEntity ? (
                  <>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight truncate w-full px-1">
                      {activeEntity.name}
                    </span>
                    <span className="font-mono text-xs font-extrabold text-white mt-0.5 truncate w-full">
                      {formatCurrency(activeEntity.value, currencySymbol)}
                    </span>
                    <span
                      className={`text-[9px] font-bold rounded-full px-1.5 py-0.2 mt-0.5 ${
                        activeEntity.debtType === 'lent'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {activeEntity.debtType === 'lent' ? 'Lent' : 'Borrowed'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {filter === 'lent_only'
                        ? 'Total Lent'
                        : filter === 'borrowed_only'
                        ? 'Total Borrowed'
                        : 'View Total'}
                    </span>
                    <span className="font-mono text-xs sm:text-sm font-extrabold text-white mt-0.5">
                      {formatCurrency(viewTotalAmount, currencySymbol)}
                    </span>
                    <span className="text-[9px] text-gray-400 mt-0.5 font-medium">
                      {chartData.length} {chartData.length === 1 ? 'Entity' : 'Entities'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Quick color indicator legend */}
            <div className="flex items-center gap-4 text-[11px] text-gray-400 mt-1">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span>Lent to Friends/Entities</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span>Borrowed from Friends/Banks</span>
              </div>
            </div>
          </div>

          {/* Interactive Entity List Breakdown (7 Cols) */}
          <div className="lg:col-span-7 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-400 pb-1 border-b border-[#222]">
              <span>Friend or Entity Breakdown</span>
              <span>Balance & Share</span>
            </div>

            {chartData.map((item, idx) => {
              const pct = viewTotalAmount > 0 ? (item.value / viewTotalAmount) * 100 : 0;
              const isSelected = activeIndex === idx;

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={() => onSelectEntity && onSelectEntity(item.name)}
                  className={`group rounded-xl border p-2.5 transition cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'border-indigo-500/50 bg-[#1c1c1c]'
                      : 'border-[#222] bg-[#141414] hover:border-[#333] hover:bg-[#181818]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate group-hover:text-blue-300 transition">
                            {item.displayName}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold shrink-0 ${
                              item.debtType === 'lent'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.debtType === 'lent' ? 'Lent' : 'Borrowed'}
                          </span>
                          {item.category === 'bank' && (
                            <span className="rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 px-1 py-0.2 text-[9px] font-semibold flex items-center gap-0.5 shrink-0">
                              <Building2 size={10} /> Bank
                            </span>
                          )}
                        </div>

                        {item.subtext && (
                          <div className="text-[11px] text-gray-400 truncate mt-0.5">
                            {item.subtext}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs font-bold text-white">
                        {formatCurrency(item.value, currencySymbol)}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {pct.toFixed(1)}% of view
                      </div>
                    </div>
                  </div>

                  {/* Percentage Progress Bar */}
                  <div className="h-1.5 w-full rounded-full bg-[#202020] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(2, pct)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
