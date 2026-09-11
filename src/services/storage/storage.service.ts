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
  RecurringSchedule,
} from '../../types';
import { DEFAULT_CATEGORIES } from '../../data/defaultCategories';
import { getCurrencySymbol } from '../../utils/currency';
import {
  SEED_PROFILE,
  SEED_TRANSACTIONS,
  SEED_BUDGETS,
  SEED_GOALS,
  SEED_SUBSCRIPTIONS,
  SEED_EMI_LOANS,
  SEED_NOTIFICATIONS,
  SEED_RECURRING_SCHEDULES,
} from '../../data/seedData';
import {
  db,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
  onSnapshot,
} from '../firebase/firebase';

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
  RECURRING_SCHEDULES: 'ais_spend_recurring_schedules_v1',
};

export const NOTIFY_EVENT = 'ais_spend_data_changed';

function triggerUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFY_EVENT));
  }
}

class StorageService {
  private currentUserId: string | null = null;
  private currentUserEmail: string | null = null;
  private currentUserName: string | null = null;
  private currentUserPhoto: string | null = null;
  private currentProvider: string | null = null;

  // In-Memory Transient State for Demo User (NEVER saved to database or localStorage)
  private demoTransactions: Transaction[] | null = null;
  private demoBudgets: Budget[] | null = null;
  private demoGoals: FinancialGoal[] | null = null;
  private demoProfile: UserProfile | null = null;
  private demoCategories: Category[] | null = null;
  private demoSubscriptions: Subscription[] | null = null;
  private demoLoans: EMILoan[] | null = null;
  private demoRecurring: RecurringSchedule[] | null = null;
  private demoStatements: StatementUpload[] | null = null;
  private demoNotifications: NotificationItem[] | null = null;
  private demoInsights: AIInsight[] | null = null;

