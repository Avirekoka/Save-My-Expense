import React from 'react';
import {
  Sparkles,
  Plus,
  Menu,
  Search,
} from 'lucide-react';
import { UserProfile } from '../../types';

interface HeaderProps {
  currentMonth: string;
  onMonthChange?: (month: string) => void;
  onChangeMonth?: (month: string) => void;
  onOpenAddModal?: () => void;
  onOpenAddTransaction?: () => void;
  onOpenScanReceipt?: () => void;
  onOpenAskMoney?: () => void;
  onOpenBeforeSpend?: () => void;
  onOpenAuthModal?: () => void;
  profile?: UserProfile;
  onNavigate?: (viewId: string) => void;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentMonth,
  onMonthChange,
  onChangeMonth,
  onOpenAddModal,
  onOpenAddTransaction,
  onOpenScanReceipt,
  onOpenAskMoney,
  onOpenBeforeSpend,
  onOpenAuthModal,
  profile,
  onNavigate,
  onToggleMobileSidebar,
}) => {
  const handleAddClick = () => {
    if (onOpenAddTransaction) {
      onOpenAddTransaction();
    } else if (onOpenAddModal) {
      onOpenAddModal();
    }
  };

  const handleNav = (viewId: string) => {
    if (onNavigate) {
      onNavigate(viewId);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-[#262626] bg-[#0a0a0a]/95 px-3 sm:px-5 lg:px-6 backdrop-blur-md">
      {/* Left: Mobile Navigation Trigger (Hamburger Menu) & App Branding */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        <button
          onClick={onToggleMobileSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#262626] bg-[#141414] text-gray-300 hover:text-white hover:bg-[#1a1a1a] hover:border-blue-500/40 lg:hidden transition cursor-pointer"
          aria-label="Open Navigation & Quick Actions Menu"
          title="Open Navigation & Quick Actions Menu"
        >
          <Menu size={18} />
        </button>

        <div
          onClick={() => handleNav('dashboard')}
          className="flex cursor-pointer items-center gap-2 font-bold tracking-tight text-white select-none"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="flex items-center">
            <span className="text-sm sm:text-base font-extrabold text-white tracking-tight">Spend</span>
            <span className="text-sm sm:text-base font-extrabold text-blue-500">AI</span>
            <span className="ml-1.5 hidden md:inline-block rounded-md bg-blue-600/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
              Intelligence
            </span>
          </div>
        </div>
      </div>

      {/* Middle: Natural Language "Ask My Money" Search Trigger */}
      <div className="flex-1 max-w-sm md:max-w-md mx-2.5 sm:mx-6 min-w-0">
        <button
          onClick={onOpenAskMoney}
          className="group relative flex h-9 w-full items-center gap-2 rounded-full border border-[#262626] bg-[#141414] px-3 sm:px-3.5 text-left text-xs text-gray-400 transition-all hover:border-blue-500/50 hover:bg-[#1a1a1a] hover:text-gray-200 truncate cursor-pointer"
          title="Ask AI about your money (⌘K)"
        >
          <Search size={14} className="text-gray-400 group-hover:text-blue-400 shrink-0 transition-colors" />
          <span className="hidden sm:inline truncate">Ask AI: &quot;Where did my money go?&quot;</span>
          <span className="sm:hidden truncate text-[11px]">Ask AI / Search...</span>
          <span className="ml-auto hidden rounded border border-[#333] bg-[#0f0f0f] px-1.5 py-0.5 font-mono text-[9px] font-medium text-gray-400 md:inline-block">
            ⌘K
          </span>
        </button>
      </div>

      {/* Right Controls: Clean & Neat with Quick Add Button */}
      <div className="flex items-center shrink-0">
        <button
          onClick={handleAddClick}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 sm:px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-500 cursor-pointer shrink-0"
          title="Add New Expense"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="hidden sm:inline">Add Expense</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>
    </header>
  );
};
