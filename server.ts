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
6. Provide calculated totalDebit and totalCredit.
7. CRITICAL AMOUNT UNIT RULE: Amounts MUST ALWAYS be in standard Rupee units (INR) e.g. 1890.50 or 250.00. NEVER multiply amounts by 100 or convert to paise. If amounts in statement have decimals (like 1890.50), preserve the exact decimal value. If the statement explicitly states amounts in paise (e.g., 189050 paise), convert them to rupees (1890.50).`;

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
                  amount: { type: Type.NUMBER, description: 'Numeric amount in standard Rupees (e.g. 1890.50, NOT in paise)' },
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

// 6. Camera Receipt AI Scanner & Information Extractor
app.post('/api/ai/scan-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', categories } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Receipt image data (imageBase64) is required.' });
    }

    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    // Clean base64 string if data URL scheme prefix exists
    let cleanBase64 = imageBase64;
    let resolvedMimeType = mimeType;
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      resolvedMimeType = parts[0].replace('data:', '');
      cleanBase64 = parts[1];
    }

    const promptText = `You are a high-precision OCR and financial receipt analysis engine.
Analyze this physical or digital receipt/invoice image carefully and extract all transaction details.

Available Category IDs in system:
${JSON.stringify(
  categories || [
    { id: 'food', name: 'Food & Dining' },
    { id: 'groceries', name: 'Groceries' },
    { id: 'shopping', name: 'Shopping & Retail' },
    { id: 'travel', name: 'Travel & Flights' },
    { id: 'transport', name: 'Cab & Transit' },
    { id: 'fuel', name: 'Fuel / Gas' },
    { id: 'bills', name: 'Bills & Utilities' },
    { id: 'healthcare', name: 'Health & Pharmacy' },
    { id: 'entertainment', name: 'Entertainment & Movies' },
    { id: 'subscriptions', name: 'Digital Subscriptions' },
    { id: 'other', name: 'Other' },
  ]
)}

Instructions:
1. Extract the primary Merchant/Store name clearly (clean normalized title, e.g. "Starbucks Coffee", "Decathlon Sports", "Shell Petrol", "Apollo Pharmacy", "Zomato", "Costco").
2. Extract the Final Total Amount as a numeric value (e.g. 542.50). IMPORTANT: Do not convert to paise; keep as standard currency value (Rupees/Dollars).
3. Extract the Transaction Date in YYYY-MM-DD format. If only DD/MM or day is found, use the current year (2026).
4. Categorize accurately using the most appropriate category ID from the list.
5. Identify Payment Method if indicated on receipt footer (e.g. "UPI", "Credit Card", "Debit Card", "Cash", "Net Banking", "Wallet", "Other").
6. Extract Line Items (item name, quantity, price) if legible.
7. Summarize the items into a concise note (e.g., "1x Latte, 2x Croissants").
8. Generate 2-4 helpful tags (e.g., ["receipt", "dining", "breakfast"]).
9. Estimate confidenceScore between 0 and 100 based on image clarity and text legibility.`;

    const imagePart = {
      inlineData: {
        mimeType: resolvedMimeType || 'image/jpeg',
        data: cleanBase64,
      },
    };

    const textPart = {
      text: promptText,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING, description: 'Store or vendor name' },
            amount: { type: Type.NUMBER, description: 'Final total amount paid' },
            date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
            type: {
              type: Type.STRING,
              enum: ['expense', 'income', 'refund', 'transfer', 'investment', 'loan_emi'],
              description: 'Transaction classification',
            },
            categoryId: { type: Type.STRING, description: 'Selected category identifier' },
            categoryName: { type: Type.STRING, description: 'Readable category name' },
            paymentMethod: {
              type: Type.STRING,
              enum: ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Cash', 'Wallet', 'Other'],
            },
            taxAmount: { type: Type.NUMBER, description: 'Taxes or GST amount if identified' },
            notes: { type: Type.STRING, description: 'Itemized summary or invoice reference' },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of relevant keywords',
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  price: { type: Type.NUMBER },
                },
                required: ['name'],
              },
            },
            confidenceScore: { type: Type.INTEGER, description: 'Confidence from 0 to 100' },
            detectedCurrency: { type: Type.STRING, description: 'Currency symbol or ISO code' },
          },
          required: ['merchant', 'amount', 'date', 'categoryId', 'type', 'confidenceScore'],
        },
      },
    });

    const parsedData = JSON.parse(response.text?.trim() || '{}');
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error in /api/ai/scan-receipt:', error);
    res.status(500).json({ error: error.message || 'Receipt scanning failed' });
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
