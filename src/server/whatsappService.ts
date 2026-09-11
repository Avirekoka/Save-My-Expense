import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import {
  getServerFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from './firestoreServer';

export interface WhatsAppIncomingMessage {
  id: string; // provider message ID, e.g. "wamid.HBgL..."
  from: string; // sender phone number in international format e.g. "919876543210"
  senderName?: string;
  timestamp?: string;
  text: string;
}

export interface ExtractedExpense {
  amount: number;
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'investment' | 'loan_emi';
  merchant: string;
  categoryId: string;
  date: string; // YYYY-MM-DD
  paymentMethod: 'UPI' | 'Credit Card' | 'Debit Card' | 'Cash' | 'Bank Transfer' | 'Net Banking';
  confidenceScore: number;
  notes?: string;
}

export interface ProcessedWhatsAppResult {
  status: 'processed' | 'duplicate' | 'in_progress' | 'failed' | 'ignored';
  messageId: string;
  transactionId?: string;
  extracted?: ExtractedExpense;
  userId?: string;
  replyMessage?: string;
  error?: string;
}

/**
 * 1. Webhook Handshake Verification (GET /api/webhooks/whatsapp)
 * Validates hub.mode and hub.verify_token against configured secret.
 */
export function verifyWebhookHandshake(
  mode?: string,
  token?: string,
  challenge?: string
): { isValid: boolean; challenge?: string } {
  const expectedToken =
    process.env.WHATSAPP_VERIFY_TOKEN || 'spend_ai_whatsapp_token_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    return { isValid: true, challenge: challenge || '' };
  }

  return { isValid: false };
}

/**
 * 2. HMAC-SHA256 Signature Verification
 * Validates X-Hub-Signature-256 header sent by Meta using WHATSAPP_APP_SECRET.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader?: string
): { isValid: boolean; reason?: string } {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // If WHATSAPP_APP_SECRET is not configured yet (e.g. initial setup / development),
  // allow request while logging a helpful configuration warning.
  if (!appSecret) {
    return {
      isValid: true,
      reason: 'WHATSAPP_APP_SECRET not configured on server; signature check bypassed for development/testing',
    };
  }

  if (!signatureHeader) {
    return { isValid: false, reason: 'Missing X-Hub-Signature-256 header' };
  }

  if (!signatureHeader.startsWith('sha256=')) {
    return { isValid: false, reason: 'Invalid signature algorithm (expected sha256=)' };
  }

  const signatureHash = signatureHeader.slice(7).trim();
  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(typeof rawBody === 'string' ? rawBody : '');

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(bodyBuffer)
    .digest('hex');

  const sigBuffer = Buffer.from(signatureHash, 'hex');
  const expBuffer = Buffer.from(expectedHash, 'hex');

  if (sigBuffer.length !== expBuffer.length) {
    return { isValid: false, reason: 'Signature length mismatch' };
  }

  const isMatch = crypto.timingSafeEqual(sigBuffer, expBuffer);
  return {
    isValid: isMatch,
    reason: isMatch ? undefined : 'HMAC signature does not match computed digest',
  };
}

/**
 * 3. Message Deduplication / Idempotency Check in Firebase Firestore
 * Checks if the incoming message has already been received or processed.
 */
export async function checkMessageIdempotency(
  messageId: string
): Promise<{ exists: boolean; status?: string; transactionId?: string; extracted?: ExtractedExpense }> {
  try {
    const db = getServerFirestore();
    const docRef = doc(db, 'whatsapp_messages', messageId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        exists: true,
        status: data.status,
        transactionId: data.transactionId,
        extracted: data.extracted,
      };
    }
    return { exists: false };
  } catch (err) {
    console.warn(`[WhatsApp Idempotency] Failed to query Firestore doc for ${messageId}:`, err);
    // On read error, allow pipeline to attempt processing rather than hard failing
    return { exists: false };
  }
}

/**
 * Record incoming message in Firestore to establish idempotency lock
 */
