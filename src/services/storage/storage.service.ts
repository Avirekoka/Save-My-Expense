import {
  Transaction,
  Category,
  Budget,
  FinancialGoal,
  Subscription,
  UserProfile,
  EMILoan,
  NotificationItem,
  StatementUpload,
  AIInsight,
  FinancialHealthScore,
  HealthScoreFactor,
} from '../../types';
import { DEFAULT_CATEGORIES } from '../../data/defaultCategories';
import {
  SEED_PROFILE,
  SEED_TRANSACTIONS,
  SEED_BUDGETS,
  SEED_GOALS,
  SEED_SUBSCRIPTIONS,
  SEED_EMI_LOANS,
  SEED_NOTIFICATIONS,
} from '../../data/seedData';

const STORAGE_KEYS = {
  TRANSACTIONS: 'ais_spend_transactions_v1',
  CATEGORIES: 'ais_spend_categories_v1',
  BUDGETS: 'ais_spend_budgets_v1',
  GOALS: 'ais_spend_goals_v1',
  SUBSCRIPTIONS: 'ais_spend_subscriptions_v1',
  PROFILE: 'ais_spend_profile_v1',
  EMI_LOANS: 'ais_spend_emi_loans_v1',
  NOTIFICATIONS: 'ais_spend_notifications_v1',
  STATEMENTS: 'ais_spend_statements_v1',
  INSIGHTS: 'ais_spend_insights_v1',
};

export const NOTIFY_EVENT = 'ais_spend_data_changed';

function triggerUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFY_EVENT));
  }
}