  constructor() {
    // Purge any stale demo remnants from localStorage
    this.cleanDemoLocalStorage();

    // Restore genuine user session synchronously on startup if saved locally
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ais_auth_current_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.uid && parsed.provider !== 'demo') {
            this.currentUserId = parsed.uid;
            this.currentUserEmail = parsed.email || null;
            this.currentUserName = parsed.displayName || null;
            this.currentUserPhoto = parsed.photoURL || null;
            this.currentProvider = parsed.provider || 'authenticated';

            // Background sync with Firestore database
            setTimeout(() => {
              if (this.currentUserId && !this.isDemoUser()) {
                this.syncGenuineUserWithFirestore(this.currentUserId);
              }
            }, 80);
          }
        }
      } catch (_) {}
    }
  }

  /**
   * Helper to identify if current active session is a demo user.
   */
  isDemoUser(): boolean {
    return (
      this.currentProvider === 'demo' ||
      this.currentUserId === 'demo_user_spendai_01' ||
      (this.currentUserId ? this.currentUserId.startsWith('demo_') : false)
    );
  }

  /**
   * Purges any demo entries from localStorage to guarantee zero demo footprint in local storage.
   */
  private cleanDemoLocalStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('demo_user_spendai_01') || key.includes('ais_demo_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
  }

  /**
   * Sets current user session to strictly isolate data by user UID.
   * For Demo Users: Fetches baseline transactions into memory state. Any actions stay in state only.
   * For Genuine Users: Persists session and syncs with cloud Firestore database.
   */
  setCurrentUser(
    user: {
      uid: string;
      email?: string | null;
      displayName?: string | null;
      photoURL?: string | null;
      provider?: string | null;
    } | null
  ): void {
    const prevId = this.currentUserId;
    if (user && user.uid) {
      this.currentUserId = user.uid;
      this.currentUserEmail = user.email || null;
      this.currentUserName = user.displayName || null;
      this.currentUserPhoto = user.photoURL || null;
      this.currentProvider = user.provider || 'authenticated';

      if (this.isDemoUser()) {
        // Only re-seed demo data if switching user or first initializing
        if (prevId !== user.uid || !this.demoTransactions) {
          this.cleanDemoLocalStorage();
          this.demoTransactions = JSON.parse(JSON.stringify(SEED_TRANSACTIONS));
          this.demoBudgets = JSON.parse(JSON.stringify(SEED_BUDGETS));
          this.demoGoals = JSON.parse(JSON.stringify(SEED_GOALS));
          this.demoProfile = {
            ...SEED_PROFILE,
            name: user.displayName || 'Ashwin Kumar',
            email: user.email || 'ashwin.finance@spendai.io',
            currency: '₹',
            currencySymbol: '₹',
          };
          this.demoCategories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
          this.demoSubscriptions = JSON.parse(JSON.stringify(SEED_SUBSCRIPTIONS));
          this.demoLoans = JSON.parse(JSON.stringify(SEED_EMI_LOANS));
          this.demoRecurring = JSON.parse(JSON.stringify(SEED_RECURRING_SCHEDULES));
          this.demoStatements = [];
          this.demoNotifications = JSON.parse(JSON.stringify(SEED_NOTIFICATIONS));
          this.demoInsights = [];
        } else {
          // Keep current in-memory modifications for demo user
          if (this.demoProfile) {
            if (user.displayName) this.demoProfile.name = user.displayName;
            if (user.email) this.demoProfile.email = user.email;
            if (user.photoURL !== undefined) this.demoProfile.photoURL = user.photoURL || undefined;
          }
        }
      } else {
        // GENUINE USER: Clear demo state, persist local user cache, and sync with Firestore database
        this.demoTransactions = null;
        this.demoBudgets = null;
        this.demoGoals = null;
        this.demoProfile = null;
        this.demoCategories = null;
        this.demoSubscriptions = null;
        this.demoLoans = null;
        this.demoRecurring = null;
        this.demoStatements = null;
        this.demoNotifications = null;
        this.demoInsights = null;

        try {
          localStorage.setItem(
            'ais_auth_current_user',
            JSON.stringify({
              uid: this.currentUserId,
              email: this.currentUserEmail,
              displayName: this.currentUserName,
              photoURL: this.currentUserPhoto,
              provider: this.currentProvider,
            })
          );
        } catch (_) {}

        // Ensure user profile exists for genuine user
        const userProfileKey = this.getKey('PROFILE');
        const existingProfile = localStorage.getItem(userProfileKey);
        if (!existingProfile) {
          const initialProfile: UserProfile = {
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'Personal Account',
            email: user.email || '',
            photoURL: user.photoURL || undefined,
            currency: '₹',
            currencySymbol: '₹',
            monthlyIncome: 0,
            primaryGoal: '',
            onboardingCompleted: false,
            theme: 'system',
            dailySpendingAlert: {
              enabled: false,
              threshold: 2000,
              nudgeTone: 'gentle',
            },
            aiPreferences: {
              autoCategorize: true,
              alertThreshold: 2000,
              anomalyDetection: true,
            },
          };
          localStorage.setItem(userProfileKey, JSON.stringify(initialProfile));
        }

        // Initialize empty containers if this authenticated user is fresh - NEVER SEED DUMMY DATA FOR AUTHENTICATED USERS
        const userTxKey = this.getKey('TRANSACTIONS');
        const existingUserTx = localStorage.getItem(userTxKey);
        if (!existingUserTx) {
          localStorage.setItem(userTxKey, JSON.stringify([]));
        }

        const userBudgetKey = this.getKey('BUDGETS');
        if (!localStorage.getItem(userBudgetKey)) {
          localStorage.setItem(userBudgetKey, JSON.stringify([]));
        }

        const userGoalKey = this.getKey('GOALS');
        if (!localStorage.getItem(userGoalKey)) {
          localStorage.setItem(userGoalKey, JSON.stringify([]));
        }

        const userSubKey = this.getKey('SUBSCRIPTIONS');
        if (!localStorage.getItem(userSubKey)) {
          localStorage.setItem(userSubKey, JSON.stringify([]));
        }

        const userLoanKey = this.getKey('EMI_LOANS');
        if (!localStorage.getItem(userLoanKey)) {
          localStorage.setItem(userLoanKey, JSON.stringify([]));
        }

        const userRecKey = this.getKey('RECURRING_SCHEDULES');
        if (!localStorage.getItem(userRecKey)) {
          localStorage.setItem(userRecKey, JSON.stringify([]));
        }

        // Trigger Firestore synchronization only on fresh login or user switch
        if (prevId !== user.uid) {
          setTimeout(() => {
            if (this.currentUserId && !this.isDemoUser()) {
              this.syncGenuineUserWithFirestore(this.currentUserId);
            }
          }, 100);
        }
      }
    } else {
      // LOGGED OUT: Reset all states
      this.currentUserId = null;
      this.currentUserEmail = null;
      this.currentUserName = null;
      this.currentUserPhoto = null;
      this.currentProvider = null;
      this.demoTransactions = null;
      this.demoBudgets = null;
      this.demoGoals = null;
      this.demoProfile = null;
      this.demoCategories = null;
      this.demoSubscriptions = null;
      this.demoLoans = null;
      this.demoRecurring = null;
      this.demoStatements = null;
      this.demoNotifications = null;
      this.demoInsights = null;

      try {
        localStorage.removeItem('ais_auth_current_user');
      } catch (_) {}
      this.cleanDemoLocalStorage();
    }

    if (prevId !== this.currentUserId) {
      triggerUpdate();
    }
  }

  getCurrentUser(): {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    provider: string | null;
  } | null {
    if (!this.currentUserId) return null;
    return {
      uid: this.currentUserId,
      email: this.currentUserEmail,
      displayName: this.currentUserName,
      photoURL: this.currentUserPhoto,
      provider: this.currentProvider,
    };
  }

  /**
   * Update active user metadata in memory and session cache without resetting or wiping state
   */
  updateCurrentUserInfo(info: {
    displayName?: string;
    photoURL?: string | null;
    email?: string;
  }): void {
    if (info.displayName !== undefined) {
      this.currentUserName = info.displayName;
    }
    if (info.photoURL !== undefined) {
      this.currentUserPhoto = info.photoURL;
    }
    if (info.email !== undefined) {
      this.currentUserEmail = info.email;
    }

    try {
      const saved = localStorage.getItem('ais_auth_current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (info.displayName !== undefined) parsed.displayName = info.displayName;
        if (info.photoURL !== undefined) parsed.photoURL = info.photoURL;
        if (info.email !== undefined) parsed.email = info.email;
        localStorage.setItem('ais_auth_current_user', JSON.stringify(parsed));
      }
    } catch (_) {}

    // Update in-memory profile if demo
    if (this.isDemoUser() && this.demoProfile) {
      if (info.displayName) this.demoProfile.name = info.displayName;
      if (info.photoURL !== undefined) this.demoProfile.photoURL = info.photoURL || undefined;
      if (info.email) this.demoProfile.email = info.email;
    }

    triggerUpdate();
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  isUserAuthenticated(): boolean {
    return !!this.currentUserId;
  }

  private getKey(keyName: keyof typeof STORAGE_KEYS): string {
    const base = STORAGE_KEYS[keyName];
    if (this.currentUserId) {
      return `ais_usr_${this.currentUserId}_${base}`;
    }
    return `ais_guest_${base}`;
  }

  // --- USER PROFILE ---
  getProfile(): UserProfile {
    if (this.isDemoUser() && this.demoProfile) {
      return { ...this.demoProfile };
    }
    try {
      const data = localStorage.getItem(this.getKey('PROFILE'));
      if (data) {
        const parsed = JSON.parse(data);
        const canonicalSymbol = getCurrencySymbol(
          parsed.currencySymbol || parsed.currency || SEED_PROFILE.currencySymbol || '₹'
        );
        return {
          ...SEED_PROFILE,
          ...parsed,
          photoURL: parsed.photoURL !== undefined ? (parsed.photoURL || undefined) : (this.currentUserPhoto || undefined),
          phone: parsed.phone || undefined,
          occupation: parsed.occupation || undefined,
          dailySpendingAlert: {
            enabled:
              parsed.dailySpendingAlert?.enabled !== undefined
                ? parsed.dailySpendingAlert.enabled
                : (SEED_PROFILE.dailySpendingAlert?.enabled ?? true),
            threshold:
              parsed.dailySpendingAlert?.threshold !== undefined
                ? parsed.dailySpendingAlert.threshold
                : (SEED_PROFILE.dailySpendingAlert?.threshold ?? 2000),
            targetGoalId:
              parsed.dailySpendingAlert?.targetGoalId ||
              SEED_PROFILE.dailySpendingAlert?.targetGoalId ||
              'goal_01',
            nudgeTone:
              parsed.dailySpendingAlert?.nudgeTone ||
              SEED_PROFILE.dailySpendingAlert?.nudgeTone ||
              'gentle',
            lastAlertDate: parsed.dailySpendingAlert?.lastAlertDate,
          },
          name:
            parsed.name ||
            this.currentUserName ||
            (parsed as any).displayName ||
            (this.isDemoUser() ? 'Ashwin Kumar' : (this.currentUserEmail?.split('@')[0] || 'Personal Account')),
          email: parsed.email || this.currentUserEmail || (this.isDemoUser() ? SEED_PROFILE.email : ''),
          currency: canonicalSymbol,
          currencySymbol: canonicalSymbol,
          theme: parsed.theme || SEED_PROFILE.theme || 'system',
        };
      }
    } catch (e) {
      console.warn('Failed to parse profile from storage', e);
    }
    return {
      ...SEED_PROFILE,
      name:
        this.currentUserName ||
        (this.isDemoUser() ? SEED_PROFILE.name : (this.currentUserEmail?.split('@')[0] || 'Personal Account')),
      email: this.currentUserEmail || (this.isDemoUser() ? SEED_PROFILE.email : ''),
      photoURL: this.currentUserPhoto || undefined,
      currency: getCurrencySymbol(SEED_PROFILE.currency),
      currencySymbol: getCurrencySymbol(SEED_PROFILE.currencySymbol),
    };
  }

  saveProfile(profile: UserProfile): void {
    const canonicalSymbol = getCurrencySymbol(profile.currencySymbol || profile.currency || '₹');
    const normalizedProfile: UserProfile = {
      ...profile,
      currency: canonicalSymbol,
      currencySymbol: canonicalSymbol,
    };
    if (normalizedProfile.name) {
      this.currentUserName = normalizedProfile.name;
    }
    if (normalizedProfile.photoURL !== undefined) {
      this.currentUserPhoto = normalizedProfile.photoURL || null;
    }
    if (normalizedProfile.email) {
      this.currentUserEmail = normalizedProfile.email;
    }

    try {
      const saved = localStorage.getItem('ais_auth_current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (normalizedProfile.name) parsed.displayName = normalizedProfile.name;
        if (normalizedProfile.photoURL !== undefined) parsed.photoURL = normalizedProfile.photoURL;
        if (normalizedProfile.email) parsed.email = normalizedProfile.email;
        localStorage.setItem('ais_auth_current_user', JSON.stringify(parsed));
      }
    } catch (_) {}

    if (this.isDemoUser()) {
      this.demoProfile = normalizedProfile;
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    localStorage.setItem(this.getKey('PROFILE'), JSON.stringify(normalizedProfile));
    triggerUpdate();
    this.saveProfileToFirestore(normalizedProfile);
  }

  // --- CATEGORIES ---
  getCategories(): Category[] {
    if (this.isDemoUser()) {
      if (!this.demoCategories) {
        this.demoCategories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      }
      return [...this.demoCategories];
    }
    try {
      const data = localStorage.getItem(this.getKey('CATEGORIES'));
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse categories from storage', e);
    }
    return DEFAULT_CATEGORIES;
  }

  saveCategory(cat: Category): void {
    if (this.isDemoUser()) {
      const cats = this.getCategories();
      const idx = cats.findIndex((c) => c.id === cat.id);
      if (idx >= 0) {
        cats[idx] = cat;
      } else {
        cats.push(cat);
      }
      this.demoCategories = cats;
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    const cats = this.getCategories();
    const idx = cats.findIndex((c) => c.id === cat.id);
    if (idx >= 0) {
      cats[idx] = cat;
    } else {
      cats.push(cat);
    }
    localStorage.setItem(this.getKey('CATEGORIES'), JSON.stringify(cats));
    triggerUpdate();
  }

  deleteCategory(catId: string): void {
    if (this.isDemoUser()) {
      this.demoCategories = this.getCategories().filter((c) => c.id !== catId);
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    const cats = this.getCategories().filter((c) => c.id !== catId);
    localStorage.setItem(this.getKey('CATEGORIES'), JSON.stringify(cats));
    triggerUpdate();
  }

  // --- TRANSACTIONS ---
  getTransactions(): Transaction[] {
    if (this.isDemoUser()) {
      if (!this.demoTransactions) {
        // Fetch baseline demo transactions from initial datastore/seed into state
        this.demoTransactions = JSON.parse(JSON.stringify(SEED_TRANSACTIONS));
      }
      return [...this.demoTransactions];
    }
    try {
      const data = localStorage.getItem(this.getKey('TRANSACTIONS'));
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          // Never return seed transactions for authenticated users
          return parsed.filter(
            (tx) =>
              tx.userId !== 'usr_main_demo' &&
              !tx.id.startsWith('tx_sep_') &&
              !tx.id.startsWith('tx_aug_') &&
              !tx.id.startsWith('tx_jul_')
          );
        }
      }
    } catch (e) {
      console.warn('Failed to parse transactions from storage', e);
    }
    // Genuine authenticated user has no dummy data - return empty array
    return [];
  }

  saveTransaction(tx: Transaction): void {
    if (this.isDemoUser()) {
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
      this.demoTransactions = list;
      triggerUpdate();

      // In-memory alert check
      if (tx.type === 'expense' || tx.type === 'loan_emi') {
        try {
          this.checkDailySpendingAlert(tx.date);
        } catch (_) {}
      }
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }

    const list = this.getTransactions();
    const idx = list.findIndex((item) => item.id === tx.id);
    const updatedTx: Transaction = {
      ...tx,
      createdAt: tx.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) {
      list[idx] = updatedTx;
    } else {
      list.unshift(updatedTx);
    }
    this.saveAllTransactions(list);

    // Save genuine user transaction to Firestore cloud database
    this.saveTransactionToFirestore(updatedTx);

    // Auto-check daily spending alert if this is an expense or loan EMI
    if (tx.type === 'expense' || tx.type === 'loan_emi') {
      try {
        this.checkDailySpendingAlert(tx.date);
      } catch (err) {
        console.warn('Error checking daily spending alert:', err);
      }
    }
  }

  saveAllTransactions(transactions: Transaction[]): void {
    if (this.isDemoUser()) {
      this.demoTransactions = [...transactions];
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    localStorage.setItem(this.getKey('TRANSACTIONS'), JSON.stringify(transactions));
    triggerUpdate();
    this.batchSaveTransactionsToFirestore(transactions);
  }

  deleteTransaction(id: string): void {
    if (this.isDemoUser()) {
      this.demoTransactions = this.getTransactions().filter((tx) => tx.id !== id);
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    const list = this.getTransactions().filter((tx) => tx.id !== id);
    this.saveAllTransactions(list);
    this.deleteTransactionFromFirestore(id);
  }

  deleteTransactions(ids: string[]): void {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    if (this.isDemoUser()) {
      this.demoTransactions = this.getTransactions().filter((tx) => !idSet.has(tx.id));
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    const list = this.getTransactions().filter((tx) => !idSet.has(tx.id));
    this.saveAllTransactions(list);
    this.deleteTransactionsFromFirestore(ids);
  }

  convertPaiseToRupees(ids: string[]): void {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    const list = this.getTransactions().map((tx) => {
      if (idSet.has(tx.id)) {
        return {
          ...tx,
          amount: Math.round((tx.amount / 100) * 100) / 100,
        };
      }
      return tx;
    });
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
    if (this.isDemoUser()) {
      if (!this.demoBudgets) {
        this.demoBudgets = JSON.parse(JSON.stringify(SEED_BUDGETS));
      }
      return [...this.demoBudgets];
    }
    try {
      const data = localStorage.getItem(this.getKey('BUDGETS'));
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((b) => !['b_food', 'b_shopping', 'b_ent', 'b_bills', 'b_transport'].includes(b.id));
        }
      }
    } catch (e) {
      console.warn('Failed to parse budgets', e);
    }
    return [];
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
    if (this.isDemoUser()) {
      this.demoBudgets = list;
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    this.saveBudgets(list);
    this.saveBudgetToFirestore(budget);
  }

  saveBudgets(budgets: Budget[]): void {
    if (this.isDemoUser()) {
      this.demoBudgets = [...budgets];
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    localStorage.setItem(this.getKey('BUDGETS'), JSON.stringify(budgets));
    triggerUpdate();
    this.batchSaveBudgetsToFirestore(budgets);
  }

  deleteBudget(id: string): void {
    if (this.isDemoUser()) {
      this.demoBudgets = this.getBudgets().filter((b) => b.id !== id);
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    const list = this.getBudgets().filter((b) => b.id !== id);
    this.saveBudgets(list);
    this.deleteBudgetFromFirestore(id);
  }

  // --- GOALS ---
  getGoals(): FinancialGoal[] {
    if (this.isDemoUser()) {
      if (!this.demoGoals) {
        this.demoGoals = JSON.parse(JSON.stringify(SEED_GOALS));
      }
      return [...this.demoGoals];
    }
    try {
      const data = localStorage.getItem(this.getKey('GOALS'));
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((g) => !['goal_01', 'goal_02', 'goal_03'].includes(g.id));
        }
      }
    } catch (e) {
      console.warn('Failed to parse goals', e);
    }
    return [];
  }

  saveGoal(goal: FinancialGoal): void {
    const list = this.getGoals();
    const idx = list.findIndex((g) => g.id === goal.id);
    if (idx >= 0) {
      list[idx] = goal;
    } else {
      list.push(goal);
    }
    if (this.isDemoUser()) {
      this.demoGoals = list;
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    this.saveGoals(list);
    this.saveGoalToFirestore(goal);
  }

  saveGoals(goals: FinancialGoal[]): void {
    if (this.isDemoUser()) {
      this.demoGoals = [...goals];
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    localStorage.setItem(this.getKey('GOALS'), JSON.stringify(goals));
    triggerUpdate();
    this.batchSaveGoalsToFirestore(goals);
  }

  deleteGoal(id: string): void {
    if (this.isDemoUser()) {
      this.demoGoals = this.getGoals().filter((g) => g.id !== id);
      triggerUpdate();
      return; // DO NOT WRITE TO DATABASE FOR DEMO USER
    }
    const list = this.getGoals().filter((g) => g.id !== id);
    this.saveGoals(list);
    this.deleteGoalFromFirestore(id);
  }

  contributeToGoal(goalId: string, amount: number): void {
    const list = this.getGoals();
    const goal = list.find((g) => g.id === goalId);
    if (goal) {
      goal.currentAmount = Math.min(goal.targetAmount, goal.currentAmount + amount);
      if (this.isDemoUser()) {
        this.demoGoals = list;
        triggerUpdate();
        return; // DO NOT WRITE TO DATABASE FOR DEMO USER
      }
      this.saveGoals(list);
      this.saveGoalToFirestore(goal);
    }
  }

  // --- SUBSCRIPTIONS ---
  getSubscriptions(): Subscription[] {
    if (this.isDemoUser()) {
      if (!this.demoSubscriptions) {
        this.demoSubscriptions = JSON.parse(JSON.stringify(SEED_SUBSCRIPTIONS));
      }
      return [...this.demoSubscriptions];
    }
    try {
      const data = localStorage.getItem(this.getKey('SUBSCRIPTIONS'));
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((s) => !['sub_01', 'sub_02', 'sub_03', 'sub_04'].includes(s.id));
        }
      }
    } catch (e) {
      console.warn('Failed to parse subscriptions', e);
    }
    return [];
  }

  saveSubscription(sub: Subscription): void {
    const list = this.getSubscriptions();
    const idx = list.findIndex((s) => s.id === sub.id);
    if (idx >= 0) {
      list[idx] = sub;
    } else {
      list.push(sub);
    }
    if (this.isDemoUser()) {
      this.demoSubscriptions = list;
      triggerUpdate();
      return;
    }
    this.saveSubscriptions(list);
  }

  saveSubscriptions(subs: Subscription[]): void {
    if (this.isDemoUser()) {
      this.demoSubscriptions = [...subs];
      triggerUpdate();
      return;
    }
    localStorage.setItem(this.getKey('SUBSCRIPTIONS'), JSON.stringify(subs));
    triggerUpdate();
  }

  deleteSubscription(id: string): void {
    if (this.isDemoUser()) {
      this.demoSubscriptions = this.getSubscriptions().filter((s) => s.id !== id);
      triggerUpdate();
      return;
    }
    const list = this.getSubscriptions().filter((s) => s.id !== id);
    this.saveSubscriptions(list);
  }

  // --- EMI / LOANS ---
  getEMILoans(): EMILoan[] {
    if (this.isDemoUser()) {
      if (!this.demoLoans) {
        this.demoLoans = JSON.parse(JSON.stringify(SEED_EMI_LOANS));
      }
      return [...this.demoLoans];
    }
    try {
      const data = localStorage.getItem(this.getKey('EMI_LOANS'));
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((l) => !['loan_01', 'loan_02'].includes(l.id));
        }
      }
    } catch (e) {
      console.warn('Failed to parse EMI loans', e);
    }
    return [];
  }

  saveEMILoan(loan: EMILoan): void {
    const list = this.getEMILoans();
    const idx = list.findIndex((l) => l.id === loan.id);
    if (idx >= 0) {
      list[idx] = loan;
    } else {
      list.push(loan);
    }
    if (this.isDemoUser()) {
      this.demoLoans = list;
      triggerUpdate();
      return;
    }
    this.saveEMILoans(list);
  }

  saveEMILoans(loans: EMILoan[]): void {
    if (this.isDemoUser()) {
      this.demoLoans = [...loans];
      triggerUpdate();
      return;
    }
    localStorage.setItem(this.getKey('EMI_LOANS'), JSON.stringify(loans));
    triggerUpdate();
  }

  deleteEMILoan(id: string): void {
    if (this.isDemoUser()) {
      this.demoLoans = this.getEMILoans().filter((l) => l.id !== id);
      triggerUpdate();
      return;
    }
    const list = this.getEMILoans().filter((l) => l.id !== id);
    this.saveEMILoans(list);
  }

  makeLoanPrepayment(loanId: string, amount: number): { remainingAmount: number; isSettled: boolean } {
    const list = this.getEMILoans();
    const loan = list.find((l) => l.id === loanId);
    if (!loan) return { remainingAmount: 0, isSettled: false };

    const newRemaining = Math.max(0, loan.remainingAmount - amount);
    loan.remainingAmount = newRemaining;
    loan.prepaymentsMade = (loan.prepaymentsMade || 0) + amount;

    if (newRemaining <= 0) {
      loan.remainingAmount = 0;
      loan.paidMonths = loan.tenureMonths;
    }

    if (this.isDemoUser()) {
      this.demoLoans = list;
      triggerUpdate();
      return { remainingAmount: newRemaining, isSettled: newRemaining <= 0 };
    }

    this.saveEMILoans(list);
    return { remainingAmount: newRemaining, isSettled: newRemaining <= 0 };
  }

  // --- RECURRING SCHEDULES ---
  getRecurringSchedules(): RecurringSchedule[] {
    if (this.isDemoUser()) {
      if (!this.demoRecurring) {
        this.demoRecurring = JSON.parse(JSON.stringify(SEED_RECURRING_SCHEDULES));
      }
      return [...this.demoRecurring];
    }
    try {
      const data = localStorage.getItem(this.getKey('RECURRING_SCHEDULES'));
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((s) => !['rec_01', 'rec_02', 'rec_03'].includes(s.id));
        }
      }
    } catch (e) {
      console.warn('Failed to parse recurring schedules', e);
    }
    return [];
  }

  saveRecurringSchedule(schedule: RecurringSchedule): void {
    const list = this.getRecurringSchedules();
    const idx = list.findIndex((s) => s.id === schedule.id);
    if (idx >= 0) {
      list[idx] = { ...schedule, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({
        ...schedule,
        createdAt: schedule.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    if (this.isDemoUser()) {
      this.demoRecurring = list;
      triggerUpdate();
      return;
    }
    this.saveRecurringSchedules(list);
  }

  saveRecurringSchedules(schedules: RecurringSchedule[]): void {
    if (this.isDemoUser()) {
      this.demoRecurring = [...schedules];
      triggerUpdate();
      return;
    }
    localStorage.setItem(this.getKey('RECURRING_SCHEDULES'), JSON.stringify(schedules));
    triggerUpdate();
  }

  deleteRecurringSchedule(id: string): void {
    if (this.isDemoUser()) {
      this.demoRecurring = this.getRecurringSchedules().filter((s) => s.id !== id);
      triggerUpdate();
      return;
    }
    const list = this.getRecurringSchedules().filter((s) => s.id !== id);
    this.saveRecurringSchedules(list);
  }

  toggleRecurringScheduleStatus(id: string, status?: 'active' | 'paused' | 'completed'): void {
    const list = this.getRecurringSchedules();
    const item = list.find((s) => s.id === id);
    if (item) {
      if (status) {
        item.status = status;
      } else {
        item.status = item.status === 'active' ? 'paused' : 'active';
      }
      item.updatedAt = new Date().toISOString();
      if (this.isDemoUser()) {
        this.demoRecurring = list;
        triggerUpdate();
        return;
      }
      this.saveRecurringSchedules(list);
    }
  }

  // --- NOTIFICATIONS ---
  getNotifications(): NotificationItem[] {
    if (this.isDemoUser()) {
      if (!this.demoNotifications) {
        this.demoNotifications = JSON.parse(JSON.stringify(SEED_NOTIFICATIONS));
      }
      return [...this.demoNotifications];
    }
    try {
      const data = localStorage.getItem(this.getKey('NOTIFICATIONS'));
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter((n) => !['n_01', 'n_02', 'n_03', 'n_04'].includes(n.id));
        }
      }
    } catch (e) {
      console.warn('Failed to parse notifications', e);
    }
    return [];
  }

  markNotificationRead(id: string): void {
    const list = this.getNotifications();
    const item = list.find((n) => n.id === id);
    if (item) {
      item.read = true;
      if (this.isDemoUser()) {
        this.demoNotifications = list;
        triggerUpdate();
        return;
      }
      localStorage.setItem(this.getKey('NOTIFICATIONS'), JSON.stringify(list));
      triggerUpdate();
    }
  }

  addNotification(notif: NotificationItem): void {
    const list = this.getNotifications();
    list.unshift(notif);
    if (this.isDemoUser()) {
      this.demoNotifications = list;
      triggerUpdate();
      return;
    }
    localStorage.setItem(this.getKey('NOTIFICATIONS'), JSON.stringify(list));
    triggerUpdate();
  }

  // --- STATEMENTS ---
  getStatements(): StatementUpload[] {
    if (this.isDemoUser()) {
      if (!this.demoStatements) {
        this.demoStatements = [];
      }
      return [...this.demoStatements];
    }
    try {
      const data = localStorage.getItem(this.getKey('STATEMENTS'));
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse statements', e);
    }
    return [];
  }

  saveStatement(stmt: StatementUpload): void {
    const list = this.getStatements();
    list.unshift(stmt);
    if (this.isDemoUser()) {
      this.demoStatements = list;
      triggerUpdate();
      return;
    }
    localStorage.setItem(this.getKey('STATEMENTS'), JSON.stringify(list));
    triggerUpdate();
  }

  deleteStatement(id: string): void {
    if (this.isDemoUser()) {
      this.demoStatements = this.getStatements().filter((s) => s.id !== id);
      triggerUpdate();
      return;
    }
    const list = this.getStatements().filter((s) => s.id !== id);
    localStorage.setItem(this.getKey('STATEMENTS'), JSON.stringify(list));
    triggerUpdate();
  }

  // --- SAVED AI INSIGHTS ---
  getInsights(): AIInsight[] {
    if (this.isDemoUser()) {
      if (!this.demoInsights) {
        this.demoInsights = [];
      }
      return [...this.demoInsights];
    }
    try {
      const data = localStorage.getItem(this.getKey('INSIGHTS'));
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse insights', e);
    }
    return [];
  }

  saveInsight(insight: AIInsight): void {
    const list = this.getInsights();
    list.unshift(insight);
    if (this.isDemoUser()) {
      this.demoInsights = list;
      triggerUpdate();
      return;
    }
    localStorage.setItem(this.getKey('INSIGHTS'), JSON.stringify(list));
    triggerUpdate();
  }

  // --- CLOUD FIRESTORE PERSISTENCE (GENUINE USERS ONLY) ---
  async syncGenuineUserWithFirestore(userId: string): Promise<void> {
    if (!userId || this.isDemoUser()) return;
    try {
      // 1. Transactions Collection
      const txCol = collection(db, 'users', userId, 'transactions');
      const txSnap = await getDocs(txCol);
      if (!txSnap.empty) {
        const remoteTxs: Transaction[] = [];
        txSnap.forEach((docSnap) => {
          const t = docSnap.data() as Transaction;
          if (
            t &&
            t.userId !== 'usr_main_demo' &&
            !t.id.startsWith('tx_sep_') &&
            !t.id.startsWith('tx_aug_') &&
            !t.id.startsWith('tx_jul_')
          ) {
            remoteTxs.push(t);
          }
        });
        remoteTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        localStorage.setItem(this.getKey('TRANSACTIONS'), JSON.stringify(remoteTxs));
        triggerUpdate();
      } else {
        // Fresh genuine user with no transactions yet: keep local storage clean and empty
        localStorage.setItem(this.getKey('TRANSACTIONS'), JSON.stringify([]));
        triggerUpdate();
      }

      // Attach real-time Firestore listener for live WhatsApp message & multi-device sync
      this.listenToTransactions(userId);

      // 2. Budgets Collection
      const budgetCol = collection(db, 'users', userId, 'budgets');
      const budgetSnap = await getDocs(budgetCol);
      if (!budgetSnap.empty) {
        const remoteBudgets: Budget[] = [];
        budgetSnap.forEach((docSnap) => {
          const b = docSnap.data() as Budget;
          if (b && !['b_food', 'b_shopping', 'b_ent', 'b_bills', 'b_transport'].includes(b.id)) {
            remoteBudgets.push(b);
          }
        });
        localStorage.setItem(this.getKey('BUDGETS'), JSON.stringify(remoteBudgets));
        triggerUpdate();
      } else {
        localStorage.setItem(this.getKey('BUDGETS'), JSON.stringify([]));
        triggerUpdate();
      }

      // 3. Goals Collection
      const goalsCol = collection(db, 'users', userId, 'goals');
      const goalsSnap = await getDocs(goalsCol);
      if (!goalsSnap.empty) {
        const remoteGoals: FinancialGoal[] = [];
        goalsSnap.forEach((docSnap) => {
          const g = docSnap.data() as FinancialGoal;
          if (g && !['goal_01', 'goal_02', 'goal_03'].includes(g.id)) {
            remoteGoals.push(g);
          }
        });
        localStorage.setItem(this.getKey('GOALS'), JSON.stringify(remoteGoals));
        triggerUpdate();
      } else {
        localStorage.setItem(this.getKey('GOALS'), JSON.stringify([]));
        triggerUpdate();
      }

      // 4. Profile Document
      const profileDocRef = doc(db, 'users', userId, 'profile', 'main');
      const profileSnap = await getDoc(profileDocRef);
      if (profileSnap.exists()) {
        const remoteProfile = profileSnap.data() as UserProfile;
        localStorage.setItem(this.getKey('PROFILE'), JSON.stringify(remoteProfile));
        triggerUpdate();
      } else {
        // If profile/main does not exist yet, check /users/{userId} document
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          const localProfile = this.getProfile();
          const mergedProfile: UserProfile = {
            ...localProfile,
            name: uData.displayName || localProfile.name,
            email: uData.email || localProfile.email,
            photoURL: uData.photoURL || localProfile.photoURL,
            currency: uData.currency || localProfile.currency,
            monthlyIncome: uData.monthlyIncome || localProfile.monthlyIncome,
          };
          localStorage.setItem(this.getKey('PROFILE'), JSON.stringify(mergedProfile));
          triggerUpdate();
        }
      }
    } catch (err) {
      console.warn('Firestore cloud sync notice:', err);
    }
  }

  private unsubscribeTransactions: (() => void) | null = null;

  listenToTransactions(userId: string): void {
    if (!userId || this.isDemoUser()) return;
    if (this.unsubscribeTransactions) {
      this.unsubscribeTransactions();
      this.unsubscribeTransactions = null;
    }
    try {
      const txCol = collection(db, 'users', userId, 'transactions');
      this.unsubscribeTransactions = onSnapshot(
        txCol,
        (snap) => {
          if (!snap.empty) {
            const remoteTxs: Transaction[] = [];
            snap.forEach((docSnap) => {
              remoteTxs.push(docSnap.data() as Transaction);
            });
            remoteTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            localStorage.setItem(this.getKey('TRANSACTIONS'), JSON.stringify(remoteTxs));
            triggerUpdate();
          }
        },
        (err) => {
          console.warn('Real-time transactions subscription notice:', err);
        }
      );
    } catch (e) {
      console.warn('Failed to start transactions real-time listener:', e);
    }
  }

  async reloadFromCloud(): Promise<void> {
    if (this.currentUserId && !this.isDemoUser()) {
      await this.syncGenuineUserWithFirestore(this.currentUserId);
    }
  }

  private async saveTransactionToFirestore(tx: Transaction): Promise<void> {
    if (!this.currentUserId || this.isDemoUser()) return;
    try {
      await setDoc(doc(db, 'users', this.currentUserId, 'transactions', tx.id), tx, { merge: true });
    } catch (err) {
      console.warn('Failed to save transaction to Firestore:', err);
    }
  }

  private async deleteTransactionFromFirestore(txId: string): Promise<void> {
    if (!this.currentUserId || this.isDemoUser()) return;
    try {
      await deleteDoc(doc(db, 'users', this.currentUserId, 'transactions', txId));
    } catch (err) {
      console.warn('Failed to delete transaction from Firestore:', err);
    }
  }

  private async deleteTransactionsFromFirestore(txIds: string[]): Promise<void> {
    if (!this.currentUserId || this.isDemoUser() || !txIds.length) return;
    try {
      const batch = writeBatch(db);
      for (const id of txIds) {
        batch.delete(doc(db, 'users', this.currentUserId, 'transactions', id));
      }
      await batch.commit();
    } catch (err) {
      console.warn('Failed to batch delete transactions from Firestore:', err);
    }
  }

  private async batchSaveTransactionsToFirestore(transactions: Transaction[]): Promise<void> {
    if (!this.currentUserId || this.isDemoUser() || !transactions.length) return;
    try {
      const batch = writeBatch(db);
      // Firestore batch limit is 500 operations
      const slice = transactions.slice(0, 450);
      for (const tx of slice) {
        batch.set(doc(db, 'users', this.currentUserId, 'transactions', tx.id), tx, { merge: true });
      }
      await batch.commit();
    } catch (err) {
      console.warn('Failed to batch save transactions to Firestore:', err);
    }
  }

  private async saveBudgetToFirestore(budget: Budget): Promise<void> {
    if (!this.currentUserId || this.isDemoUser()) return;
    try {
      await setDoc(doc(db, 'users', this.currentUserId, 'budgets', budget.id), budget, { merge: true });
    } catch (err) {
      console.warn('Failed to save budget to Firestore:', err);
    }
  }

  private async deleteBudgetFromFirestore(budgetId: string): Promise<void> {
    if (!this.currentUserId || this.isDemoUser()) return;
    try {
      await deleteDoc(doc(db, 'users', this.currentUserId, 'budgets', budgetId));
    } catch (err) {
      console.warn('Failed to delete budget from Firestore:', err);
    }
  }

  private async batchSaveBudgetsToFirestore(budgets: Budget[]): Promise<void> {
    if (!this.currentUserId || this.isDemoUser() || !budgets.length) return;
    try {
      const batch = writeBatch(db);
      for (const b of budgets) {
        batch.set(doc(db, 'users', this.currentUserId, 'budgets', b.id), b, { merge: true });
      }
      await batch.commit();
    } catch (err) {
      console.warn('Failed to batch save budgets to Firestore:', err);
    }
  }

  private async saveGoalToFirestore(goal: FinancialGoal): Promise<void> {
    if (!this.currentUserId || this.isDemoUser()) return;
    try {
      await setDoc(doc(db, 'users', this.currentUserId, 'goals', goal.id), goal, { merge: true });
    } catch (err) {
      console.warn('Failed to save goal to Firestore:', err);
    }
  }

  private async deleteGoalFromFirestore(goalId: string): Promise<void> {
    if (!this.currentUserId || this.isDemoUser()) return;
    try {
      await deleteDoc(doc(db, 'users', this.currentUserId, 'goals', goalId));
    } catch (err) {
      console.warn('Failed to delete goal from Firestore:', err);
    }
  }

  private async batchSaveGoalsToFirestore(goals: FinancialGoal[]): Promise<void> {
    if (!this.currentUserId || this.isDemoUser() || !goals.length) return;
    try {
      const batch = writeBatch(db);
      for (const g of goals) {
        batch.set(doc(db, 'users', this.currentUserId, 'goals', g.id), g, { merge: true });
      }
      await batch.commit();
    } catch (err) {
      console.warn('Failed to batch save goals to Firestore:', err);
    }
  }

  private async saveProfileToFirestore(profile: UserProfile): Promise<void> {
    if (!this.currentUserId || this.isDemoUser()) return;
    try {
      // Deep clone and clean all undefined properties so Firestore SDK does not reject with error
      const cleanProfile: Record<string, any> = {};
      for (const [key, value] of Object.entries(profile)) {
        if (value !== undefined) {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const cleanSub: Record<string, any> = {};
            for (const [subK, subV] of Object.entries(value)) {
              if (subV !== undefined) cleanSub[subK] = subV;
            }
            cleanProfile[key] = cleanSub;
          } else {
            cleanProfile[key] = value;
          }
        }
      }

      await setDoc(doc(db, 'users', this.currentUserId, 'profile', 'main'), cleanProfile, { merge: true });

      // Also update top-level /users/{userId} document for direct profile access
      await setDoc(
        doc(db, 'users', this.currentUserId),
        {
          uid: this.currentUserId,
          displayName: profile.name || '',
          email: profile.email || '',
          ...(profile.photoURL && profile.photoURL.length <= 2000 ? { photoURL: profile.photoURL } : {}),
          currency: profile.currency,
          monthlyIncome: profile.monthlyIncome,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to save profile to Firestore:', err);
    }
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

  // --- DAILY SPENDING & GOAL NUDGE ALERTS ---

  /**
   * Calculates total expenses & loan EMIs for a specific day (YYYY-MM-DD).
   */
  getDailySpending(dateStr?: string): {
    total: number;
    count: number;
    transactions: Transaction[];
    date: string;
  } {
    const targetDate = dateStr || new Date().toISOString().slice(0, 10);
    const transactions = this.getTransactions().filter(
      (t) => t.date === targetDate && (t.type === 'expense' || t.type === 'loan_emi')
    );
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    return { total, count: transactions.length, transactions, date: targetDate };
  }

  /**
   * Gets today's spending, or falls back to the latest active spending date (ideal for demo data).
   */
  getTodayOrLatestDailySpending(): {
    date: string;
    total: number;
    count: number;
    transactions: Transaction[];
    isToday: boolean;
  } {
    const today = new Date().toISOString().slice(0, 10);
    const todayResult = this.getDailySpending(today);
    if (todayResult.count > 0 || !this.isDemoUser()) {
      return {
        date: today,
        total: todayResult.total,
        count: todayResult.count,
        transactions: todayResult.transactions,
        isToday: true,
      };
    }

    // In demo mode or if today is empty, find the most recent expense date
    const allExpenses = this.getTransactions()
      .filter((t) => t.type === 'expense' || t.type === 'loan_emi')
      .sort((a, b) => b.date.localeCompare(a.date));

    if (allExpenses.length > 0) {
      const latestDate = allExpenses[0].date;
      const latestResult = this.getDailySpending(latestDate);
      return {
        date: latestDate,
        total: latestResult.total,
        count: latestResult.count,
        transactions: latestResult.transactions,
        isToday: false,
      };
    }

    return { date: today, total: 0, count: 0, transactions: [], isToday: true };
  }

  /**
   * Checks whether spending on dateStr exceeds the user's configured daily threshold,
   * creating a compassionate, goal-oriented notification when breached.
   */
  checkDailySpendingAlert(
    dateStr?: string,
    forceCreateNotification = false
  ): {
    enabled: boolean;
    exceeded: boolean;
    spent: number;
    threshold: number;
    overAmount: number;
    targetGoal?: FinancialGoal;
    notificationCreated: boolean;
    nudgeMessage?: string;
  } {
    const profile = this.getProfile();
    const alertSetting = profile.dailySpendingAlert;

    if (!alertSetting || !alertSetting.enabled || !alertSetting.threshold || alertSetting.threshold <= 0) {
      return {
        enabled: false,
        exceeded: false,
        spent: 0,
        threshold: alertSetting?.threshold || 0,
        overAmount: 0,
        notificationCreated: false,
      };
    }

    const targetDate = dateStr || new Date().toISOString().slice(0, 10);
    const { total: spent } = this.getDailySpending(targetDate);
    const threshold = alertSetting.threshold;

    if (spent <= threshold && !forceCreateNotification) {
      return {
        enabled: true,
        exceeded: false,
        spent,
        threshold,
        overAmount: 0,
        notificationCreated: false,
      };
    }

    const overAmount = Math.max(0, spent - threshold);
    const goals = this.getGoals();
    let targetGoal: FinancialGoal | undefined;

    if (alertSetting.targetGoalId && alertSetting.targetGoalId !== 'all') {
      targetGoal = goals.find((g) => g.id === alertSetting.targetGoalId);
    }
    if (!targetGoal && goals.length > 0) {
      targetGoal = goals[0];
    }

    const goalName = targetGoal ? targetGoal.name : 'Primary Savings';
    const goalPercent =
      targetGoal && targetGoal.targetAmount > 0
        ? Math.round((targetGoal.currentAmount / targetGoal.targetAmount) * 100)
        : 0;

    const sym = profile.currencySymbol || '₹';

    let nudgeMessage = '';
    const tone = alertSetting.nudgeTone || 'gentle';

    if (tone === 'mindful') {
      nudgeMessage = `Mindful Check-in: Today's spending has reached ${sym}${spent.toLocaleString()}, which is ${sym}${overAmount.toLocaleString()} over your daily target of ${sym}${threshold.toLocaleString()}. Pausing non-essential spends for the rest of today helps protect your '${goalName}' goal (currently ${goalPercent}% completed)!`;
    } else if (tone === 'motivational') {
      nudgeMessage = `Goal Nudge: You're ${sym}${overAmount.toLocaleString()} past your daily threshold of ${sym}${threshold.toLocaleString()} (${sym}${spent.toLocaleString()} total). Every conscious pause between now and midnight preserves funds directly for '${goalName}'!`;
    } else {
      // Gentle (default)
      nudgeMessage = `Gentle Nudge: You've spent ${sym}${spent.toLocaleString()} today, crossing your daily limit of ${sym}${threshold.toLocaleString()}. Taking a mindful breather from optional purchases today keeps your '${goalName}' comfortably on track! 🎯`;
    }

    // Check if we already notified for this target date
    const existingNotifs = this.getNotifications();
    const alreadyNotified = existingNotifs.some(
      (n) => n.type === 'daily_limit_exceeded' && n.date.startsWith(targetDate)
    );

    let notificationCreated = false;
    if (!alreadyNotified || forceCreateNotification) {
      const notifId = `notif_daily_limit_${targetDate}_${Date.now()}`;
      const notif: NotificationItem = {
        id: notifId,
        title: 'Daily Spending Limit Nudge 🎯',
        message: nudgeMessage,
        type: 'daily_limit_exceeded',
        date: new Date().toISOString(),
        read: false,
        actionUrl: '/settings',
        goalName,
        overAmount,
      };
      this.addNotification(notif);
      notificationCreated = true;

      // Update profile lastAlertDate
      profile.dailySpendingAlert = {
        ...alertSetting,
        lastAlertDate: targetDate,
      };
      this.saveProfile(profile);
    }

    return {
      enabled: true,
      exceeded: true,
      spent,
      threshold,
      overAmount,
      targetGoal,
      notificationCreated,
      nudgeMessage,
    };
  }

  calculateFinancialHealthScore(): FinancialHealthScore {
    const allTxs = this.getTransactions();
    if (!this.isDemoUser() && allTxs.length === 0) {
      return {
        score: 0,
        rating: 'Fair',
        summary: 'Add your first income or expense to calculate your financial health score.',
        factors: [],
        keyStrengths: [],
        areasToImprove: ['Add your first transactions to compute health metrics.'],
      };
    }

    const currentMonthStr = new Date().toISOString().slice(0, 7);
    let activeSummary = this.calculateMonthSummary(currentMonthStr);
    if (this.isDemoUser() && activeSummary.transactions.length === 0) {
      activeSummary = this.calculateMonthSummary('2026-08');
    }
    const goals = this.getGoals();
    const subs = this.getSubscriptions();
    const emiLoans = this.getEMILoans();
    const budgets = this.getBudgets();

    const factors: HealthScoreFactor[] = [];

    // 1. Savings Rate (Max 25 pts)
    const savingsRate = activeSummary.savingsRate;
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
      const spent = activeSummary.categorySpending[b.categoryId] || 0;
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
    const subRatio = activeSummary.totalIncome > 0 ? (totalSubsCost / activeSummary.totalIncome) * 100 : 0;
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
    const monthlyBurn = activeSummary.totalExpenses || 50000;
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
    const emiRatio = activeSummary.totalIncome > 0 ? (totalEmi / activeSummary.totalIncome) * 100 : 0;
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
    localStorage.removeItem(this.getKey('TRANSACTIONS'));
    localStorage.removeItem(this.getKey('CATEGORIES'));
    localStorage.removeItem(this.getKey('BUDGETS'));
    localStorage.removeItem(this.getKey('GOALS'));
    localStorage.removeItem(this.getKey('SUBSCRIPTIONS'));
    localStorage.removeItem(this.getKey('PROFILE'));
    localStorage.removeItem(this.getKey('EMI_LOANS'));
    localStorage.removeItem(this.getKey('NOTIFICATIONS'));
    localStorage.removeItem(this.getKey('STATEMENTS'));
    localStorage.removeItem(this.getKey('INSIGHTS'));
    localStorage.removeItem(this.getKey('RECURRING_SCHEDULES'));

    this.saveProfile(SEED_PROFILE);
    this.saveAllTransactions(SEED_TRANSACTIONS);
    this.saveBudgets(SEED_BUDGETS);
    this.saveGoals(SEED_GOALS);
    this.saveSubscriptions(SEED_SUBSCRIPTIONS);
    this.saveEMILoans(SEED_EMI_LOANS);
    localStorage.setItem(this.getKey('CATEGORIES'), JSON.stringify(DEFAULT_CATEGORIES));
    localStorage.setItem(this.getKey('NOTIFICATIONS'), JSON.stringify(SEED_NOTIFICATIONS));
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

    // CSV Formula Injection (DDE) Sanitizer
    const sanitizeCell = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      // Neutralize formula characters (=, +, -, @, tab, CR)
      if (/^[=+\-@\t\r]/.test(str)) {
        return `"'${str}"`;
      }
      return `"${str}"`;
    };

    const rows = txs.map((t) => [
      t.date,
      sanitizeCell(t.merchant),
      typeof t.amount === 'number' && !isNaN(t.amount) ? t.amount : 0,
      sanitizeCell(t.type),
      sanitizeCell(t.categoryId),
      sanitizeCell(t.paymentMethod),
      sanitizeCell((t.tags || []).join(';')),
      sanitizeCell(t.notes || ''),
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

export const storageService = new StorageService();
