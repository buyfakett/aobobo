import { beforeEach, describe, expect, it, rstest } from '@rstest/core';
import i18n from '../src/i18n';
import config from '../src/config';
import billing from '../src/utils/billing';
import request from '../src/utils/request';
import { duration, normalizeTimestamp } from '../src/utils/date';
import { formatDuration } from '../src/utils/online-history';
import { parseBillingCostAmount } from '../src/utils/exchange-rate';
import {
  getCycleTransferRuleName, getCycleTransferSummaryByServer, loadCycleTransferMap,
} from '../src/utils/cycle-transfer';
import { getBillAndPlanByServer } from '../src/composables/server-bill-and-plan';
import { serverSortHandler, serverSortOptions } from '../src/composables/server-sort';

rstest.mock('../src/config', () => ({ default: { aobobo: {} } }));
rstest.mock('../src/utils/request', () => ({ default: rstest.fn() }));

describe('translated server utilities', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    config.aobobo = {};
  });

  it('localizes cycle labels while parsing the original billing data in either language', async () => {
    const cycles = ['2年', '三个月', '1年半', '2half', 12];
    const months = cycles.map(billing.getCycleMonths);
    expect(months).toEqual([24, 3, 18, 12, 12]);
    expect(billing.getCycleLabel('2年')).toBe('year');
    expect(billing.getCycleLabel('一次性购买')).toBe('One-time purchase');
    expect(billing.isOneTimeCycle('一次性购买')).toBe(true);
    expect(parseBillingCostAmount('200 港币/月')).toMatchObject({
      type: 'fixed', value: 200, currency: 'HKD',
    });
    expect(parseBillingCostAmount('按量')).toMatchObject({ type: 'metered' });

    await i18n.changeLanguage('zh-CN');
    expect(cycles.map(billing.getCycleMonths)).toEqual(months);
    expect(billing.getCycleLabel('2年')).toBe('年');
    expect(billing.getCycleLabel('一次性购买')).toBe('一次性购买');
    expect(billing.isOneTimeCycle('一次性购买')).toBe(true);
  });

  it('keeps renewal calculations and plan values stable when switching languages', async () => {
    rstest.useFakeTimers();
    rstest.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    const server = { PublicNote: {
      billingDataMod: { amount: '$100', cycle: '月', endDate: '2025-12-17T12:00:00Z', autoRenewal: true },
      planDataMod: { bandwidth: '1Gbps', trafficVol: '1TB', trafficType: '3' },
    } };

    const english = getBillAndPlanByServer(server);
    expect(english.billing).toMatchObject({ value: '$100', months: 1, cycleLabel: 'month', label: 'per month' });
    expect(english.remainingTime).toEqual({ label: 'Remaining', value: '3d', value2: 3, type: 'autoRenewal-nextTime' });
    expect(english.bandwidth).toEqual({ label: 'Bandwidth', value: '1Gbps' });
    expect(english.traffic).toEqual({ label: 'Max direction traffic', value: '1TB' });

    await i18n.changeLanguage('zh-CN');
    const chinese = getBillAndPlanByServer(server);
    expect(chinese.billing).toMatchObject({ value: english.billing.value, months: english.billing.months, cycleLabel: '月', label: '月付' });
    expect(chinese.remainingTime).toEqual({ label: '剩余', value: '3天', value2: english.remainingTime.value2, type: english.remainingTime.type });
    expect(chinese.bandwidth).toEqual({ label: '带宽', value: english.bandwidth.value });
    expect(chinese.traffic).toEqual({ label: '单向取最大流量', value: english.traffic.value });
  });

  it('translates metered and free labels while preserving configured text', async () => {
    const metered = { PublicNote: { billingDataMod: { amount: -1, cycle: 'month' } } };
    const free = { PublicNote: { billingDataMod: { amount: 0 } } };
    const perpetual = { PublicNote: { billingDataMod: { endDate: '0000-00-00' } } };
    expect(getBillAndPlanByServer(metered).billing).toMatchObject({ value: 'Metered', label: 'per month', months: 1, isFree: false });
    expect(getBillAndPlanByServer(free).billing).toMatchObject({ value: 'Free', isFree: true });
    expect(getBillAndPlanByServer(perpetual).remainingTime).toMatchObject({ value: 'No expiry', type: 'infinity' });
    config.aobobo.freeAmount = '公益';
    config.aobobo.infinityCycle = '永久';
    expect(getBillAndPlanByServer(free).billing.value).toBe('公益');
    expect(getBillAndPlanByServer(perpetual).remainingTime.value).toBe('永久');

    await i18n.changeLanguage('zh-CN');
    expect(getBillAndPlanByServer(metered).billing).toMatchObject({ value: '按量', label: '每月', months: 1, isFree: false });
    expect(getBillAndPlanByServer(free).billing.value).toBe('公益');
    expect(getBillAndPlanByServer(perpetual).remainingTime.value).toBe('永久');
  });

  it('retranslates cached traffic summaries without changing thresholds or custom rule names', async () => {
    rstest.mocked(request).mockResolvedValue({ status: 200, data: { success: true, data: { cycle_transfer_stats: {
      7: { max: 1024, transfer: { 1: 800, 2: 1024 } },
      8: { name: '自定义规则', transfer: { 3: 100 } },
    } } } } as any);
    const map = await loadCycleTransferMap();
    expect(getCycleTransferSummaryByServer(map, { ID: 1 })).toMatchObject({
      ruleName: 'Rule #7', statusLevel: 'warning', statusLabel: 'Warning',
      remainingDisplay: '224B', remainingPercent: 21.88, remainingPercentText: '21.88%',
    });
    expect(getCycleTransferSummaryByServer(map, { ID: 2 })).toMatchObject({ statusLevel: 'over', statusLabel: 'Limit exceeded' });
    expect(getCycleTransferSummaryByServer(map, { ID: 3 })).toMatchObject({ ruleName: '自定义规则', remainingPercentText: 'No limit set' });

    await i18n.changeLanguage('zh-CN');
    expect(getCycleTransferSummaryByServer(map, { ID: 1 })).toMatchObject({
      ruleName: '规则 #7', statusLevel: 'warning', statusLabel: '注意',
      remainingDisplay: '224B', remainingPercent: 21.88, remainingPercentText: '21.88%',
    });
    expect(getCycleTransferSummaryByServer(map, { ID: 2 })).toMatchObject({ statusLevel: 'over', statusLabel: '超限' });
    expect(getCycleTransferRuleName(map[3][0])).toBe('自定义规则');
    expect(rstest.mocked(request)).toHaveBeenCalledTimes(1);
  });

  it('updates duration and sorting labels without changing timestamp or ordering results', async () => {
    const englishOptions = serverSortOptions();
    const result = serverSortHandler({ Name: 'server2' }, { Name: 'Server10' }, 'Name', 'asc');
    expect(duration(0, 3661000)).toBe('1h 1m');
    expect(formatDuration(90060)).toBe('1d 1h 1m');
    expect(englishOptions.find(option => option.value === 'Name').label).toBe('Server name');
    expect(normalizeTimestamp('1710000000')).toBe(1710000000000);

    await i18n.changeLanguage('zh-CN');
    const chineseOptions = serverSortOptions();
    expect(duration(0, 3661000)).toBe('1小时1分钟');
    expect(formatDuration(90060)).toBe('1天 1小时 1分钟');
    expect(chineseOptions.find(option => option.value === 'Name').label).toBe('主机名称');
    expect(chineseOptions.map(option => option.value)).toEqual(englishOptions.map(option => option.value));
    expect(serverSortHandler({ Name: 'server2' }, { Name: 'Server10' }, 'Name', 'asc')).toBe(result);
    expect(normalizeTimestamp('1710000000')).toBe(1710000000000);
  });
});
