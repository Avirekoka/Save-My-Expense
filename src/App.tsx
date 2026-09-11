import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Loader2, Sparkles, ShieldAlert } from 'lucide-react';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { Footer } from './components/common/Footer';
import { EmailVerificationBanner } from './components/common/EmailVerificationBanner';
import { EmailVerificationGate } from './components/common/EmailVerificationGate';
import { PageLoadingSkeleton } from './components/common/PageLoadingSkeleton';
import { AddTransactionModal } from './components/modals/AddTransactionModal';
import { ReceiptScannerModal, ScannedReceiptData } from './components/modals/ReceiptScannerModal';
import { AskMoneyDialog } from './components/modals/AskMoneyDialog';
import { BeforeYouSpendModal } from './components/modals/BeforeYouSpendModal';
import { AuthModal } from './components/modals/AuthModal';
import { AuthProvider, useAuth } from './services/firebase/AuthContext';
import { ThemeProvider } from './services/theme/ThemeContext';
import { RouterProvider, useRouter, AppRoute, ROUTE_PATHS } from './router/RouterContext';
import { storageService, NOTIFY_EVENT } from './services/storage/storage.service';
import { Transaction } from './types';
import { getCurrencySymbol } from './utils/currency';
import { getCurrentMonth } from './utils/formatters';
import { initGlobalModalScrollListener } from './hooks/useScrollLock';

