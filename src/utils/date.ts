import dayjs from 'dayjs';
import { t } from '@/i18n';

export function normalizeTimestamp(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;

  const numericValue = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN);
  if (Number.isFinite(numericValue)) {
    return Math.abs(numericValue) < 1e12 ? numericValue * 1000 : numericValue;
  }

  const parsedValue = dayjs(value).valueOf();
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export const duration = (startDate, endDate, noSub = false) => {
  const startTime = dayjs(startDate).valueOf();
  const endTime = dayjs(endDate).valueOf();
  const diff = endTime - startTime;

  if (diff < 0) return t('刚刚启动');

  const second = 1000;
  const minute = second * 60;
  const hour = minute * 60;
  const day = hour * 24;

  if (diff < minute) return t('{{seconds}}秒', { seconds: Math.floor(diff / second) });
  if (diff < hour) {
    if (noSub) return t('{{minutes}}分钟', { minutes: Math.floor(diff / minute) });
    return t('{{minutes}}分钟{{seconds}}秒', { minutes: Math.floor(diff / minute), seconds: Math.floor((diff % minute) / second) });
  }
  if (diff < day) {
    if (noSub) return t('{{hours}}小时', { hours: Math.floor(diff / hour) });
    return t('{{hours}}小时{{minutes}}分钟', { hours: Math.floor(diff / hour), minutes: Math.floor((diff % hour) / minute) });
  }
  return t('{{days}}天', { days: Math.floor(diff / day) });
};

export function getNextCycleTime(startDate, months, specifiedDate) {
  const start = dayjs(startDate);
  const checkDate = dayjs(specifiedDate);

  if (!start.isValid() || months <= 0) {
    throw new Error(t('参数无效：请检查起始日期、周期月份数和指定日期。'));
  }

  let nextDate = start;
  let whileStatus = true;
  while (whileStatus) {
    nextDate = nextDate.add(months, 'month');
    whileStatus = nextDate.valueOf() <= checkDate.valueOf();
  }

  return nextDate.valueOf();
}
