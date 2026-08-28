export function formatCurrency(
  amount: number,
  currencySymbol = '₹',
  locale = 'en-IN'
): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let formatted = '';
  try {
    formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absAmount);
  } catch (e) {
    formatted = absAmount.toLocaleString();
  }

  return `${isNegative ? '-' : ''}${currencySymbol}${formatted}`;
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
