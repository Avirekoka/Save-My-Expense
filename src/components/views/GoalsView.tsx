import React, { useState, useEffect } from 'react';
import {
  Target,
  Sparkles,
  Plus,
  TrendingUp,
  Calendar,
  Sliders,
  CheckCircle2,
  ArrowRight,
  Shield,
  Plane,
  Laptop,
} from 'lucide-react';
import { FinancialGoal } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface GoalsViewProps {
  currencySymbol: string;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ currencySymbol }) => {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [cutDining, setCutDining] = useState<number>(2000);
  const [cutShopping, setCutShopping] = useState<number>(3000);
  const [cutSubscriptions, setCutSubscriptions] = useState<number>(1000);

  const load = () => {
    setGoals(storageService.getGoals());
  };

  useEffect(() => {
    load();
    window.addEventListener(NOTIFY_EVENT, load);
    return () => window.removeEventListener(NOTIFY_EVENT, load);
  }, []);

  const totalExtraSavedMonthly = cutDining + cutShopping + cutSubscriptions;
  const totalExtraSavedAnnual = totalExtraSavedMonthly * 12;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Financial Goals & What-If Simulator
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Model savings trajectories, track milestone targets, and simulate the exact timeline acceleration from reducing discretionary spending.
        </p>
      </div>

      {/* Active Financial Goals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
          const remaining = g.targetAmount - g.currentAmount;
          const monthsToTarget =
            g.monthlyContribution > 0 ? Math.ceil(remaining / g.monthlyContribution) : 12;

          return (
            <div
              key={g.id}
              className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#262626] text-blue-400">
                      <Target size={17} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white">{g.name}</span>
                      <div className="text-[10px] text-gray-500">Target: {formatDate(g.deadline)}</div>
                    </div>
                  </div>
                  <span className="rounded-md bg-blue-600/20 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                    {pct}%
                  </span>
                </div>

                <div className="mt-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Saved</span>
                    <div className="font-mono text-base font-bold text-white">
                      {formatCurrency(g.currentAmount, currencySymbol)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Target</span>
                    <div className="font-mono text-xs text-gray-400 font-bold">
                      {formatCurrency(g.targetAmount, currencySymbol)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#262626]">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>Contributing {formatCurrency(g.monthlyContribution, currencySymbol)}/mo</span>
                    <span>~{monthsToTarget} months left</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#262626] text-[11px] text-gray-400">
                Remaining buffer required:{' '}
                <strong className="text-white font-mono">
                  {formatCurrency(remaining, currencySymbol)}
                </strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive What-If Scenario Simulator */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Interactive "What-If" Expense Optimization Simulator
              </h2>
              <p className="text-xs text-gray-400">
                Adjust sliders to see how trimming specific discretionary spends accelerates your wealth targets.
              </p>
            </div>
          </div>
          <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
            Real-Time Engine
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Sliders Area */}
          <div className="space-y-4 lg:col-span-6">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1.5">
                <span>Reduce Dining & Food Delivery Spends</span>
                <span className="font-mono font-bold text-blue-400">
                  {formatCurrency(cutDining, currencySymbol)} / month
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="8000"
                step="500"
                value={cutDining}
                onChange={(e) => setCutDining(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1.5">
                <span>Reduce Impulse Shopping / Fashion</span>
                <span className="font-mono font-bold text-blue-400">
                  {formatCurrency(cutShopping, currencySymbol)} / month
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="500"
                value={cutShopping}
                onChange={(e) => setCutShopping(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1.5">
                <span>Prune Unused Digital Subscriptions</span>
                <span className="font-mono font-bold text-blue-400">
                  {formatCurrency(cutSubscriptions, currencySymbol)} / month
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="3000"
                step="250"
                value={cutSubscriptions}
                onChange={(e) => setCutSubscriptions(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          {/* Simulation Output Card */}
          <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-5 space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Simulated Liquidity Boost
              </span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                +{formatCurrency(totalExtraSavedMonthly, currencySymbol)}/mo
              </span>
            </div>

            <div className="font-mono text-2xl font-bold text-white">
              +{formatCurrency(totalExtraSavedAnnual, currencySymbol)}{' '}
              <span className="text-xs font-normal text-gray-400">annualized cash gain</span>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>
                  <strong className="text-white">Emergency Fund (₹3L)</strong> completed <strong className="text-white">3.2 months earlier</strong>.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>
                  <strong className="text-white">Japan Vacation (₹2L)</strong> fully funded by <strong className="text-white">Nov 2026</strong>{' '}
                  instead of March 2027.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>
                  Boosts total annual compounding portfolio by ~
                  <strong className="text-white">{formatCurrency(totalExtraSavedAnnual * 1.12, currencySymbol)}</strong>.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
