import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import {
  verifyWebhookHandshake,
  verifyWebhookSignature,
  extractWhatsAppMessagesFromPayload,
  processWhatsAppMessage,
  linkUserPhone,
} from './src/server/whatsappService';

dotenv.config();

const app = express();
const PORT = 3000;

// Security: Disable X-Powered-By header to prevent framework fingerprinting
app.disable('x-powered-by');

// Security: Enforce HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  // Allow framing within AI Studio and Cloud Run while blocking arbitrary third-party embedding
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://*.google.com https://*.run.app https://ai.studio http://localhost:*;"
  );
  next();
});

// Capture raw body for HMAC-SHA256 signature verification
app.use(
  express.json({
    limit: '15mb',
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// In-Memory Sliding Window Rate Limiting (Protection against DoS & Denial-of-Wallet)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();

// Background pruning of stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function createRateLimiter(maxRequests: number, windowMs: number, prefix: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rawIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'client';
    const key = `${prefix}:${rawIp}`;
    const now = Date.now();

    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
        retryAfter,
      });
    }

    entry.count++;
    next();
  };
}

const apiGeneralLimiter = createRateLimiter(150, 60 * 1000, 'api_general');
const aiEndpointLimiter = createRateLimiter(40, 60 * 1000, 'ai_llm');
const webhookSimLimiter = createRateLimiter(60, 60 * 1000, 'wh_sim');

app.use('/api', apiGeneralLimiter);
app.use('/api/ai', aiEndpointLimiter);
app.use('/api/webhooks/whatsapp/simulate', webhookSimLimiter);

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

// --- EMAIL VERIFICATION SYSTEM ---
interface VerificationTokenRecord {
  email: string;
  token: string;
  createdAt: number;
  expiresAt: number;
}
const emailVerificationTokens = new Map<string, VerificationTokenRecord>();

// Clean expired tokens every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of emailVerificationTokens.entries()) {
    if (now > val.expiresAt) {
      emailVerificationTokens.delete(key);
    }
  }
}, 15 * 60 * 1000).unref();

