import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  Plus,
  Bell,
  Check,
  Calendar,
  Layers,
  ChevronDown,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import { UserProfile, NotificationItem } from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { formatCurrency, getMonthName } from '../../utils/formatters';

interface HeaderProps {
  currentMonth: string;
  onMonthChange?: (month: string) => void;
  onChangeMonth?: (month: string) => void;
  onOpenAddModal?: () => void;
  onOpenAddTransaction?: () => void;
  onOpenAskMoney?: () => void;
  onOpenBeforeSpend?: () => void;
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
  onOpenAskMoney,
  onOpenBeforeSpend,
  profile,
  onNavigate,
  onToggleMobileSidebar,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const activeProfile = profile || storageService.getUserProfile();
  const displayName = activeProfile?.name || (activeProfile as any)?.displayName || 'User';

  const handleMonthChange = (month: string) => {
    if (onMonthChange) onMonthChange(month);
    if (onChangeMonth) onChangeMonth(month);
  };

  const handleAddClick = () => {
    if (onOpenAddModal) onOpenAddModal();
    else if (onOpenAddTransaction) onOpenAddTransaction();
  };

  const handleNav = (viewId: string) => {
    if (onNavigate) onNavigate(viewId);
  };

  useEffect(() => {
    setNotifications(storageService.getNotifications());
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = (id: string) => {
    storageService.markNotificationRead(id);
    setNotifications(storageService.getNotifications());
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#262626] bg-[#0a0a0a]/95 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile trigger & App branding */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#262626] bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1a1a1a] lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Layers size={18} />
        </button>

        <div
          onClick={() => handleNav('dashboard')}
          className="flex cursor-pointer items-center gap-2.5 font-bold tracking-tight text-white"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold shadow-sm shadow-blue-900/50">
            <Sparkles size={17} />
          </div>
          <div className="hidden sm:block">
            <span className="text-base font-extrabold text-white">Spend</span>
            <span className="text-base font-extrabold text-blue-500">AI</span>
            <span className="ml-1.5 rounded-md bg-blue-600/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
              Intelligence
            </span>
          </div>
        </div>
      </div>

      {/* Middle: Natural Language "Ask My Money" Search */}
      <div className="flex flex-1 max-w-md mx-4">
        <button
          onClick={onOpenAskMoney}
          className="group relative flex h-10 w-full items-center gap-2.5 rounded-full border border-[#262626] bg-[#141414] px-4 text-left text-sm text-gray-400 transition-all hover:border-blue-500/50 hover:bg-[#1a1a1a] hover:text-gray-200"
        >
          <Sparkles size={16} className="text-blue-400 transition-transform group-hover:scale-110" />
          <span className="hidden sm:inline">Ask My Money: &quot;Where did my money go in August?&quot;</span>
          <span className="sm:hidden">Ask AI Search...</span>
          <span className="ml-auto hidden rounded border border-[#333] bg-[#0f0f0f] px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-400 sm:inline-block">
            ⌘K
          </span>
        </button>
      </div>

      {/* Right Controls: Month Selector, Quick Add, Advisor, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Month Selector */}
        <div className="relative">
          <select
            value={currentMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            aria-label="Filter by month"
            className="h-9 cursor-pointer appearance-none rounded-lg border border-[#262626] bg-[#141414] pl-3 pr-8 text-xs font-semibold text-gray-200 shadow-xs transition hover:border-[#3a3a3a] focus:border-blue-500 focus:outline-hidden"
          >
            <option value="2026-08">August 2026</option>
            <option value="2026-07">July 2026</option>
            <option value="2026-06">June 2026</option>
            <option value="all">All History</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>

        {/* "Before You Spend" Decision Tool */}
        <button
          onClick={onOpenBeforeSpend}
          title="Before You Spend Advisor"
          className="hidden md:flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
        >
          <Sparkles size={13} className="text-amber-400" />
          <span>Before You Spend</span>
        </button>

        {/* Quick Add Button */}
        <button
          onClick={handleAddClick}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-500"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="hidden sm:inline">Add Expense</span>
        </button>

        {/* Notifications Drawer */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#262626] bg-[#141414] text-gray-300 hover:text-white hover:bg-[#1a1a1a]"
            aria-label="Notifications"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#262626] bg-[#0f0f0f] p-3 shadow-2xl z-50">
              <div className="flex items-center justify-between border-b border-[#262626] pb-2.5 px-2">
                <div className="font-semibold text-sm text-white">Financial Alerts</div>
                <span className="text-[11px] font-medium text-gray-400">
                  {unreadCount} unread
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-[#212121] mt-1">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-500">
                    No active alerts at this moment
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 transition rounded-xl my-0.5 ${
                        n.read ? 'bg-[#0f0f0f] opacity-60' : 'bg-[#141414]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-semibold text-white">{n.title}</div>
                        {!n.read && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5"
                          >
                            <Check size={12} /> Mark read
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <button
          onClick={() => handleNav('settings')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 border border-[#3a3a3a] text-xs font-bold text-white hover:ring-2 hover:ring-blue-500/50 transition"
          title={`Signed in as ${displayName}`}
        >
          {displayName
            .split(' ')
            .filter(Boolean)
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'U'}
        </button>
      </div>
    </header>
  );
};
