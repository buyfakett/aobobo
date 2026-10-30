import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const DAY_SECONDS = 86400;

export function panelDay(value, tz) {
  if (!value) {
    return dayjs(NaN);
  }
  if (tz) {
    return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
      ? dayjs(value).tz(tz)
      : dayjs.tz(value, tz);
  }
  return dayjs(value);
}

export function panelNow(tz) {
  return tz ? dayjs().tz(tz) : dayjs();
}

function nextDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

export function panelNextDayStart(date, tz) {
  return panelDay(nextDate(date), tz);
}

export function formatPeriodMoment(value, anchor, tz, withSeconds = false) {
  const dayEnd = panelNextDayStart(anchor.format('YYYY-MM-DD'), tz);
  if (value.valueOf() === dayEnd.valueOf()) {
    return withSeconds ? '24:00:00' : '24:00';
  }
  return value.format(withSeconds ? 'HH:mm:ss' : 'HH:mm');
}

export function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(safeSeconds / DAY_SECONDS);
  const hours = Math.floor((safeSeconds % DAY_SECONDS) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (days > 0) {
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  }
  if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

function wallClockPercent(value) {
  const seconds = (
    value.hour() * 3600
    + value.minute() * 60
    + value.second()
    + value.millisecond() / 1000
  );
  return (seconds / DAY_SECONDS) * 100;
}

export function buildDayWindow(date, windowStart, windowEnd, tz) {
  const dayStart = panelDay(date, tz);
  const dayEnd = panelNextDayStart(date, tz);
  const start = panelDay(windowStart, tz);
  const end = panelDay(windowEnd, tz);
  const effectiveStart = start.valueOf() > dayStart.valueOf() ? start : dayStart;
  const effectiveEnd = end.valueOf() < dayEnd.valueOf() ? end : dayEnd;
  const percent = (value) => {
    if (value.valueOf() <= dayStart.valueOf()) {
      return 0;
    }
    if (value.valueOf() >= dayEnd.valueOf()) {
      return 100;
    }
    return wallClockPercent(value);
  };
  return {
    dayStart,
    dayEnd,
    start: effectiveStart,
    end: effectiveEnd,
    seconds: Math.max(0, effectiveEnd.diff(effectiveStart, 'second')),
    leftPct: percent(effectiveStart),
    rightPct: percent(effectiveEnd),
  };
}

function preparePeriods(periods, tz, windowStart, windowEnd) {
  if (!Array.isArray(periods)) {
    return [];
  }
  const lower = windowStart ? panelDay(windowStart, tz) : null;
  const upper = windowEnd ? panelDay(windowEnd, tz) : null;
  return periods.flatMap((period) => {
    const originalStart = panelDay(period?.start, tz);
    const originalEnd = panelDay(period?.end, tz);
    const start = lower && lower.valueOf() > originalStart.valueOf()
      ? lower
      : originalStart;
    const end = upper && upper.valueOf() < originalEnd.valueOf()
      ? upper
      : originalEnd;
    return start.isValid() && end.isValid() && end.valueOf() > start.valueOf()
      ? [{
        period,
        start,
        end,
        live: !!period.ongoing && end.valueOf() === originalEnd.valueOf(),
      }]
      : [];
  });
}

function buildParsedDaySegments(periods, dayStart, dayEnd) {
  const lower = dayStart.valueOf();
  const upper = dayEnd.valueOf();
  return periods.flatMap(({
    period,
    start,
    end,
    live,
  }) => {
    if (end.valueOf() <= lower || start.valueOf() >= upper) {
      return [];
    }
    const segStart = start.valueOf() > lower ? start : dayStart;
    const segEnd = end.valueOf() < upper ? end : dayEnd;
    const leftPct = segStart.valueOf() === lower ? 0 : wallClockPercent(segStart);
    const rightPct = segEnd.valueOf() === upper ? 100 : wallClockPercent(segEnd);
    const widthPct = Math.max(0, Math.min(rightPct - leftPct, 100 - leftPct));
    return widthPct > 0
      ? [{
        period,
        segStart,
        segEnd,
        leftPct,
        widthPct,
        live: live && segEnd.valueOf() === end.valueOf(),
      }]
      : [];
  });
}

export function buildDailyOnlineRows(periods, daily, windowStart, windowEnd, tz) {
  const prepared = preparePeriods(periods, tz, windowStart, windowEnd);
  return (Array.isArray(daily) ? daily : []).map((day) => {
    const window = buildDayWindow(day.date, windowStart, windowEnd, tz);
    const segments = buildParsedDaySegments(
      prepared,
      window.dayStart,
      window.dayEnd,
    );
    return {
      ...day,
      segments,
      window,
      online_seconds: segments.reduce(
        (sum, segment) => sum + segment.segEnd.diff(segment.segStart, 'second'),
        0,
      ),
    };
  });
}

export function groupOnlineRows(rows, tz) {
  return (rows || [])
    .filter((row) => row.segments.length > 0)
    .map((row) => ({
      date: row.date,
      day: panelDay(row.date, tz),
      chips: row.segments.map((segment) => ({
        start: segment.segStart,
        end: segment.segEnd,
        ongoing: segment.live,
        original: segment.period,
      })),
      total: row.segments.reduce(
        (sum, segment) => sum + segment.segEnd.diff(segment.segStart, 'second'),
        0,
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function mergePeriods(periods, tz) {
  const sorted = (periods || [])
    .map((period) => ({
      start: panelDay(period.start, tz),
      end: panelDay(period.end, tz),
      ongoing: period.ongoing,
    }))
    .filter((period) => (
      period.start.isValid()
      && period.end.isValid()
      && period.end.valueOf() > period.start.valueOf()
    ))
    .sort((a, b) => a.start.valueOf() - b.start.valueOf());
  const merged = [];
  sorted.forEach((period) => {
    const last = merged[merged.length - 1];
    if (last && period.start.valueOf() < last.end.valueOf()) {
      if (period.end.valueOf() > last.end.valueOf()) {
        last.end = period.end;
      }
      last.ongoing = last.ongoing || period.ongoing;
      return;
    }
    merged.push({ ...period });
  });
  return merged;
}

export function buildOfflineGroups(
  periods,
  daily,
  windowStart,
  windowEnd,
  currentlyOnline,
  tz,
) {
  const merged = mergePeriods(periods, tz);
  const windowStartTime = panelDay(windowStart, tz);
  const windowEndTime = panelDay(windowEnd, tz);
  const groups = (Array.isArray(daily) ? daily : [])
    .map((day) => day.date)
    .sort((a, b) => b.localeCompare(a))
    .flatMap((date) => {
      const dayStart = panelDay(date, tz);
      const dayEnd = panelNextDayStart(date, tz);
      const effectiveStart = dayStart.valueOf() > windowStartTime.valueOf()
        ? dayStart
        : windowStartTime;
      const effectiveEnd = dayEnd.valueOf() < windowEndTime.valueOf()
        ? dayEnd
        : windowEndTime;
      if (effectiveEnd.valueOf() <= effectiveStart.valueOf()) {
        return [];
      }
      const chips = [];
      let cursor = effectiveStart;
      merged.forEach((segment) => {
        if (segment.end.valueOf() <= effectiveStart.valueOf()) {
          return;
        }
        if (segment.start.valueOf() >= effectiveEnd.valueOf()) {
          return;
        }
        const segStart = segment.start.valueOf() > cursor.valueOf()
          ? segment.start
          : cursor;
        if (segStart.valueOf() > cursor.valueOf()) {
          chips.push({ start: cursor, end: segStart, ongoing: false });
        }
        const segEnd = segment.end.valueOf() < effectiveEnd.valueOf()
          ? segment.end
          : effectiveEnd;
        if (segEnd.valueOf() > cursor.valueOf()) {
          cursor = segEnd;
        }
      });
      if (cursor.valueOf() < effectiveEnd.valueOf()) {
        chips.push({ start: cursor, end: effectiveEnd, ongoing: false });
      }
      return [{
        date,
        day: dayStart,
        total: chips.reduce(
          (sum, chip) => sum + chip.end.diff(chip.start, 'second'),
          0,
        ),
        chips,
      }];
    })
    .filter((group) => group.chips.length > 0);
  if (!currentlyOnline && groups.length > 0) {
    const newestChips = groups[0].chips;
    const last = newestChips[newestChips.length - 1];
    if (last?.end.isSame(windowEndTime)) {
      last.ongoing = true;
    }
  }
  return groups;
}

export function windowDurationSeconds(windowStart, windowEnd, tz) {
  return Math.max(
    0,
    panelDay(windowEnd, tz).diff(panelDay(windowStart, tz), 'second'),
  );
}