// Code-split page components (lazy loaded on route request)
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const TransactionsPage = React.lazy(() => import('./pages/TransactionsPage'));
const MonthWisePage = React.lazy(() => import('./pages/MonthWisePage'));
const StatementsPage = React.lazy(() => import('./pages/StatementsPage'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const BudgetsPage = React.lazy(() => import('./pages/BudgetsPage'));
const GoalsPage = React.lazy(() => import('./pages/GoalsPage'));
const InsightsPage = React.lazy(() => import('./pages/InsightsPage'));
const DebtPage = React.lazy(() => import('./pages/DebtPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));

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
  const { user, loading, signInAsDemo, logOut } = useAuth();
  const { currentRoute, navigate } = useRouter();
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
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
  const [monthlyIncome, setMonthlyIncome] = useState<number>(() => {
    return storageService.isDemoUser() ? 120000 : (storageService.getUserProfile().monthlyIncome || 0);
  });
  const [monthlyExpense, setMonthlyExpense] = useState<number>(0);
  const [heatmapDateRange, setHeatmapDateRange] = useState<{ start: string; end: string } | null>(null);
  const mainScrollRef = useRef<HTMLElement>(null);

  // Route Access Guard: redirect unauthenticated users away from restricted routes
  useEffect(() => {
    if (!loading) {
      if (!user) {
        if (RESTRICTED_ROUTES.includes(currentRoute as any)) {
          navigate('landing');
        }
      } else {
        if (currentRoute === 'landing') {
          navigate('dashboard');
        }
      }
    }
  }, [user, loading, currentRoute, navigate]);

  // Route Navigation Handler
  const handleNavigate = (targetView: string) => {
    if (!user && RESTRICTED_ROUTES.includes(targetView as any)) {
      setAccessDeniedNotice(`Authentication required to view ${targetView}. Please sign in or register.`);
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      navigate('landing');
      return;
    }
    setAccessDeniedNotice(null);
    navigate(targetView as AppRoute);
    if (isMobileSidebarOpen) setIsMobileSidebarOpen(false);
  };

  // Action Guard: Blocks unauthenticated or unconfirmed email users from performing actions
  const requireAuthForAction = (actionName: string, callback: () => void) => {
    if (!user) {
      setAccessDeniedNotice(`You must be logged in to ${actionName}.`);
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      return;
    }
    if (user.emailVerified === false) {
      window.dispatchEvent(
        new CustomEvent('spendai-toast', {
          detail: {
            type: 'warning',
            title: 'Email Confirmation Required',
            message: `Please verify your email address (${user.email}) to ${actionName}.`,
          },
        })
      );
      return;
    }
    callback();
  };

  // Scroll to top whenever currentRoute changes
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentRoute]);

  const refreshFinancials = () => {
    const profile = storageService.getUserProfile();
    const isDemo = storageService.isDemoUser();
    setMonthlyIncome(profile.monthlyIncome || (isDemo ? 120000 : 0));
    setCurrencySymbol(profile.currencySymbol || profile.currency || '₹');

    const allTransactions = storageService.getTransactions();
    const monthExpenses = allTransactions
      .filter((t) => {
        if (selectedMonth === 'all') return t.type === 'expense' || t.type === 'loan_emi';
        return (t.type === 'expense' || t.type === 'loan_emi') && t.date.startsWith(selectedMonth);
      })
      .reduce((sum, t) => sum + t.amount, 0);

    setMonthlyExpense(monthExpenses > 0 ? monthExpenses : (isDemo ? 72450 : 0));
  };

  // Global modal listener for scroll locking
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
      const isSeedEmail =
        currentProfile.email === 'ashwin.finance@spendai.io' ||
        currentProfile.email === 'user@example.com';
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
  if (!user || currentRoute === 'landing') {
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

        <Suspense fallback={<PageLoadingSkeleton />}>
          <LandingPage
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'signin');
              setIsAuthModalOpen(true);
            }}
            onInstantDemo={async () => {
              await signInAsDemo();
              navigate('dashboard');
            }}
          />
        </Suspense>

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
    <div
      id="app-root-container"
      className="h-screen h-[100dvh] max-h-screen overflow-hidden bg-[#0a0a0a] text-[#e5e5e5] font-sans flex flex-col selection:bg-blue-600 selection:text-white"
    >
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

      {/* Email Verification Alert Banner for Unverified Accounts */}
      <EmailVerificationBanner />

      {/* Main Layout Container */}
      <div className="flex flex-1 min-h-0 h-full max-h-[calc(100dvh-4rem)] overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeView={currentRoute}
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

        {/* Dynamic Content View Area with Suspense Page Code-Splitting */}
        <main
          ref={mainScrollRef}
          id="main-content-scroll"
          className="flex-1 min-h-0 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-between"
        >
          <div className="max-w-7xl mx-auto w-full flex-1">
            <Suspense fallback={<PageLoadingSkeleton />}>
              {user && user.emailVerified === false && currentRoute !== 'settings' ? (
                <EmailVerificationGate
                  attemptedFeature={
                    currentRoute === 'dashboard' ? 'Financial Dashboard' :
                    currentRoute === 'transactions' ? 'Expense & Income Records' :
                    currentRoute === 'monthwise' ? 'Monthly Breakdown' :
                    currentRoute === 'statements' ? 'AI Statement Parser' :
                    currentRoute === 'analytics' ? 'Analytics & Cash Flow' :
                    currentRoute === 'budgets' ? 'Budget Planner' :
                    currentRoute === 'goals' ? 'Savings Simulator' :
                    currentRoute === 'insights' ? 'AI Spending Insights' :
                    currentRoute === 'debt' ? 'Debt & EMI Planner' :
                    'Financial Suite'
                  }
                  onSignOut={logOut}
                />
              ) : (
                <>
                  {currentRoute === 'dashboard' && (
                    <DashboardPage
                      currentMonth={selectedMonth}
                      currencySymbol={currencySymbol}
                      onNavigate={handleNavigate}
                      onOpenAddModal={() => handleOpenAdd()}
                      onOpenBeforeSpend={handleOpenBeforeSpend}
                      onOpenAskMoney={handleOpenAskMoney}
                      onOpenScanReceipt={handleOpenScanReceipt}
                    />
                  )}

                  {currentRoute === 'transactions' && (
                    <TransactionsPage
                      currentMonth={selectedMonth}
                      currencySymbol={currencySymbol}
                      onOpenAddModal={handleOpenAdd}
                      onOpenScanReceipt={handleOpenScanReceipt}
                      onSelectMonth={setSelectedMonth}
                      initialStartDate={heatmapDateRange?.start}
                      initialEndDate={heatmapDateRange?.end}
                      onClearDateRange={() => setHeatmapDateRange(null)}
                    />
                  )}

                  {currentRoute === 'monthwise' && (
                    <MonthWisePage
                      currencySymbol={currencySymbol}
                      onNavigate={handleNavigate}
                      onSelectMonth={(month) => {
                        setSelectedMonth(month);
                        handleNavigate('transactions');
                      }}
                      onOpenAddModal={() => handleOpenAdd()}
                    />
                  )}

                  {currentRoute === 'statements' && (
                    <StatementsPage
                      currencySymbol={currencySymbol}
                      onNavigate={handleNavigate}
                    />
                  )}

                  {currentRoute === 'analytics' && (
                    <AnalyticsPage
                      currentMonth={selectedMonth}
                      currencySymbol={currencySymbol}
                      onNavigate={handleNavigate}
                      onOpenAddModal={handleOpenAdd}
                      onNavigateToTransactions={(startDate, endDate) => {
                        setHeatmapDateRange({ start: startDate, end: endDate });
                        handleNavigate('transactions');
                      }}
                    />
                  )}

                  {currentRoute === 'budgets' && (
                    <BudgetsPage
                      currentMonth={selectedMonth}
                      currencySymbol={currencySymbol}
                    />
                  )}

                  {currentRoute === 'goals' && (
                    <GoalsPage currencySymbol={currencySymbol} />
                  )}

                  {currentRoute === 'insights' && (
                    <InsightsPage
                      currentMonth={selectedMonth}
                      currencySymbol={currencySymbol}
                    />
                  )}

                  {currentRoute === 'debt' && (
                    <DebtPage currencySymbol={currencySymbol} />
                  )}

                  {currentRoute === 'settings' && (
                    <SettingsPage
                      currencySymbol={currencySymbol}
                      onUpdateCurrency={setCurrencySymbol}
                      onNavigate={handleNavigate}
                      onOpenAuthModal={() => {
                        setAuthModalMode('signin');
                        setIsAuthModalOpen(true);
                      }}
                    />
                  )}
                </>
              )}
            </Suspense>
          </div>

          <Footer
            onNavigate={handleNavigate}
            onOpenAskMoney={handleOpenAskMoney}
            onOpenBeforeSpend={handleOpenBeforeSpend}
            onOpenAddModal={() => handleOpenAdd()}
            onOpenScanReceipt={handleOpenScanReceipt}
            currencySymbol={currencySymbol}
          />
        </main>
      </div>

      {/* Global Interactive Modals */}
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

function RootRouterApp() {
  const { user } = useAuth();
  return (
    <RouterProvider isAuthenticated={Boolean(user)}>
      <MainAppContent />
    </RouterProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <RootRouterApp />
      </ThemeProvider>
    </AuthProvider>
  );
}
