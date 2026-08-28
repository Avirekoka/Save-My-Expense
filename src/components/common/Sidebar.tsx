import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  FileSpreadsheet,
  BarChart3,
  PieChart,
  Repeat,
  Target,
  Sparkles,
  Landmark,
  Settings,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  monthlyIncome: number;
  monthlyExpense: number;
  currencySymbol: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  monthlyIncome,
  monthlyExpense,
  currencySymbol,
  isMobileOpen,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'transactions', label: 'Transactions', icon: Receipt, badge: null },
    { id: 'statements', label: 'Upload Statement', icon: FileSpreadsheet, badge: 'AI Parser' },
    { id: 'analytics', label: 'Analytics & Cash Flow', icon: BarChart3, badge: null },
    { id: 'budgets', label: 'Budgets & Planner', icon: PieChart, badge: null },
    { id: 'subscriptions', label: 'Subscriptions & Leaks', icon: Repeat, badge: '1 Alert' },
    { id: 'goals', label: 'Goals & Simulator', icon: Target, badge: null },
    { id: 'insights', label: 'AI Insights & Stories', icon: Sparkles, badge: 'Smart' },
    { id: 'debt', label: 'Debt & EMIs', icon: Landmark, badge: null },
    { id: 'settings', label: 'Settings & Data', icon: Settings, badge: null },
  ];

  const savings = Math.max(0, monthlyIncome - monthlyExpense);
  const savingsRate = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#262626] bg-[#0f0f0f] transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
            Financial Suite
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400 font-medium'
                    : 'text-gray-400 hover:bg-[#141414] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    size={17}
                    className={isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? 'bg-blue-500/20 text-blue-300'
                        : item.badge === '1 Alert'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-[#1a1a1a] text-gray-400 border border-[#262626]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Savings & Health Card */}
        <div className="p-3 border-t border-[#262626] bg-[#0c0c0c]">
          <div className="rounded-xl border border-[#262626] bg-[#141414] p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-400 uppercase tracking-wider text-[10px]">Active Savings</span>
              <span className="font-bold text-emerald-400">
                {savingsRate.toFixed(0)}% Rate
              </span>
            </div>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#262626]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, savingsRate))}%` }}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-400">
              <span>Saved this month:</span>
              <span className="font-mono font-bold text-white">
                {formatCurrency(savings, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
