import { getCurrencySymbol, getCurrencyLocale } from './currency';
export { getCurrencySymbol, getCurrencyLocale, SUPPORTED_CURRENCIES } from './currency';

export function formatCurrency(
  amount: number,
  currencySymbol = '₹',
  locale?: string
): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const resolvedSymbol = getCurrencySymbol(currencySymbol);
  const resolvedLocale = locale || getCurrencyLocale(resolvedSymbol);

  let formatted = '';
  try {
    const hasFraction = absAmount % 1 !== 0;
    formatted = new Intl.NumberFormat(resolvedLocale, {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(absAmount);
  } catch (e) {
    formatted = absAmount.toLocaleString();
  }

  return `${isNegative ? '-' : ''}${resolvedSymbol}${formatted}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
}

export function getMonthName(monthStr: string): string {
  // '2026-08' -> 'August 2026'
  if (!monthStr) return '';
  try {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch (e) {
    return monthStr;
  }
}

export function getRelativeTime(dateStr: string): string {
  try {
    const now = new Date();
    const target = new Date(dateStr);
    const diffMs = now.getTime() - target.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  } catch (e) {
    return dateStr;
  }
}

export interface MonthOption {
  value: string; // '2026-08'
  label: string; // 'August 2026'
}

/**
 * Returns the last 3 calendar months formatted as options,
 * including any additional requested month if specified.
 */
export function getLastThreeMonths(additionalMonth?: string): MonthOption[] {
  const result: MonthOption[] = [];
  const now = new Date();

  // If current month is 2026-09 or 2026-08, compute last 3 calendar months
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${yyyy}-${mm}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    result.push({ value, label });
  }

  // Ensure additionalMonth (e.g. current selected month from seed data like 2026-08) is selectable if not present
  if (
    additionalMonth &&
    additionalMonth !== 'all' &&
    !result.some((m) => m.value === additionalMonth)
  ) {
    result.push({
      value: additionalMonth,
      label: getMonthName(additionalMonth),
    });
  }

  return result;
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function toISODateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
