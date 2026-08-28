import Papa from 'papaparse';
import { Transaction, TransactionType, PaymentMethod } from '../../types';
import { ExpenseCategorizer } from './expense-categorizer';

export interface ParsedRawRow {
  date: string; // YYYY-MM-DD
  rawDescription: string;
  amount: number;
  type: TransactionType;
  inferredCategory: string;
  paymentMethod: PaymentMethod;
  cleanMerchant: string;
  confidenceScore: number;
  referenceNo?: string;
  notes?: string;
  tags?: string[];
}

export class TransactionParser {
  /**
   * Cleans messy bank narrations and extracts clean merchant, payment rail, and transaction type.
   */
  static cleanMerchantName(raw: string): { merchant: string; paymentMethod: PaymentMethod; type: TransactionType } {
    let text = (raw || '').trim();
    let method: PaymentMethod = 'Net Banking';
    let type: TransactionType = 'expense';

    const upper = text.toUpperCase();

    // Payment Rail Detection
    if (
      upper.includes('UPI/') ||
      upper.startsWith('UPI-') ||
      upper.includes('/UPI/') ||
      upper.includes('UPI/P2M') ||
      upper.includes('UPI/P2A') ||
      upper.includes('UPI-P2M') ||
      upper.includes('@UPI') ||
      upper.includes('@OK') ||
      upper.includes('@PAYTM') ||
      upper.includes('@YBL') ||
      upper.includes('@ICICI') ||
      upper.includes('@HDFCBANK') ||
      upper.includes('@AXIS')
    ) {
      method = 'UPI';
      const parts = text.split('/');
      if (parts.length >= 3) {
        // e.g. UPI/SWIGGY/991208/ORDER or UPI/P2M/PAYEE/REF
        text = parts[1]?.toLowerCase().includes('p2m') || parts[1]?.toLowerCase().includes('p2a')
          ? parts[2] || parts[1]
          : parts[1] || parts[0];
      } else if (parts.length === 2) {
        text = parts[1] || parts[0];
      }
    } else if (upper.includes('POS ') || upper.startsWith('POS-') || upper.includes('POS/') || upper.includes('CARD TXN') || upper.includes('DEBIT CARD') || upper.includes('CREDIT CARD')) {
      method = upper.includes('CREDIT') ? 'Credit Card' : 'Debit Card';
      text = text.replace(/POS[\s\/\-]*/i, '').replace(/CARD TXN[\s\/\-]*/i, '');
    } else if (upper.includes('NEFT') || upper.includes('IMPS') || upper.includes('RTGS') || upper.includes('FT-') || upper.includes('FUNDS TRANSFER')) {
      method = 'Bank Transfer';
      if (upper.includes('SELF') || upper.includes('TO-') || upper.includes('TRANSFER') || upper.includes('OWN A/C')) {
        type = 'transfer';
      }
    } else if (upper.includes('ATM WDL') || upper.includes('NFS*') || upper.includes('CASH WDL') || upper.includes('ATM CASH') || upper.includes('CASH WITHDRAWAL')) {
      method = 'Cash';
      type = 'cash_withdrawal';
    } else if (upper.includes('ACH/') || upper.includes('NACH/') || upper.includes('AUTO DEBIT') || upper.includes('SI/')) {
      method = 'Net Banking';
      if (upper.includes('LOAN') || upper.includes('EMI') || upper.includes('FINSERV') || upper.includes('HDFC AUTO')) {
        type = 'loan_emi';
      }
    }

    // Type heuristic overrides from narration text
    if (upper.includes('REFUND') || upper.includes('REVERSAL') || upper.includes('REV-') || upper.includes('CASHBACK') || upper.includes('REWARD')) {
      type = 'refund';
    } else if (
      upper.includes('SALARY') ||
      upper.includes('PAYROLL') ||
      upper.includes('/SAL/') ||
      upper.includes('STIPEND') ||
      upper.includes('DIVIDEND') ||
      upper.includes('INTEREST PAID')
    ) {
      type = 'income';
    } else if (
      upper.includes('MUTUAL FUND') ||
      upper.includes('SIP ') ||
      upper.includes('ZERODHA') ||
      upper.includes('GROWW') ||
      upper.includes('INDMONEY') ||
      upper.includes('KFINTECH') ||
      upper.includes('CAMS') ||
      upper.includes('SECURITIES')
    ) {
      type = 'investment';
    }

    // Clean common prefixes, suffixes, noise tokens, digits
    let clean = text
      .replace(/^(POS|UPI|NEFT|IMPS|ACH|BBPS|NACH|ATM WDL|REFUND|SAL|FT|INF)[\s\/\-_:]*/i, '')
      .replace(/\d{6,}/g, '') // remove account/ref digits
      .replace(/\b(BANGALORE|BENGALURU|MUMBAI|DELHI|GURGAON|CHENNAI|HYDERABAD|KOLKATA|PUNE|IN|IND|INDIA|PVT|LTD|CORP|LLP|INC)\b/gi, '')
      .replace(/[_\/\\#\*\-\:\.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean || clean.length < 2) {
      clean = raw.slice(0, 30).trim();
    }

    // Capitalize title case nicely
    clean = clean
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    return { merchant: clean, paymentMethod: method, type };
  }

  /**
   * Normalizes diverse international and Indian bank date formats to standard ISO YYYY-MM-DD.
   */
  static normalizeDate(dateRaw: any): string {
    if (!dateRaw) return new Date().toISOString().slice(0, 10);
    const dateStr = String(dateRaw).trim();

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // YYYY/MM/DD
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];

      // If month > 12, it might be MM/DD/YYYY instead
      if (parseInt(month, 10) > 12 && parseInt(day, 10) <= 12) {
        return `${year}-${day}-${month}`;
      }
      return `${year}-${month}-${day}`;
    }

