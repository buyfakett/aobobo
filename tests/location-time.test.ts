import { describe, expect, it } from '@rstest/core';
import { formatLocationLocalTime, resolveLocationTimeZone } from '../src/utils/location-time';

describe('location time zones', () => {
  it.each([
    [{ code: 'PEK' }, 'Asia/Shanghai'], [{ code: 'NYC' }, 'America/New_York'],
    [{ code: 'PHX' }, 'America/Phoenix'], [{ code: 'SYD' }, 'Australia/Sydney'],
    [{ code: 'unknown', codes: ['bad', 'TYO'], aliasCode: 'SIN' }, 'Asia/Tokyo'],
    [{ aliasCode: 'HKG' }, 'Asia/Hong_Kong'], [{ country: '德国' }, 'Europe/Berlin'],
    [{ code: 'bad', country: '日本' }, 'Asia/Tokyo'], [{ codes: 'TYO', country: '美国' }, 'America/Los_Angeles'],
    [{}, ''], [undefined, ''], [{ country: 'unknown' }, ''],
  ])('resolves a known location or country', (location, expected) => {
    expect(resolveLocationTimeZone(location)).toBe(expected);
  });
  it('formats a timestamp in each location rather than the host timezone', () => {
    const timestamp = Date.parse('2026-01-01T00:00:00Z');
    expect(formatLocationLocalTime({ code: 'PEK' }, timestamp)).toBe('1.1 08:00');
    expect(formatLocationLocalTime({ code: 'NYC' }, timestamp)).toBe('12.31 19:00');
    expect(formatLocationLocalTime({ code: 'NYC' }, Date.parse('2026-07-01T00:00:00Z'))).toBe('6.30 20:00');
  });
  it('reuses the formatter and returns empty output for unknown or invalid times', () => {
    expect(formatLocationLocalTime({ code: 'PEK' }, Date.parse('2026-01-02T01:02:00Z'))).toBe('1.2 09:02');
    expect(formatLocationLocalTime({ code: 'unknown' }, 0)).toBe('');
    expect(formatLocationLocalTime({ code: 'PEK' }, NaN)).toBe('');
  });
});
