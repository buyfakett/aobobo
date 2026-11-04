import { beforeEach, describe, expect, it, rstest } from '@rstest/core';
import {
  formatCurrencyValue, getCurrencySymbol, loadExchangeRatesForCurrencies,
  normalizeCurrencyCode, parseBillingCostAmount,
} from '../src/utils/exchange-rate';

const CACHE_KEY = 'aobobo:exchange-rates:v1';
const NOW = new Date('2026-11-04T00:00:00Z').valueOf();

describe('billing currency parsing', () => {
  it.each([
    [' rmb ', 'CNY'], ['US$', 'USD'], ['（HKD）/月', 'HKD'], ['人民币', 'CNY'],
    ['日元', 'JPY'], ['eur', 'EUR'], ['chf', 'CHF'], ['unknown', 'CNY'], ['', 'CNY'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeCurrencyCode(input)).toBe(expected);
  });

  it('honors explicit fallbacks and formats known and unknown currencies', () => {
    expect(normalizeCurrencyCode(null, 'USD')).toBe('USD');
    expect(normalizeCurrencyCode('?', '')).toBe('');
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('CHF')).toBe('CHF ');
    expect(formatCurrencyValue(1234.567, 'CNY')).toBe('¥1,234.57');
    expect(formatCurrencyValue(12, 'CHF')).toBe('CHF 12.00');
    expect(formatCurrencyValue('bad')).toBe('-');
  });

  it.each([null, undefined, '', '   '])('accepts empty values', (input) => {
    expect(parseBillingCostAmount(input)).toMatchObject({ type: 'empty', raw: '' });
  });
  it.each(['-1', '按量', '按需', 'USAGE', 'metered', '-20 USD'])('recognizes metered amounts: %s', (input) => {
    expect(parseBillingCostAmount(input)).toMatchObject({ type: 'metered' });
  });
  it.each(['0', '免费', 'FREE', 'USD 0.00'])('recognizes free amounts: %s', (input) => {
    expect(parseBillingCostAmount(input, 'USD')).toMatchObject({ type: 'free', value: 0, currency: 'USD' });
  });
  it.each([
    ['US$ 1,234.50/月', 1234.5, 'USD'], ['200 港币', 200, 'HKD'],
    ['JPY 500', 500, 'JPY'], ['£10.5', 10.5, 'GBP'], ['20 CHF', 20, 'CHF'],
    ['30', 30, 'CNY'], ['30 ???', 30, 'CNY'], ['NT$ 123', 123, 'TWD'],
  ])('parses fixed amount %s', (input, value, currency) => {
    expect(parseBillingCostAmount(input)).toEqual({ type: 'fixed', raw: input, value, currency });
  });
  it('rejects missing and overflowing numbers', () => {
    expect(parseBillingCostAmount('USD')).toMatchObject({ type: 'invalid' });
    expect(parseBillingCostAmount('9'.repeat(400))).toMatchObject({ type: 'invalid' });
  });
});

describe('exchange rate fetching and caching', () => {
  beforeEach(() => {
    rstest.useFakeTimers();
    rstest.setSystemTime(NOW);
  });

  it('deduplicates currencies and uses an encoded custom API URL', async () => {
    const fetchMock = rstest.fn().mockResolvedValue({ ok: true, json: async () => ({ rate: '7.1', date: '2026-11-03' }) });
    rstest.stubGlobal('fetch', fetchMock);
    const result = await loadExchangeRatesForCurrencies(['usd', 'USD', 'CNY', '?'], '人民币', { apiBase: 'https://rates.example///' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://rates.example/rate/USD/CNY');
    expect(result).toMatchObject({
      targetCurrency: 'CNY', fetchedCurrencies: ['USD'], cachedCurrencies: [],
      missingCurrencies: [], staleCurrencies: [], updatedAt: NOW, disabled: false,
      rates: { CNY: { rate: 1, source: 'base' }, USD: { rate: 7.1, source: 'frankfurter', stale: false } },
    });
    expect(JSON.parse(localStorage.getItem(CACHE_KEY))['USD->CNY']).toMatchObject({ rate: 7.1, fetchedAt: NOW });
    const cached = await loadExchangeRatesForCurrencies(['USD'], 'CNY');
    expect(cached.cachedCurrencies).toEqual(['USD']);
    expect(cached.rates.USD.source).toBe('cache');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns base currency without fetching when disabled', async () => {
    const fetchMock = rstest.fn();
    rstest.stubGlobal('fetch', fetchMock);
    const result = await loadExchangeRatesForCurrencies(['EUR', 'USD', 'USD'], 'CNY', { enabled: false });
    expect(result).toMatchObject({ missingCurrencies: ['EUR', 'USD'], disabled: true, updatedAt: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to stale cache and reports missing currencies on network errors', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      'USD->CNY': { rate: '7', fetchedAt: NOW - 90000000 },
      'EUR->CNY': { rate: 'invalid', fetchedAt: NOW },
    }));
    rstest.stubGlobal('fetch', rstest.fn().mockRejectedValue(new Error('offline')));
    const result = await loadExchangeRatesForCurrencies(['USD', 'EUR'], 'CNY', { cacheHours: -1 });
    expect(result.staleCurrencies).toEqual(['USD']);
    expect(result.missingCurrencies).toEqual(['EUR']);
    expect(result.rates.USD).toMatchObject({ rate: 7, source: 'stale-cache', stale: true });
  });

  it.each([
    { ok: false, status: 500 },
    { ok: true, json: async () => ({ rate: 0 }) },
    { ok: true, json: async () => ({ rate: -1 }) },
    { ok: true, json: async () => ({}) },
  ])('handles invalid API responses', async (response) => {
    rstest.stubGlobal('fetch', rstest.fn().mockResolvedValue(response));
    expect((await loadExchangeRatesForCurrencies(['USD'], 'CNY')).missingCurrencies).toEqual(['USD']);
  });

  it.each(['invalid json', 'null', '42'])('recovers from malformed stored cache: %s', async (cache) => {
    localStorage.setItem(CACHE_KEY, cache);
    rstest.stubGlobal('fetch', rstest.fn().mockResolvedValue({ ok: true, json: async () => ({ rate: 7 }) }));
    expect((await loadExchangeRatesForCurrencies(['USD'], null)).rates.USD.rate).toBe(7);
  });

  it('refreshes expired rates according to the configured TTL', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ 'USD->CNY': { rate: 6, fetchedAt: NOW - 7200000 } }));
    const fetchMock = rstest.fn().mockResolvedValue({ ok: true, json: async () => ({ rate: 7.2 }) });
    rstest.stubGlobal('fetch', fetchMock);
    expect((await loadExchangeRatesForCurrencies(['USD'], 'CNY', { cacheHours: 1 })).rates.USD.rate).toBe(7.2);
  });

  it('continues fetching if browser storage cannot be read or written', async () => {
    rstest.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    rstest.stubGlobal('fetch', rstest.fn().mockResolvedValue({ ok: true, json: async () => ({ rate: 7 }) }));
    expect((await loadExchangeRatesForCurrencies(['USD'], 'CNY')).rates.USD.rate).toBe(7);
  });
});
