import React from 'react';
import {
  Sparkles,
  Shield,
  ArrowUp,
  CreditCard,
  PieChart,
  Target,
  FileSpreadsheet,
  Settings,
  Heart,
  Lock,
  Zap,
} from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string) => void;
  onOpenAskMoney?: () => void;
  onOpenBeforeSpend?: () => void;
  onOpenAddModal?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onOpenAskMoney,
  onOpenBeforeSpend,
  onOpenAddModal,
}) => {
  const scrollToTop = () => {
    const mainContainer = document.getElementById('main-content-scroll');
    if (mainContainer) {
      mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="mt-8 sm:mt-12 border-t border-[#222222] bg-[#0c0c0c]/80 backdrop-blur-md rounded-2xl p-5 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
          {/* Brand & AI Overview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold shadow-xs">
                <Sparkles size={15} />
              </div>
              <span className="text-base font-extrabold text-white">
                Spend<span className="text-blue-500">AI</span>
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Intelligent personal expense tracking, automated transaction categorization, proactive debt payoff planning, and conversational financial reasoning.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Gemini 2.5 Active
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-[#161616] border border-[#262626] px-2 py-0.5 rounded-md">
                <Lock size={11} className="text-blue-400" />
                Client-First Privacy
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Financial Suite
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <PieChart size={13} className="text-blue-400" />
                  Dashboard Overview
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('transactions')}
                  className="text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard size={13} className="text-emerald-400" />
                  Transactions & Expenses
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('monthwise')}
                  className="text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet size={13} className="text-indigo-400" />
                  Month-wise Breakdown
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('budgets')}
                  className="text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Target size={13} className="text-amber-400" />
                  Budgets & Limits
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('debt')}
                  className="text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap size={13} className="text-purple-400" />
                  Debt Snowball & Avalanche
                </button>
              </li>
            </ul>
          </div>

          {/* Quick AI & Smart Tools */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              AI Decision Tools
            </h4>
            <ul className="space-y-2 text-xs">
              {onOpenAskMoney && (
                <li>
                  <button
                    onClick={onOpenAskMoney}
                    className="text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={13} className="text-blue-400" />
                    Ask My Money (Q&A)
                  </button>
                </li>
              )}
              {onOpenBeforeSpend && (
                <li>
                  <button
                    onClick={onOpenBeforeSpend}
                    className="text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shield size={13} className="text-amber-400" />
                    Before You Spend Advisor
                  </button>
                </li>
              )}
              {onOpenAddModal && (
                <li>
                  <button
                    onClick={onOpenAddModal}
                    className="text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard size={13} className="text-blue-400" />
                    Quick Add Transaction
                  </button>
                </li>
              )}
              <li>
                <button
                  onClick={() => onNavigate('insights')}
                  className="text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles size={13} className="text-emerald-400" />
                  Monthly AI Financial Health
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('settings')}
                  className="text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Settings size={13} className="text-gray-400" />
                  Preferences & Currency
                </button>
              </li>
            </ul>
          </div>

          {/* Data & Security Assurance */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Security & Persistence
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Your financial records are stored locally on your device with optional real-time Firebase Cloud synchronization for seamless cross-device access.
            </p>
            <div className="rounded-xl border border-[#262626] bg-[#141414] p-3 text-[11px] text-gray-400 space-y-1">
              <div className="font-semibold text-gray-200">Zero Third-Party Sell</div>
              <div>No advertising tracking. You retain complete ownership and export access of your data.</div>
            </div>
          </div>
        </div>

        {/* Bottom Bar with Copyright, Disclaimer, & Back to Top */}
        <div className="pt-6 border-t border-[#1f1f1f] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <div className="flex flex-wrap items-center gap-2 text-center sm:text-left">
            <span>© {new Date().getFullYear()} SpendAI. All rights reserved.</span>
            <span className="hidden sm:inline text-gray-600">•</span>
            <span className="text-gray-400">
              Crafted for disciplined personal budgeting and financial freedom.
            </span>
          </div>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#141414] px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-blue-500/50 hover:text-white hover:bg-[#1c1c1c] transition cursor-pointer shrink-0"
            title="Scroll back to top"
          >
            <span>Back to top</span>
            <ArrowUp size={13} />
          </button>
        </div>
      </div>
    </footer>
  );
};
