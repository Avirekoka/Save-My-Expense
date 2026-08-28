import { Category, Transaction } from '../../types';

export interface CategorizationSuggestion {
  categoryId: string;
  categoryName: string;
  confidenceScore: number;
  reasoning: string;
}

export class ExpenseCategorizer {
  private static userCorrectionsKey = 'ais_user_category_rules_v1';

  static getUserRules(): Record<string, string> {
    try {
      const data = localStorage.getItem(this.userCorrectionsKey);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse user category rules', e);
    }
    return {};
  }

  static recordUserCorrection(merchantName: string, categoryId: string): void {
    const rules = this.getUserRules();
    const clean = merchantName.toLowerCase().trim();
    rules[clean] = categoryId;
    localStorage.setItem(this.userCorrectionsKey, JSON.stringify(rules));
  }

  static suggestCategory(
    merchant: string,
    description: string,
    amount: number,
    categories: Category[]
  ): CategorizationSuggestion {
    const rules = this.getUserRules();
    const merchantLower = merchant.toLowerCase().trim();

    // Check user corrections first (100% confidence)
    if (rules[merchantLower]) {
      const catId = rules[merchantLower];
      const found = categories.find((c) => c.id === catId);
      if (found) {
        return {
          categoryId: catId,
          categoryName: found.name,
          confidenceScore: 99,
          reasoning: `Learned from your previous categorization for "${merchant}".`,
        };
      }
    }

    const text = `${merchant} ${description}`.toLowerCase();

    // Rule-based classification
    const mappings: Array<{ keywords: string[]; categoryId: string; confidence: number }> = [
      { keywords: ['swiggy', 'zomato', 'mcdonald', 'starbucks', 'cafe', 'restaurant', 'burger', 'pizza', 'toit', 'third wave'], categoryId: 'food', confidence: 96 },
      { keywords: ['groceries', 'supermarket', 'bigbasket', 'blinkit', 'zepto', 'nature basket', 'dmart', 'instamart'], categoryId: 'groceries', confidence: 95 },
      { keywords: ['amazon', 'flipkart', 'myntra', 'zara', 'h&m', 'apple', 'croma', 'reliance digital', 'clothing', 'shoes'], categoryId: 'shopping', confidence: 92 },
      { keywords: ['uber', 'ola', 'rapido', 'metro', 'auto', 'taxi', 'toll', 'fastag'], categoryId: 'transport', confidence: 97 },
      { keywords: ['petrol', 'diesel', 'fuel', 'hpcl', 'bpcl', 'ioc', 'shell', 'indian oil'], categoryId: 'fuel', confidence: 98 },
      { keywords: ['flight', 'indigo', 'air india', 'makemytrip', 'hotel', 'airbnb', 'irctc', 'railways'], categoryId: 'travel', confidence: 95 },
      { keywords: ['netflix', 'spotify', 'youtube', 'prime', 'hotstar', 'apple tv', 'claude', 'chatgpt', 'gym', 'cult.fit', 'duolingo'], categoryId: 'subscriptions', confidence: 98 },
      { keywords: ['airtel', 'jio', 'broadband', 'bescom', 'electricity', 'water bill', 'piped gas', 'tneb'], categoryId: 'utilities', confidence: 97 },
      { keywords: ['rent', 'society maintenance', 'landlord', 'apartment', 'housing'], categoryId: 'rent', confidence: 96 },
      { keywords: ['pharmacy', 'apollo', 'medplus', 'doctor', 'hospital', 'practo', 'diagnostic', 'clinic'], categoryId: 'healthcare', confidence: 96 },
      { keywords: ['cinema', 'pvr', 'inox', 'bookmyshow', 'gaming', 'steam', 'playstation'], categoryId: 'entertainment', confidence: 94 },
      { keywords: ['loan', 'emi', 'hdfc bank auto', 'bajaj finserv', 'home loan'], categoryId: 'loan_emi', confidence: 98 },
      { keywords: ['salary', 'payroll', 'stipend', 'bonus'], categoryId: 'salary', confidence: 99 },
    ];

    for (const rule of mappings) {
      if (rule.keywords.some((k) => text.includes(k))) {
        const found = categories.find((c) => c.id === rule.categoryId);
        return {
          categoryId: rule.categoryId,
          categoryName: found ? found.name : rule.categoryId,
          confidenceScore: rule.confidence,
          reasoning: `Matched high-confidence merchant signature "${merchant}".`,
        };
      }
    }

    return {
      categoryId: 'other',
      categoryName: 'Other & Miscellaneous',
      confidenceScore: 65,
      reasoning: 'Unrecognized merchant. Defaulted to general expense category.',
    };
  }
}
