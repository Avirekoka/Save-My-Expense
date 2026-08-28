import React, { useState, useEffect } from 'react';
import {
  Repeat,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Calendar,
  CreditCard,
  Trash2,
  PauseCircle,
  PlayCircle,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { Subscription } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface SubscriptionsViewProps {
  currencySymbol: string;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  currencySymbol,
}) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const load = () => {
    setSubscriptions(storageService.getSubscriptions());
  };

  useEffect(() => {
    load();
    window.addEventListener(NOTIFY_EVENT, load);
    return () => window.removeEventListener(NOTIFY_EVENT, load);
  }, []);

  const totalMonthly = subscriptions
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => {
      if (s.billingCycle === 'monthly') return sum + s.amount;
      if (s.billingCycle === 'annual') return sum + s.amount / 12;
      if (s.billingCycle === 'quarterly') return sum + s.amount / 3;
      return sum + s.amount;
    }, 0);

  const totalAnnual = totalMonthly * 12;
  const potentialSavings = subscriptions
    .filter((s) => s.isUnused)
    .reduce((sum, s) => sum + s.amount * 12, 0);

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    const sub = subscriptions.find((s) => s.id === id);
    if (sub) {
      storageService.saveSubscription({
        ...sub,
        status: nextStatus as any,
      });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Subscriptions & Money Leak Detector
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Audit recurring auto-debits, track renewal deadlines, and identify unutilized digital subscriptions.
        </p>
      </div>

      {/* Burn Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs">
          <span className="text-xs font-bold text-gray-400">Monthly Recurring Commitments</span>
          <div className="mt-1 font-mono text-2xl font-bold text-white">
            {formatCurrency(totalMonthly, currencySymbol)}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Total {subscriptions.filter((s) => s.status === 'active').length} active memberships
          </p>
        </div>

        <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs">
          <span className="text-xs font-bold text-gray-400">Annualized Run Rate</span>
          <div className="mt-1 font-mono text-2xl font-bold text-blue-400">
            {formatCurrency(totalAnnual, currencySymbol)}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Projected 12-month drain</p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-xs">
          <span className="text-xs font-bold text-amber-300">Identified Money Leak Savings</span>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-400">
            {formatCurrency(potentialSavings, currencySymbol)}/yr
          </div>
          <p className="text-[11px] text-amber-400/70 mt-1">
            From 1 unutilized language subscription
          </p>
        </div>
      </div>

      {/* Active Subscriptions List */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Active Recurring Memberships</h2>
            <p className="text-xs text-gray-400">
              Auto-renewing cards and mandates on file
            </p>
          </div>
        </div>

        <div className="divide-y divide-[#212121]">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-3"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#262626] text-blue-400 font-bold text-sm shrink-0">
                  {sub.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{sub.name}</span>
                    {sub.isUnused && (
                      <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 flex items-center gap-1">
                        <AlertTriangle size={11} />
                        Unused this month
                      </span>
                    )}
                    {sub.priceChangeAlert && (
                      <span className="rounded bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                        {sub.priceChangeAlert}
                      </span>
                    )}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        sub.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-[#262626] text-gray-400'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                    <span>{sub.category}</span>
                    <span>•</span>
                    <span>Renewal: {formatDate(sub.nextBillingDate)}</span>
                    <span>•</span>
                    <span>Card ending **4920</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-white">
                    {formatCurrency(sub.amount, currencySymbol)}
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase">
                    per {sub.billingCycle}
                  </span>
                </div>

                <button
                  onClick={() => handleToggleStatus(sub.id, sub.status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    sub.status === 'active'
                      ? 'border border-[#262626] bg-[#0f0f0f] text-gray-300 hover:bg-[#1a1a1a]'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {sub.status === 'active' ? 'Pause Auto-Debit' : 'Resume'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