// Send Account Verification Link Email
app.post('/api/auth/send-verification-email', async (req, res) => {
  try {
    const { email, name, customToken } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const token = customToken || `${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    emailVerificationTokens.set(token, {
      email: cleanEmail,
      token,
      createdAt: Date.now(),
      expiresAt,
    });

    // Derive Base URL
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = process.env.APP_URL || (host ? `${protocol}://${host}` : 'http://localhost:3000');
    const verificationUrl = `${baseUrl.replace(/\/$/, '')}?verify_token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    const recipientName = name?.trim() || cleanEmail.split('@')[0];

    // HTML Email Template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify your account - AI Expense Intelligence</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 32px 16px; margin: 0;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden;">
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #334155;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">AI Expense Intelligence</h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">Autonomous Financial Analytics & Statement Intelligence</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #e2e8f0;">
                Hello <strong>${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 22px; color: #cbd5e1;">
                Please click the button below to verify your email address and activate your personal AI Expense Intelligence account. This step confirms your email and protects your account against spam bots.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${verificationUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">
                  Verify My Account
                </a>
              </div>
              <p style="margin: 24px 0 8px; font-size: 12px; color: #94a3b8; line-height: 18px;">
                If the button above does not work, copy and paste this verification URL into your browser:
              </p>
              <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; word-break: break-all; font-family: monospace; font-size: 11px; color: #38bdf8;">
                ${verificationUrl}
              </div>
              <p style="margin: 24px 0 0; font-size: 12px; color: #64748b;">
                This link will remain active for 24 hours. If you did not create this account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                &copy; ${new Date().getFullYear()} AI Expense Intelligence. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Attempt 1: Custom SMTP (if provided via environment variables)
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpFrom = process.env.SMTP_FROM || smtpUser || 'noreply@spendai.io';

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
        await transporter.sendMail({
          from: `"AI Expense Intelligence" <${smtpFrom}>`,
          to: cleanEmail,
          subject: 'Verify your account - AI Expense Intelligence',
          html: emailHtml,
        });
        return res.json({
          success: true,
          method: 'smtp',
          verificationUrl,
          message: `Verification email dispatched to ${cleanEmail}`,
        });
      } catch (smtpErr: any) {
        console.warn('Custom SMTP delivery error:', smtpErr.message);
      }
    }

    // Attempt 2: Resend API (if RESEND_API_KEY provided)
    if (process.env.RESEND_API_KEY) {
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'AI Expense Intelligence <onboarding@resend.dev>',
            to: cleanEmail,
            subject: 'Verify your account - AI Expense Intelligence',
            html: emailHtml,
          }),
        });
        if (resendResponse.ok) {
          return res.json({
            success: true,
            method: 'resend',
            verificationUrl,
            message: `Verification email dispatched to ${cleanEmail} via Resend`,
          });
        }
      } catch (resendErr: any) {
        console.warn('Resend email delivery error:', resendErr.message);
      }
    }

    // Attempt 3: Ethereal test inbox delivery (provides instant web preview link)
    let previewUrl: string | null = null;
    try {
      const testAccount = await nodemailer.createTestAccount();
      const testTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      const info = await testTransporter.sendMail({
        from: '"AI Expense Intelligence" <noreply@spendai.io>',
        to: cleanEmail,
        subject: 'Verify your account - AI Expense Intelligence',
        html: emailHtml,
      });
      const testUrl = nodemailer.getTestMessageUrl(info);
      if (typeof testUrl === 'string') {
        previewUrl = testUrl;
      }
    } catch (etherealErr: any) {
      console.warn('Ethereal test dispatch note:', etherealErr.message);
    }

    // Return successful token generation with direct link and preview
    return res.json({
      success: true,
      method: previewUrl ? 'ethereal_preview' : 'direct_link',
      token,
      verificationUrl,
      previewUrl,
      message: `Account verification link created for ${cleanEmail}`,
      firebaseProjectId: 'gen-lang-client-0472501454',
      firebaseConsoleUrl: 'https://console.firebase.google.com/project/gen-lang-client-0472501454/authentication/providers',
    });
  } catch (err: any) {
    console.error('send-verification-email error:', err);
    return res.status(500).json({ error: 'Failed to process verification email request' });
  }
});

// Verify Token Endpoint
app.post('/api/auth/verify-token', (req, res) => {
  try {
    const { token, email } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const record = emailVerificationTokens.get(token);
    if (!record) {
      return res.status(404).json({ error: 'Verification link has expired or is invalid.' });
    }

    if (Date.now() > record.expiresAt) {
      emailVerificationTokens.delete(token);
      return res.status(410).json({ error: 'Verification link has expired. Please request a new one.' });
    }

    if (email && record.email.toLowerCase() !== email.trim().toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match verification token.' });
    }

    // Mark as verified and remove token
    emailVerificationTokens.delete(token);

    return res.json({
      success: true,
      email: record.email,
      verified: true,
      message: 'Email verified successfully!',
    });
  } catch (err: any) {
    console.error('verify-token error:', err);
    return res.status(500).json({ error: 'Failed to verify token' });
  }
});


// 1. AI Statement Parser & Normalizer
app.post('/api/ai/parse-statement', async (req, res) => {
  try {
    const { rawText, fileType } = req.body;
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      return res.status(400).json({ error: 'Valid rawText string is required' });
    }

    if (rawText.length > 70000) {
      return res.status(413).json({ error: 'Statement content exceeds maximum size limit (70,000 characters)' });
    }

    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    const prompt = `You are a world-class financial intelligence parser and bank statement normalization engine.
Parse the following raw statement content (type: ${fileType || 'text/csv'}).

Raw Statement Data:
"""
${rawText.slice(0, 10000)}
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
    if (!Array.isArray(currentMonthTxs) || !Array.isArray(prevMonthTxs)) {
      return res.status(400).json({ error: 'currentMonthTxs and prevMonthTxs must be arrays' });
    }
    if (currentMonthTxs.length > 250 || prevMonthTxs.length > 250) {
      return res.status(413).json({ error: 'Transaction list exceeds maximum batch limit of 250 items' });
    }

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
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Valid query string is required' });
    }

    if (query.length > 600) {
      return res.status(400).json({ error: 'Query text exceeds maximum allowed length of 600 characters' });
    }

    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    const safeTxs = Array.isArray(transactions) ? transactions.slice(0, 100) : [];
    const txSummary = safeTxs.map((t: any) => ({
      id: String(t.id || ''),
      date: String(t.date || ''),
      merchant: String(t.merchant || ''),
      amount: typeof t.amount === 'number' ? t.amount : 0,
      type: String(t.type || 'expense'),
      category: String(t.categoryId || ''),
      paymentMethod: String(t.paymentMethod || ''),
    }));

    const prompt = `You are "Ask My Money", a financial intelligence agent.
The user is asking: "${query.replace(/[^\w\s\?\.,₹$%@!-]/g, '')}"

Here is the user's structured financial dataset:
Transactions (${txSummary.length}):
${JSON.stringify(txSummary)}

Categories:
${JSON.stringify(Array.isArray(categories) ? categories.slice(0, 30) : [])}

Budgets:
${JSON.stringify(Array.isArray(budgets) ? budgets.slice(0, 30) : [])}

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
    const matchedTxs = safeTxs.filter((t: any) =>
      (parsed.relevantTransactionIds || []).includes(t.id)
    );

    res.json({
      answer: parsed.answer,
      queryType: parsed.queryType,
      calculatedAmount: parsed.calculatedAmount,
      relevantTransactions: matchedTxs.length > 0 ? matchedTxs : safeTxs.slice(0, 4),
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
    if (!itemDescription || typeof itemDescription !== 'string' || itemDescription.trim().length === 0) {
      return res.status(400).json({ error: 'Valid itemDescription is required' });
    }

    const numAmount = typeof amount === 'number' && !isNaN(amount) && amount > 0 ? Math.min(amount, 1000000000) : 0;
    if (numAmount <= 0) {
      return res.status(400).json({ error: 'A positive numeric amount is required' });
    }

    const cleanItem = itemDescription.slice(0, 200).trim();
    const cleanCat = String(categoryName || 'General').slice(0, 60);

    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    const safeBudget = typeof monthlyBudget === 'number' && !isNaN(monthlyBudget) ? monthlyBudget : 0;
    const safeSpent = typeof alreadySpent === 'number' && !isNaN(alreadySpent) ? alreadySpent : 0;

    const remainingBudget = safeBudget - safeSpent;
    const afterPurchaseRemaining = remainingBudget - numAmount;
    const isOverBudget = afterPurchaseRemaining < 0;

    const prompt = `You are a financial advisor evaluating a potential purchase.
User is considering buying: "${cleanItem}"
Price: ₹${numAmount}
Category: ${cleanCat}
Current Monthly Budget: ₹${safeBudget}
Already Spent in Category: ₹${safeSpent}
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
        categoryName: cleanCat,
        monthlyBudget: safeBudget,
        alreadySpent: safeSpent,
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
    if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.trim().length === 0) {
      return res.status(400).json({ error: 'Receipt image data (imageBase64) is required.' });
    }

    if (imageBase64.length > 15 * 1024 * 1024) {
      return res.status(413).json({ error: 'Receipt image exceeds maximum allowed 10MB size limit.' });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
    if (mimeType && !allowedMimes.includes(mimeType)) {
      return res.status(400).json({ error: 'Unsupported image format. Allowed: JPEG, PNG, WEBP, HEIC.' });
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

// ==========================================
// WhatsApp Business Cloud API Webhook Routes
// ==========================================

// 1. Webhook Handshake Verification (GET /api/webhooks/whatsapp)
app.get('/api/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  const result = verifyWebhookHandshake(mode, token, challenge);
  if (result.isValid) {
    console.log('[WhatsApp Webhook] Handshake verified successfully with Meta.');
    return res.status(200).send(result.challenge);
  }

  console.warn('[WhatsApp Webhook] Handshake verification rejected. Check WHATSAPP_VERIFY_TOKEN.');
  return res.sendStatus(403);
});

// 2. Incoming Event Ingestion with Signature Verification & Idempotency (POST /api/webhooks/whatsapp)
app.post('/api/webhooks/whatsapp', async (req, res) => {
  try {
    const rawBody = (req as any).rawBody;
    const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;

    // Step A: Signature Verification
    const sigCheck = verifyWebhookSignature(rawBody, signatureHeader);
    if (!sigCheck.isValid) {
      console.warn(`[WhatsApp Webhook] Security Alert: ${sigCheck.reason}`);
      return res.status(401).json({ error: sigCheck.reason || 'Invalid webhook signature' });
    }

    // Step B: Extract Incoming Messages
    const incomingMessages = extractWhatsAppMessagesFromPayload(req.body);

    if (!incomingMessages || incomingMessages.length === 0) {
      // Non-message event (e.g. status acknowledgment, read receipt)
      return res.status(200).json({ status: 'ok', received: 0 });
    }

    console.log(`[WhatsApp Webhook] Received ${incomingMessages.length} message(s) to process.`);

    // Step C: Process each message through Deduplication, AI Parsing, and Firestore
    const results = [];
    const ai = getAI();

    for (const msg of incomingMessages) {
      const result = await processWhatsAppMessage(ai, msg);
      results.push(result);
    }

    // Acknowledge promptly to Meta (Meta requires HTTP 200 within 20s)
    return res.status(200).json({
      status: 'success',
      processedCount: results.length,
      results,
    });
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Unhandled exception in webhook handler:', error);
    // Return HTTP 200 to prevent Meta retry loops if the error is unrecoverable, or 500 if transient
    return res.status(200).json({ status: 'error_handled', error: error.message });
  }
});

// 3. Simulated Webhook Testing Endpoint (POST /api/webhooks/whatsapp/simulate)
// Enables instant in-app developer testing of natural language messages
app.post('/api/webhooks/whatsapp/simulate', async (req, res) => {
  try {
    const { from, text, senderName, userId, currencySymbol } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required (e.g. "Spent 500 on dinner")' });
    }

    const cleanText = text.slice(0, 600).trim();
    const cleanFrom = String(from || '919876543210').replace(/[^0-9]/g, '').slice(0, 16);
    const cleanSenderName = String(senderName || 'Simulator User').slice(0, 100);
    const cleanUserId = userId ? String(userId).slice(0, 128) : undefined;
    const cleanCurrency = currencySymbol ? String(currencySymbol).slice(0, 10) : undefined;

    const testMessage = {
      id: `sim_msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from: cleanFrom,
      senderName: cleanSenderName,
      timestamp: String(Math.floor(Date.now() / 1000)),
      text: cleanText,
    };

    const ai = getAI();
    const result = await processWhatsAppMessage(ai, testMessage, cleanUserId, cleanCurrency);

    return res.status(200).json({
      status: 'success',
      simulation: true,
      result,
    });
  } catch (error: any) {
    console.error('[WhatsApp Simulator] Simulation failed:', error);
    return res.status(500).json({ error: error.message || 'Simulation failed' });
  }
});

// 4. Link WhatsApp Phone Number to User Profile (POST /api/whatsapp/link-phone)
app.post('/api/whatsapp/link-phone', async (req, res) => {
  try {
    const { phone, userId, userName, currencySymbol } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'phone is required' });
    }

    const cleanDigits = phone.replace(/[^0-9]/g, '');
    if (cleanDigits.length < 8 || cleanDigits.length > 16) {
      return res.status(400).json({ error: 'Valid phone number with 8-16 digits is required' });
    }

    if (userId && (typeof userId !== 'string' || !/^[a-zA-Z0-9_\-\.]{1,128}$/.test(userId))) {
      return res.status(400).json({ error: 'Invalid userId format' });
    }

    await linkUserPhone(cleanDigits, userId || 'default_user', userName, currencySymbol);
    return res.status(200).json({ status: 'success', linked: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to link phone' });
  }
});

// 5. WhatsApp Integration Status (GET /api/whatsapp/status)
app.get('/api/whatsapp/status', (req, res) => {
  const verifyTokenConfigured = Boolean(process.env.WHATSAPP_VERIFY_TOKEN);
  const appSecretConfigured = Boolean(process.env.WHATSAPP_APP_SECRET);
  const outboundConfigured = Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN
  );

  const protocol = req.protocol;
  const host = req.get('host');
  const appUrl = process.env.APP_URL || `${protocol}://${host}`;
  const webhookUrl = `${appUrl}/api/webhooks/whatsapp`;

  res.json({
    status: 'ready',
    webhookUrl,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ? '••••••••' : 'spend_ai_whatsapp_token_2026',
    verifyTokenConfigured,
    appSecretConfigured,
    outboundConfigured,
    idempotencyStore: 'Firestore (collection: whatsapp_messages)',
  });
});

// Centralized Error Handling Middleware (prevents leaking internal stack traces)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Server Error]:', err?.message || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: 'An internal server error occurred. Request could not be processed.',
  });
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
