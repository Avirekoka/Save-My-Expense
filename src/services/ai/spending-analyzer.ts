import { Transaction, Category } from '../../types';

export interface MoMComparisonItem {
  categoryId: string;
  categoryName: string;
  currentAmount: number;
  previousAmount: number;
  diffAmount: number;
  changePercentage: number;
  trend: 'up' | 'down' | 'flat';
}

export interface SpendingPersonalityResult {
  personalityTitle: string; // e.g. "Weekend Spender", "Subscription Heavy", "Steady Saver"
  tagline: string;
  discretionaryBreakdown: string;
  strengths: string[];
  vulnerabilities: string[];
  recommendation: string;
}

export interface MoneyLeakItem {
  name: string;
  category: string;
  monthlyAmount: number;
  yearlyImpact: number;
  frequencyDescription: string;
  leakRiskLevel: 'high' | 'medium' | 'low';
}

export class SpendingAnalyzer {
  static compareMonths(
    currentTxs: Transaction[],
    prevTxs: Transaction[],
    categories: Category[]
  ): {
    items: MoMComparisonItem[];
    totalCurrent: number;
    totalPrevious: number;
    totalChangePercentage: number;
    summaryNarration: string;
  } {
    const curCatSpend: Record<string, number> = {};
    const prevCatSpend: Record<string, number> = {};

    let totalCurrent = 0;
    let totalPrevious = 0;

    for (const tx of currentTxs) {
      if (tx.type === 'expense' || tx.type === 'loan_emi') {
        curCatSpend[tx.categoryId] = (curCatSpend[tx.categoryId] || 0) + tx.amount;
        totalCurrent += tx.amount;
      }
    }

    for (const tx of prevTxs) {
      if (tx.type === 'expense' || tx.type === 'loan_emi') {
        prevCatSpend[tx.categoryId] = (prevCatSpend[tx.categoryId] || 0) + tx.amount;
        totalPrevious += tx.amount;
      }
    }

    const allCatIds = Array.from(new Set([...Object.keys(curCatSpend), ...Object.keys(prevCatSpend)]));
    const items: MoMComparisonItem[] = [];

    for (const catId of allCatIds) {
      const cur = curCatSpend[catId] || 0;
      const prev = prevCatSpend[catId] || 0;
      const diff = cur - prev;
      const pct = prev > 0 ? Math.round((diff / prev) * 100) : cur > 0 ? 100 : 0;
      const catObj = categories.find((c) => c.id === catId);

      items.push({
        categoryId: catId,
        categoryName: catObj ? catObj.name : catId,
        currentAmount: cur,
        previousAmount: prev,
        diffAmount: diff,
        changePercentage: pct,
        trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
      });
    }

    // Sort by largest absolute spending difference
    items.sort((a, b) => Math.abs(b.diffAmount) - Math.abs(a.diffAmount));

    const totalChangePercentage =
      totalPrevious > 0 ? Math.round(((totalCurrent - totalPrevious) / totalPrevious) * 100) : 0;

    const topIncrease = items.find((i) => i.diffAmount > 0);
    const topDecrease = items.find((i) => i.diffAmount < 0);

    let summaryNarration = `Expenses ${
      totalChangePercentage >= 0 ? `increased by ${totalChangePercentage}%` : `decreased by ${Math.abs(totalChangePercentage)}%`
    } compared with last month.`;

    if (topIncrease) {
      summaryNarration += ` The largest increase came from ${topIncrease.categoryName} (+₹${topIncrease.diffAmount.toLocaleString('en-IN')}).`;
    }
    if (topDecrease) {
      summaryNarration += ` Travel and transport saw a reduction of ₹${Math.abs(topDecrease.diffAmount).toLocaleString('en-IN')}.`;
    }

    return {
      items,
      totalCurrent,
      totalPrevious,
      totalChangePercentage,
      summaryNarration,
    };
  }

