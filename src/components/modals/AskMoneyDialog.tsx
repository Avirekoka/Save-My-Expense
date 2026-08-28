import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Send,
  Loader2,
  ArrowRight,
  TrendingUp,
  Receipt,
  HelpCircle,
} from 'lucide-react';
import { aiService } from '../../services/ai/ai.service';
import { storageService } from '../../services/storage/storage.service';
import { Transaction, AskMoneyResponse } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface AskMoneyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
}

export const AskMoneyDialog: React.FC<AskMoneyDialogProps> = ({
  isOpen,
  onClose,
  currencySymbol,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskMoneyResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sampleQueries = [
    'How much did I spend on food in August?',
    'Why did August expenses increase compared to July?',
    'What are my recurring subscriptions and are any unused?',
    'Show all transactions above ₹5,000',
    'How much did I spend on Amazon and Swiggy?',
  ];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResult(null);
    }
  }, [isOpen]);

  const handleSearch = async (textToSearch: string) => {
    const q = textToSearch.trim();
    if (!q) return;

    setLoading(true);
    setQuery(q);

    const txs = storageService.getTransactions();
    const categories = storageService.getCategories();
    const budgets = storageService.getBudgets();

    try {
      const response = await aiService.askMyMoney(q, txs, categories, budgets);
      setResult(response);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 sm:pt-20 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#262626] bg-[#141414] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-white">
        {/* Search Bar Header */}
        <div className="flex items-center border-b border-[#262626] px-4 py-3 bg-[#0f0f0f]">
          <Sparkles className="text-blue-400 shrink-0 mr-3" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask anything about your expenses, budgets, or spending habits..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch(query);
            }}
            className="flex-1 bg-transparent text-sm font-medium text-white placeholder:text-gray-500 focus:outline-hidden"
          />
          {loading ? (
            <Loader2 className="animate-spin text-blue-400 ml-2" size={18} />
          ) : (
            <button
              onClick={() => handleSearch(query)}
              disabled={!query.trim()}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 disabled:opacity-40"
            >
              Ask
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-5">
          {!result && !loading && (
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Suggested Prompts
              </div>
              <div className="space-y-2">
                {sampleQueries.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearch(sample)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#262626] bg-[#0f0f0f] p-3 text-left text-xs font-medium text-gray-300 hover:border-blue-500/50 hover:bg-[#1a1a1a] hover:text-white transition"
                  >
                    <span>{sample}</span>
                    <ArrowRight size={14} className="text-gray-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="animate-spin text-blue-400 mx-auto" size={28} />
              <p className="text-xs text-gray-400 font-medium">
                Analyzing your financial records and computing intelligence...
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* Answer Card */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-600/10 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 mb-1.5">
                  <Sparkles size={15} className="text-blue-400" />
                  <span>AI Financial Insight</span>
                </div>
                <p className="text-sm font-medium text-gray-100 leading-relaxed">
                  {result.answer}
                </p>

                {result.calculatedAmount !== undefined && result.calculatedAmount > 0 && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#141414] px-3 py-1.5 text-xs font-bold text-blue-400 shadow-xs border border-blue-500/30">
                    <span>Total Calculated:</span>
                    <span className="font-mono text-sm font-extrabold text-white">
                      {formatCurrency(result.calculatedAmount, currencySymbol)}
                    </span>
                  </div>
                )}
              </div>

              {/* Insights bullet points if available */}
              {result.insights && result.insights.length > 0 && (
                <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3.5 space-y-1.5">
                  <div className="text-xs font-bold text-gray-300 mb-1">Key Takeaways:</div>
                  {result.insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <span>{ins}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Grounded Transactions List */}
              {result.relevantTransactions && result.relevantTransactions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-gray-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Receipt size={14} className="text-gray-500" />
                      Traceable Records ({result.relevantTransactions.length})
                    </span>
                  </div>
                  <div className="divide-y divide-[#212121] rounded-xl border border-[#262626] bg-[#0f0f0f] overflow-hidden">
                    {result.relevantTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-2.5 text-xs hover:bg-[#141414]"
                      >
                        <div>
                          <div className="font-semibold text-white">{tx.merchant}</div>
                          <div className="text-[11px] text-gray-500">
                            {formatDate(tx.date)} • {tx.paymentMethod} • {tx.categoryId}
                          </div>
                        </div>
                        <div
                          className={`font-mono font-bold ${
                            tx.type === 'income'
                              ? 'text-emerald-400'
                              : tx.type === 'refund'
                              ? 'text-blue-400'
                              : 'text-white'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'refund' ? '↺ ' : '-'}
                          {formatCurrency(tx.amount, currencySymbol)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up Prompts */}
              {result.suggestedFollowUps && result.suggestedFollowUps.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Follow-up Questions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.suggestedFollowUps.map((fu, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSearch(fu)}
                        className="rounded-lg border border-[#262626] bg-[#0f0f0f] px-2.5 py-1 text-xs text-gray-300 hover:border-blue-500/50 hover:bg-[#1a1a1a] hover:text-white transition"
                      >
                        {fu} →
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
