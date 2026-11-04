import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core';

rstest.mock('@/config', () => ({ default: { aobobo: {} } }));

import config from '../src/config';
import { getBillAndPlanByServer } from '../src/composables/server-bill-and-plan';

describe('server billing and plan presentation', () => {
  beforeEach(() => {
    rstest.useFakeTimers();
    rstest.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    config.aobobo = {};
  });
  afterEach(() => { rstest.useRealTimers(); });

  it.each([undefined, {}, { PublicNote: {} }])('returns empty sections without billing or plan data', (server) => {
    expect(getBillAndPlanByServer(server)).toEqual({ billing: null, remainingTime: null, bandwidth: null, traffic: null });
  });

  it('formats fixed pricing and named billing cycles', () => {
    expect(getBillAndPlanByServer({ PublicNote: { billingDataMod: { amount: '$100', cycle: '2年' } } }).billing).toEqual({
      label: '年付', value: '$100', cycleLabel: '年', months: 24, isFree: false,
    });
  });

  it('supports metered pricing, absent cycles and free pricing labels', () => {
    expect(getBillAndPlanByServer({ PublicNote: { billingDataMod: { amount: -1, cycle: 'month' } } }).billing).toMatchObject({ label: '每月', value: '按量' });
    expect(getBillAndPlanByServer({ PublicNote: { billingDataMod: { amount: -1 } } }).billing).toMatchObject({ label: '', months: 1 });
    expect(getBillAndPlanByServer({ PublicNote: { billingDataMod: { amount: 9 } } }).billing).toMatchObject({ label: '', value: 9 });
    expect(getBillAndPlanByServer({ PublicNote: { billingDataMod: { amount: 0 } } }).billing).toMatchObject({ value: '免费', isFree: true });
    config.aobobo.freeAmount = '公益';
    expect(getBillAndPlanByServer({ PublicNote: { billingDataMod: { amount: '0' } } }).billing.value).toBe('公益');
  });

  it('formats perpetual end dates with configurable labels', () => {
    const server = { PublicNote: { billingDataMod: { endDate: '0000-00-00' } } };
    expect(getBillAndPlanByServer(server).remainingTime).toEqual({ label: '剩余', value: '长期有效', type: 'infinity' });
    config.aobobo.infinityCycle = '永久';
    expect(getBillAndPlanByServer(server).remainingTime.value).toBe('永久');
  });

  it.each([
    [false, 'endTime'], [true, 'autoRenewal-endTime'], ['enabled', 'autoRenewal-endTime'],
  ])('shows future expiry dates for renewal setting %s', (autoRenewal, type) => {
    expect(getBillAndPlanByServer({ PublicNote: { billingDataMod: { endDate: '2026-01-17T12:00:00Z', autoRenewal } } }).remainingTime).toEqual({
      label: '剩余', value: '3天', value2: 3, type,
    });
  });

  it('advances expired recurring subscriptions to their next renewal', () => {
    expect(getBillAndPlanByServer({ PublicNote: { billingDataMod: { endDate: '2025-12-17T12:00:00Z', autoRenewal: true, cycle: '月' } } }).remainingTime).toEqual({
      label: '剩余', value: '3天', value2: 3, type: 'autoRenewal-nextTime',
    });
  });

  it.each(['2026-01-14T12:00:00Z', '2026-01-15T12:00:00Z', 'invalid'])('marks unpaid or invalid dates as expired', (endDate) => {
    expect(getBillAndPlanByServer({ PublicNote: { billingDataMod: { endDate } } }).remainingTime).toEqual({ label: '剩余', value: '已过期', type: 'expired' });
  });

  it.each([['1', '单向出'], ['3', '单向取最大'], ['2', '双向'], [undefined, '双向']])(
    'formats bandwidth and traffic mode %s', (trafficType, label) => {
      const plan = getBillAndPlanByServer({ PublicNote: { planDataMod: { bandwidth: '1Gbps', trafficVol: '1TB', trafficType } } });
      expect(plan.bandwidth).toEqual({ label: '带宽', value: '1Gbps' });
      expect(plan.traffic).toEqual({ label: `${label}流量`, value: '1TB' });
    },
  );

  it('hides empty plan fields', () => {
    expect(getBillAndPlanByServer({ PublicNote: { planDataMod: { bandwidth: '', trafficVol: '' } } })).toEqual({ billing: null, remainingTime: null, bandwidth: null, traffic: null });
  });
});
