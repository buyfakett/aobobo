import { afterEach, describe, expect, it, rstest } from '@rstest/core';
import {
  buildDailyOnlineRows, buildOfflineGroups, formatDuration, formatPeriodMoment,
  groupOnlineRows, panelDay, panelNow, windowDurationSeconds,
} from '../src/utils/online-history';

const tz = 'UTC';
const date = '2026-01-01';
const start = `${date}T00:00:00Z`;
const end = '2026-01-02T00:00:00Z';
const daily = [{ date }];

afterEach(() => { rstest.useRealTimers(); });

describe('panel history time formatting', () => {
  it('interprets unqualified timestamps in panel time and converts qualified timestamps', () => {
    expect(panelDay('2026-01-01 08:00:00', 'Asia/Shanghai').valueOf()).toBe(Date.parse(start));
    expect(panelDay(start, 'Asia/Shanghai').format('HH:mm')).toBe('08:00');
    expect(panelDay('2026-01-01T08:00:00+08:00', tz).format('HH:mm')).toBe('00:00');
    expect(panelDay(null, tz).isValid()).toBe(false);
    expect(panelDay('invalid', undefined).isValid()).toBe(false);
    expect(panelDay('2026-01-01', undefined).isValid()).toBe(true);
  });
  it('reads the current time in panel and local zones', () => {
    rstest.useFakeTimers();
    rstest.setSystemTime(new Date(start));
    expect(panelNow('Asia/Shanghai').format('HH:mm')).toBe('08:00');
    expect(panelNow(undefined).valueOf()).toBe(Date.parse(start));
  });
  it('uses 24:00 for the exact next midnight', () => {
    const anchor = panelDay(date, tz);
    expect(formatPeriodMoment(panelDay(end, tz), anchor, tz)).toBe('24:00');
    expect(formatPeriodMoment(panelDay(end, tz), anchor, tz, true)).toBe('24:00:00');
    expect(formatPeriodMoment(panelDay(`${date}T12:34:56Z`, tz), anchor, tz)).toBe('12:34');
    expect(formatPeriodMoment(panelDay(`${date}T12:34:56Z`, tz), anchor, tz, true)).toBe('12:34:56');
  });
  it.each([
    [null, '0分钟'], ['bad', '0分钟'], [-1, '0分钟'], [59, '0分钟'], [60, '1分钟'],
    [3660, '1小时 1分钟'], [90060, '1天 1小时 1分钟'],
  ])('formats duration %s', (seconds, expected) => expect(formatDuration(seconds)).toBe(expected));
  it('computes nonnegative window durations with timezone awareness', () => {
    expect(windowDurationSeconds(start, end, tz)).toBe(86400);
    expect(windowDurationSeconds(end, start, tz)).toBe(0);
    expect(windowDurationSeconds('2026-03-08', '2026-03-09', 'America/New_York')).toBe(23 * 3600);
    expect(windowDurationSeconds('2026-11-01', '2026-11-02', 'America/New_York')).toBe(25 * 3600);
  });
});

