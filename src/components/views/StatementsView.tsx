import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Loader2,
  ArrowRight,
  Trash2,
  Eye,
  FileText,
  HelpCircle,
  Clock,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Transaction, Category, StatementUpload, PaymentMethod, TransactionType } from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { aiService } from '../../services/ai/ai.service';
import { TransactionParser } from '../../services/ai/transaction-parser';
import { ExpenseCategorizer } from '../../services/ai/expense-categorizer';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';

interface StatementsViewProps {
  currencySymbol: string;
  onNavigate: (viewId: string) => void;
}

export const StatementsView: React.FC<StatementsViewProps> = ({
  currencySymbol,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'error' | 'success' | 'warning'; message: string } | null>(null);
  const [previewRows, setPreviewRows] = useState<
    Array<{
      id: string;
      date: string;
      rawDescription: string;
      merchant: string;
      amount: number;
      type: TransactionType;
      categoryId: string;
      paymentMethod: PaymentMethod;
      confidenceScore: number;
      isDuplicate: boolean;
      selected: boolean;
    }>
  >([]);
  const [statementMeta, setStatementMeta] = useState<{
    fileName: string;
    totalDebit: number;
    totalCredit: number;
  } | null>(null);

  const [history, setHistory] = useState<StatementUpload[]>(storageService.getStatements());
  const categories = storageService.getCategories();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sampleBankCSV = `Date,Narration,Amount,Type
2026-08-20,UPI/SWIGGY/991208/ORDER,740.00,DR
2026-08-21,POS ZARA OBEROI MALL,4850.00,DR
2026-08-22,NEFT SALARY ACME CORP,120000.00,CR
2026-08-23,UPI/UBER TRIP INDIA/492,380.00,DR
2026-08-24,AMAZON PAY INDIA REFUND,1200.00,CR
2026-08-25,BBPS BESCOM POWER BILL,1890.00,DR`;

  const handleProcessText = async (text: string, fileName: string) => {
    if (!text || !text.trim()) {
      setNotification({ type: 'warning', message: 'Provided statement text is empty.' });
      return;
    }

    setProcessing(true);
    setProcessStep('1. Reading and parsing statement rows...');

    try {
      await new Promise((r) => setTimeout(r, 250));
      setProcessStep('2. Normalizing merchant names & payment rails...');

      const result = await aiService.parseStatement(text, fileName.endsWith('.csv') ? 'csv' : 'text');
      setProcessStep('3. Scanning for potential duplicates...');

      const candidateTx: Partial<Transaction>[] = result.transactions.map((tx) => ({
        date: tx.date,
        amount: tx.amount,
        merchant: tx.merchant,
        rawDescription: tx.description,
      }));

      const { duplicates } = storageService.findDuplicates(candidateTx);
      const duplicateIndices = new Set(
        duplicates.map((d) => `${d.candidate.date}_${d.candidate.amount}`)
      );

      const validCatIds = new Set(categories.map((c) => c.id));

      const rows = result.transactions.map((t, idx) => {
        const key = `${t.date}_${t.amount}`;
        const isDup = duplicateIndices.has(key);
        let validCat = t.category;
        if (!validCatIds.has(validCat)) {
          validCat = t.type === 'income' ? 'salary' : 'shopping';
        }

        return {
          id: `cand_${idx}_${Date.now()}`,
          date: t.date || new Date().toISOString().slice(0, 10),
          rawDescription: t.description || t.merchant,
          merchant: t.merchant,
          amount: t.amount,
          type: t.type || 'expense',
          categoryId: validCat,
          paymentMethod: t.paymentMethod || 'UPI',
          confidenceScore: t.confidenceScore || 90,
          isDuplicate: isDup,
          selected: !isDup, // auto-select non-duplicates
        };
      });

      if (rows.length === 0) {
        setNotification({
          type: 'warning',
          message: 'No transactions found. Please check file formatting or headers.',
        });
      } else {
        setPreviewRows(rows);
        setStatementMeta({
          fileName,
          totalDebit: result.totalDebit,
          totalCredit: result.totalCredit,
        });
        setNotification(null);
      }
    } catch (e: any) {
      console.error(e);
      setNotification({
        type: 'error',
        message: 'Failed to process statement. Please check the file format or try a standard CSV format.',
      });
    } finally {
      setProcessing(false);
      setProcessStep('');
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isXlsx) {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
        handleProcessText(csv, file.name);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        handleProcessText(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    const selectedRows = previewRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setNotification({ type: 'warning', message: 'Please select at least one transaction to import.' });
      return;
    }

    const txsToSave: Transaction[] = selectedRows.map((r) => ({
      id: `tx_imp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: 'usr_main_demo',
      amount: r.amount,
      type: r.type,
      merchant: r.merchant,
      categoryId: r.categoryId,
      date: r.date,
      paymentMethod: r.paymentMethod,
      source: 'statement',
      rawDescription: r.rawDescription,
      confidenceScore: r.confidenceScore,
      tags: ['statement-import'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Record user corrections for learning
    selectedRows.forEach((r) => {
      ExpenseCategorizer.recordUserCorrection(r.merchant, r.categoryId);
    });

    const currentAll = storageService.getTransactions();
    storageService.saveAllTransactions([...txsToSave, ...currentAll]);

    // Save Statement metadata record
    if (statementMeta) {
      const stmtRecord: StatementUpload = {
        id: `stmt_${Date.now()}`,
        fileName: statementMeta.fileName,
        fileType: statementMeta.fileName.endsWith('.xlsx') ? 'xlsx' : 'csv',
        uploadDate: new Date().toISOString(),
        transactionsCount: selectedRows.length,
        totalDebit: statementMeta.totalDebit,
        totalCredit: statementMeta.totalCredit,
        status: 'imported',
        duplicatesCount: previewRows.filter((r) => r.isDuplicate).length,
        uncategorizedCount: 0,
      };
      storageService.saveStatement(stmtRecord);
      setHistory(storageService.getStatements());
    }

    setPreviewRows([]);
    setStatementMeta(null);
    onNavigate('transactions');
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
      {/* In-app Notification */}
      {notification && (
        <div
          className={`flex items-center justify-between rounded-xl p-3 text-xs border ${
            notification.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              : notification.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-white font-bold text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Bank & Card Statement Intelligence
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Upload PDF, CSV, or Excel bank statements. AI parses messy transaction narrations, extracts clean merchant names, and auto-categorizes with high accuracy.
        </p>
      </div>

      {!previewRows.length ? (
        /* Upload / Paste Area */
        <div className="space-y-5 sm:space-y-6">
          {/* Tab Selector */}
          <div className="flex border-b border-[#262626]">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <UploadCloud size={15} />
              <span>Upload Statement File (.csv, .xlsx, .txt)</span>
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition ${
                activeTab === 'paste'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileSpreadsheet size={15} />
              <span>Paste Raw Statement Text</span>
            </button>
          </div>

          {activeTab === 'upload' ? (
            <div
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
                dragActive
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-[#333] bg-[#0f0f0f] hover:border-blue-500/50 hover:bg-[#141414]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt,.tsv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
                }}
              />

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-xs">
                {processing ? (
                  <Loader2 size={32} className="animate-spin" />
                ) : (
                  <UploadCloud size={32} />
                )}
              </div>

              <h3 className="mt-4 text-base font-bold text-white">
                {processing ? 'Processing Statement with AI...' : 'Drag & drop bank statement file here'}
              </h3>
              <p className="mt-1 text-xs text-gray-400 max-w-sm mx-auto">
                Supports CSV, Excel (.xlsx), or Text statements from HDFC, ICICI, SBI, Axis, Amex, or any global bank.
              </p>

              {processing && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600/20 border border-blue-500/30 px-4 py-2 text-xs font-semibold text-blue-300 animate-pulse">
                  <Sparkles size={15} />
                  <span>{processStep}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-[#262626] bg-[#0f0f0f] p-5">
              <textarea
                rows={8}
                placeholder="Paste CSV text or raw bank copy-paste here (e.g. Date, Narration, Debit, Credit)..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full rounded-xl border border-[#262626] bg-[#141414] p-3 text-xs font-mono text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-hidden"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => handleProcessText(pastedText, 'pasted_statement.csv')}
                  disabled={processing || !pastedText.trim()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50"
                >
                  {processing && <Loader2 size={14} className="animate-spin" />}
                  <span>Parse Statement →</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Demo Templates */}
          <div className="rounded-xl border border-[#262626] bg-[#141414] p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Test with Sample Bank Statements</h4>
                  <p className="text-[11px] text-gray-400">
                    Instant demo statements containing realistic UPI, POS, Net Banking, and Salary transactions.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleProcessText(sampleBankCSV, 'sample_bank_august_2026.csv')}
                  disabled={processing}
                  className="rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold text-gray-200 hover:border-blue-500 hover:text-white"
                >
                  🏦 Standard Bank (UPI/POS)
                </button>
                <button
                  onClick={() =>
                    handleProcessText(
                      `Txn Date,Particulars,Debit,Credit,Balance\n20/08/2026,UPI/ZOMATO RESTAURANT/7721,850.00,,45200.00\n21/08/2026,ATM CASH WITHDRAWAL KORAMANGALA,5000.00,,40200.00\n22/08/2026,ACH/HDFC AUTO LOAN EMI/8831,14200.00,,26000.00\n23/08/2026,IMPS/DIVIDEND REWARD/9912,,3400.00,29400.00`,
                      'bank_debit_credit.csv'
                    )
                  }
                  disabled={processing}
                  className="rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold text-gray-200 hover:border-blue-500 hover:text-white"
                >
                  💳 Dual Column (Dr/Cr)
                </button>
              </div>
            </div>
          </div>

          {/* Statement Upload History */}
          {history.length > 0 && (
            <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                Previous Upload Batches
              </h3>
              <div className="divide-y divide-[#212121]">
                {history.map((stmt) => (
                  <div
                    key={stmt.id}
                    className="flex items-center justify-between py-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="text-blue-400" size={18} />
                      <div>
                        <span className="font-bold text-white">{stmt.fileName}</span>
                        <div className="text-[11px] text-gray-500">
                          {formatDate(stmt.uploadDate)} • {stmt.transactionsCount} transactions imported
                        </div>
                      </div>
                    </div>
                    <span className="rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                      Imported
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Pre-Import Review Safety Screen */
        <div className="space-y-4">
          {/* Review Banner */}
          <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Pre-Import Review: {statementMeta?.fileName}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Verify cleaned merchant names and categories below before finalizing ledger synchronization.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Price unit helper */}
              <div className="flex items-center gap-1.5 bg-[#0f0f0f] border border-[#262626] rounded-lg px-2.5 py-1.5 text-[11px]">
                <span className="text-gray-400">Unit:</span>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewRows(
                      previewRows.map((r) => ({
                        ...r,
                        amount: Math.round((r.amount / 100) * 100) / 100,
                      }))
                    );
                  }}
                  title="If statement amounts were in paise, divide by 100 to convert to Rupees"
                  className="text-blue-400 font-semibold hover:underline"
                >
                  Paise → ₹ (÷100)
                </button>
                <span className="text-gray-600">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewRows(
                      previewRows.map((r) => ({
                        ...r,
                        amount: Math.round(r.amount * 100 * 100) / 100,
                      }))
                    );
                  }}
                  title="Multiply amounts by 100"
                  className="text-gray-400 font-semibold hover:text-white"
                >
                  ×100
                </button>
              </div>

              <button
                onClick={() => {
                  setPreviewRows([]);
                  setStatementMeta(null);
                }}
                className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-3.5 py-2 text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a]"
              >
                Discard
              </button>
              <button
                onClick={handleConfirmImport}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500"
              >
                Import Selected ({previewRows.filter((r) => r.selected).length}) →
              </button>
            </div>
          </div>

          {/* Table Preview */}
          <div className="overflow-hidden rounded-xl border border-[#262626] bg-[#141414] shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="border-b border-[#262626] bg-[#0f0f0f] font-semibold uppercase tracking-wider text-gray-500 text-[10px]">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={previewRows.every((r) => r.selected)}
                        onChange={(e) =>
                          setPreviewRows(
                            previewRows.map((r) => ({ ...r, selected: e.target.checked }))
                          )
                        }
                        className="rounded border-[#333] text-blue-500 bg-[#0f0f0f]"
                      />
                    </th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Original Narration</th>
                    <th className="py-3 px-4">Clean Merchant</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#212121] font-medium">
                  {previewRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-[#1a1a1a] transition ${
                        row.isDuplicate ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => {
                            const updated = [...previewRows];
                            updated[idx].selected = e.target.checked;
                            setPreviewRows(updated);
                          }}
                          className="rounded border-[#333] text-blue-500 bg-[#0f0f0f]"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-400">{row.date}</td>
                      <td className="py-3 px-4 max-w-xs truncate text-[11px] text-gray-500 font-mono">
                        {row.rawDescription}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        <input
                          type="text"
                          value={row.merchant}
                          onChange={(e) => {
                            const updated = [...previewRows];
                            updated[idx].merchant = e.target.value;
                            setPreviewRows(updated);
                          }}
                          className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-2 py-1 text-white hover:border-[#444] focus:border-blue-500 focus:outline-hidden"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={row.categoryId}
                          onChange={(e) => {
                            const updated = [...previewRows];
                            updated[idx].categoryId = e.target.value;
                            setPreviewRows(updated);
                          }}
                          className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-2 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-hidden"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-400 text-[11px]">
                        {row.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={row.type === 'income' ? 'text-emerald-400' : 'text-white'}
                        >
                          {row.type === 'income' ? '+' : '-'}
                          {formatCurrency(row.amount, currencySymbol)}
                        </span>
                        {row.isDuplicate && (
                          <div className="text-[10px] text-amber-400 font-sans font-semibold">
                            Possible duplicate
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