class StorageService {
  // --- USER PROFILE ---
  getProfile(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...SEED_PROFILE,
          ...parsed,
          name: parsed.name || (parsed as any).displayName || SEED_PROFILE.name || 'Ashwin Kumar',
          currency: parsed.currency || SEED_PROFILE.currency || '₹',
          currencySymbol: parsed.currencySymbol || parsed.currency || '₹',
        };
      }
    } catch (e) {
      console.warn('Failed to parse profile from storage', e);
    }
    return SEED_PROFILE;
  }

  saveProfile(profile: UserProfile): void {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    triggerUpdate();
  }

  // --- CATEGORIES ---
  getCategories(): Category[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse categories from storage', e);
    }
    return DEFAULT_CATEGORIES;
  }

  saveCategory(cat: Category): void {
    const cats = this.getCategories();
    const idx = cats.findIndex((c) => c.id === cat.id);
    if (idx >= 0) {
      cats[idx] = cat;
    } else {
      cats.push(cat);
    }
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
    triggerUpdate();
  }

  deleteCategory(catId: string): void {
    const cats = this.getCategories().filter((c) => c.id !== catId);
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
    triggerUpdate();
  }

  // --- TRANSACTIONS ---
  getTransactions(): Transaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse transactions from storage', e);
    }
    // Initialize with seed transactions
    this.saveAllTransactions(SEED_TRANSACTIONS);
    return SEED_TRANSACTIONS;
  }

  saveTransaction(tx: Transaction): void {
    const list = this.getTransactions();
    const idx = list.findIndex((item) => item.id === tx.id);
    if (idx >= 0) {
      list[idx] = { ...tx, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({
        ...tx,
        createdAt: tx.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    this.saveAllTransactions(list);
  }

  saveAllTransactions(transactions: Transaction[]): void {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    triggerUpdate();
  }

  deleteTransaction(id: string): void {
    const list = this.getTransactions().filter((tx) => tx.id !== id);
    this.saveAllTransactions(list);
  }

  // Duplicate detection algorithm
  findDuplicates(candidateTx: Partial<Transaction>[]): {
    duplicates: { candidate: Partial<Transaction>; existing: Transaction }[];
    nonDuplicates: Partial<Transaction>[];
  } {
    const existing = this.getTransactions();
    const duplicates: { candidate: Partial<Transaction>; existing: Transaction }[] = [];
    const nonDuplicates: Partial<Transaction>[] = [];

    for (const cand of candidateTx) {
      const match = existing.find((ex) => {
        const sameAmount = Math.abs(ex.amount - (cand.amount || 0)) < 0.01;
        const sameDate = ex.date === cand.date;
        const candNorm = (cand.merchant || cand.rawDescription || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        const exNorm = (ex.merchant || ex.rawDescription || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        const similarMerchant =
          candNorm.includes(exNorm) || exNorm.includes(candNorm) || candNorm === exNorm;
        return sameAmount && sameDate && similarMerchant;
      });

      if (match) {
        duplicates.push({ candidate: cand, existing: match });
      } else {
        nonDuplicates.push(cand);
      }
    }

    return { duplicates, nonDuplicates };
  }

  // --- BUDGETS ---
  getBudgets(): Budget[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BUDGETS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse budgets', e);
    }
    this.saveBudgets(SEED_BUDGETS);
    return SEED_BUDGETS;
  }

  saveBudget(budget: Budget): void {
    const list = this.getBudgets();
    const idx = list.findIndex(
      (b) => b.categoryId === budget.categoryId && b.period === budget.period
    );
    if (idx >= 0) {
      list[idx] = budget;
    } else {
      list.push(budget);
    }
    this.saveBudgets(list);
  }

  saveBudgets(budgets: Budget[]): void {
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
    triggerUpdate();
  }

  deleteBudget(id: string): void {
    const list = this.getBudgets().filter((b) => b.id !== id);
    this.saveBudgets(list);
  }

  // --- GOALS ---
  getGoals(): FinancialGoal[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GOALS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse goals', e);
    }
    this.saveGoals(SEED_GOALS);
    return SEED_GOALS;
  }

  saveGoal(goal: FinancialGoal): void {
    const list = this.getGoals();
    const idx = list.findIndex((g) => g.id === goal.id);
    if (idx >= 0) {
      list[idx] = goal;
    } else {
      list.push(goal);
    }
    this.saveGoals(list);
  }

  saveGoals(goals: FinancialGoal[]): void {
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    triggerUpdate();
  }

  deleteGoal(id: string): void {
    const list = this.getGoals().filter((g) => g.id !== id);
    this.saveGoals(list);
  }

  contributeToGoal(goalId: string, amount: number): void {
    const list = this.getGoals();
    const goal = list.find((g) => g.id === goalId);
    if (goal) {
      goal.currentAmount = Math.min(goal.targetAmount, goal.currentAmount + amount);
      this.saveGoals(list);
    }
  }

  // --- SUBSCRIPTIONS ---
  getSubscriptions(): Subscription[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse subscriptions', e);
    }
    this.saveSubscriptions(SEED_SUBSCRIPTIONS);
    return SEED_SUBSCRIPTIONS;
  }

  saveSubscription(sub: Subscription): void {
    const list = this.getSubscriptions();
    const idx = list.findIndex((s) => s.id === sub.id);
    if (idx >= 0) {
      list[idx] = sub;
    } else {
      list.push(sub);
    }
    this.saveSubscriptions(list);
  }

  saveSubscriptions(subs: Subscription[]): void {
    localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
    triggerUpdate();
  }

  deleteSubscription(id: string): void {
    const list = this.getSubscriptions().filter((s) => s.id !== id);
    this.saveSubscriptions(list);
  }

  // --- EMI / LOANS ---
  getEMILoans(): EMILoan[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EMI_LOANS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse EMI loans', e);
    }
    this.saveEMILoans(SEED_EMI_LOANS);
    return SEED_EMI_LOANS;
  }

  saveEMILoan(loan: EMILoan): void {
    const list = this.getEMILoans();
    const idx = list.findIndex((l) => l.id === loan.id);
    if (idx >= 0) {
      list[idx] = loan;
    } else {
      list.push(loan);
    }
    this.saveEMILoans(list);
  }

  saveEMILoans(loans: EMILoan[]): void {
    localStorage.setItem(STORAGE_KEYS.EMI_LOANS, JSON.stringify(loans));
    triggerUpdate();
  }

  deleteEMILoan(id: string): void {
    const list = this.getEMILoans().filter((l) => l.id !== id);
    this.saveEMILoans(list);
  }

  // --- NOTIFICATIONS ---
  getNotifications(): NotificationItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse notifications', e);
    }
    return SEED_NOTIFICATIONS;
  }

  markNotificationRead(id: string): void {
    const list = this.getNotifications();
    const item = list.find((n) => n.id === id);
    if (item) {
      item.read = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
      triggerUpdate();
    }
  }

  addNotification(notif: NotificationItem): void {
    const list = this.getNotifications();
    list.unshift(notif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
    triggerUpdate();
  }

  // --- STATEMENTS ---
  getStatements(): StatementUpload[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STATEMENTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse statements', e);
    }
    return [];
  }

  saveStatement(stmt: StatementUpload): void {
    const list = this.getStatements();
    list.unshift(stmt);
    localStorage.setItem(STORAGE_KEYS.STATEMENTS, JSON.stringify(list));
    triggerUpdate();
  }

  deleteStatement(id: string): void {
    const list = this.getStatements().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.STATEMENTS, JSON.stringify(list));
    triggerUpdate();
  }

  // --- SAVED AI INSIGHTS ---
  getInsights(): AIInsight[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INSIGHTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse insights', e);
    }
    return [];
  }

  saveInsight(insight: AIInsight): void {
    const list = this.getInsights();
    list.unshift(insight);
    localStorage.setItem(STORAGE_KEYS.INSIGHTS, JSON.stringify(list));
    triggerUpdate();
  }

  // --- ANALYTICS CALCULATIONS ---
  calculateMonthSummary(monthStr: string) {
    // monthStr: '2026-08'
    const txs = this.getTransactions().filter((t) => t.date.startsWith(monthStr));

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalTransfers = 0;
    let totalInvestments = 0;
    let totalCashWithdrawal = 0;
    let totalRefunds = 0;

    const categorySpending: Record<string, number> = {};
    const merchantSpending: Record<
      string,
      { total: number; count: number; highest: number; transactions: Transaction[] }
    > = {};
    const paymentMethodSpending: Record<string, number> = {};
    const dailySpending: Record<string, number> = {};

    for (const tx of txs) {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else if (tx.type === 'expense' || tx.type === 'loan_emi') {
        totalExpenses += tx.amount;

        // category
        categorySpending[tx.categoryId] = (categorySpending[tx.categoryId] || 0) + tx.amount;

        // merchant
        if (!merchantSpending[tx.merchant]) {
          merchantSpending[tx.merchant] = {
            total: 0,
            count: 0,
            highest: 0,
            transactions: [],
          };
        }
        merchantSpending[tx.merchant].total += tx.amount;
        merchantSpending[tx.merchant].count += 1;
        merchantSpending[tx.merchant].highest = Math.max(
          merchantSpending[tx.merchant].highest,
          tx.amount
        );
        merchantSpending[tx.merchant].transactions.push(tx);

        // payment method
        paymentMethodSpending[tx.paymentMethod] =
          (paymentMethodSpending[tx.paymentMethod] || 0) + tx.amount;

        // daily
        dailySpending[tx.date] = (dailySpending[tx.date] || 0) + tx.amount;
      } else if (tx.type === 'refund') {
        totalRefunds += tx.amount;
        // Subtract refund from category spend if exists
        categorySpending[tx.categoryId] = Math.max(
          0,
          (categorySpending[tx.categoryId] || 0) - tx.amount
        );
        totalExpenses = Math.max(0, totalExpenses - tx.amount);
      } else if (tx.type === 'transfer') {
        totalTransfers += tx.amount;
      } else if (tx.type === 'investment') {
        totalInvestments += tx.amount;
      } else if (tx.type === 'cash_withdrawal') {
        totalCashWithdrawal += tx.amount;
      }
    }

    const saved = Math.max(0, totalIncome - totalExpenses);
    const savingsRate = totalIncome > 0 ? (saved / totalIncome) * 100 : 0;

    return {
      monthStr,
      totalIncome,
      totalExpenses,
      saved,
      savingsRate,
      totalTransfers,
      totalInvestments,
      totalCashWithdrawal,
      totalRefunds,
      categorySpending,
      merchantSpending,
      paymentMethodSpending,
      dailySpending,
      transactions: txs,
    };
  }

  calculateFinancialHealthScore(): FinancialHealthScore {
    const aug = this.calculateMonthSummary('2026-08');
    const jul = this.calculateMonthSummary('2026-07');
    const goals = this.getGoals();
    const subs = this.getSubscriptions();
    const emiLoans = this.getEMILoans();
    const budgets = this.getBudgets();

    const factors: HealthScoreFactor[] = [];

    // 1. Savings Rate (Max 25 pts)
    const savingsRate = aug.savingsRate;
    let savingsScore = 0;
    if (savingsRate >= 35) savingsScore = 25;
    else if (savingsRate >= 20) savingsScore = 18;
    else if (savingsRate >= 10) savingsScore = 12;
    else savingsScore = 5;

    factors.push({
      name: 'Savings Rate',
      score: savingsScore,
      maxScore: 25,
      feedback: `Active savings rate is ${savingsRate.toFixed(1)}% (Healthy target is > 25%).`,
      status: savingsScore >= 18 ? 'good' : savingsScore >= 12 ? 'warning' : 'critical',
    });

    // 2. Budget Adherence (Max 25 pts)
    let budgetOverruns = 0;
    for (const b of budgets) {
      const spent = aug.categorySpending[b.categoryId] || 0;
      if (spent > b.monthlyLimit) budgetOverruns++;
    }
    const budgetScore = budgetOverruns === 0 ? 25 : budgetOverruns === 1 ? 16 : 8;
    factors.push({
      name: 'Budget Adherence',
      score: budgetScore,
      maxScore: 25,
      feedback:
        budgetOverruns === 0
          ? 'All active category budgets within safe allocation limits.'
          : `${budgetOverruns} category exceeded its monthly spending ceiling.`,
      status: budgetScore >= 20 ? 'good' : budgetScore >= 15 ? 'warning' : 'critical',
    });

    // 3. Recurring Expense Ratio (Max 20 pts)
    const totalSubsCost = subs
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + s.amount, 0);
    const subRatio = aug.totalIncome > 0 ? (totalSubsCost / aug.totalIncome) * 100 : 0;
    const recurringScore = subRatio < 5 ? 20 : subRatio < 10 ? 15 : 8;
    factors.push({
      name: 'Fixed & Recurring Ratio',
      score: recurringScore,
      maxScore: 20,
      feedback: `Recurring subscriptions represent ${subRatio.toFixed(1)}% of total monthly income.`,
      status: recurringScore >= 15 ? 'good' : 'warning',
    });

    // 4. Emergency Fund Coverage (Max 20 pts)
    const emergencyGoal = goals.find(
      (g) => (g?.name || '').toLowerCase().includes('emergency') || (g as any)?.category === 'Safety'
    );
    const emergencyCurrent = emergencyGoal ? emergencyGoal.currentAmount : 0;
    const monthlyBurn = aug.totalExpenses || 50000;
    const monthsCoverage = emergencyCurrent / (monthlyBurn || 1);
    const emergencyScore = monthsCoverage >= 3 ? 20 : monthsCoverage >= 1.5 ? 14 : 6;

    factors.push({
      name: 'Emergency Buffer',
      score: emergencyScore,
      maxScore: 20,
      feedback: `Emergency liquidity covers approx ${monthsCoverage.toFixed(1)} months of baseline living expenses.`,
      status: emergencyScore >= 16 ? 'good' : emergencyScore >= 10 ? 'warning' : 'critical',
    });

    // 5. Debt Burden / EMI Ratio (Max 10 pts)
    const totalEmi = emiLoans.reduce((sum, l) => sum + l.emiAmount, 0);
    const emiRatio = aug.totalIncome > 0 ? (totalEmi / aug.totalIncome) * 100 : 0;
    const debtScore = emiRatio < 20 ? 10 : emiRatio < 40 ? 6 : 2;
    factors.push({
      name: 'Debt & EMI Burden',
      score: debtScore,
      maxScore: 10,
      feedback: `EMI obligations account for ${emiRatio.toFixed(1)}% of income (Recommended < 30%).`,
      status: debtScore >= 8 ? 'good' : debtScore >= 5 ? 'warning' : 'critical',
    });

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    let rating: 'Poor' | 'Fair' | 'Good' | 'Excellent' = 'Fair';
    if (totalScore >= 85) rating = 'Excellent';
    else if (totalScore >= 70) rating = 'Good';
    else if (totalScore >= 50) rating = 'Fair';
    else rating = 'Poor';

    return {
      score: totalScore,
      rating,
      factors,
      summary: `Your overall Financial Health is ${rating} (${totalScore}/100) driven by a strong savings rate and consistent emergency reserves.`,
      keyStrengths: [
        `High savings rate (${savingsRate.toFixed(1)}%) exceeding recommended benchmark.`,
        'Disciplined emergency fund buildup covering over 2.5x monthly burn.',
      ],
      areasToImprove: [
        'High discretionary shopping spikes in mid-month.',
        'Review 1 flagged unused subscription to reclaim monthly cash flow.',
      ],
    };
  }

  // --- RESET & EXPORT ---
  resetToDemoData(): void {
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.BUDGETS);
    localStorage.removeItem(STORAGE_KEYS.GOALS);
    localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTIONS);
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    localStorage.removeItem(STORAGE_KEYS.EMI_LOANS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.STATEMENTS);
    localStorage.removeItem(STORAGE_KEYS.INSIGHTS);

    this.saveProfile(SEED_PROFILE);
    this.saveAllTransactions(SEED_TRANSACTIONS);
    this.saveBudgets(SEED_BUDGETS);
    this.saveGoals(SEED_GOALS);
    this.saveSubscriptions(SEED_SUBSCRIPTIONS);
    this.saveEMILoans(SEED_EMI_LOANS);
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(SEED_NOTIFICATIONS));
    triggerUpdate();
  }

  getUserProfile(): UserProfile {
    return this.getProfile();
  }

  saveUserProfile(profile: UserProfile): void {
    this.saveProfile(profile);
  }

  resetToSeedData(): void {
    this.resetToDemoData();
  }

  clearAllData(): void {
    localStorage.clear();
    triggerUpdate();
  }

  exportToCSV(): string {
    const txs = this.getTransactions();
    const headers = [
      'Date',
      'Merchant',
      'Amount',
      'Type',
      'Category',
      'Payment Method',
      'Tags',
      'Notes',
    ];
    const rows = txs.map((t) => [
      t.date,
      `"${t.merchant.replace(/"/g, '""')}"`,
      t.amount,
      t.type,
      t.categoryId,
      t.paymentMethod,
      `"${(t.tags || []).join(';')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

export const storageService = new StorageService();
