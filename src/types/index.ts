export type TransactionType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'refund'
  | 'investment'
  | 'loan_emi'
  | 'cash_withdrawal';

export type PaymentMethod =
  | 'UPI'
  | 'Credit Card'
  | 'Debit Card'
  | 'Cash'
  | 'Bank Transfer'
  | 'Net Banking';

export type TransactionSource = 'manual' | 'statement' | 'import' | 'whatsapp';

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  merchant: string;
  categoryId: string;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  source: TransactionSource;
  statementId?: string;
  confidenceScore?: number; // 0-100
  isRecurring?: boolean;
  isDuplicate?: boolean;
  isAnomaly?: boolean;
  anomalyReason?: string;
  tags: string[];
  notes?: string;
  rawDescription?: string;
  referenceNo?: string;
  refundedTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income' | 'system';
  isCustom?: boolean;
  budgetMonthly?: number;
}

export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimit: number;
  period: string; // YYYY-MM
  rollover?: boolean;
  alertThreshold?: number; // percentage, e.g., 80
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  monthlyContribution?: number;
  category?: string;
  color?: string;
  icon?: string;
  notes?: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly' | 'quarterly';
  nextBillingDate: string;
  categoryId: string;
  status: 'active' | 'paused' | 'cancelled';
  isPotentiallyUnused?: boolean;
  lastUsageDate?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface StatementUpload {
  id: string;
  fileName: string;
  fileType: 'csv' | 'xlsx' | 'pdf' | 'text';
  uploadDate: string;
  transactionsCount: number;
  totalDebit: number;
  totalCredit: number;
  status: 'pending_review' | 'imported' | 'rejected';
  duplicatesCount: number;
  uncategorizedCount: number;
  transactionsPreview?: Partial<Transaction>[];
}

export type InsightType =
  | 'spending_anomaly'
  | 'subscription_discovery'
  | 'lifestyle_inflation'
  | 'merchant_concentration'
  | 'weekend_spending'
  | 'salary_day_behavior'
  | 'money_leak'
  | 'smart_recommendation'
  | 'budget_optimization'
  | 'spending_personality'
  | 'monthly_story';

export interface AIInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  impactAmount?: number;
  changePercentage?: number;
  categoryId?: string;
  actionRecommendation?: string;
  confidenceScore?: number;
  date: string;
  metadata?: Record<string, any>;
}

export interface HealthScoreFactor {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
  status: 'good' | 'warning' | 'critical';
}

export interface FinancialHealthScore {
  score: number; // 0-100
  rating: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  factors: HealthScoreFactor[];
  summary: string;
  keyStrengths: string[];
  areasToImprove: string[];
}

export type NudgeTone = 'gentle' | 'mindful' | 'motivational';

export interface DailySpendingAlertSetting {
  enabled: boolean;
  threshold: number; // Daily spending threshold amount (e.g. 2000)
  targetGoalId?: string; // Optional ID of goal to link the gentle nudge to
  nudgeTone?: NudgeTone; // Tone of the nudge message
  lastAlertDate?: string; // Last date (YYYY-MM-DD) an alert was generated
}

export type ThemeMode = 'system' | 'dark' | 'light';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  phone?: string;
  occupation?: string;
  currency: string;
  currencySymbol: string;
  monthlyIncome: number;
  primaryGoal: string;
  onboardingCompleted: boolean;
  theme?: ThemeMode;
  aiPreferences: {
    autoCategorize: boolean;
    alertThreshold: number;
    anomalyDetection: boolean;
  };
  dailySpendingAlert?: DailySpendingAlertSetting;
}

export type LoanType =
  | 'Personal Loan'
  | 'Home Loan'
  | 'Auto Loan'
  | 'Credit Card EMI'
  | 'Education Loan'
  | 'Consumer Durable'
  | 'Business Loan'
  | 'Other';

export interface EMILoan {
  id: string;
  name: string;
  lender: string;
  type?: LoanType | string;
  totalAmount: number;
  remainingAmount: number;
  emiAmount: number;
  interestRate: number; // %
  tenureMonths: number;
  paidMonths: number;
  nextDueDate: string;
  startDate: string;
  notes?: string;
  accountNumber?: string;
  color?: string;
  icon?: string;
  prepaymentsMade?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type:
    | 'budget_alert'
    | 'anomaly'
    | 'subscription_due'
    | 'monthly_report'
    | 'spending_spike'
    | 'daily_limit_exceeded';
  date: string;
  read: boolean;
  actionUrl?: string;
  goalName?: string;
  overAmount?: number;
}

export interface AskMoneyResponse {
  answer: string;
  queryType: string;
  calculatedAmount?: number;
  relevantTransactions: Transaction[];
  insights?: string[];
  suggestedFollowUps?: string[];
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type RecurringCategoryType =
  | 'rent'
  | 'subscription'
  | 'emi'
  | 'utility'
  | 'salary'
  | 'investment'
  | 'insurance'
  | 'custom';

export interface RecurringSchedule {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  recurringType: RecurringCategoryType;
  frequency: RecurringFrequency;
  dayOfMonth: number; // 1-31 (or day of week 0-6 for weekly)
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (optional)
  paymentMethod: PaymentMethod;
  autoInject: boolean;
  lastInjectedDate?: string;
  status: 'active' | 'paused' | 'completed';
  tags: string[];
  notes?: string;
  sourceRefId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringProjectedOccurrence {
  scheduleId: string;
  name: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  recurringType: RecurringCategoryType;
  frequency: RecurringFrequency;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  isMaterialized: boolean;
  materializedTransactionId?: string;
  status: 'paid' | 'due_today' | 'upcoming' | 'overdue' | 'paused';
  daysUntilDue: number;
  autoInject: boolean;
}

export interface RecurringMonthSummary {
  monthStr: string;
  totalRecurringExpenses: number;
  totalInjectedOrPaid: number;
  totalPendingUpcoming: number;
  totalRecurringIncome: number;
  items: RecurringProjectedOccurrence[];
  activeCount: number;
  settledCount: number;
  pendingCount: number;
  breakdownByType: Record<RecurringCategoryType, number>;
}