export async function recordIncomingMessageLock(
  msg: WhatsAppIncomingMessage
): Promise<void> {
  try {
    const db = getServerFirestore();
    const docRef = doc(db, 'whatsapp_messages', msg.id);
    await setDoc(docRef, {
      id: msg.id,
      messageId: msg.id,
      from: msg.from,
      senderName: msg.senderName || '',
      text: msg.text,
      timestamp: msg.timestamp || new Date().toISOString(),
      status: 'processing',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn(`[WhatsApp Idempotency] Failed to record message lock ${msg.id}:`, err);
  }
}

/**
 * Mark message as successfully processed with associated transaction ID
 */
export async function markMessageProcessed(
  messageId: string,
  userId: string,
  transactionId: string,
  extracted: ExtractedExpense
): Promise<void> {
  try {
    const db = getServerFirestore();
    const docRef = doc(db, 'whatsapp_messages', messageId);
    await updateDoc(docRef, {
      status: 'processed',
      userId,
      transactionId,
      extracted,
      processedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn(`[WhatsApp Idempotency] Failed to update message ${messageId} to processed:`, err);
  }
}

/**
 * Mark message as failed in Firestore
 */
export async function markMessageFailed(
  messageId: string,
  errorMessage: string
): Promise<void> {
  try {
    const db = getServerFirestore();
    const docRef = doc(db, 'whatsapp_messages', messageId);
    await updateDoc(docRef, {
      status: 'failed',
      error: errorMessage,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn(`[WhatsApp Idempotency] Failed to mark message ${messageId} as failed:`, err);
  }
}

/**
 * Link WhatsApp Phone Number to a user account with strict format validation
 */
export async function linkUserPhone(
  phoneNumber: string,
  userId: string,
  userName?: string,
  currencySymbol?: string
): Promise<void> {
  const db = getServerFirestore();
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  if (!cleanPhone || cleanPhone.length < 8 || cleanPhone.length > 16) {
    throw new Error('Invalid phone number format. Must be between 8 and 16 digits.');
  }

  // Sanitize and validate userId
  const cleanUserId = String(userId || '').trim().slice(0, 128);
  if (!/^[a-zA-Z0-9_\-\.]{1,128}$/.test(cleanUserId)) {
    throw new Error('Invalid userId format.');
  }

  const safeUserName = String(userName || 'User').trim().slice(0, 100);
  const safeCurrency = String(currencySymbol || '₹').trim().slice(0, 10);

  try {
    const docRef = doc(db, 'whatsapp_users', cleanPhone);
    await setDoc(
      docRef,
      {
        phone: cleanPhone,
        userId: cleanUserId,
        userName: safeUserName,
        currencySymbol: safeCurrency,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Also update phone on user document if not demo
    if (cleanUserId && !cleanUserId.startsWith('demo_') && cleanUserId !== 'default_user') {
      const userRef = doc(db, 'users', cleanUserId);
      await setDoc(userRef, { phone: cleanPhone, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch (err) {
    console.warn('[WhatsApp Phone Linking] Error saving phone link:', err);
    throw err;
  }
}

/**
 * 4. User Resolution
 * Finds the matching user profile in Firestore by phone number.
 */
export async function resolveUserByPhone(
  phoneNumber: string
): Promise<{ userId: string; userName: string; currencySymbol: string }> {
  const db = getServerFirestore();

  // Normalize phone number (e.g. "919876543210" or "+91 98765 43210")
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  const variants = [
    cleanPhone,
    `+${cleanPhone}`,
    cleanPhone.startsWith('91') && cleanPhone.length === 12 ? cleanPhone.slice(2) : cleanPhone,
    cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone,
    cleanPhone.length === 10 ? `+91${cleanPhone}` : cleanPhone,
  ];

  try {
    // 1. Check direct whatsapp_users mapping first
    for (const v of variants) {
      const vClean = v.replace(/[^0-9]/g, '');
      const waUserSnap = await getDoc(doc(db, 'whatsapp_users', vClean));
      if (waUserSnap.exists()) {
        const d = waUserSnap.data();
        if (d && d.userId) {
          return {
            userId: d.userId,
            userName: d.userName || 'User',
            currencySymbol: d.currencySymbol || '₹',
          };
        }
      }
    }

    // 2. Query users collection by phone
    const usersCol = collection(db, 'users');
    const usersSnap = await getDocs(usersCol);

    for (const docSnap of usersSnap.docs) {
      const uData = docSnap.data();
      const userPhone = (uData.phone || '').replace(/[^0-9]/g, '');
      if (userPhone && variants.some((v) => v.replace(/[^0-9]/g, '') === userPhone)) {
        return {
          userId: docSnap.id,
          userName: uData.displayName || uData.name || 'User',
          currencySymbol: uData.currencySymbol || uData.currency || '₹',
        };
      }
    }

    // 3. If no phone match, check if any registered user exists (e.g. primary account)
    if (!usersSnap.empty) {
      // Pick first genuine registered user as default recipient
      const firstUser = usersSnap.docs[0];
      const uData = firstUser.data();
      return {
        userId: firstUser.id,
        userName: uData.displayName || uData.name || 'User',
        currencySymbol: uData.currencySymbol || uData.currency || '₹',
      };
    }
  } catch (err) {
    console.warn('[WhatsApp User Lookup] Error resolving user by phone:', err);
  }

  // Fallback to default user id if database is fresh
  return {
    userId: 'default_user',
    userName: 'User',
    currencySymbol: '₹',
  };
}

/**
 * Deterministic Regex/Rule-Based Fallback Parser for WhatsApp Expenses
 * Used if Gemini API experiences transient 503 high demand or connectivity issues
 */
export function parseExpenseHeuristics(messageText: string): ExtractedExpense {
  const clean = messageText.trim();
  const lower = clean.toLowerCase();
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Amount Extraction (e.g. "450", "₹500", "500.00", "1200 rs", "rs 1200", "spent 350")
  let amount = 0;
  const amountMatch = clean.match(/(?:(?:rs\.?|inr|₹|spent|paid|ka)\s*)?(\d+(?:\.\d{1,2})?)(?:\s*(?:rs\.?|inr|₹|rupees|bucks))?/i);
  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1]);
  } else {
    // Look for any digit sequence
    const digits = clean.match(/\b\d+(\.\d{1,2})?\b/);
    if (digits) amount = parseFloat(digits[0]);
  }

  // 2. Category Detection
  let categoryId = 'other';
  let merchant = 'Expense';

  if (/(dinner|lunch|breakfast|food|swiggy|zomato|cafe|tea|coffee|restaurant|snack|khana)/i.test(lower)) {
    categoryId = 'food';
    merchant = 'Food & Dining';
  } else if (/(petrol|diesel|cng|fuel|gas station|hp pump|indian oil)/i.test(lower)) {
    categoryId = 'fuel';
    merchant = 'Fuel Pump';
  } else if (/(blinkit|zepto|instamart|grocery|groceries|sabzi|milk|supermarket|dmart)/i.test(lower)) {
    categoryId = 'groceries';
    merchant = 'Groceries';
  } else if (/(amazon|flipkart|myntra|clothes|shopping|shoes|zara|h&m)/i.test(lower)) {
    categoryId = 'shopping';
    merchant = 'Shopping';
  } else if (/(uber|ola|cab|auto|metro|bus|train|flight|fare)/i.test(lower)) {
    categoryId = 'transport';
    merchant = 'Cab & Transit';
  } else if (/(electricity|wifi|broadband|recharge|jio|airtel|bill|cylinder)/i.test(lower)) {
    categoryId = 'bills';
    merchant = 'Bills & Recharge';
  } else if (/(medicine|pharma|apollo|doctor|hospital|clinic)/i.test(lower)) {
    categoryId = 'healthcare';
    merchant = 'Healthcare';
  } else if (/(movie|cinema|netflix|spotify|prime|hotstar|pvr)/i.test(lower)) {
    categoryId = 'entertainment';
    merchant = 'Entertainment';
  } else if (/(salary|credited|dividend)/i.test(lower)) {
    categoryId = 'salary';
    merchant = 'Salary / Income';
  }

  // Try extracting cleaner merchant name
  const words = clean.split(/\s+/).filter((w) => !/^(spent|paid|pe|ka|kiya|hua|rs|inr|₹|\d+)$/i.test(w));
  if (words.length > 0 && merchant === 'Expense') {
    merchant = words.slice(0, 3).join(' ');
  }

  // 3. Date Detection
  let date = todayStr;
  if (/(kal|yesterday)/i.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    date = d.toISOString().slice(0, 10);
  }

  // 4. Payment method
  let paymentMethod: 'UPI' | 'Credit Card' | 'Debit Card' | 'Cash' | 'Bank Transfer' | 'Net Banking' = 'UPI';
  if (/cash/i.test(lower)) paymentMethod = 'Cash';
  else if (/credit/i.test(lower)) paymentMethod = 'Credit Card';
  else if (/debit/i.test(lower)) paymentMethod = 'Debit Card';

  return {
    amount: Math.abs(amount) || 100,
    type: /(salary|credited|received)/i.test(lower) ? 'income' : 'expense',
    merchant: merchant.charAt(0).toUpperCase() + merchant.slice(1),
    categoryId,
    date,
    paymentMethod,
    confidenceScore: 85,
    notes: clean,
  };
}

/**
 * 5. Natural Language Financial Parser powered by Gemini with Automatic Fallback
 */
export async function parseExpenseWithGemini(
  ai: GoogleGenAI | null,
  messageText: string
): Promise<ExtractedExpense> {
  const todayStr = new Date().toISOString().slice(0, 10);

  if (!ai) {
    return parseExpenseHeuristics(messageText);
  }

  const prompt = `You are an expert AI financial expense parser for a WhatsApp expense tracking service.
The user just sent the following message to our WhatsApp assistant:
"""
${messageText}
"""

Reference Date for today: ${todayStr}

Tasks:
1. Extract the numeric amount (Rupees / standard units). Never convert to paise. Example: "Spent 500" -> 500. "450 dinner" -> 450.
2. Determine transaction type:
   - "expense": purchases, dining, fuel, shopping, bills, groceries
   - "income": salary, refund received, dividend
   - "transfer": sent to friend or self account transfer
   - "loan_emi": EMI payments
3. Categorize into exactly ONE of these category IDs:
   - "food": dining, restaurants, snacks, swiggy, zomato, cafe, lunch, dinner
   - "groceries": supermarket, fruits, vegetables, blinkit, zepto, instamart
   - "shopping": clothes, electronics, amazon, flipkart, shoes
   - "travel": flights, hotels, vacations
   - "transport": uber, ola, auto, metro, bus, cab
   - "fuel": petrol, diesel, CNG, fuel pump
   - "bills": electricity, wifi, mobile recharge, gas cylinder
   - "utilities": water, maintenance, house expenses
   - "rent": house or office rent
   - "healthcare": medicine, doctor, pharmacy, clinic
   - "education": books, tuition, courses
   - "entertainment": movies, games, concerts
   - "subscriptions": netflix, spotify, prime, youtube
   - "investments": stocks, mutual funds, SIP, crypto
   - "loan_emi": home/car loan EMI
   - "salary": monthly income
   - "other": general expenses
4. Identify a clean merchant / description name (e.g. "Dinner", "Petrol Pump", "Amazon", "Swiggy", "Electric Bill").
5. Parse the date in YYYY-MM-DD format:
   - "today", "aaj" -> ${todayStr}
   - "yesterday", "kal" -> calculate yesterday's date
   - If not specified, default to ${todayStr}.
6. Infer payment method: "UPI", "Credit Card", "Debit Card", "Cash", "Bank Transfer", "Net Banking". Default to "UPI" for digital spends or "Cash" if cash mentioned.
7. Assign a realistic confidence score (0-100).`;

  const modelsToTry = ['gemini-2.5-flash', 'gemini-3.7-flash'];

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER, description: 'Standard currency units (e.g. 450)' },
              type: {
                type: Type.STRING,
                enum: ['expense', 'income', 'transfer', 'refund', 'investment', 'loan_emi'],
              },
              merchant: { type: Type.STRING, description: 'Clean merchant or spend purpose name' },
              categoryId: { type: Type.STRING, description: 'One of the specified category IDs' },
              date: { type: Type.STRING, description: 'YYYY-MM-DD format' },
              paymentMethod: {
                type: Type.STRING,
                enum: ['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Net Banking'],
              },
              confidenceScore: { type: Type.INTEGER, description: '0 to 100' },
              notes: { type: Type.STRING },
            },
            required: ['amount', 'type', 'merchant', 'categoryId', 'date', 'paymentMethod'],
          },
        },
      });

      const rawJson = response.text?.trim() || '{}';
      const parsed = JSON.parse(rawJson);

      return {
        amount: typeof parsed.amount === 'number' ? Math.abs(parsed.amount) : 0,
        type: parsed.type || 'expense',
        merchant: parsed.merchant || 'General Expense',
        categoryId: parsed.categoryId || 'other',
        date: parsed.date || todayStr,
        paymentMethod: parsed.paymentMethod || 'UPI',
        confidenceScore: parsed.confidenceScore || 95,
        notes: parsed.notes || messageText,
      };
    } catch (err: any) {
      console.warn(`[WhatsApp AI Parser] Model ${modelName} call failed:`, err?.message || err);
    }
  }

  // Fallback to deterministic regex parser if both Gemini models encounter demand spikes
  console.log('[WhatsApp AI Parser] Falling back to heuristic rule-based extractor.');
  return parseExpenseHeuristics(messageText);
}

/**
 * 6. Save Extracted Transaction to User's Firestore Ledger
 */
export async function saveTransactionToFirestore(
  userId: string,
  extracted: ExtractedExpense,
  sourceId: string
): Promise<string> {
  const db = getServerFirestore();
  const txId = `tx_wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();

  const transactionData = {
    id: txId,
    userId,
    amount: extracted.amount,
    type: extracted.type,
    merchant: extracted.merchant,
    categoryId: extracted.categoryId,
    date: extracted.date,
    paymentMethod: extracted.paymentMethod,
    source: 'whatsapp',
    tags: ['whatsapp', extracted.categoryId],
    confidenceScore: extracted.confidenceScore,
    notes: `Added via WhatsApp: "${extracted.notes || ''}"`,
    rawDescription: extracted.notes || '',
    referenceNo: sourceId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 1. Save to users/{userId}/transactions/{txId}
  const txDocRef = doc(db, 'users', userId, 'transactions', txId);
  await setDoc(txDocRef, transactionData, { merge: true });

  // 2. Also save to root transactions collection for global queries if needed
  try {
    const rootTxDocRef = doc(db, 'transactions', txId);
    await setDoc(rootTxDocRef, transactionData, { merge: true });
  } catch (_) {}

  return txId;
}

/**
 * 7. Optional Outbound WhatsApp Reply via WhatsApp Cloud API
 */
export async function sendWhatsAppReply(
  toPhoneNumber: string,
  replyText: string
): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(
      `[WhatsApp Outbound] (Simulation) To: ${toPhoneNumber} | Message: "${replyText}"`
    );
    return true;
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhoneNumber,
        type: 'text',
        text: { body: replyText },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn('[WhatsApp Outbound] Meta API error response:', errBody);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[WhatsApp Outbound] Failed to send message via Meta Graph API:', err);
    return false;
  }
}

/**
 * 8. Complete End-to-End Ingestion Pipeline
 */
export async function processWhatsAppMessage(
  ai: GoogleGenAI | null,
  msg: WhatsAppIncomingMessage,
  explicitUserId?: string,
  explicitCurrencySymbol?: string
): Promise<ProcessedWhatsAppResult> {
  const messageId = msg.id;

  // 0. Replay Attack Defense: verify timestamp within acceptable window (10 mins past, 2 mins future)
  if (msg.timestamp) {
    const msgTimeSec = parseInt(msg.timestamp, 10);
    if (!isNaN(msgTimeSec)) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec - msgTimeSec > 600 || msgTimeSec - nowSec > 120) {
        console.warn(`[WhatsApp Security] Rejected message ${messageId} due to timestamp skew (timestamp: ${msg.timestamp}, now: ${nowSec})`);
        return {
          status: 'ignored',
          messageId,
          error: 'Message timestamp out of acceptable skew window (replay attack mitigation)',
        };
      }
    }
  }

  // 1. Check Idempotency
  const idempotency = await checkMessageIdempotency(messageId);
  if (idempotency.exists) {
    if (idempotency.status === 'processed') {
      console.log(`[WhatsApp Idempotency] Message ${messageId} already processed.`);
      return {
        status: 'duplicate',
        messageId,
        transactionId: idempotency.transactionId,
        extracted: idempotency.extracted,
      };
    }
    if (idempotency.status === 'processing') {
      console.log(`[WhatsApp Idempotency] Message ${messageId} currently in progress.`);
      return {
        status: 'in_progress',
        messageId,
      };
    }
  }

  // 2. Acquire Idempotency Lock
  await recordIncomingMessageLock(msg);

  try {
    // 3. Resolve User by sender phone or explicit user parameter
    let user: { userId: string; userName: string; currencySymbol: string };
    if (explicitUserId && explicitUserId !== 'default_user') {
      user = {
        userId: explicitUserId,
        userName: msg.senderName || 'User',
        currencySymbol: explicitCurrencySymbol || '₹',
      };
    } else {
      user = await resolveUserByPhone(msg.from);
    }

    // 4. Extract Financial Details using Gemini AI
    if (!ai) {
      throw new Error('Gemini AI client is not initialized on server');
    }

    const extracted = await parseExpenseWithGemini(ai, msg.text);

    // 5. Persist to existing user database
    const transactionId = await saveTransactionToFirestore(user.userId, extracted, messageId);

    // 6. Mark Idempotency as Processed
    await markMessageProcessed(messageId, user.userId, transactionId, extracted);

    // 7. Prepare & Send Confirmation
    const replyMessage = `✅ Added ${user.currencySymbol}${extracted.amount.toLocaleString()} for ${extracted.merchant} (${extracted.categoryId}) on ${extracted.date} to your SpendAI dashboard!`;
    await sendWhatsAppReply(msg.from, replyMessage);

    return {
      status: 'processed',
      messageId,
      transactionId,
      extracted,
      userId: user.userId,
      replyMessage,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown processing failure';
    console.error(`[WhatsApp Pipeline] Failed to process message ${messageId}:`, err);
    await markMessageFailed(messageId, errorMsg);

    return {
      status: 'failed',
      messageId,
      error: errorMsg,
    };
  }
}

/**
 * Helper to parse Meta WhatsApp Business Webhook JSON Body
 */
export function extractWhatsAppMessagesFromPayload(payload: any): WhatsAppIncomingMessage[] {
  const results: WhatsAppIncomingMessage[] = [];

  if (!payload || !Array.isArray(payload.entry)) {
    // Check if direct single message structure (e.g. from simulator)
    if (payload.from && payload.text) {
      results.push({
        id: payload.id || `wa_sim_${Date.now()}`,
        from: payload.from,
        senderName: payload.senderName || 'Tester',
        timestamp: payload.timestamp || String(Math.floor(Date.now() / 1000)),
        text: typeof payload.text === 'string' ? payload.text : payload.text.body || '',
      });
    }
    return results;
  }

  for (const entry of payload.entry) {
    if (!Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      const value = change.value;
      if (!value || !Array.isArray(value.messages)) continue;

      const contacts = value.contacts || [];
      const contactMap = new Map<string, string>();
      for (const contact of contacts) {
        if (contact.wa_id && contact.profile?.name) {
          contactMap.set(contact.wa_id, contact.profile.name);
        }
      }

      for (const message of value.messages) {
        // Handle text messages
        if (message.type === 'text' && message.text?.body) {
          results.push({
            id: message.id,
            from: message.from,
            senderName: contactMap.get(message.from) || '',
            timestamp: message.timestamp,
            text: message.text.body,
          });
        }
      }
    }
  }

  return results;
}
