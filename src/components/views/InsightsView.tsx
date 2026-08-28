import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  BookOpen,
  Award,
  Zap,
} from 'lucide-react';
import { AIInsight, Category } from '../../types';
import { storageService, NOTIFY_EVENT } from '../../services/storage/storage.service';
import { aiService } from '../../services/ai/ai.service';
import { InsightGenerator } from '../../services/ai/insight-generator';
import { formatCurrency, getMonthName } from '../../utils/formatters';

interface InsightsViewProps {
  currentMonth: string;
  currencySymbol: string;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  currentMonth,
  currencySymbol,
}) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setCategories(storageService.getCategories());
    const currentTxs = storageService.getTransactions().filter((t) => t.date.startsWith('2026-08'));
    const prevTxs = storageService.getTransactions().filter((t) => t.date.startsWith('2026-07'));
    const cats = storageService.getCategories();
    const dynamicInsights = InsightGenerator.generateDynamicInsights(currentTxs, prevTxs, cats);
    setInsights(dynamicInsights);
  };

  useEffect(() => {
    load();
    window.addEventListener(NOTIFY_EVENT, load);
    return () => window.removeEventListener(NOTIFY_EVENT, load);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const currentTxs = storageService.getTransactions().filter((t) => t.date.startsWith('2026-08'));
      const prevTxs = storageService.getTransactions().filter((t) => t.date.startsWith('2026-07'));
      const cats = storageService.getCategories();
      const budgets = storageService.getBudgets();
      const generated = await aiService.generateMonthlyInsights(currentTxs, prevTxs, cats, budgets);
      setInsights(generated);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            AI Financial Insights & Stories
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Narrative financial intelligence, behavioral personality analysis, and automated money-leak detection.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-blue-500 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Regenerate Insights</span>
        </button>
      </div>

      {/* Monthly Narrative Story Card */}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 text-white shadow-xl">
        <div className="flex items-center gap-2.5 text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
          <BookOpen size={16} />
          <span>The Story of Your August 2026 Finances</span>
        </div>

        <p className="text-sm sm:text-base font-medium text-gray-200 leading-relaxed max-w-3xl">
          August was a disciplined, wealth-positive month with an active <strong>39.6% savings rate</strong> (₹47,550 retained from ₹1,20,000 inflow). Although outlays rose by 18% due to a high-ticket mechanical keyboard & monitor purchase (₹23,800), non-discretionary grocery and utility bills remained well within healthy limits.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#262626] pt-4 text-xs">
          <div>
            <span className="text-gray-400">Behavior Archetype:</span>
            <div className="font-bold text-emerald-400 mt-0.5">Calculated Optimizer</div>
          </div>
          <div>
            <span className="text-gray-400">Main Outflow Driver:</span>
            <div className="font-bold text-amber-400 mt-0.5">Tech Workspace Hardware</div>
          </div>
          <div>
            <span className="text-gray-400">Recommended Action:</span>
            <div className="font-bold text-blue-400 mt-0.5">Pause leisure dining for 7 days</div>
          </div>
        </div>
      </div>

      {/* Categorized AI Insights Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {insights.map((ins) => {
          let badgeColor = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
          let borderHighlight = 'border-[#262626]';

          if (ins.type === 'anomaly') {
            badgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
            borderHighlight = 'border-rose-500/30 bg-rose-500/5';
          } else if (ins.type === 'leak') {
            badgeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            borderHighlight = 'border-amber-500/30 bg-amber-500/5';
          } else if (ins.type === 'positive') {
            badgeColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            borderHighlight = 'border-emerald-500/30 bg-emerald-500/5';
          }

          return (
            <div
              key={ins.id}
              className={`rounded-xl border ${borderHighlight} bg-[#141414] p-5 shadow-xs flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                  <span className="text-xs font-bold text-white">{ins.title}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                    {ins.type.toUpperCase()} • {ins.confidenceScore}% AI Confidence
                  </span>
                </div>

                <p className="mt-3 text-xs text-gray-300 leading-relaxed">{ins.description}</p>
              </div>

              {ins.actionRecommendation && (
                <div className="mt-4 rounded-lg bg-[#0f0f0f] p-3 text-xs border border-[#262626]">
                  <span className="font-bold text-blue-400">Recommended Playbook:</span>{' '}
                  <span className="text-gray-300">{ins.actionRecommendation}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
