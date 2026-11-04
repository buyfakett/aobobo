const DEFAULT_TARGET_CURRENCY = 'CNY';

const CURRENCY_ALIASES = {
  CNY: 'CNY',
  RMB: 'CNY',
  'CN¥': 'CNY',
  '¥': 'CNY',
  '￥': 'CNY',
  元: 'CNY',
  人民币: 'CNY',
  USD: 'USD',
  US$: 'USD',
  $: 'USD',
  美元: 'USD',
  EUR: 'EUR',
  '€': 'EUR',
  欧元: 'EUR',
  HKD: 'HKD',
  HK$: 'HKD',
  港币: 'HKD',
  SGD: 'SGD',
  S$: 'SGD',
  新币: 'SGD',
  新加坡元: 'SGD',
  JPY: 'JPY',
  'JP¥': 'JPY',
  円: 'JPY',
  日元: 'JPY',
  GBP: 'GBP',
  '£': 'GBP',
  英镑: 'GBP',
  AUD: 'AUD',
  A$: 'AUD',
  AU$: 'AUD',
  CAD: 'CAD',
  C$: 'CAD',
  CA$: 'CAD',
  TWD: 'TWD',
  NT$: 'TWD',
  台币: 'TWD',
  KRW: 'KRW',
  '₩': 'KRW',
  韩元: 'KRW',
};

const CURRENCY_SYMBOLS = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  HKD: 'HK$',
  SGD: 'S$',
  JPY: '¥',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  TWD: 'NT$',
  KRW: '₩',
};

const SORTED_ALIAS_KEYS = Object.keys(CURRENCY_ALIASES)
  .sort((a, b) => b.length - a.length);

function compactCurrencyToken(token) {
  return String(token || '')
    .trim()
    .replace(/[()（）]/g, '')
    .replace(/\/.*$/, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function findCurrencyToken(text) {
  const compact = compactCurrencyToken(text);
  if (!compact) {
    return '';
  }

  const alias = SORTED_ALIAS_KEYS.find((key) => compact.includes(key.toUpperCase()));
  if (alias) {
    return alias;
  }

  const iso = compact.match(/[A-Z]{3}/);
  return iso ? iso[0] : '';
}

function normalizeCurrencyCode(token, fallback = DEFAULT_TARGET_CURRENCY) {
  const compact = compactCurrencyToken(token);
  if (!compact) {
    return fallback !== undefined ? fallback : DEFAULT_TARGET_CURRENCY;
  }

  if (CURRENCY_ALIASES[compact]) {
    return CURRENCY_ALIASES[compact];
  }

  if (/^[A-Z]{3}$/.test(compact)) {
    return compact;
  }

  return fallback !== undefined ? fallback : DEFAULT_TARGET_CURRENCY;
}

function getCurrencySymbol(currency) {
  const code = normalizeCurrencyCode(currency, DEFAULT_TARGET_CURRENCY);
  return CURRENCY_SYMBOLS[code] || `${code} `;
}

export function parseBillingCostAmount(amount, defaultCurrency = DEFAULT_TARGET_CURRENCY) {
  if (amount === null || amount === undefined) {
    return { type: 'empty', raw: '' };
  }

  const raw = String(amount).trim();
  if (!raw) {
    return { type: 'empty', raw };
  }

  if (raw === '-1' || /^(按量|按需|usage|metered)$/i.test(raw)) {
    return { type: 'metered', raw };
  }

  if (raw === '0' || /^(免费|free)$/i.test(raw)) {
    return {
      type: 'free',
      raw,
      value: 0,
      currency: normalizeCurrencyCode(defaultCurrency, DEFAULT_TARGET_CURRENCY),
    };
  }

  const normalized = raw.replace(/,/g, '');
  const match = normalized.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) {
    return { type: 'invalid', raw };
  }

  const value = Number(match[0]);
  if (!Number.isFinite(value)) {
    return { type: 'invalid', raw };
  }

  if (value === 0) {
    return {
      type: 'free',
      raw,
      value: 0,
      currency: normalizeCurrencyCode(defaultCurrency, DEFAULT_TARGET_CURRENCY),
    };
  }

  if (value < 0) {
    return { type: 'metered', raw };
  }

  const prefix = normalized.slice(0, match.index).trim();
  const suffix = normalized.slice(match.index + match[0].length).trim();
  const token = findCurrencyToken(prefix) || findCurrencyToken(suffix);
  const defaultCurrencyCode = normalizeCurrencyCode(defaultCurrency, DEFAULT_TARGET_CURRENCY);
  const currency = normalizeCurrencyCode(token, defaultCurrencyCode);

  return {
    type: 'fixed',
    raw,
    value,
    currency,
  };
}

export function formatCurrencyValue(value, currency = DEFAULT_TARGET_CURRENCY) {
  if (!Number.isFinite(Number(value))) {
    return '-';
  }

  const code = normalizeCurrencyCode(currency, DEFAULT_TARGET_CURRENCY);
  const symbol = getCurrencySymbol(code);
  const number = Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${number}`;
}
