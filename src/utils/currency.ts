export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  label: string;
  locale: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', label: '₹ - INR (Indian Rupee)', locale: 'en-IN' },
  { code: 'USD', symbol: '$', name: 'US Dollar', label: '$ - USD (US Dollar)', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', label: '€ - EUR (Euro)', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', label: '£ - GBP (British Pound)', locale: 'en-GB' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', label: '¥ - JPY (Japanese Yen)', locale: 'ja-JP' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', label: 'C$ - CAD (Canadian Dollar)', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', label: 'A$ - AUD (Australian Dollar)', locale: 'en-AU' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', label: 'S$ - SGD (Singapore Dollar)', locale: 'en-SG' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', label: 'AED - UAE Dirham', locale: 'en-AE' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', label: 'CHF - Swiss Franc', locale: 'de-CH' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', label: '¥ - CNY (Chinese Yuan)', locale: 'zh-CN' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', label: 'R$ - BRL (Brazilian Real)', locale: 'pt-BR' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', label: '₩ - KRW (South Korean Won)', locale: 'ko-KR' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', label: 'kr - SEK (Swedish Krona)', locale: 'sv-SE' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', label: 'NZ$ - NZD (New Zealand Dollar)', locale: 'en-NZ' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', label: '₺ - TRY (Turkish Lira)', locale: 'tr-TR' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', label: '₽ - RUB (Russian Ruble)', locale: 'ru-RU' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', label: 'SAR - Saudi Riyal', locale: 'en-SA' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', label: 'R - ZAR (South African Rand)', locale: 'en-ZA' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', label: '฿ - THB (Thai Baht)', locale: 'th-TH' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', label: 'RM - MYR (Malaysian Ringgit)', locale: 'ms-MY' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', label: '₱ - PHP (Philippine Peso)', locale: 'en-PH' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', label: 'Rp - IDR (Indonesian Rupiah)', locale: 'id-ID' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', label: '₫ - VND (Vietnamese Dong)', locale: 'vi-VN' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', label: 'MX$ - MXN (Mexican Peso)', locale: 'es-MX' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', label: 'zł - PLN (Polish Zloty)', locale: 'pl-PL' },
];

const CODE_TO_SYMBOL_MAP: Record<string, string> = {
  INR: '₹',
  RS: '₹',
  RUPEE: '₹',
  RUPEES: '₹',
  USD: '$',
  DOLLAR: '$',
  DOLLARS: '$',
  EUR: '€',
  EURO: '€',
  EUROS: '€',
  GBP: '£',
  POUND: '£',
  POUNDS: '£',
  JPY: '¥',
  YEN: '¥',
  CAD: 'C$',
  AUD: 'A$',
  SGD: 'S$',
  AED: 'AED',
  DIRHAM: 'AED',
  CHF: 'CHF',
  CNY: '¥',
  YUAN: '¥',
  BRL: 'R$',
  REAL: 'R$',
  KRW: '₩',
  WON: '₩',
  SEK: 'kr',
  KRONA: 'kr',
  NZD: 'NZ$',
  TRY: '₺',
  LIRA: '₺',
  RUB: '₽',
  RUBLE: '₽',
  SAR: 'SAR',
  RIYAL: 'SAR',
  ZAR: 'R',
  RAND: 'R',
  THB: '฿',
  BAHT: '฿',
  MYR: 'RM',
  RINGGIT: 'RM',
  PHP: '₱',
  PESO: '₱',
  IDR: 'Rp',
  RUPIAH: 'Rp',
  VND: '₫',
  DONG: '₫',
  MXN: 'MX$',
  PLN: 'zł',
  ZLOTY: 'zł',
};

const SYMBOL_TO_LOCALE_MAP: Record<string, string> = {
  '₹': 'en-IN',
  '$': 'en-US',
  '€': 'de-DE',
  '£': 'en-GB',
  '¥': 'ja-JP',
  'C$': 'en-CA',
  'A$': 'en-AU',
  'S$': 'en-SG',
  'AED': 'en-AE',
  'CHF': 'de-CH',
  'R$': 'pt-BR',
  '₩': 'ko-KR',
  'kr': 'sv-SE',
  'NZ$': 'en-NZ',
  '₺': 'tr-TR',
  '₽': 'ru-RU',
  'SAR': 'en-SA',
  'R': 'en-ZA',
  '฿': 'th-TH',
  'RM': 'ms-MY',
  '₱': 'en-PH',
  'Rp': 'id-ID',
  '₫': 'vi-VN',
  'MX$': 'es-MX',
  'zł': 'pl-PL',
};

/**
 * Converts any currency code or symbol (e.g., 'INR', 'USD', 'EUR', 'GBP') to its canonical symbol ('₹', '$', '€', '£')
 */
export function getCurrencySymbol(codeOrSymbol: string | undefined | null): string {
  if (!codeOrSymbol) return '₹';
  const clean = codeOrSymbol.trim();
  const upper = clean.toUpperCase();
  if (CODE_TO_SYMBOL_MAP[upper]) {
    return CODE_TO_SYMBOL_MAP[upper];
  }
  // Check if it matches an existing symbol directly
  const found = SUPPORTED_CURRENCIES.find((c) => c.symbol === clean || c.code === upper);
  if (found) {
    return found.symbol;
  }
  return clean;
}

/**
 * Gets the standard formatting locale for a given currency symbol or code
 */
export function getCurrencyLocale(codeOrSymbol: string | undefined | null): string {
  const symbol = getCurrencySymbol(codeOrSymbol);
  return SYMBOL_TO_LOCALE_MAP[symbol] || 'en-IN';
}
