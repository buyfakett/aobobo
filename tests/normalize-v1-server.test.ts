import { beforeEach, describe, expect, it, rstest } from '@rstest/core';

rstest.mock('@/store', () => ({ default: { state: { serverGroup: [] } } }));

import store from '../src/store';
import normalizeServer from '../src/utils/normalize-v1-server';

describe('v1 server normalization', () => {
  beforeEach(() => { store.state.serverGroup = []; });

  it('maps nested fields and resolves the first matching server group', () => {
    store.state.serverGroup = [{ name: 'ignored' }, { name: 'Asia', servers: [7] }, { name: 'second', servers: [7] }];
    const input = {
      id: 7, name: 'test-server', display_index: 2, last_active: '2026-01-01', country_code: 'CN',
      host: { platform: 'linux', platform_version: '6.1', cpu: ['AMD EPYC'], mem_total: 10, disk_total: 20, swap_total: 30, arch: 'amd64', virtualization: 'kvm', boot_time: 100, version: '1.2', gpu: ['GPU'] },
      state: { cpu: 5, mem_used: 1, swap_used: 2, disk_used: 3, net_in_transfer: 4, net_out_transfer: 5, net_in_speed: 6, net_out_speed: 7, uptime: 8, load_1: 0.1, load_5: 0.2, load_15: 0.3, tcp_conn_count: 9, udp_conn_count: 10, process_count: 11, temperatures: [20], gpu: [30] },
      public_note: '{"billingDataMod":{"amount":100}}',
    };
    expect(normalizeServer(input)).toEqual({
      ID: 7, Name: 'test-server', Tag: 'Asia', DisplayIndex: 2, LastActive: '2026-01-01',
      Host: { Platform: 'linux', PlatformVersion: '6.1', CPU: ['AMD EPYC'], MemTotal: 10, DiskTotal: 20, SwapTotal: 30, Arch: 'amd64', Virtualization: 'kvm', BootTime: 100, CountryCode: 'CN', Version: '1.2', GPU: ['GPU'] },
      State: { CPU: 5, MemUsed: 1, SwapUsed: 2, DiskUsed: 3, NetInTransfer: 4, NetOutTransfer: 5, NetInSpeed: 6, NetOutSpeed: 7, Uptime: 8, Load1: 0.1, Load5: 0.2, Load15: 0.3, TcpConnCount: 9, UdpConnCount: 10, ProcessCount: 11, Temperatures: [20], GPU: [30] },
      PublicNote: { billingDataMod: { amount: 100 } },
    });
    expect(input.host.platform).toBe('linux');
  });

  it('defaults only optional network and load values to zero', () => {
    const normalized = normalizeServer({ state: { cpu: 0, load_1: null, net_in_speed: null } });
    expect(normalized.State).toMatchObject({
      CPU: 0, Load1: 0, Load5: 0, Load15: 0, NetInTransfer: 0, NetOutTransfer: 0, NetInSpeed: 0, NetOutSpeed: 0,
    });
    expect(normalized.State.TcpConnCount).toBeUndefined();
    expect(normalized.Host.Platform).toBeUndefined();
    expect(normalized.Tag).toBeUndefined();
  });

  it.each(['', null, undefined, '{invalid json'])('handles missing or malformed public notes', (public_note) => {
    expect(normalizeServer({ id: 1, public_note }).PublicNote).toBeNull();
  });

  it('tolerates a missing server group list', () => {
    store.state.serverGroup = undefined;
    expect(normalizeServer({ id: 1 }).Tag).toBeUndefined();
  });
});
