import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Plus,
  PieChart,
  Settings,
} from 'lucide-react';
import { AppRoute } from '../../router/RouterContext';

export interface BottomFooterTabsProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
  onOpenAddModal?: () => void;
  className?: string;
}

interface FooterNavTab {
  id: AppRoute;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tooltip: string;
}

// Exactly 4 navigation tabs + 1 central Add action button = 5 items total
const LEFT_TABS: readonly FooterNavTab[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    tooltip: 'Financial overview and summary',
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: Receipt,
    tooltip: 'Expenses, income, and receipts',
  },
] as const;

const RIGHT_TABS: readonly FooterNavTab[] = [
  {
    id: 'budgets',
    label: 'Budgets',
    icon: PieChart,
    tooltip: 'Budget limits and planner',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    tooltip: 'Preferences, theme, profile, and data',
  },
] as const;

export const BottomFooterTabs: React.FC<BottomFooterTabsProps> = ({
  activeRoute,
  onNavigate,
  onOpenAddModal,
  className = '',
}) => {
  // Helper to determine if a tab is currently active (including sub-route affinity)
  const isTabActive = (tabId: AppRoute): boolean => {
    if (activeRoute === tabId) return true;
    if (tabId === 'transactions' && (activeRoute === 'monthwise' || activeRoute === 'statements')) {
      return true;
    }
    if (tabId === 'budgets' && (activeRoute === 'goals' || activeRoute === 'debt')) {
      return true;
    }
    return false;
  };

  const renderNavTab = (tab: FooterNavTab) => {
    const active = isTabActive(tab.id);
    const Icon = tab.icon;

    return (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={`${tab.label} tab`}
        title={tab.tooltip}
        onClick={() => onNavigate(tab.id)}
        className={`group flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-95 ${
          active
            ? 'text-blue-400 font-semibold'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        {/* Icon pill container */}
        <div
          className={`relative flex items-center justify-center px-3.5 py-1 rounded-full transition-all duration-150 ${
            active
              ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-xs shadow-blue-500/20'
              : 'text-gray-400 group-hover:text-gray-200 group-hover:bg-[#1a1a1a]'
          }`}
        >
          <Icon
            size={19}
            className={`transition-transform duration-150 ${
              active ? 'scale-105 stroke-[2.25]' : 'group-hover:scale-105'
            }`}
          />
        </div>

        {/* Label */}
        <span
          className={`text-[10px] sm:text-[11px] leading-tight mt-1 transition-colors truncate max-w-full ${
            active
              ? 'font-bold text-blue-400 tracking-tight'
              : 'font-medium text-gray-400 group-hover:text-gray-300'
          }`}
        >
          {tab.label}
        </span>

        {/* Active Indicator Bar */}
        <span
          className={`h-0.5 w-4 rounded-full mt-0.5 transition-all duration-200 ${
            active
              ? 'bg-blue-500 shadow-xs shadow-blue-400/60 opacity-100 scale-100'
              : 'opacity-0 scale-50'
          }`}
          aria-hidden="true"
        />
      </button>
    );
  };

  return (
    <nav
      id="bottom-footer-tabs"
      aria-label="Bottom footer tabs navigation"
      className={`sticky bottom-0 z-30 w-full shrink-0 border-t border-[#262626] bg-[#0c0c0c]/95 backdrop-blur-md px-1 sm:px-4 pt-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] transition-colors select-none shadow-[0_-4px_24px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div className="max-w-xl mx-auto grid grid-cols-5 gap-0.5 sm:gap-1 items-end">
        {/* Tab 1: Dashboard */}
        {renderNavTab(LEFT_TABS[0])}

        {/* Tab 2: Transactions */}
        {renderNavTab(LEFT_TABS[1])}

        {/* Tab 3: Center Elevated Add Button */}
        <div className="flex flex-col items-center justify-center -mt-3.5 sm:-mt-4 relative z-10">
          <button
            type="button"
            aria-label="Add transaction or expense"
            title="Add New Expense or Transaction"
            onClick={onOpenAddModal}
            className="group flex flex-col items-center justify-center cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/35 border-2 border-[#0c0c0c] ring-2 ring-blue-500/40 group-hover:scale-105 group-hover:shadow-blue-500/50 group-active:scale-95 transition-all duration-150">
              <Plus
                size={22}
                strokeWidth={2.5}
                className="group-hover:rotate-90 transition-transform duration-200"
              />
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-blue-400 mt-1 tracking-tight group-hover:text-blue-300">
              Add
            </span>
          </button>
        </div>

        {/* Tab 4: Budgets */}
        {renderNavTab(RIGHT_TABS[0])}

        {/* Tab 5: Settings */}
        {renderNavTab(RIGHT_TABS[1])}
      </div>
    </nav>
  );
};
