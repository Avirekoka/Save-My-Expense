import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Clipboard,
  FileText,
  Filter,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Transaction, Category, PaymentMethod, TransactionType } from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { TransactionParser, ParsedRawRow } from '../../services/ai/transaction-parser';
import { ExpenseCategorizer } from '../../services/ai/expense-categorizer';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useScrollLock } from '../../hooks/useScrollLock';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
  currencySymbol: string;
}

export const ImportCSVModal: React.FC<ImportCSVModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currencySymbol,
}) => {
  useScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState('');
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
      tags: string[];
      notes?: string;
    }>
  >([]);

  const [notification, setNotification] = useState<{
    type: 'error' | 'success' | 'warning';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const categories = storageService.getCategories();

  if (!isOpen) return null;

  const handleProcessCSVText = (text: string, sourceName: string) => {
    if (!text || !text.trim()) {
      setNotification({ type: 'warning', message: 'The provided data is empty.' });
      return;
    }

    try {
      const parsedRows = TransactionParser.parseCSVText(text);

      if (parsedRows.length === 0) {
        setNotification({
          type: 'error',
          message: 'Could not extract valid transactions. Please check headers or format.',
        });
        return;
      }

      // Check duplicates against existing storage
      const candidateTx: Partial<Transaction>[] = parsedRows.map((tx) => ({
        date: tx.date,
        amount: tx.amount,
        merchant: tx.cleanMerchant,
        rawDescription: tx.rawDescription,
      }));

      const { duplicates } = storageService.findDuplicates(candidateTx);
      const duplicateKeys = new Set(
        duplicates.map((d) => `${d.candidate.date}_${d.candidate.amount}`)
      );

      // Validate category IDs against active categories
      const validCatIds = new Set(categories.map((c) => c.id));

      const rows = parsedRows.map((r, idx) => {
        const key = `${r.date}_${r.amount}`;
        const isDup = duplicateKeys.has(key);
        let validCat = r.inferredCategory;
        if (!validCatIds.has(validCat)) {
          validCat = r.type === 'income' ? 'salary' : 'other';
        }

        return {
          id: `imp_row_${idx}_${Date.now()}`,
          date: r.date,
          rawDescription: r.rawDescription,
          merchant: r.cleanMerchant,
          amount: r.amount,
          type: r.type,
          categoryId: validCat,
          paymentMethod: r.paymentMethod,
          confidenceScore: r.confidenceScore,
          isDuplicate: isDup,
          selected: !isDup, // auto-select non-duplicates
          tags: r.tags || ['csv-import'],
          notes: r.notes,
        };
      });

      setFileName(sourceName);
      setPreviewRows(rows);
      setNotification(null);
    } catch (err: any) {
      console.error('CSV Parsing Error:', err);
      setNotification({
        type: 'error',
        message: `Failed to parse data: ${err.message || 'Unknown error'}`,
      });
    }
  };

  const handleFile = (file: File) => {
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    if (isXlsx) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
          handleProcessCSVText(csv, file.name);
        } catch (err: any) {
          setNotification({ type: 'error', message: 'Failed to read Excel file.' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        handleProcessCSVText(text, file.name);
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

  const handleSampleTemplate = (type: 'bank' | 'finpulse' | 'debit_credit') => {
    if (type === 'bank') {
      const sample = `Date,Narration,Amount,Type
2026-08-20,UPI/SWIGGY/991208/ORDER,740.00,DR
2026-08-21,POS ZARA OBEROI MALL,4850.00,DR
2026-08-22,NEFT SALARY ACME CORP,120000.00,CR
2026-08-23,UPI/UBER TRIP INDIA/492,380.00,DR
2026-08-24,AMAZON PAY INDIA REFUND,1200.00,CR
2026-08-25,BBPS BESCOM POWER BILL,1890.00,DR`;
      setPastedText(sample);
      handleProcessCSVText(sample, 'sample_bank_statement.csv');
    } else if (type === 'finpulse') {
      const sample = `Date,Merchant,Amount,Type,Category,Payment Method,Tags,Notes
2026-08-18,"Whole Foods",1450.00,expense,groceries,Credit Card,"organic;fresh","Weekly grocery run"
2026-08-19,"Client Consulting",45000.00,income,salary,Bank Transfer,"project;bonus","Q3 retainer payment"
2026-08-20,"Starbucks",420.00,expense,food,UPI,"coffee","Team standup meeting"
2026-08-21,"Netflix",649.00,expense,subscriptions,Credit Card,"streaming","Monthly premium plan"`;
      setPastedText(sample);
      handleProcessCSVText(sample, 'finpulse_export_sample.csv');
    } else {
      const sample = `Txn Date,Particulars,Debit,Credit,Balance
20/08/2026,UPI/ZOMATO RESTAURANT/7721,850.00,,45200.00
21/08/2026,ATM CASH WITHDRAWAL KORAMANGALA,5000.00,,40200.00
22/08/2026,ACH/HDFC AUTO LOAN EMI/8831,14200.00,,26000.00
23/08/2026,IMPS/DIVIDEND REWARD/9912,,3400.00,29400.00`;
      setPastedText(sample);
      handleProcessCSVText(sample, 'bank_debit_credit_sample.csv');
    }
  };

  const handleConfirmImport = () => {
    const selectedRows = previewRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setNotification({ type: 'warning', message: 'Please select at least one transaction to import.' });
      return;
    }

    const txsToSave: Transaction[] = selectedRows.map((r) => ({
      id: `tx_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: 'usr_main_demo',
      amount: r.amount,
      type: r.type,
      merchant: r.merchant,
      categoryId: r.categoryId,
      date: r.date,
      paymentMethod: r.paymentMethod,
      source: 'import',
      rawDescription: r.rawDescription,
      confidenceScore: r.confidenceScore,
      tags: r.tags || ['csv-import'],
      notes: r.notes,
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
    const totalDebit = selectedRows
      .filter((r) => r.type !== 'income' && r.type !== 'refund')
      .reduce((s, r) => s + r.amount, 0);
    const totalCredit = selectedRows
      .filter((r) => r.type === 'income' || r.type === 'refund')
      .reduce((s, r) => s + r.amount, 0);

    storageService.saveStatement({
      id: `stmt_${Date.now()}`,
      fileName: fileName || 'manual_import.csv',
      fileType: fileName.endsWith('.xlsx') ? 'xlsx' : 'csv',
      uploadDate: new Date().toISOString(),
      transactionsCount: selectedRows.length,
      totalDebit,
      totalCredit,
      status: 'imported',
      duplicatesCount: previewRows.filter((r) => r.isDuplicate).length,
      uncategorizedCount: 0,
    });

    if (onSuccess) {
      onSuccess(selectedRows.length);
    }
    onClose();
  };

  // Preview metrics
  const selectedCount = previewRows.filter((r) => r.selected).length;
  const duplicateCount = previewRows.filter((r) => r.isDuplicate).length;
  const totalInflow = previewRows
    .filter((r) => r.selected && (r.type === 'income' || r.type === 'refund'))
    .reduce((s, r) => s + r.amount, 0);
  const totalOutflow = previewRows
    .filter((r) => r.selected && r.type !== 'income' && r.type !== 'refund')
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-[#262626] bg-[#141414] shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] px-6 py-4 bg-[#0f0f0f]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-xs">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Import CSV / Excel Ledger Data
              </h2>
              <p className="text-xs text-gray-400">
                Seamlessly import bank statements, exported FinPulse records, or custom CSV files.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#212121] hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notification banner */}
        {notification && (
          <div
            className={`mx-6 mt-4 flex items-center justify-between rounded-xl p-3 text-xs border ${
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

        {/* Content Area */}
        <div className="p-6 space-y-6">
          {previewRows.length === 0 ? (
            /* Upload / Paste View */
            <div className="space-y-5">
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
                  <span>Upload File (.csv, .xlsx, .tsv)</span>
                </button>
                <button
                  onClick={() => setActiveTab('paste')}
                  className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'paste'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Clipboard size={15} />
                  <span>Paste CSV Text</span>
                </button>
              </div>

              {activeTab === 'upload' ? (
                /* File Dropzone */
                <div
                  onDragEnter={() => setDragActive(true)}
                  onDragLeave={() => setDragActive(false)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
                    dragActive
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-[#333] bg-[#0f0f0f] hover:border-blue-500/50 hover:bg-[#181818]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.tsv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
                    }}
                  />
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-xs">
                    <UploadCloud size={28} />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-white">
                    Click to browse or drag & drop CSV/Excel statement
                  </h3>
                  <p className="mt-1 text-xs text-gray-400 max-w-sm mx-auto">
                    Supports HDFC, ICICI, SBI, Axis, Amex, Apple Card, Google Pay, Paytm, Zerodha, and custom CSV spreadsheets.
                  </p>
                </div>
              ) : (
                /* Paste text area */
                <div className="space-y-3">
                  <textarea
                    rows={7}
                    placeholder="Paste CSV rows here (e.g. Date, Narration, Amount, Type)..."
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] p-3 text-xs font-mono text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-hidden"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleProcessCSVText(pastedText, 'pasted_data.csv')}
                      disabled={!pastedText.trim()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50"
                    >
                      Parse Data →
                    </button>
                  </div>
                </div>
              )}

              {/* Sample Templates */}
              <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
                  Or Test with Sample Data Templates:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSampleTemplate('bank')}
                    className="rounded-lg border border-[#262626] bg-[#141414] px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-blue-500/50 hover:text-white"
                  >
                    🏦 Standard Bank Statement (UPI/POS)
                  </button>
                  <button
                    onClick={() => handleSampleTemplate('debit_credit')}
                    className="rounded-lg border border-[#262626] bg-[#141414] px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-blue-500/50 hover:text-white"
                  >
                    💳 Dual Column (Debit & Credit)
                  </button>
                  <button
                    onClick={() => handleSampleTemplate('finpulse')}
                    className="rounded-lg border border-[#262626] bg-[#141414] px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-blue-500/50 hover:text-white"
                  >
                    📄 FinPulse Native Export
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Review & Edit Table View */
            <div className="space-y-4">
              {/* Summary Stats Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Rows</span>
                  <div className="text-base font-bold text-white font-mono">{previewRows.length}</div>
                </div>
                <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Inflow</span>
                  <div className="text-base font-bold text-emerald-400 font-mono">
                    +{formatCurrency(totalInflow, currencySymbol)}
                  </div>
                </div>
                <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Total Outflow</span>
                  <div className="text-base font-bold text-white font-mono">
                    -{formatCurrency(totalOutflow, currencySymbol)}
                  </div>
                </div>
                <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Duplicates Flagged</span>
                  <div className="text-base font-bold text-amber-400 font-mono">{duplicateCount}</div>
                </div>
              </div>

              {/* Selection quick actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[#0f0f0f] border border-[#262626] rounded-xl p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPreviewRows(previewRows.map((r) => ({ ...r, selected: true })))}
                    className="text-blue-400 hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-gray-600">•</span>
                  <button
                    onClick={() => setPreviewRows(previewRows.map((r) => ({ ...r, selected: false })))}
                    className="text-gray-400 hover:underline font-semibold"
                  >
                    Deselect All
                  </button>
                  {duplicateCount > 0 && (
                    <>
                      <span className="text-gray-600">•</span>
                      <button
                        onClick={() =>
                          setPreviewRows(previewRows.map((r) => ({ ...r, selected: !r.isDuplicate })))
                        }
                        className="text-amber-400 hover:underline font-semibold"
                      >
                        Keep Only Non-Duplicates ({previewRows.length - duplicateCount})
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-[11px]">Price Unit:</span>
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
                    title="If values in your CSV are in paise (e.g. 50000), divide by 100 to convert to Rupees (500.00)"
                    className="rounded-md border border-[#333] bg-[#181818] px-2.5 py-1 text-[11px] font-medium text-blue-400 hover:border-blue-500 hover:bg-blue-500/10 transition flex items-center gap-1"
                  >
                    <span>Convert Paise → ₹ (÷100)</span>
                  </button>
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
                    title="Multiply by 100"
                    className="rounded-md border border-[#333] bg-[#181818] px-2 py-1 text-[11px] font-medium text-gray-400 hover:border-gray-500 hover:text-white transition"
                  >
                    <span>×100</span>
                  </button>
                </div>
              </div>

              {/* Editable Preview Table */}
              <div className="max-h-80 overflow-y-auto rounded-xl border border-[#262626] bg-[#0f0f0f]">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="sticky top-0 z-10 border-b border-[#262626] bg-[#141414] font-semibold uppercase tracking-wider text-gray-500 text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={previewRows.length > 0 && previewRows.every((r) => r.selected)}
                          onChange={(e) =>
                            setPreviewRows(previewRows.map((r) => ({ ...r, selected: e.target.checked })))
                          }
                          className="rounded border-[#333] text-blue-500 bg-[#0f0f0f]"
                        />
                      </th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Merchant / Payee</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
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
                        <td className="py-2 px-3">
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
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => {
                              const updated = [...previewRows];
                              updated[idx].date = e.target.value;
                              setPreviewRows(updated);
                            }}
                            className="rounded-md border border-[#262626] bg-[#141414] px-2 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.merchant}
                            onChange={(e) => {
                              const updated = [...previewRows];
                              updated[idx].merchant = e.target.value;
                              setPreviewRows(updated);
                            }}
                            className="w-full rounded-md border border-[#262626] bg-[#141414] px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-hidden font-semibold"
                          />
                          {row.rawDescription && row.rawDescription !== row.merchant && (
                            <div className="text-[10px] text-gray-500 truncate max-w-[200px] mt-0.5 font-mono">
                              {row.rawDescription}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={row.categoryId}
                            onChange={(e) => {
                              const updated = [...previewRows];
                              updated[idx].categoryId = e.target.value;
                              setPreviewRows(updated);
                            }}
                            className="rounded-md border border-[#262626] bg-[#141414] px-2 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-hidden"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={row.type}
                            onChange={(e) => {
                              const updated = [...previewRows];
                              updated[idx].type = e.target.value as TransactionType;
                              setPreviewRows(updated);
                            }}
                            className="rounded-md border border-[#262626] bg-[#141414] px-2 py-1 text-[11px] text-gray-200 focus:border-blue-500 focus:outline-hidden"
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                            <option value="transfer">Transfer</option>
                            <option value="refund">Refund</option>
                            <option value="investment">Investment</option>
                            <option value="loan_emi">Loan EMI</option>
                            <option value="cash_withdrawal">Cash Wdl</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={row.paymentMethod}
                            onChange={(e) => {
                              const updated = [...previewRows];
                              updated[idx].paymentMethod = e.target.value as PaymentMethod;
                              setPreviewRows(updated);
                            }}
                            className="rounded-md border border-[#262626] bg-[#141414] px-2 py-1 text-[11px] text-gray-200 focus:border-blue-500 focus:outline-hidden"
                          >
                            <option value="UPI">UPI</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Debit Card">Debit Card</option>
                            <option value="Net Banking">Net Banking</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cash">Cash</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => {
                              const updated = [...previewRows];
                              updated[idx].amount = Math.abs(parseFloat(e.target.value) || 0);
                              setPreviewRows(updated);
                            }}
                            className={`w-24 text-right rounded-md border border-[#262626] bg-[#141414] px-2 py-1 text-xs font-mono font-bold focus:border-blue-500 focus:outline-hidden ${
                              row.type === 'income' ? 'text-emerald-400' : 'text-white'
                            }`}
                          />
                          {row.isDuplicate && (
                            <div className="text-[10px] text-amber-400 font-sans font-semibold mt-0.5">
                              Duplicate
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#262626] px-6 py-4 bg-[#0f0f0f]">
          {previewRows.length > 0 ? (
            <button
              onClick={() => {
                setPreviewRows([]);
                setPastedText('');
                setFileName('');
              }}
              className="rounded-xl border border-[#262626] bg-[#141414] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#1e1e1e]"
            >
              ← Choose Another File
            </button>
          ) : (
            <div className="text-xs text-gray-500">
              Transactions are stored locally & securely in your ledger.
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border border-[#262626] bg-[#141414] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#1e1e1e]"
            >
              Cancel
            </button>
            {previewRows.length > 0 && (
              <button
                onClick={handleConfirmImport}
                disabled={selectedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                <span>Import {selectedCount} Transactions</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
