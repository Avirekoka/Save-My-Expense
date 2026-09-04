import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Sparkles, ShieldAlert, LogIn, UserPlus } from 'lucide-react';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { Footer } from './components/common/Footer';
import { DashboardView } from './components/views/DashboardView';
import { TransactionsView } from './components/views/TransactionsView';
import { MonthWiseExpenseView } from './components/views/MonthWiseExpenseView';
import { StatementsView } from './components/views/StatementsView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { BudgetsView } from './components/views/BudgetsView';
import { GoalsView } from './components/views/GoalsView';
import { InsightsView } from './components/views/InsightsView';
import { DebtView } from './components/views/DebtView';
import { SettingsView } from './components/views/SettingsView';
import { LandingPageView } from './components/views/LandingPageView';
import { AddTransactionModal } from './components/modals/AddTransactionModal';
import { ReceiptScannerModal, ScannedReceiptData } from './components/modals/ReceiptScannerModal';
import { AskMoneyDialog } from './components/modals/AskMoneyDialog';
import { BeforeYouSpendModal } from './components/modals/BeforeYouSpendModal';
import { AuthModal } from './components/modals/AuthModal';
import { AuthProvider, useAuth } from './services/firebase/AuthContext';
import { storageService, NOTIFY_EVENT } from './services/storage/storage.service';
import { Transaction } from './types';
import { getCurrencySymbol } from './utils/currency';
import { initGlobalModalScrollListener } from './hooks/useScrollLock';

// Route Access Categories
export const RESTRICTED_ROUTES = [
  'dashboard',
  'transactions',
  'monthwise',
  'statements',
  'analytics',
  'budgets',
  'goals',
  'insights',
  'debt',
  'settings',
] as const;

export const PUBLIC_ROUTES = ['landing'] as const;

export type RouteView = (typeof RESTRICTED_ROUTES)[number] | (typeof PUBLIC_ROUTES)[number];