    // DD/MM/YY or DD-MM-YY (2-digit year)
    const dmyShortMatch = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
    if (dmyShortMatch) {
      const day = dmyShortMatch[1].padStart(2, '0');
      const month = dmyShortMatch[2].padStart(2, '0');
      const year = `20${dmyShortMatch[3]}`;
      return `${year}-${month}-${day}`;
    }

    // Textual dates e.g. "20-Aug-2026", "20 Aug 2026", "Aug 20, 2026", "20-August-2026"
    const monthsMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      january: '01', february: '02', march: '03', april: '04', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
    };

    const textDateMatch = dateStr.match(/(\d{1,2})[\s\-\/]+([a-zA-Z]+)[\s\-\/,]+(\d{2,4})/);
    if (textDateMatch) {
      const day = textDateMatch[1].padStart(2, '0');
      const mStr = textDateMatch[2].toLowerCase();
      let year = textDateMatch[3];
      if (year.length === 2) year = `20${year}`;
      const month = monthsMap[mStr];
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }

    const monthFirstMatch = dateStr.match(/([a-zA-Z]+)[\s\-\/]+(\d{1,2})[\s\-\/,]+(\d{2,4})/);
    if (monthFirstMatch) {
      const mStr = monthFirstMatch[1].toLowerCase();
      const day = monthFirstMatch[2].padStart(2, '0');
      let year = monthFirstMatch[3];
      if (year.length === 2) year = `20${year}`;
      const month = monthsMap[mStr];
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }

    // Standard JavaScript Date fallback
    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    } catch {
      // ignore
    }

    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Robust numeric amount cleaner handling currency symbols, commas, and negative signs / parentheses.
   */
  static parseAmount(val: any): { amount: number; isNegative: boolean } {
    if (typeof val === 'number') {
      return { amount: Math.abs(val), isNegative: val < 0 };
    }
    if (!val) return { amount: 0, isNegative: false };

    let str = String(val).trim();
    let isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));

    // Remove currency symbols, commas, spaces, quotes, etc.
    str = str.replace(/[₹$€£Rs\.INR\s,"'()]/gi, '');

    // If string has minus sign
    if (str.includes('-')) {
      isNegative = true;
      str = str.replace(/-/g, '');
    }

    const amount = parseFloat(str) || 0;
    return { amount: Math.abs(amount), isNegative };
  }

  /**
   * Main CSV / Tab / Text statement parser engine with automatic header and delimiter detection.
   */
  static parseCSVText(csvText: string): ParsedRawRow[] {
    if (!csvText || !csvText.trim()) return [];

    // Parse with PapaParse for complete RFC 4180 compliance, quote escapes, and delimiter sniffing
    const parsed = Papa.parse<string[]>(csvText.trim(), {
      skipEmptyLines: 'greedy',
      header: false,
    });

    const rows = parsed.data;
    if (!rows || rows.length === 0) return [];

    // Find the header row (scan first 15 rows)
    let headerRowIdx = -1;
    let colMap = {
      date: -1,
      desc: -1,
      debit: -1,
      credit: -1,
      amount: -1,
      type: -1,
      category: -1,
      method: -1,
      ref: -1,
      notes: -1,
      tags: -1,
    };

    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r].map((cell) => (cell || '').toLowerCase().trim());
      
      const hasDate = row.some((c) => /date|txn\s*date|value\s*date|posting/i.test(c));
      const hasDesc = row.some((c) => /narration|description|particulars|details|merchant|payee|remarks/i.test(c));
      const hasAmt = row.some((c) => /amount|debit|credit|withdrawal|deposit|amt/i.test(c));

      if ((hasDate && hasDesc) || (hasDate && hasAmt) || (hasDesc && hasAmt)) {
        headerRowIdx = r;
        
        row.forEach((colName, cIdx) => {
          if (/(^|\b)(txn\s*date|transaction\s*date|value\s*date|posting\s*date|date|trans\s*date)(\b|$)/i.test(colName)) {
            if (colMap.date === -1) colMap.date = cIdx;
          } else if (/(^|\b)(narration|description|particulars|merchant|details|payee|recipient|remarks|transaction\s*details|note|title)(\b|$)/i.test(colName)) {
            if (colMap.desc === -1) colMap.desc = cIdx;
          } else if (/(^|\b)(debit|withdrawal|dr\s*amount|debit\s*amount|outflow|spent|dr)(\b|$)/i.test(colName)) {
            if (colMap.debit === -1) colMap.debit = cIdx;
          } else if (/(^|\b)(credit|deposit|cr\s*amount|credit\s*amount|inflow|received|income|cr)(\b|$)/i.test(colName)) {
            if (colMap.credit === -1) colMap.credit = cIdx;
          } else if (/(^|\b)(amount|txn\s*amount|transaction\s*amount|net\s*amount|amt|total)(\b|$)/i.test(colName)) {
            if (colMap.amount === -1) colMap.amount = cIdx;
          } else if (/(^|\b)(type|dr\/cr|cr\/dr|d\/c|c\/d|entry\s*type|transaction\s*type)(\b|$)/i.test(colName)) {
            if (colMap.type === -1) colMap.type = cIdx;
          } else if (/(^|\b)(category|category\s*name|cat|expense\s*category)(\b|$)/i.test(colName)) {
            if (colMap.category === -1) colMap.category = cIdx;
          } else if (/(^|\b)(payment\s*method|payment\s*mode|mode|channel|method|rail)(\b|$)/i.test(colName)) {
            if (colMap.method === -1) colMap.method = cIdx;
          } else if (/(^|\b)(ref|ref\s*no|reference|reference\s*no|utr|chq\s*no|cheque\s*no|txn\s*id)(\b|$)/i.test(colName)) {
            if (colMap.ref === -1) colMap.ref = cIdx;
          } else if (/(^|\b)(notes|note|comment|comments)(\b|$)/i.test(colName)) {
            if (colMap.notes === -1) colMap.notes = cIdx;
          } else if (/(^|\b)(tags|tag|label|labels)(\b|$)/i.test(colName)) {
            if (colMap.tags === -1) colMap.tags = cIdx;
          }
        });
        break;
      }
    }

    // If no header found, use positional heuristics
    if (headerRowIdx === -1) {
      headerRowIdx = -1; // start from row 0
      colMap.date = 0;
      colMap.desc = 1;
      colMap.amount = 2;
    }

    const startRow = headerRowIdx + 1;
    const results: ParsedRawRow[] = [];

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Extract raw values based on mapped columns
      const rawDate = colMap.date >= 0 ? row[colMap.date] : row[0];
      const rawDesc = colMap.desc >= 0 ? row[colMap.desc] : (row[1] || 'Transaction');
      
      const rawDebit = colMap.debit >= 0 ? row[colMap.debit] : null;
      const rawCredit = colMap.credit >= 0 ? row[colMap.credit] : null;
      const rawAmount = colMap.amount >= 0 ? row[colMap.amount] : (row[2] || '0');
      
      const rawType = colMap.type >= 0 ? row[colMap.type] : null;
      const rawCategory = colMap.category >= 0 ? row[colMap.category] : null;
      const rawMethod = colMap.method >= 0 ? row[colMap.method] : null;
      const rawRef = colMap.ref >= 0 ? row[colMap.ref] : null;
      const rawNotes = colMap.notes >= 0 ? row[colMap.notes] : null;
      const rawTags = colMap.tags >= 0 ? row[colMap.tags] : null;

      // Check if line is empty or footer summary (e.g. "Total Balance", "Page 1 of 2")
      const combinedText = row.join(' ').toLowerCase();
      if (
        combinedText.includes('opening balance') ||
        combinedText.includes('closing balance') ||
        combinedText.includes('total balance') ||
        combinedText.includes('end of statement') ||
        combinedText.includes('generated on')
      ) {
        continue;
      }

      // Determine amount and type
      let amount = 0;
      let isNegative = false;
      let determinedType: TransactionType = 'expense';

      const debitParsed = rawDebit ? this.parseAmount(rawDebit) : null;
      const creditParsed = rawCredit ? this.parseAmount(rawCredit) : null;

      if (debitParsed && debitParsed.amount > 0) {
        amount = debitParsed.amount;
        determinedType = 'expense';
      } else if (creditParsed && creditParsed.amount > 0) {
        amount = creditParsed.amount;
        determinedType = 'income';
      } else {
        const amtParsed = this.parseAmount(rawAmount);
        amount = amtParsed.amount;
        isNegative = amtParsed.isNegative;

        if (rawType) {
          const tUpper = String(rawType).toUpperCase().trim();
          if (tUpper === 'CR' || tUpper === 'CREDIT' || tUpper === 'INCOME' || tUpper === 'DEPOSIT') {
            determinedType = 'income';
          } else if (tUpper === 'DR' || tUpper === 'DEBIT' || tUpper === 'EXPENSE' || tUpper === 'WITHDRAWAL') {
            determinedType = 'expense';
          } else if (['transfer', 'refund', 'investment', 'loan_emi', 'cash_withdrawal'].includes(rawType.toLowerCase())) {
            determinedType = rawType.toLowerCase() as TransactionType;
          }
        } else if (isNegative) {
          determinedType = 'expense';
        }
      }

      if (amount <= 0) continue; // Skip zero-amount or unparseable lines

      const date = this.normalizeDate(rawDate);
      const desc = String(rawDesc || '').trim() || 'Transaction';

      // Clean merchant and infer payment method & type nuances
      const cleaned = this.cleanMerchantName(desc);
      
      // If debit/credit column was explicitly set, preserve income vs expense unless cleaned type is specialized (like refund, transfer, investment)
      let finalType: TransactionType = determinedType;
      if (cleaned.type === 'refund' || cleaned.type === 'transfer' || cleaned.type === 'investment' || cleaned.type === 'cash_withdrawal' || cleaned.type === 'loan_emi') {
        finalType = cleaned.type;
      } else if (determinedType === 'income') {
        finalType = 'income';
      }

      // Infer category
      let categoryId = 'shopping';
      if (rawCategory && rawCategory.trim()) {
        categoryId = rawCategory.trim().toLowerCase();
      } else {
        if (finalType === 'income') categoryId = 'salary';
        else if (finalType === 'transfer') categoryId = 'transfers';
        else if (finalType === 'investment') categoryId = 'investments';
        else if (finalType === 'cash_withdrawal') categoryId = 'cash_withdrawal';
        else if (finalType === 'loan_emi') categoryId = 'loan_emi';
        else {
          const suggestion = ExpenseCategorizer.suggestCategory(cleaned.merchant, desc, amount, []);
          categoryId = suggestion.categoryId;
        }
      }

      // Payment method
      let paymentMethod: PaymentMethod = cleaned.paymentMethod;
      if (rawMethod && rawMethod.trim()) {
        const mStr = rawMethod.trim();
        if (['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Net Banking'].includes(mStr)) {
          paymentMethod = mStr as PaymentMethod;
        }
      }

      // Tags
      const tags: string[] = ['csv-import'];
      if (rawTags) {
        const customTags = String(rawTags).split(/[;,|]/).map((t) => t.trim()).filter(Boolean);
        tags.push(...customTags);
      }

      results.push({
        date,
        rawDescription: desc,
        amount,
        type: finalType,
        inferredCategory: categoryId,
        paymentMethod,
        cleanMerchant: cleaned.merchant,
        confidenceScore: 92,
        referenceNo: rawRef ? String(rawRef).trim() : undefined,
        notes: rawNotes ? String(rawNotes).trim() : undefined,
        tags,
      });
    }

    return results;
  }
}
