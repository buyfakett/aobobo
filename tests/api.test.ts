import { beforeEach, describe, expect, it, rstest } from '@rstest/core';
import config from '../src/config';
import request from '../src/utils/request';
import {
  isOnlineHistorySupported, loadAvailability, loadProfile, loadServerGroup,
  loadServerOnlineHistory, loadSetting,
} from '../src/utils/api';

rstest.mock('../src/utils/request', () => ({ default: rstest.fn() }));

describe('API adapters', () => {
  const send = rstest.mocked(request);
  beforeEach(() => {
    send.mockReset();
    rstest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('accepts availability arrays with legacy ID and percentage aliases', async () => {
    send.mockResolvedValue({ data: { data: [
      { server_id: 1, availability_percent: '99.9' },
      { id: 2, availability: 0 },
      { serverId: 3, availability: 100 },
      { availability: 98 }, { id: 4, availability: null }, { id: 5, availability: 'bad' },
    ] } } as any);
    expect(await loadAvailability()).toEqual({ 1: 99.9, 2: 0, 3: 100 });
    expect(send).toHaveBeenCalledWith({ url: config.aobobo.apiAvailabilityPath, method: 'GET' });
  });

  it('handles map and result response envelopes while ignoring invalid entries', async () => {
    send.mockResolvedValue({ data: { result: { 1: '99', 2: null, 3: 'invalid', hidden: 1 } } } as any);
    expect(await loadAvailability()).toEqual({ 1: 99, hidden: 1 });
    for (const payload of [null, 0, 'bad', {}, []]) {
      send.mockResolvedValue({ data: payload } as any);
      expect(await loadAvailability()).toBeNull();
    }
    send.mockRejectedValue(new Error('offline'));
    expect(await loadAvailability()).toBeNull();
  });

  it('maps successful groups and uses the legacy path fallback', async () => {
    const path = config.aobobo.v1GroupPath;
    try {
      config.aobobo.v1GroupPath = '';
      config.aobobo.v1ApiGroupPath = '/legacy/groups';
      send.mockResolvedValue({ status: 200, data: { success: true, data: [
        { id: 1, group: { name: 'Asia' }, servers: [1, 2] },
      ] } } as any);
      expect(await loadServerGroup()).toEqual([
        { id: 1, group: { name: 'Asia' }, servers: [1, 2], name: 'Asia', count: 2 },
      ]);
      expect(send).toHaveBeenLastCalledWith({ url: '/legacy/groups', method: 'GET' });
      send.mockResolvedValue({ status: 200, data: { success: true } } as any);
      expect(await loadServerGroup()).toEqual([]);
    } finally {
      config.aobobo.v1GroupPath = path;
      delete config.aobobo.v1ApiGroupPath;
    }
  });

  it('loads settings and profiles, including the authentication status check', async () => {
    send.mockResolvedValue({ status: 200, data: { success: true, data: { name: 'demo' } } } as any);
    expect(await loadSetting()).toEqual({ name: 'demo' });
    expect(await loadProfile()).toEqual({ name: 'demo' });
    expect(await loadProfile(true)).toBe(true);
    send.mockResolvedValue({ status: 200, data: { success: false } } as any);
    expect(await loadProfile(true)).toBe(true);
    expect(await loadProfile()).toBeNull();
    expect(await loadSetting()).toBeNull();
    send.mockResolvedValue({ status: 200, data: { success: true } } as any);
    expect(await loadSetting()).toEqual({});
    expect(await loadProfile()).toEqual({});
    send.mockResolvedValue({ status: 401, data: {} } as any);
    expect(await loadProfile(true)).toBe(false);
  });

  it.each([loadServerGroup, loadSetting, loadProfile])('returns null on unsuccessful or rejected requests', async (load) => {
    send.mockResolvedValue({ status: 500, data: {} } as any);
    expect(await load()).toBeNull();
    send.mockRejectedValue(new Error('offline'));
    expect(await load()).toBeNull();
  });

  it('builds online history URLs with existing query strings and validates data', async () => {
    expect(isOnlineHistorySupported()).toBe(true);
    const path = config.aobobo.v1ApiOnlineHistoryPath;
    try {
      config.aobobo.v1ApiOnlineHistoryPath = '/history/{id}?kind=online';
      send.mockResolvedValue({ data: { result: { periods: [] } } } as any);
      expect(await loadServerOnlineHistory(7, 30)).toEqual({ periods: [] });
      expect(send).toHaveBeenLastCalledWith({ url: '/history/7?kind=online&days=30', method: 'GET' });
      config.aobobo.v1ApiOnlineHistoryPath = '';
      send.mockResolvedValue({ data: 'bad' } as any);
      await expect(loadServerOnlineHistory('x', 1)).rejects.toThrow('在线历史数据格式无效');
      expect(send).toHaveBeenLastCalledWith({ url: '/api/v1/server/x/online-history?days=1', method: 'GET' });
      send.mockRejectedValue(new Error('offline'));
      await expect(loadServerOnlineHistory(1, 1)).rejects.toThrow('offline');
    } finally {
      config.aobobo.v1ApiOnlineHistoryPath = path;
    }
  });
});
