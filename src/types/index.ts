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

export type TransactionSource = 'manual' | 'statement' | 'import';

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

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  currency: string;
  currencySymbol: string;
  monthlyIncome: number;
  primaryGoal: string;
  onboardingCompleted: boolean;
  aiPreferences: {
    autoCategorize: boolean;
    alertThreshold: number;
    anomalyDetection: boolean;
  };
}

export interface EMILoan {
  id: string;
  name: string;
  lender: string;
  totalAmount: number;
  remainingAmount: number;
  emiAmount: number;
  interestRate: number; // %
  tenureMonths: number;
  paidMonths: number;
  nextDueDate: string;
  startDate: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'budget_alert' | 'anomaly' | 'subscription_due' | 'monthly_report' | 'spending_spike';
  date: string;
  read: boolean;
  actionUrl?: string;
}

export interface AskMoneyResponse {
  answer: string;
  queryType: string;
  calculatedAmount?: number;
  relevantTransactions: Transaction[];
  insights?: string[];
  suggestedFollowUps?: string[];
}
