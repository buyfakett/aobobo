import { describe, expect, it } from '@rstest/core';
import billing from '../src/utils/billing';

describe('billing cycles', () => {
  it.each([
    [null, 1], [undefined, 1], ['', 1], ['unknown', 1], [0, 1], [-2, 1],
    [1, 1], [3, 3], ['36', 36], [1.5, 1.5],
    ['月', 1], ['m', 1], ['mo', 1], ['month', 1], ['monthly', 1],
    ['年', 12], ['Y', 12], ['yr', 12], ['year', 12], ['annual', 12],
    ['季', 3], ['quarterly', 3], ['半', 6], ['半年', 6], ['h', 6], ['half', 6], ['semi-annually', 6],
    ['2年', 24], ['3Y', 36], ['1.5yr', 18], ['10years', 120], ['1年半付', 18],
    ['2季付', 6], ['2quarterly', 6], ['2半年', 12], ['2half', 12],
    ['2个月', 2], ['2mo', 2], ['2monthly付', 2], ['1.5月', 2],
    ['三年', 36], ['两年', 24], ['十年', 120], ['一年半', 18], ['十二个月', 12],
    ['二百三十四月', 234], ['一千二百月', 1200], ['一万月', 10000],
  ])('converts %s to %s months', (cycle, months) => {
    expect(billing.getCycleMonths(cycle)).toBe(months);
  });

  it.each(['一次性', '一次性付费', '一次性付款', '一次性购买', '买断', 'onetime', 'ONE-TIME', ' one time '])(
    'recognizes one-time cycle %s', (cycle) => {
      expect(billing.isOneTimeCycle(cycle)).toBe(true);
      expect(billing.getCycleLabel(cycle)).toBe(cycle.trim());
    },
  );

  it.each([null, undefined, '', 'month', 12])('does not classify %s as one-time', (cycle) => {
    expect(billing.isOneTimeCycle(cycle)).toBe(false);
  });

  it.each([
    [null, ''], ['', ''], ['monthly', '月'], ['annual', '年'], ['quarterly', '季'], ['semi-annually', '半年'],
    [1, '月'], [3, '季'], [6, '半年'], [12, '年'], [36, '36'],
    ['2年', '年'], ['1年半', '年'], ['2季', '季'], ['2半年', '半年'], ['2个月', '月'],
    ['两年', '年'], ['三个月', '月'], ['custom cycle', 'custom cycle'],
  ])('formats cycle label %s', (cycle, label) => {
    expect(billing.getCycleLabel(cycle)).toBe(label);
  });

  it.each([true, 1, '1', 'TRUE', ' yes ', 'on', 'enabled'])('enables renewal for %s', (value) => {
    expect(billing.isAutoRenewalEnabled(value)).toBe(true);
  });

  it.each([false, 0, null, undefined, '', 'false', 'off', 2, 'random'])('disables renewal for %s', (value) => {
    expect(billing.isAutoRenewalEnabled(value)).toBe(false);
  });

  it.each([
    ['0000-00-00', true], [' 0000-00-00T00:00:00Z ', true],
    ['2026-01-01', false], [null, false], [undefined, false], ['', false],
  ])('recognizes infinity date %s', (value, expected) => {
    expect(billing.isInfinityEndDate(value)).toBe(expected);
  });
});
