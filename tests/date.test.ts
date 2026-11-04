import { describe, expect, it } from '@rstest/core';
import dayjs from 'dayjs';
import { duration, getNextCycleTime, normalizeTimestamp } from '../src/utils/date';

describe('timestamps', () => {
  it.each([
    [null, 7], [undefined, 7], ['', 7], ['invalid', 7], [Number.NaN, 7],
    [1710000000, 1710000000000], ['1710000000', 1710000000000],
    [1710000000000, 1710000000000], ['1710000000000', 1710000000000],
    [0, 0], [-1, -1000],
    ['2026-01-02T03:04:05Z', Date.parse('2026-01-02T03:04:05Z')],
  ])('normalizes %s with an explicit fallback', (value, expected) => {
    expect(normalizeTimestamp(value, 7)).toBe(expected);
  });
  it('defaults missing values to zero', () => expect(normalizeTimestamp(null)).toBe(0));
});

describe('duration', () => {
  it.each([
    [-1, false, '刚刚启动'], [0, false, '0秒'], [59999, false, '59秒'],
    [61000, false, '1分钟1秒'], [3599000, false, '59分钟59秒'],
    [3661000, false, '1小时1分钟'], [86400000, false, '1天'],
    [61000, true, '1分钟'], [3661000, true, '1小时'], [172800000, true, '2天'],
  ])('formats %s milliseconds', (milliseconds, noSub, expected) => {
    expect(duration(0, milliseconds, noSub)).toBe(expected);
  });
});

describe('recurring dates', () => {
  it('moves to the first cycle strictly after the specified date', () => {
    expect(getNextCycleTime('2026-01-15', 1, '2026-03-15')).toBe(dayjs('2026-04-15').valueOf());
  });
  it('moves at least one cycle even before the start date', () => {
    expect(getNextCycleTime('2026-01-15', 3, '2025-01-01')).toBe(dayjs('2026-04-15').valueOf());
  });
  it('handles end-of-month rollover and leap years', () => {
    expect(getNextCycleTime('2024-01-31', 1, '2024-02-01')).toBe(dayjs('2024-02-29').valueOf());
  });
  it.each([['invalid', 1], ['2026-01-01', 0], ['2026-01-01', -1]])(
    'rejects an invalid start date or nonpositive cycle', (start, months) => {
      expect(() => getNextCycleTime(start, months, '2026-01-01')).toThrow('参数无效');
    },
  );
});
