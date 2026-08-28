import { Transaction, AIInsight, Category } from '../../types';
import { SpendingAnalyzer } from './spending-analyzer';

export class InsightGenerator {
  static generateDynamicInsights(
    currentMonthTxs: Transaction[],
    prevMonthTxs: Transaction[],
    categories: Category[]
  ): AIInsight[] {
    const insights: AIInsight[] = [];
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. Spending Anomaly Detection
    const anomalies = currentMonthTxs.filter((t) => t.isAnomaly || t.amount > 10000);
    if (anomalies.length > 0) {
      const top = anomalies[0];
      insights.push({
        id: `ins_anomaly_${top.id}`,
        type: 'spending_anomaly',
        title: `Unusual Spending Spike: ${top.merchant}`,
        description: `You spent ₹${top.amount.toLocaleString('en-IN')} on ${top.merchant}. This is significantly higher than your typical transaction size in this category.`,
        impactAmount: top.amount,
        categoryId: top.categoryId,
        actionRecommendation: 'Review this transaction to confirm if it was an essential one-off purchase or an impulsive expense.',
        confidenceScore: 94,
        date: dateStr,
      });
    }

    // 2. Month-over-Month Comparison
    const comparison = SpendingAnalyzer.compareMonths(currentMonthTxs, prevMonthTxs, categories);
    insights.push({
      id: 'ins_mom_story',
      type: 'monthly_story',
      title: 'Month-over-Month Expense Trajectory',
      description: comparison.summaryNarration,
      changePercentage: comparison.totalChangePercentage,
      confidenceScore: 96,
      date: dateStr,
    });

    // 3. Weekend vs Weekday analysis
    const personality = SpendingAnalyzer.analyzeSpendingPersonality(currentMonthTxs);
    insights.push({
      id: 'ins_personality',
      type: 'spending_personality',
      title: `Financial Archetype: ${personality.personalityTitle}`,
      description: `${personality.tagline} (${personality.discretionaryBreakdown}).`,
      actionRecommendation: personality.recommendation,
      confidenceScore: 92,
      date: dateStr,
    });

    // 4. Money Leaks & Micro-Expenses
    const leaks = SpendingAnalyzer.detectMoneyLeaks(currentMonthTxs);
    if (leaks.length > 0) {
      const totalLeaks = leaks.reduce((s, l) => s + l.monthlyAmount, 0);
      insights.push({
        id: 'ins_money_leaks',
        type: 'money_leak',
        title: `Potential Money Leaks: ₹${totalLeaks.toLocaleString('en-IN')}/month`,
        description: `Identified ${leaks.length} recurring micro-expenses (including delivery fees and small convenience apps) totaling ₹${(
          totalLeaks * 12
        ).toLocaleString('en-IN')} annualized.`,
        impactAmount: totalLeaks,
        actionRecommendation: 'Consolidate small grocery/food delivery orders to save on delivery fees and packaging surges.',
        confidenceScore: 88,
        date: dateStr,
      });
    }

    // 5. Merchant Concentration (e.g. Amazon / Swiggy)
    const merchantMap: Record<string, number> = {};
    let totalExpense = 0;
    for (const tx of currentMonthTxs) {
      if (tx.type === 'expense') {
        merchantMap[tx.merchant] = (merchantMap[tx.merchant] || 0) + tx.amount;
        totalExpense += tx.amount;
      }
    }

    const sortedMerchants = Object.entries(merchantMap).sort((a, b) => b[1] - a[1]);
    if (sortedMerchants.length > 0 && totalExpense > 0) {
      const topMerchant = sortedMerchants[0];
      const pct = Math.round((topMerchant[1] / totalExpense) * 100);
      if (pct >= 20) {
        insights.push({
          id: 'ins_merchant_conc',
          type: 'merchant_concentration',
          title: `Merchant Concentration: ${topMerchant[0]}`,
          description: `${pct}% of your total monthly expenditure (₹${topMerchant[1].toLocaleString(
            'en-IN'
          )}) went to ${topMerchant[0]}.`,
          impactAmount: topMerchant[1],
          confidenceScore: 95,
          date: dateStr,
        });
      }
    }

    return insights;
  }
}
