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

    // 4. Savings & Budget Optimization Opportunity
    const discretionaryTxs = currentMonthTxs.filter(
      (t) => t.type === 'expense' && ['food', 'shopping', 'entertainment'].includes(t.categoryId)
    );
    const discretionarySum = discretionaryTxs.reduce((s, t) => s + t.amount, 0);
    if (discretionarySum > 5000) {
      const potentialGain = Math.round(discretionarySum * 0.15);
      insights.push({
        id: 'ins_savings_boost',
        type: 'smart_recommendation',
        title: `Savings Opportunity: +₹${potentialGain.toLocaleString('en-IN')}/month`,
        description: `By trimming 15% from lifestyle and discretionary expenses (currently ₹${discretionarySum.toLocaleString(
          'en-IN'
        )}), you can redirect an extra ₹${(potentialGain * 12).toLocaleString(
          'en-IN'
        )} annually towards your financial goals.`,
        impactAmount: potentialGain,
        actionRecommendation: 'Set category budget caps in Budgets & Planner or simulate goal acceleration in Goals.',
        confidenceScore: 90,
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
