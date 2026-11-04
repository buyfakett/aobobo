import { describe, expect, it } from '@rstest/core';
import { compareServerOnlineStatus, defaultServerSortConfig, serverSortHandler, serverSortOptions } from '../src/composables/server-sort';

describe('server sorting', () => {
  it('offers unique fields and fresh default configuration', () => {
    const options = serverSortOptions();
    expect(options).toHaveLength(22);
    expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
    const config = defaultServerSortConfig();
    expect(config).toEqual({ prop: 'DisplayIndex', order: 'desc' });
    config.prop = 'Name';
    expect(defaultServerSortConfig().prop).toBe('DisplayIndex');
  });
  it('puts online servers first and keeps equal statuses stable', () => {
    expect(compareServerOnlineStatus({ online: 1 }, { online: -1 })).toBeLessThan(0);
    expect(compareServerOnlineStatus({ online: -1 }, { online: 1 })).toBeGreaterThan(0);
    expect(compareServerOnlineStatus({}, { online: -1 })).toBe(0);
  });
  it('sorts numeric properties in either direction, including numeric strings', () => {
    expect(serverSortHandler({ DisplayIndex: '10' }, { DisplayIndex: 2 }, 'DisplayIndex', 'asc')).toBeGreaterThan(0);
    expect(serverSortHandler({ DisplayIndex: 10 }, { DisplayIndex: 2 }, 'DisplayIndex', 'desc')).toBeLessThan(0);
    expect(serverSortHandler({ DisplayIndex: 2 }, { DisplayIndex: 2 }, 'DisplayIndex', 'asc')).toBe(0);
  });
  it('uses natural, case-insensitive text sorting', () => {
    expect(serverSortHandler({ Name: 'server2' }, { Name: 'Server10' }, 'Name', 'asc')).toBeLessThan(0);
    expect(serverSortHandler({ Name: 'A' }, { Name: 'a' }, 'Name', 'asc')).toBe(0);
    expect(serverSortHandler({ Host: { CountryCode: 'US' } }, { Host: { CountryCode: 'CN' } }, 'Host.CountryCode', 'desc')).toBeLessThan(0);
  });
  it.each(['asc', 'desc'])('keeps missing values last for %s sorting', (order) => {
    expect(serverSortHandler({}, { Name: 'a' }, 'Name', order)).toBeGreaterThan(0);
    expect(serverSortHandler({ Name: 'a' }, { Name: '' }, 'Name', order)).toBeLessThan(0);
    expect(serverSortHandler({}, {}, 'Name', order)).toBe(0);
  });
  it('sorts boot timestamps by elapsed uptime', () => {
    expect(serverSortHandler({ Host: { BootTime: 1 } }, { Host: { BootTime: 2 } }, 'Host.BootTime', 'asc')).toBeGreaterThan(0);
    expect(serverSortHandler({ Host: { BootTime: 'bad' } }, { Host: { BootTime: 2 } }, 'Host.BootTime', 'asc')).toBeGreaterThan(0);
  });
  it.each([
    ['$.TotalTransfer', { NetInTransfer: 10, NetOutTransfer: '20' }, { NetInTransfer: 10, NetOutTransfer: 10 }],
    ['$.TotalConnCount', { TcpConnCount: 10, UdpConnCount: 20 }, { TcpConnCount: 1, UdpConnCount: 2 }],
  ])('sorts computed field %s', (field, first, second) => {
    expect(serverSortHandler({ State: first }, { State: second }, field, 'asc')).toBeGreaterThan(0);
    expect(serverSortHandler({ State: { ...first, NetInTransfer: 'bad', TcpConnCount: 'bad' } }, { State: second }, field, 'asc')).toBeGreaterThan(0);
  });
  it.each([
    ['8 Virtual Core', '4 Physical Core'],
    [['4 Virtual Core', '4 Physics Core'], ['2 Virtual Core']],
    [8, 4],
  ])('sorts CPU core counts from strings, arrays and numeric values', (first, second) => {
    expect(serverSortHandler({ Host: { CPU: first } }, { Host: { CPU: second } }, '$.CPU', 'asc')).toBeGreaterThan(0);
  });
  it('keeps absent CPU counts and unknown fields stable or last', () => {
    expect(serverSortHandler({ Host: { CPU: ['unknown'] } }, { Host: { CPU: 2 } }, '$.CPU', 'asc')).toBeGreaterThan(0);
    expect(serverSortHandler({ Host: { CPU: 'unknown' } }, { Host: { CPU: 2 } }, '$.CPU', 'asc')).toBeGreaterThan(0);
    expect(serverSortHandler({}, {}, '$.unknown', 'asc')).toBe(0);
    expect(serverSortHandler({}, {}, '', 'asc')).toBe(0);
  });
});
