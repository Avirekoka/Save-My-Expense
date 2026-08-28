import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Lazy Google GenAI Client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 1. AI Statement Parser & Normalizer
app.post('/api/ai/parse-statement', async (req, res) => {
  try {
    const { rawText, fileType } = req.body;
    if (!rawText) {
      return res.status(400).json({ error: 'rawText is required' });
    }

    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    const prompt = `You are a world-class financial intelligence parser and bank statement normalization engine.
Parse the following raw statement content (type: ${fileType || 'text/csv'}).

Raw Statement Data:
"""
${rawText.slice(0, 8000)}
"""

Tasks:
1. Extract every valid transaction row accurately.
2. Clean and normalize messy bank narration/descriptions (e.g. "UPI/RAHULSHARMA/123" -> merchant: "Rahul Sharma", paymentMethod: "UPI", type: "transfer"; "POS AMAZON PAY INDIA" -> merchant: "Amazon India", category: "shopping").
3. Strictly distinguish between transaction types:
   - "expense": genuine purchases or bills
   - "income": salary, rewards, interest
   - "transfer": self-transfers or peer transfers between own accounts
   - "refund": reversals or merchant returns
   - "investment": mutual funds, stocks, crypto, deposits
   - "loan_emi": vehicle, personal or home loan repayments
   - "cash_withdrawal": ATM withdrawals (not spending!)
4. Select one of these category IDs: food, groceries, shopping, travel, transport, fuel, bills, utilities, rent, healthcare, education, entertainment, subscriptions, insurance, investments, loan_emi, salary, transfers, cash_withdrawal, other.
5. Provide a realistic confidence score (0-100) for categorization.
6. Provide calculated totalDebit and totalCredit.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: 'YYYY-MM-DD format' },
                  description: { type: Type.STRING, description: 'Original or summarized description' },
                  merchant: { type: Type.STRING, description: 'Clean normalized merchant name' },
                  amount: { type: Type.NUMBER, description: 'Numeric amount' },
                  type: {
                    type: Type.STRING,
                    enum: ['expense', 'income', 'transfer', 'refund', 'investment', 'loan_emi', 'cash_withdrawal'],
                  },
                  category: { type: Type.STRING, description: 'Category ID' },
                  paymentMethod: {
                    type: Type.STRING,
                    enum: ['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Net Banking'],
                  },
                  confidenceScore: { type: Type.INTEGER, description: '0-100' },
                  notes: { type: Type.STRING },
                },
                required: ['date', 'merchant', 'amount', 'type', 'category', 'paymentMethod', 'confidenceScore'],
              },
            },
            totalDebit: { type: Type.NUMBER },
            totalCredit: { type: Type.NUMBER },
            summary: { type: Type.STRING },
          },
          required: ['transactions', 'totalDebit', 'totalCredit', 'summary'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/parse-statement:', error);
    res.status(500).json({ error: error.message || 'Statement parse failed' });
  }
});

// 2. AI Insights Generator
app.post('/api/ai/insights', async (req, res) => {
  try {
    const { currentMonthTxs, prevMonthTxs, categories } = req.body;
    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    const prompt = `You are a senior financial analyst and behavioral economics advisor.
Analyze these transactions for the current month vs previous month.

Current Month Transactions (${(currentMonthTxs || []).length} items):
${JSON.stringify(
  (currentMonthTxs || []).slice(0, 40).map((t: any) => ({
    date: t.date,
    merchant: t.merchant,
    amount: t.amount,
    cat: t.categoryId,
    type: t.type,
  }))
)}

Previous Month Summary / Transactions (${(prevMonthTxs || []).length} items):
${JSON.stringify(
  (prevMonthTxs || []).slice(0, 20).map((t: any) => ({
    date: t.date,
    merchant: t.merchant,
    amount: t.amount,
    cat: t.categoryId,
  }))
)}

Generate 4 to 6 insightful, mathematically grounded intelligence items:
- spending_anomaly (unusual spikes)
- subscription_discovery (recurring software/memberships cost and potential flags)
- lifestyle_inflation (category growth over time)
- merchant_concentration (e.g. % spent at Amazon or Swiggy)
- weekend_spending (weekend vs weekday spending ratio)
- salary_day_behavior (spending velocity post-salary)
- money_leak (small repeating charges totaling significant sums)
- spending_personality (e.g., Weekend Spender, Subscription Heavy, Steady Saver)
- monthly_story (narrative summary of what changed this month)

Ensure all figures and percentages match the actual transaction data provided.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: {
                    type: Type.STRING,
                    enum: [
                      'spending_anomaly',
                      'subscription_discovery',
                      'lifestyle_inflation',
                      'merchant_concentration',
                      'weekend_spending',
                      'salary_day_behavior',
                      'money_leak',
                      'spending_personality',
                      'monthly_story',
                    ],
                  },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  impactAmount: { type: Type.NUMBER },
                  changePercentage: { type: Type.NUMBER },
                  categoryId: { type: Type.STRING },
                  actionRecommendation: { type: Type.STRING },
                  confidenceScore: { type: Type.INTEGER },
                  date: { type: Type.STRING },
                },
                required: ['id', 'type', 'title', 'description', 'confidenceScore', 'date'],
              },
            },
          },
          required: ['insights'],
        },
      },
    });

    const data = JSON.parse(response.text?.trim() || '{"insights": []}');
    res.json(data);
  } catch (error: any) {
    console.error('Error in /api/ai/insights:', error);
    res.status(500).json({ error: error.message || 'AI insights generation failed' });
  }
});