describe('daily online history segments', () => {
  it('splits a cross-midnight interval and retains ongoing only on its final segment', () => {
    const period = { start: '2025-12-31T23:00:00Z', end: '2026-01-02T01:00:00Z', ongoing: true };
    const rows = buildDailyOnlineRows([period], [{ date }, { date: '2026-01-02' }], start, '2026-01-02T03:00:00Z', tz);
    expect(rows[0].online_seconds).toBe(86400);
    expect(rows[0].segments[0]).toMatchObject({ leftPct: 0, widthPct: 100, live: false, period });
    expect(rows[1].online_seconds).toBe(3600);
    expect(rows[1].segments[0].widthPct).toBeCloseTo(100 / 24);
    expect(rows[1].segments[0].live).toBe(true);
  });
  it('clips interval and availability window to the requested range', () => {
    const period = { start, end, ongoing: true };
    const [row] = buildDailyOnlineRows([period], daily, `${date}T06:00:00Z`, `${date}T18:00:00Z`, tz);
    expect(row.online_seconds).toBe(12 * 3600);
    expect(row.window).toMatchObject({ seconds: 12 * 3600, leftPct: 25, rightPct: 75 });
    expect(row.segments[0]).toMatchObject({ leftPct: 25, widthPct: 50, live: false });
    expect(row.segments[0].segStart.valueOf()).toBe(Date.parse(`${date}T06:00:00Z`));
  });
  it('ignores zero-length, reversed, missing and out-of-window periods', () => {
    const periods = [
      { start, end: start }, { start: end, end: start }, {},
      { start: '2025-01-01', end: '2025-01-02' },
      { start: end, end: '2026-01-03T00:00:00Z' },
    ];
    const [row] = buildDailyOnlineRows(periods, daily, start, end, tz);
    expect(row.segments).toEqual([]);
    expect(row.online_seconds).toBe(0);
    expect(buildDailyOnlineRows(null, null, start, end, tz)).toEqual([]);
    expect(buildDailyOnlineRows(null, daily, start, end, tz)[0].segments).toEqual([]);
  });
  it('skips invalid periods when using the local timezone parser', () => {
    const [row] = buildDailyOnlineRows([{ start: 'bad', end: 'bad' }], daily, start, end, undefined);
    expect(row.segments).toEqual([]);
  });
  it('computes full-day percentages by wall clock during daylight-saving transitions', () => {
    const [row] = buildDailyOnlineRows(
      [{ start: '2026-03-08', end: '2026-03-09' }],
      [{ date: '2026-03-08' }], '2026-03-08', '2026-03-09', 'America/New_York',
    );
    expect(row.online_seconds).toBe(23 * 3600);
    expect(row.segments[0]).toMatchObject({ leftPct: 0, widthPct: 100 });
    expect(row.window).toMatchObject({ seconds: 23 * 3600, leftPct: 0, rightPct: 100 });
  });
  it('groups only days with online segments and sorts most recent first', () => {
    const rows = buildDailyOnlineRows(
      [{ start, end: '2026-01-03T00:00:00Z', ongoing: true }],
      [{ date }, { date: '2026-01-03' }, { date: '2026-01-02' }], start, '2026-01-04T00:00:00Z', tz,
    );
    const groups = groupOnlineRows(rows, tz);
    expect(groups.map((group) => group.date)).toEqual(['2026-01-02', date]);
    expect(groups[0].total).toBe(86400);
    expect(groups[0].chips[0].ongoing).toBe(true);
    expect(groups[0].chips[0].original).toBe(rows[2].segments[0].period);
    expect(groupOnlineRows(null, tz)).toEqual([]);
  });
});

describe('offline history gaps', () => {
  it('returns a full-day gap when no online periods exist', () => {
    const groups = buildOfflineGroups([], daily, start, end, false, tz);
    expect(groups).toHaveLength(1);
    expect(groups[0].total).toBe(86400);
    expect(groups[0].chips[0].ongoing).toBe(true);
  });
  it('does not mark past offline gaps ongoing when currently online', () => {
    const groups = buildOfflineGroups([], daily, start, end, true, tz);
    expect(groups[0].chips[0].ongoing).toBe(false);
  });
  it('merges overlaps before subtracting online time', () => {
    const periods = [
      { start: `${date}T04:00:00Z`, end: `${date}T08:00:00Z` },
      { start: `${date}T02:00:00Z`, end: `${date}T06:00:00Z` },
      { start: `${date}T03:00:00Z`, end: `${date}T05:00:00Z`, ongoing: true },
      { start: `${date}T08:00:00Z`, end: `${date}T09:00:00Z` },
    ];
    const [group] = buildOfflineGroups(periods, daily, start, end, false, tz);
    expect(group.chips).toHaveLength(2);
    expect(group.total).toBe(17 * 3600);
    expect(group.chips.map((chip) => [chip.start.format('HH:mm'), chip.end.format('HH:mm'), chip.ongoing])).toEqual([
      ['00:00', '02:00', false], ['09:00', '00:00', true],
    ]);
  });
  it('ignores outside and invalid intervals and clamps to the requested window', () => {
    const periods = [
      { start: '2025-12-01', end: '2025-12-02' },
      { start: '2026-02-01', end: '2026-02-02' },
      { start, end: start },
      { start: null, end },
      { start: `${date}T05:00:00Z`, end: `${date}T07:00:00Z` },
    ];
    const [group] = buildOfflineGroups(periods, daily, `${date}T06:00:00Z`, `${date}T18:00:00Z`, false, tz);
    expect(group.total).toBe(11 * 3600);
    expect(group.chips).toHaveLength(1);
    expect(group.chips[0].start.format('HH:mm')).toBe('07:00');
  });
  it('returns no gaps when fully covered, outside the window, or no daily rows exist', () => {
    expect(buildOfflineGroups([{ start: '2025-12-31', end: '2026-01-03' }], daily, start, end, true, tz)).toEqual([]);
    expect(buildOfflineGroups([], [{ date: '2025-12-01' }], start, end, false, tz)).toEqual([]);
    expect(buildOfflineGroups(null, null, start, end, false, tz)).toEqual([]);
  });
  it('orders days descending and only marks the latest gap ongoing', () => {
    const groups = buildOfflineGroups([], [{ date }, { date: '2026-01-02' }], start, '2026-01-02T01:00:00Z', false, tz);
    expect(groups.map((group) => group.date)).toEqual(['2026-01-02', date]);
    expect(groups[0].chips[0].ongoing).toBe(true);
    expect(groups[1].chips[0].ongoing).toBe(false);
  });
});
