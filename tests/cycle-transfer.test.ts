import { beforeEach, describe, expect, it, rstest } from '@rstest/core';
import request from '../src/utils/request';
import {
  getCycleTransferStatusLabel, getCycleTransferSummaryByServer,
  loadCycleTransferByServer, loadCycleTransferMap,
} from '../src/utils/cycle-transfer';

rstest.mock('../src/utils/request', () => ({ default: rstest.fn() }));

describe('cycle transfer', () => {
  const send = rstest.mocked(request);
  beforeEach(() => { send.mockReset(); });

  it.each([
    ['fine', '充足'], ['warning', '注意'], ['alert', '告警'], ['over', '超限'],
    ['neutral', '未设置上限'], ['unknown', '未设置上限'],
  ])('labels %s', (level, expected) => {
    expect(getCycleTransferStatusLabel(level)).toBe(expected);
  });

  it('normalizes upper/lowercase fields and prioritizes severe rules before numeric IDs', async () => {
    send.mockResolvedValue({ status: 200, data: { success: true, data: { cycle_transfer_stats: {
      20: { max: 1024, transfer: { 1: 1024, 2: 'invalid' } },
      3: { Max: 1024, Min: 1, Name: 'Limit', Transfer: { 1: 900 }, From: '2026-11-01T00:00:00', To: 'bad date', NextUpdate: { 1: '2026-12-01T00:00:00' } },
      2: { max: 1024, transfer: { 1: 512 } },
      1: { max: 1024, transfer: { 1: 256 } },
      a: { transfer: { 1: 100 } },
      z: { max: 1024, transfer: { 1: 1025 } },
      4: { max: 1024, transfer: { 1: 512 } },
      empty: {},
    } } } } as any);
    const map = await loadCycleTransferMap();
    expect(map[1].map((item) => item.ruleId)).toEqual(['20', 'z', '3', '2', '4', '1', 'a']);
    expect(map[2]).toBeUndefined();
    expect(map[1][2]).toMatchObject({
      ruleName: 'Limit', minDisplay: '1B', maxDisplay: '1KB', currentUsageDisplay: '900B',
      remainingDisplay: '124B', remainingPercent: 12.11, statusLevel: 'alert',
      periodStart: '2026.11.01 00:00:00', periodEnd: 'bad date', nextCheckDisplay: '2026.12.01 00:00:00',
    });
    expect(map[1].at(-1)).toMatchObject({ remainingDisplay: '-', remainingPercent: null, statusLevel: 'neutral', periodStart: '-' });
    expect(getCycleTransferSummaryByServer(map, { ID: 1 })).toMatchObject({
      ruleId: '20', statusLabel: '超限', remainingPercentText: '0.00%',
    });
    expect(getCycleTransferSummaryByServer({ 1: [map[1].at(-1)] }, { ID: 1 })).toMatchObject({ remainingPercentText: '未设置上限' });
  });

  it('formats byte scales, rounds percentages and sorts text IDs consistently', async () => {
    send.mockResolvedValue({ status: 200, data: { success: true, data: { cycle_transfer_stats: {
      beta: { max: 1024 ** 3, transfer: { 5: 12.5 * 1024 ** 2 } },
      alpha: { max: 1024 ** 3, transfer: { 5: 1.25 * 1024 ** 2 } },
      2: { max: 100, transfer: { 5: 80 } },
      3: { max: 100, transfer: { 5: 50 } },
      4: { max: -1, transfer: { 5: -5 } },
    } } } } as any);
    const list = await loadCycleTransferByServer({ ID: 5 });
    expect(list.map((item) => item.statusLevel)).toEqual(['alert', 'warning', 'fine', 'fine', 'neutral']);
    expect(list.find((item) => item.ruleId === 'alpha').currentUsageDisplay).toBe('1.25MB');
    expect(list.find((item) => item.ruleId === 'beta').currentUsageDisplay).toBe('12.5MB');
    expect(list.at(-1)).toMatchObject({ maxDisplay: '0B', currentUsageDisplay: '0B' });
  });

  it('returns empty data for invalid servers, failed responses and missing stats', async () => {
    expect(await loadCycleTransferByServer(null)).toEqual([]);
    expect(send).not.toHaveBeenCalled();
    expect(getCycleTransferSummaryByServer({}, null)).toBeNull();
    expect(getCycleTransferSummaryByServer({}, { ID: 1 })).toBeNull();
    expect(getCycleTransferSummaryByServer({ 1: [] }, { ID: 1 })).toBeNull();
    for (const response of [null, { status: 500 }, { status: 200, data: { success: false } }, { status: 200, data: { success: true } }]) {
      send.mockResolvedValue(response as any);
      expect(await loadCycleTransferMap()).toEqual({});
      expect(await loadCycleTransferByServer({ ID: 1 })).toEqual([]);
    }
    send.mockRejectedValue(new Error('offline'));
    await expect(loadCycleTransferMap()).rejects.toThrow('offline');
  });
});