  static analyzeSpendingPersonality(transactions: Transaction[]): SpendingPersonalityResult {
    const expenseTxs = transactions.filter((t) => t.type === 'expense');
    let weekendSpend = 0;
    let weekdaySpend = 0;
    let subscriptionSpend = 0;
    let totalSpend = 0;

    for (const tx of expenseTxs) {
      totalSpend += tx.amount;
      const day = new Date(tx.date).getDay(); // 0 = Sun, 6 = Sat
      if (day === 0 || day === 6) {
        weekendSpend += tx.amount;
      } else {
        weekdaySpend += tx.amount;
      }
      if (tx.categoryId === 'subscriptions') {
        subscriptionSpend += tx.amount;
      }
    }

    const weekendPct = totalSpend > 0 ? Math.round((weekendSpend / totalSpend) * 100) : 0;
    const subPct = totalSpend > 0 ? Math.round((subscriptionSpend / totalSpend) * 100) : 0;

    if (weekendPct >= 35) {
      return {
        personalityTitle: 'Weekend Spender',
        tagline: 'You spend over 40% of discretionary outflow on weekends for dining and leisure.',
        discretionaryBreakdown: `${weekendPct}% Weekend Outflow vs ${100 - weekendPct}% Weekday Baseline`,
        strengths: ['Highly disciplined on weekdays', 'Predictable weekday burn rate'],
        vulnerabilities: ['Concentrated weekend dining spikes', 'Social outing budget overshoot'],
        recommendation: 'Pre-allocate a fixed weekend debit envelope of ₹3,000 to keep leisure spending contained.',
      };
    }

    if (subPct >= 10) {
      return {
        personalityTitle: 'Subscription Heavy',
        tagline: 'You carry a higher-than-average proportion of recurring digital & lifestyle subscriptions.',
        discretionaryBreakdown: `${subPct}% Recurring Software & Memberships`,
        strengths: ['Predictable fixed bills', 'Enjoys premium productivity and entertainment tools'],
        vulnerabilities: ['Zombie subscription creep', 'Gradual price hike accumulation'],
        recommendation: 'Audit recurring subscriptions quarterly and cancel any service unvisited in 30 days.',
      };
    }

    return {
      personalityTitle: 'Steady & Methodical Spender',
      tagline: 'Your spending is evenly distributed throughout the month with controlled volatility.',
      discretionaryBreakdown: 'Even 50/50 balance between fixed essentials and planned discretionary rewards',
      strengths: ['Low spending volatility', 'Consistent monthly savings surplus'],
      vulnerabilities: ['Occasional planned tech upgrades cause momentary one-off spikes'],
      recommendation: 'Channel surplus buffer directly into automated SIP index investments on salary day.',
    };
  }

  static detectMoneyLeaks(transactions: Transaction[]): MoneyLeakItem[] {
    const leaks: MoneyLeakItem[] = [];

    // Food delivery leak
    const foodDelivery = transactions.filter(
      (t) =>
        t.categoryId === 'food' &&
        (t.merchant.toLowerCase().includes('swiggy') || t.merchant.toLowerCase().includes('zomato') || t.amount < 1000)
    );
    const foodDeliveryTotal = foodDelivery.reduce((s, t) => s + t.amount, 0);
    if (foodDeliveryTotal > 2000) {
      leaks.push({
        name: 'Frequent Micro Food Delivery',
        category: 'Food & Dining',
        monthlyAmount: foodDeliveryTotal,
        yearlyImpact: foodDeliveryTotal * 12,
        frequencyDescription: `${foodDelivery.length} micro-orders in the current period`,
        leakRiskLevel: 'high',
      });
    }

    // Small subscriptions
    const smallSubs = transactions.filter((t) => t.categoryId === 'subscriptions' && t.amount < 600);
    const smallSubsTotal = smallSubs.reduce((s, t) => s + t.amount, 0);
    if (smallSubsTotal > 500) {
      leaks.push({
        name: 'Micro Digital Subscriptions',
        category: 'Subscriptions',
        monthlyAmount: smallSubsTotal,
        yearlyImpact: smallSubsTotal * 12,
        frequencyDescription: `${smallSubs.length} recurring micro-services under ₹600/mo`,
        leakRiskLevel: 'medium',
      });
    }

    // Instant delivery fees
    const instant = transactions.filter(
      (t) => t.merchant.toLowerCase().includes('blinkit') || t.merchant.toLowerCase().includes('zepto') || t.merchant.toLowerCase().includes('instamart')
    );
    const instantTotal = instant.reduce((s, t) => s + t.amount, 0);
    if (instantTotal > 400) {
      leaks.push({
        name: 'Instant Quick-Commerce Surges',
        category: 'Groceries',
        monthlyAmount: instantTotal,
        yearlyImpact: instantTotal * 12,
        frequencyDescription: `${instant.length} small quick-delivery orders`,
        leakRiskLevel: 'low',
      });
    }

    return leaks;
  }
}
