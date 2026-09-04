import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Lock,
  LogIn,
  UserPlus,
  Zap,
  BarChart3,
  Receipt,
  Wallet,
  TrendingUp,
  Bot,
  FileSpreadsheet,
  CheckCircle2,
  Calculator,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Flame,
  CreditCard,
  Target,
  Clock,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../services/firebase/AuthContext';

interface LandingPageViewProps {
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onInstantDemo: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenAuth,
  onInstantDemo,
}) => {
  const { isIframe, openInNewTab } = useAuth();

  // Interactive Calculator State
  const [monthlySpend, setMonthlySpend] = useState<number>(65000);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Computed leakage estimates
  const estimatedSubsLeak = Math.round(monthlySpend * 0.042);
  const estimatedImpulseLeak = Math.round(monthlySpend * 0.058);
  const estimatedAnnualSavings = (estimatedSubsLeak + estimatedImpulseLeak) * 12;

  const faqs = [
    {
      q: 'Do I need to enter my actual net banking password?',
      a: 'Never. SpendAI strictly operates without asking for your banking passwords or credentials. You can drag and drop official bank statements (PDF, CSV, Excel), snap photos of receipts with OCR, or record expenses manually in your private ledger.',
    },
    {
      q: 'How does SpendAI detect hidden money leaks?',
      a: 'Our smart rule engine and Gemini AI analyze your historical transaction patterns to flag forgotten subscription renewals, recurring delivery micro-fees, price creep on frequent utilities, and sudden velocity spikes before your monthly budget is breached.',
    },
    {
      q: 'Is my data private and encrypted?',
      a: 'Yes. Every record is stored with end-to-end user UID segregation in Google Firebase Firestore. Your financial numbers are never monetized, never shared with third-party loan sharks, and never used to train public models.',
    },
    {
      q: 'Can I test the application before registering an account?',
      a: 'Absolutely. Click "1-Click Instant Demo" on this page to immediately enter the complete application with realistic pre-populated data and explore all AI features in under two seconds.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-[#e5e5e5] font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden">
      {/* Fixed Top Header Container */}
      <div className="fixed top-0 inset-x-0 z-50 bg-[#080808]/90 backdrop-blur-md border-b border-[#1f1f1f] shadow-lg shadow-black/40">
        {/* Top Floating Announcement Bar (if iframe) */}
        {isIframe && (
          <div className="bg-blue-600/20 border-b border-blue-500/20 px-3 py-1.5 text-center text-[11px] sm:text-xs text-blue-300 flex items-center justify-center gap-2 flex-wrap">
            <span>Running in preview container.</span>
            <button
              onClick={openInNewTab}
              className="font-bold underline text-white hover:text-blue-200 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Open in Full Tab</span>
              <ExternalLink size={12} />
            </button>
          </div>
        )}

        {/* Navigation Header */}
        <header className="w-full relative">
          <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-3 sm:px-6 lg:px-8">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20 shrink-0">
                <Sparkles size={17} />
              </div>
              <div className="flex items-center">
                <span className="text-sm sm:text-base font-extrabold text-white tracking-tight">Spend</span>
                <span className="text-sm sm:text-base font-extrabold text-blue-500">AI</span>
                <span className="ml-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-blue-400">
                  PRO
                </span>
              </div>
            </div>

            {/* Desktop Nav Anchor Links + Actions */}
            <div className="hidden md:flex items-center gap-6 text-xs font-medium text-gray-400">
              <a href="#features" className="hover:text-white transition">Features</a>
              <a href="#calculator" className="hover:text-white transition">Leak Calculator</a>
              <a href="#security" className="hover:text-white transition">Security</a>
              <a href="#faq" className="hover:text-white transition">FAQ</a>

              <div className="flex items-center gap-2 ml-2 pl-4 border-l border-[#262626]">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signin')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-200 hover:text-white hover:bg-[#1a1a1a] transition cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition shadow-sm cursor-pointer"
                >
                  Get Started
                </button>
              </div>
            </div>

            {/* Mobile Header Right Controls */}
            <div className="flex md:hidden items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenAuth('signin')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition cursor-pointer shrink-0 shadow-sm"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2e2e2e] bg-[#141414] text-gray-300 hover:text-white hover:bg-[#1c1c1c] transition cursor-pointer shrink-0"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {/* Mobile Dropdown Menu Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-[#1f1f1f] bg-[#0d0d0d]/98 backdrop-blur-xl px-4 py-4 space-y-3 shadow-2xl animate-in slide-in-from-top-2 duration-150">
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-300">
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-[#161616] border border-[#242424] hover:bg-[#1f1f1f] text-center"
                >
                  Features
                </a>
                <a
                  href="#calculator"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-[#161616] border border-[#242424] hover:bg-[#1f1f1f] text-center"
                >
                  Leak Calculator
                </a>
                <a
                  href="#security"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-[#161616] border border-[#242424] hover:bg-[#1f1f1f] text-center"
                >
                  Security
                </a>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl bg-[#161616] border border-[#242424] hover:bg-[#1f1f1f] text-center"
                >
                  FAQ
                </a>
              </div>

              <div className="pt-2 border-t border-[#222] flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onInstantDemo();
                  }}
                  className="w-full min-h-[42px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  <Zap size={14} />
                  <span>1-Click Instant Demo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('signup');
                  }}
                  className="w-full min-h-[42px] py-2.5 px-3 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 transition shadow-sm cursor-pointer"
                >
                  Create Free Account
                </button>
              </div>
            </div>
          )}
        </header>
      </div>

      {/* Hero Section */}
      <section className={`relative pb-20 sm:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto ${isIframe ? 'pt-28 sm:pt-36' : 'pt-24 sm:pt-32'}`}>
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 sm:w-[600px] h-96 sm:h-[400px] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-72 h-72 bg-purple-600/10 blur-[110px] rounded-full pointer-events-none" />

        <div className="relative text-center max-w-3xl mx-auto">
          {/* Eyebrow Pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400 mb-6 shadow-xs"
          >
            <Sparkles size={13} />
            <span>Private Financial Intelligence &amp; Autonomous Expense Ledger</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]"
          >
            Intelligent Money Control. <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 via-indigo-300 to-teal-300">
              Zero Guesswork.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-sm sm:text-base text-gray-300 max-w-2xl mx-auto leading-relaxed"
          >
            All your expenses, automated PDF statement ingestion, OCR camera scanning, and real-time AI advice
            in one high-craft workspace. Sign in or create an account to unlock your personal financial ledger.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5"
          >
            <button
              onClick={() => onOpenAuth('signup')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/30 hover:bg-blue-500 transition cursor-pointer"
            >
              <span>Create Your Account</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => onInstantDemo()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-3.5 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <Zap size={16} className="text-emerald-400" />
              <span>1-Click Test Demo</span>
            </button>

            <button
              onClick={() => onOpenAuth('signin')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#141414] px-5 py-3.5 text-sm font-semibold text-gray-300 hover:bg-[#1e1e1e] hover:text-white transition cursor-pointer"
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </button>
          </motion.div>

          {/* Social Proof / Security Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400"
          >
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-emerald-400" />
              <span>Firestore UID Isolated</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock size={14} className="text-blue-400" />
              <span>No Banking Passwords Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bot size={15} className="text-indigo-400" />
              <span>Powered by Gemini AI</span>
            </div>
          </motion.div>
        </div>

        {/* Live Animated Dashboard Mockup Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="mt-14 relative rounded-2xl border border-[#262626] bg-[#0e0e0e]/80 p-2 sm:p-4 shadow-2xl backdrop-blur-xl"
        >
          {/* Mockup Header Bar */}
          <div className="flex items-center justify-between border-b border-[#202020] pb-3 px-2 sm:px-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-500/80" />
              <div className="h-3 w-3 rounded-full bg-amber-500/80" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-mono text-gray-500 hidden sm:inline">spendai.workspace.live</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Demo Preview
              </span>
              <button
                onClick={() => onInstantDemo()}
                className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Launch App →
              </button>
            </div>
          </div>

          {/* Mockup Content Grid */}
          <div className="p-3 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Metric 1: Financial Health Score */}
            <div className="rounded-xl border border-[#222] bg-[#141414] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">Financial Health Index</span>
                <span className="rounded-md bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                  STRONG
                </span>
              </div>
              <div className="my-3 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-white">88</span>
                <span className="text-xs text-gray-400">/ 100</span>
                <span className="ml-auto text-xs text-emerald-400 font-semibold flex items-center gap-0.5">
                  <TrendingUp size={13} /> +6 pts
                </span>
              </div>
              <div className="w-full bg-[#222] h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full w-[88%]" />
              </div>
            </div>

            {/* Metric 2: Detected Leaks */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                  <Flame size={14} className="text-rose-400" /> AI Money Leak Alert
                </span>
                <span className="rounded-md bg-rose-500/20 text-rose-300 px-1.5 py-0.5 text-[10px] font-bold">
                  2 FOUND
                </span>
              </div>
              <div className="my-2 space-y-1.5">
                <div className="text-xs text-gray-200 flex items-center justify-between">
                  <span>Netflix 4K (Double billed)</span>
                  <span className="font-bold text-rose-400">₹649/mo</span>
                </div>
                <div className="text-xs text-gray-200 flex items-center justify-between">
                  <span>Food Delivery Creep</span>
                  <span className="font-bold text-amber-400">+₹3,400</span>
                </div>
              </div>
              <button
                onClick={() => onOpenAuth('signup')}
                className="mt-2 w-full text-center text-[11px] font-semibold text-rose-300 hover:text-white transition cursor-pointer"
              >
                Scan Your Ledger Free →
              </button>
            </div>

            {/* Metric 3: AI Advisor Snippet */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                  <Bot size={14} className="text-blue-400" /> Ask SpendAI Advisor
                </span>
                <span className="rounded-md bg-blue-500/20 text-blue-300 px-1.5 py-0.5 text-[10px] font-bold">
                  GEMINI 2.5
                </span>
              </div>
              <p className="my-2 text-xs text-gray-300 italic border-l-2 border-blue-500/50 pl-2">
                &quot;Can I afford the ₹18,000 weekend trip?&quot;
              </p>
              <div className="text-[11px] text-blue-200 bg-[#121826] rounded-lg p-2 leading-relaxed">
                &quot;Yes, you have ₹34,200 surplus savings this month. Your emergency fund remains intact.&quot;
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Interactive Leak Calculator Section */}
      <section id="calculator" className="scroll-mt-24 sm:scroll-mt-28 py-16 bg-[#0d0d0d] border-y border-[#1c1c1c] px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-400 mb-2">
              <Calculator size={13} />
              <span>Interactive ROI Simulator</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              See How Much Hidden Money You Could Recover
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-2">
              Most households lose 8% to 12% of their monthly income to forgotten subscriptions, micro-delivery fees, and untracked impulse buys.
            </p>
          </div>

          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-gray-300">Your Monthly Total Spending</label>
                <div className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                  ₹{monthlySpend.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {[30000, 65000, 120000, 200000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMonthlySpend(val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      monthlySpend === val
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#202020] text-gray-400 hover:text-white'
                    }`}
                  >
                    ₹{(val / 1000)}k
                  </button>
                ))}
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="15000"
              max="350000"
              step="5000"
              value={monthlySpend}
              onChange={(e) => setMonthlySpend(Number(e.target.value))}
              className="w-full h-2 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[11px] text-gray-500 mt-2 font-mono">
              <span>₹15,000/mo</span>
              <span>₹1,50,000/mo</span>
              <span>₹3,50,000/mo</span>
            </div>

            {/* Calculation Output Cards */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#222] pt-6">
              <div className="rounded-xl bg-[#1a1a1a] p-3.5 text-center">
                <div className="text-[11px] text-gray-400 font-medium">Unnoticed Subscriptions</div>
                <div className="text-lg font-bold text-amber-400 mt-1">
                  ₹{estimatedSubsLeak.toLocaleString('en-IN')}<span className="text-xs font-normal text-gray-400">/mo</span>
                </div>
              </div>

              <div className="rounded-xl bg-[#1a1a1a] p-3.5 text-center">
                <div className="text-[11px] text-gray-400 font-medium">Impulse &amp; Delivery Leaks</div>
                <div className="text-lg font-bold text-rose-400 mt-1">
                  ₹{estimatedImpulseLeak.toLocaleString('en-IN')}<span className="text-xs font-normal text-gray-400">/mo</span>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 text-center">
                <div className="text-[11px] text-emerald-300 font-bold">Estimated Annual Recovery</div>
                <div className="text-xl font-extrabold text-emerald-400 mt-0.5">
                  ₹{estimatedAnnualSavings.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => onOpenAuth('signup')}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white hover:bg-blue-500 shadow-md shadow-blue-600/30 transition cursor-pointer"
              >
                <span>Register to Plug Your Money Leaks</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section id="features" className="scroll-mt-24 sm:scroll-mt-28 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400">Inside The Platform</h2>
          <h3 className="text-2xl sm:text-4xl font-extrabold text-white mt-2 tracking-tight">
            Designed for Financial Clarity
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            Every screen was engineered to help you master cash flow without manual spreadsheet chores.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="rounded-2xl border border-[#262626] bg-[#121212] p-5 hover:border-blue-500/40 transition">
            <div className="h-10 w-10 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-4">
              <Receipt size={20} />
            </div>
            <h4 className="text-base font-bold text-white">OCR Camera Receipt Scanner</h4>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Snap photos of paper receipts or bills. Optical Character Recognition automatically extracts items, tax, amounts, and dates.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-[#262626] bg-[#121212] p-5 hover:border-indigo-500/40 transition">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4">
              <FileSpreadsheet size={20} />
            </div>
            <h4 className="text-base font-bold text-white">Bank Statement Ingestion</h4>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Drop PDFs, CSVs, or Excel files from HDFC, SBI, ICICI, or any bank. Our parser standardizes noisy merchant strings into clean records.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-[#262626] bg-[#121212] p-5 hover:border-purple-500/40 transition">
            <div className="h-10 w-10 rounded-xl bg-purple-600/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4">
              <Bot size={20} />
            </div>
            <h4 className="text-base font-bold text-white">Gemini Conversational Advisor</h4>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Query your data naturally or run &quot;Before-You-Spend&quot; impulse checks before buying high-ticket gadgets or booking vacations.
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-2xl border border-[#262626] bg-[#121212] p-5 hover:border-emerald-500/40 transition">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4">
              <CreditCard size={20} />
            </div>
            <h4 className="text-base font-bold text-white">Debt &amp; EMI Amortization</h4>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Model home loans, car EMIs, and personal debts with interactive prepayment calculators to eliminate interest years ahead of schedule.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Architecture Section */}
      <section id="security" className="scroll-mt-24 sm:scroll-mt-28 py-16 bg-[#0c0c0c] border-t border-[#1e1e1e] px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto rounded-2xl border border-blue-500/20 bg-linear-to-b from-blue-950/20 to-transparent p-6 sm:p-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-400">
                <ShieldCheck size={14} />
                <span>Zero Compromises on Security</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                Your Financial Privacy is Non-Negotiable
              </h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                SpendAI is built with Google Firebase Firestore security rules ensuring strict UID isolation.
                Only your authenticated user ID can ever query or modify your transactions.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>Encrypted Cloud Sync</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>No Bank Credential Harvesting</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>One-Click Full Data Export</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>Permanent Account Purge Anytime</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 w-full sm:w-auto text-center">
              <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-6 shadow-xl">
                <div className="text-xs text-gray-400 font-semibold mb-2">Ready to take command?</div>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>Create Account</span>
                </button>
                <div className="text-[11px] text-gray-500 mt-3">
                  Or test with{' '}
                  <button
                    onClick={() => onInstantDemo()}
                    className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                  >
                    1-Click Instant Demo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section id="faq" className="scroll-mt-24 sm:scroll-mt-28 py-20 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Questions &amp; Answers</h2>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Frequently Asked Questions</h3>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[#262626] bg-[#121212] overflow-hidden transition"
            >
              <button
                type="button"
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 text-left text-xs sm:text-sm font-semibold text-white hover:text-blue-400 transition cursor-pointer"
              >
                <span>{faq.q}</span>
                {expandedFaq === idx ? (
                  <ChevronUp size={16} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400 shrink-0" />
                )}
              </button>
              {expandedFaq === idx && (
                <div className="px-4 pb-4 text-xs text-gray-400 leading-relaxed border-t border-[#1c1c1c] pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1c1c1c] bg-[#070707] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">SpendAI Intelligence</span>
            <span>•</span>
            <span>Secure Expense Architecture</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => onOpenAuth('signin')} className="hover:text-gray-300 transition cursor-pointer">
              Sign In
            </button>
            <button onClick={() => onOpenAuth('signup')} className="hover:text-gray-300 transition cursor-pointer">
              Register
            </button>
            <button onClick={() => onInstantDemo()} className="hover:text-gray-300 transition cursor-pointer">
              Instant Demo
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
