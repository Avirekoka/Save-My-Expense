import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { TransactionsView } from './components/views/TransactionsView';
import { StatementsView } from './components/views/StatementsView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { BudgetsView } from './components/views/BudgetsView';
import { SubscriptionsView } from './components/views/SubscriptionsView';
import { GoalsView } from './components/views/GoalsView';
import { InsightsView } from './components/views/InsightsView';
import { DebtView } from './components/views/DebtView';
import { SettingsView } from './components/views/SettingsView';
import { AddTransactionModal } from './components/modals/AddTransactionModal';
import { AskMoneyDialog } from './components/modals/AskMoneyDialog';
import { BeforeYouSpendModal } from './components/modals/BeforeYouSpendModal';
import { storageService, NOTIFY_EVENT } from './services/storage/storage.service';
import { Transaction } from './types';

export default function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [currencySymbol, setCurrencySymbol] = useState<string>('₹');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isAskMoneyOpen, setIsAskMoneyOpen] = useState<boolean>(false);
  const [isBeforeSpendOpen, setIsBeforeSpendOpen] = useState<boolean>(false);

  // Profile data
  const [monthlyIncome, setMonthlyIncome] = useState<number>(120000);
  const [monthlyExpense, setMonthlyExpense] = useState<number>(72450);

  const refreshFinancials = () => {
    const profile = storageService.getUserProfile();
    setCurrencySymbol(profile.currency || '₹');
    setMonthlyIncome(profile.monthlyIncome || 120000);

    const summary = storageService.calculateMonthSummary(
      selectedMonth === 'all' ? '2026-08' : selectedMonth
    );
    setMonthlyExpense(summary.totalExpenses);
  };

  useEffect(() => {
    refreshFinancials();
    window.addEventListener(NOTIFY_EVENT, refreshFinancials);
    return () => window.removeEventListener(NOTIFY_EVENT, refreshFinancials);
  }, [selectedMonth]);

  const handleOpenAdd = (tx?: Transaction) => {
    setEditingTransaction(tx || null);
    setIsAddModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header
        currentMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        onChangeMonth={setSelectedMonth}
        onOpenAddModal={() => handleOpenAdd()}
        onOpenAddTransaction={() => handleOpenAdd()}
        onOpenAskMoney={() => setIsAskMoneyOpen(true)}
        onOpenBeforeSpend={() => setIsBeforeSpendOpen(true)}
        onNavigate={setActiveView}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeView={activeView}
          onSelectView={setActiveView}
          monthlyIncome={monthlyIncome}
          monthlyExpense={monthlyExpense}
          currencySymbol={currencySymbol}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Dynamic Content View Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {activeView === 'dashboard' && (
              <DashboardView
                currentMonth={selectedMonth}
                currencySymbol={currencySymbol}
                onNavigate={setActiveView}
                onOpenAddModal={() => handleOpenAdd()}
                onOpenBeforeSpend={() => setIsBeforeSpendOpen(true)}
                onOpenAskMoney={() => setIsAskMoneyOpen(true)}
              />
            )}

            {activeView === 'transactions' && (
              <TransactionsView
                currentMonth={selectedMonth}
                currencySymbol={currencySymbol}
                onOpenAddModal={handleOpenAdd}
              />
            )}

            {activeView === 'statements' && (
              <StatementsView
                currencySymbol={currencySymbol}
                onNavigate={setActiveView}
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

            {activeView === 'subscriptions' && (
              <SubscriptionsView currencySymbol={currencySymbol} />
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
              />
            )}
          </div>
        </main>
      </div>

      {/* Interactive Modals */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTransaction(null);
        }}
        editingTransaction={editingTransaction}
        currencySymbol={currencySymbol}
        onSuccess={refreshFinancials}
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
    </div>
  );
}