// 3. Natural Language Conversational "Ask My Money"
app.post('/api/ai/ask-money', async (req, res) => {
  try {
    const { query, transactions, categories, budgets } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    const txSummary = (transactions || []).slice(0, 100).map((t: any) => ({
      id: t.id,
      date: t.date,
      merchant: t.merchant,
      amount: t.amount,
      type: t.type,
      category: t.categoryId,
      paymentMethod: t.paymentMethod,
    }));

    const prompt = `You are "Ask My Money", a financial intelligence agent.
The user is asking: "${query}"

Here is the user's structured financial dataset:
Transactions (${txSummary.length}):
${JSON.stringify(txSummary)}

Categories:
${JSON.stringify(categories || [])}

Budgets:
${JSON.stringify(budgets || [])}

Rules:
1. Ground your answer completely in the provided financial transactions.
2. If asked for amounts, calculate them precisely.
3. Identify and return the exact matching transactions that substantiate your answer.
4. Give a clear, friendly, and concise answer with financial context.
5. Provide 2-3 helpful follow-up questions the user might want to ask next.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            queryType: { type: Type.STRING },
            calculatedAmount: { type: Type.NUMBER },
            relevantTransactionIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            insights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedFollowUps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['answer', 'queryType', 'relevantTransactionIds'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const matchedTxs = (transactions || []).filter((t: any) =>
      (parsed.relevantTransactionIds || []).includes(t.id)
    );

    res.json({
      answer: parsed.answer,
      queryType: parsed.queryType,
      calculatedAmount: parsed.calculatedAmount,
      relevantTransactions: matchedTxs.length > 0 ? matchedTxs : (transactions || []).slice(0, 4),
      insights: parsed.insights || [],
      suggestedFollowUps: parsed.suggestedFollowUps || [],
    });
  } catch (error: any) {
    console.error('Error in /api/ai/ask-money:', error);
    res.status(500).json({ error: error.message || 'Ask My Money query failed' });
  }
});

// 4. "Before You Spend" Decision Tool
app.post('/api/ai/before-you-spend', async (req, res) => {
  try {
    const { itemDescription, amount, categoryName, monthlyBudget, alreadySpent } = req.body;
    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    const remainingBudget = (monthlyBudget || 0) - (alreadySpent || 0);
    const afterPurchaseRemaining = remainingBudget - amount;
    const isOverBudget = afterPurchaseRemaining < 0;

    const prompt = `You are a financial advisor evaluating a potential purchase.
User is considering buying: "${itemDescription}"
Price: ₹${amount}
Category: ${categoryName}
Current Monthly Budget: ₹${monthlyBudget}
Already Spent in Category: ₹${alreadySpent}
Remaining Budget before purchase: ₹${remainingBudget}
Projected Remaining Budget after purchase: ₹${afterPurchaseRemaining}

Provide a constructive, supportive, and non-judgmental evaluation with:
- decisionRecommendation: "safe" (well within budget), "caution" (close to limit), or "critical" (exceeds budget)
- headline: 1-line clear verdict
- tradeOffAnalysis: what this purchase means for their monthly allocation
- savingImpact: how to adjust other discretionary spending if they decide to proceed.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decisionRecommendation: {
              type: Type.STRING,
              enum: ['safe', 'caution', 'critical'],
            },
            headline: { type: Type.STRING },
            tradeOffAnalysis: { type: Type.STRING },
            savingImpact: { type: Type.STRING },
          },
          required: ['decisionRecommendation', 'headline', 'tradeOffAnalysis', 'savingImpact'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    res.json({
      ...parsed,
      budgetStatus: {
        categoryName,
        monthlyBudget,
        alreadySpent,
        remainingBudget,
        afterPurchaseRemaining,
        isOverBudget,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/ai/before-you-spend:', error);
    res.status(500).json({ error: error.message || 'Before You Spend analysis failed' });
  }
});

// 5. Smart Budget Recommendations
app.post('/api/ai/budget-recommendation', async (req, res) => {
  try {
    const { categorySpendingHistory, monthlyIncome } = req.body;
    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    const prompt = `You are a personal budgeting strategist.
Based on the user's monthly income of ₹${monthlyIncome || 120000} and historical category spend:
${JSON.stringify(categorySpendingHistory || {})}

Recommend optimal monthly budget allocations across categories. Follow the 50/30/20 rule (Needs/Wants/Savings) adjusted for real spending patterns. Provide clear rationale for each category.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  categoryId: { type: Type.STRING },
                  categoryName: { type: Type.STRING },
                  recommendedAmount: { type: Type.NUMBER },
                  rationale: { type: Type.STRING },
                },
                required: ['categoryId', 'categoryName', 'recommendedAmount', 'rationale'],
              },
            },
            totalRecommendedBudget: { type: Type.NUMBER },
            projectedSavingsAmount: { type: Type.NUMBER },
          },
          required: ['recommendations', 'totalRecommendedBudget', 'projectedSavingsAmount'],
        },
      },
    });

    res.json(JSON.parse(response.text?.trim() || '{}'));
  } catch (error: any) {
    console.error('Error in budget recommendation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Expense Intelligence server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