function MainAppContent() {
  const { user, loading, signInAsDemo } = useAuth();
  const [activeView, setActiveView] = useState<RouteView>(user ? 'dashboard' : 'landing');
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [currencySymbol, setCurrencySymbol] = useState<string>('₹');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [accessDeniedNotice, setAccessDeniedNotice] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState<boolean>(false);
  const [scannedReceiptForModal, setScannedReceiptForModal] = useState<ScannedReceiptData | null>(null);
  const [isAskMoneyOpen, setIsAskMoneyOpen] = useState<boolean>(false);
  const [isBeforeSpendOpen, setIsBeforeSpendOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Profile data
  const [monthlyIncome, setMonthlyIncome] = useState<number>(120000);
  const [monthlyExpense, setMonthlyExpense] = useState<number>(72450);
  const mainScrollRef = useRef<HTMLElement>(null);

  // Synchronize view with authentication status
  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Unauthenticated: Strictly forbid restricted routes
        if (RESTRICTED_ROUTES.includes(activeView as any)) {
          setActiveView('landing');
        }
      } else {
        // Authenticated: If user was on the landing page, transition into dashboard
        if (activeView === 'landing') {
          setActiveView('dashboard');
        }
      }
    }
  }, [user, loading, activeView]);

  // Route Navigation Guard: Blocks unauthenticated access to restricted views
  const handleNavigate = (targetView: string) => {
    if (!user && RESTRICTED_ROUTES.includes(targetView as any)) {
      setAccessDeniedNotice(`Authentication required to view ${targetView}. Please sign in or register.`);
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      setActiveView('landing');
      return;
    }
    setAccessDeniedNotice(null);
    setActiveView(targetView as RouteView);
    if (isMobileSidebarOpen) setIsMobileSidebarOpen(false);
  };

  // Action Guard: Blocks unauthenticated users from performing any actions
  const requireAuthForAction = (actionName: string, callback: () => void) => {
    if (!user) {
      setAccessDeniedNotice(`You must be logged in to ${actionName}.`);
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      return;
    }
    callback();
  };

  // Scroll to top whenever activeView changes
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeView]);

  const refreshFinancials = () => {
    const profile = storageService.getUserProfile();
    setCurrencySymbol(getCurrencySymbol(profile.currencySymbol || profile.currency || '₹'));
    setMonthlyIncome(profile.monthlyIncome || 120000);

    const summary = storageService.calculateMonthSummary(
      selectedMonth === 'all' ? '2026-08' : selectedMonth
    );
    setMonthlyExpense(summary.totalExpenses);
  };

  useEffect(() => {
    return initGlobalModalScrollListener();
  }, []);

  useEffect(() => {
    refreshFinancials();
    window.addEventListener(NOTIFY_EVENT, refreshFinancials);
    return () => window.removeEventListener(NOTIFY_EVENT, refreshFinancials);
  }, [selectedMonth]);

  // Update profile with user metadata when logged in
  useEffect(() => {
    if (user && !storageService.isDemoUser()) {
      const currentProfile = storageService.getUserProfile();
      const isSeedEmail = currentProfile.email === 'ashwin.finance@spendai.io' || currentProfile.email === 'user@example.com';
      if (user.email && (!currentProfile.email || isSeedEmail)) {
        storageService.saveUserProfile({
          ...currentProfile,
          name: user.displayName || currentProfile.name || 'Personal Account',
          email: user.email,
          ...(user.photoURL && !currentProfile.photoURL ? { photoURL: user.photoURL } : {}),
        });
      }
    }
  }, [user]);

  const handleOpenAdd = (tx?: Transaction) => {
    requireAuthForAction('add or edit transactions', () => {
      setEditingTransaction(tx || null);
      setScannedReceiptForModal(null);
      setIsAddModalOpen(true);
    });
  };

  const handleOpenScanReceipt = () => {
    requireAuthForAction('scan receipts with OCR', () => {
      setIsReceiptScannerOpen(true);
    });
  };

  const handleReceiptScanned = (scannedData: ScannedReceiptData) => {
    setEditingTransaction(null);
    setScannedReceiptForModal(scannedData);
    setIsReceiptScannerOpen(false);
    setIsAddModalOpen(true);
  };

  const handleOpenAskMoney = () => {
    requireAuthForAction('consult the AI financial advisor', () => {
      setIsAskMoneyOpen(true);
    });
  };

  const handleOpenBeforeSpend = () => {
    requireAuthForAction('evaluate purchase decisions', () => {
      setIsBeforeSpendOpen(true);
    });
  };

  // Initial authentication loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center text-white px-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold shadow-xl shadow-blue-500/25 animate-pulse mb-4">
          <Sparkles size={28} />
        </div>
        <div className="text-sm font-bold tracking-tight text-white">SpendAI Financial Intelligence</div>
        <div className="text-xs text-gray-400 mt-2 flex items-center gap-2">
          <Loader2 size={13} className="animate-spin text-blue-400" />
          <span>Securing workspace credentials...</span>
        </div>
      </div>
    );
  }

  // NON-RESTRICTED ROUTE: Unauthenticated Landing Page
  if (!user || activeView === 'landing') {
    return (
      <>
        {/* Access Denied Banner if user was redirected */}
        {accessDeniedNotice && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-[#17140f] px-4 py-2.5 text-xs text-amber-200 shadow-2xl animate-in fade-in slide-in-from-top-4">
            <ShieldAlert size={16} className="text-amber-400 shrink-0" />
            <span>{accessDeniedNotice}</span>
            <button
              onClick={() => {
                setAuthModalMode('signin');
                setIsAuthModalOpen(true);
              }}
              className="ml-2 font-bold underline text-white hover:text-amber-300 cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => setAccessDeniedNotice(null)}
              className="ml-1 text-gray-400 hover:text-white cursor-pointer"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <LandingPageView
          onOpenAuth={(mode) => {
            setAuthModalMode(mode || 'signin');
            setIsAuthModalOpen(true);
          }}
          onInstantDemo={async () => {
            await signInAsDemo();
            setActiveView('dashboard');
          }}
        />

        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authModalMode}
        />
      </>
    );
  }

  // RESTRICTED ROUTES: Authenticated Workspace
  return (
    <div className="h-screen h-[100dvh] max-h-screen overflow-hidden bg-[#0a0a0a] text-[#e5e5e5] font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header
        currentMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        onChangeMonth={setSelectedMonth}
        onOpenAddModal={() => handleOpenAdd()}
        onOpenAddTransaction={() => handleOpenAdd()}
        onOpenScanReceipt={handleOpenScanReceipt}
        onOpenAskMoney={handleOpenAskMoney}
        onOpenBeforeSpend={handleOpenBeforeSpend}
        onOpenAuthModal={() => {
          setAuthModalMode('signin');
          setIsAuthModalOpen(true);
        }}
        onNavigate={handleNavigate}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* Main Layout Container */}
      <div className="flex flex-1 min-h-0 h-[calc(100vh-4rem)] overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeView={activeView}
          onSelectView={handleNavigate}
          monthlyIncome={monthlyIncome}
          monthlyExpense={monthlyExpense}
          currencySymbol={currencySymbol}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          currentMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          onOpenAddTransaction={() => handleOpenAdd()}
          onOpenScanReceipt={handleOpenScanReceipt}
          onOpenBeforeSpend={handleOpenBeforeSpend}
          onOpenAskMoney={handleOpenAskMoney}
          onOpenAuthModal={() => {
            setAuthModalMode('signin');
            setIsAuthModalOpen(true);
          }}
        />

        {/* Dynamic Content View Area */}
        <main
          ref={mainScrollRef}
          id="main-content-scroll"
          className="flex-1 min-h-0 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-between"
        >
          <div className="max-w-7xl mx-auto w-full flex-1">
            {activeView === 'dashboard' && (
              <DashboardView
                currentMonth={selectedMonth}
                currencySymbol={currencySymbol}
                onNavigate={handleNavigate}
                onOpenAddModal={() => handleOpenAdd()}
                onOpenBeforeSpend={handleOpenBeforeSpend}
                onOpenAskMoney={handleOpenAskMoney}
                onOpenScanReceipt={handleOpenScanReceipt}
              />
            )}

            {activeView === 'transactions' && (
              <TransactionsView
                currentMonth={selectedMonth}
                currencySymbol={currencySymbol}
                onOpenAddModal={handleOpenAdd}
                onOpenScanReceipt={handleOpenScanReceipt}
              />
            )}

            {activeView === 'monthwise' && (
              <MonthWiseExpenseView
                currencySymbol={currencySymbol}
                onNavigate={handleNavigate}
                onSelectMonth={(month) => {
                  setSelectedMonth(month);
                  handleNavigate('transactions');
                }}
                onOpenAddModal={() => handleOpenAdd()}
              />
            )}

            {activeView === 'statements' && (
              <StatementsView
                currencySymbol={currencySymbol}
                onNavigate={handleNavigate}
              />
            )}

            {activeView === 'analytics' && (
              <AnalyticsView
                currentMonth={selectedMonth}
                currencySymbol={currencySymbol}
              />
            )}

            {activeView === 'budgets' && (
              <BudgetsView
                currentMonth={selectedMonth}
                currencySymbol={currencySymbol}
              />
            )}

            {activeView === 'goals' && (
              <GoalsView currencySymbol={currencySymbol} />
            )}

            {activeView === 'insights' && (
              <InsightsView
                currentMonth={selectedMonth}
                currencySymbol={currencySymbol}
              />
            )}

            {activeView === 'debt' && (
              <DebtView currencySymbol={currencySymbol} />
            )}

            {activeView === 'settings' && (
              <SettingsView
                currencySymbol={currencySymbol}
                onUpdateCurrency={setCurrencySymbol}
                onOpenAuthModal={() => {
                  setAuthModalMode('signin');
                  setIsAuthModalOpen(true);
                }}
              />
            )}
          </div>

          <Footer
            onNavigate={handleNavigate}
            onOpenAskMoney={handleOpenAskMoney}
            onOpenBeforeSpend={handleOpenBeforeSpend}
            onOpenAddModal={() => handleOpenAdd()}
          />
        </main>
      </div>

      {/* Interactive Modals - Only rendered & accessible for authenticated users */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTransaction(null);
          setScannedReceiptForModal(null);
        }}
        editingTransaction={editingTransaction}
        initialReceiptData={scannedReceiptForModal}
        currencySymbol={currencySymbol}
        onSuccess={refreshFinancials}
      />

      <ReceiptScannerModal
        isOpen={isReceiptScannerOpen}
        onClose={() => setIsReceiptScannerOpen(false)}
        onReceiptScanned={handleReceiptScanned}
        currencySymbol={currencySymbol}
      />

      <AskMoneyDialog
        isOpen={isAskMoneyOpen}
        onClose={() => setIsAskMoneyOpen(false)}
        currencySymbol={currencySymbol}
      />

      <BeforeYouSpendModal
        isOpen={isBeforeSpendOpen}
        onClose={() => setIsBeforeSpendOpen(false)}
        currencySymbol={currencySymbol}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}

