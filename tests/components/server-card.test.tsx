import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import store from '@/store';
import ServerCard, { ServerTable } from '@/components/react/ServerCard';

const GiB = 1024 ** 3;
beforeEach(() => { store.commit('SET_SHOW_AVAILABILITY', true); store.commit('SET_SERVER_TIME', 1735776000000); });
afterEach(() => { rs.useRealTimers(); });

describe('server card', () => {
  it('shows live server details and forwards pointer, keyboard focus and selection events', () => {
    const server = {
      ID: 1, Name: 'Tokyo', online: 1, availability: 99.999, LastActive: 1735776000,
      Host: { CPU: ['Intel Xeon Gold 6130 4 Virtual Core'], CountryCode: 'JP', Platform: 'debian', MemTotal: 2 * GiB, DiskTotal: 50 * GiB, BootTime: 1735689600 },
      State: { TcpConnCount: 4, UdpConnCount: 2, NetOutSpeed: 2048, NetInSpeed: 4096 },
      PublicNote: { billingDataMod: { amount: '$10', cycle: 'month', endDate: '0000-00-00' }, planDataMod: { networkRoute: 'BGP,Premium', extra: 'NVMe', IPv4: '1', IPv6: '1' } },
    };
    const onSelect = rs.fn(); const onHover = rs.fn();
    const { container } = render(<ServerCard server={server} onSelect={onSelect} onHover={onHover} />);
    const card = screen.getByRole('button');
    expect(screen.getByText('4C2G50G')).toBeTruthy();
    expect(screen.getByText('intel Xeon 6130')).toBeTruthy();
    expect(screen.getByText('在线 1天')).toBeTruthy();
    expect(screen.getByText('$10/月')).toBeTruthy();
    expect(screen.getByText('双栈IP')).toBeTruthy();
    expect(screen.getByText('连接 4/2')).toBeTruthy();
    expect(screen.getByText('可用 99.99%')).toBeTruthy();
    expect(container.querySelector('.remaining-status--success')).not.toBeNull();
    fireEvent.mouseEnter(card); fireEvent.focus(card); fireEvent.click(card); fireEvent.mouseLeave(card); fireEvent.blur(card);
    expect(onSelect).toHaveBeenCalledWith(server);
    expect(onHover.mock.calls.map(([value]) => value)).toEqual([server, server, null, null]);
  });

  it.each([
    ['1', 3 * GiB, 2 * GiB, '单向出', '2G'],
    ['3', 3 * GiB, 2 * GiB, '单向取最大', '入 3G'],
    ['3', 2 * GiB, 3 * GiB, '单向取最大', '出 3G'],
    ['2', 3 * GiB, 2 * GiB, '双向', '5G'],
    ['', 3 * GiB, 2 * GiB, '不限制', null],
  ])('uses traffic policy %s', (trafficType, incoming, outgoing, label, value) => {
    render(<ServerCard server={{ Name: 'Server', State: { NetInTransfer: incoming, NetOutTransfer: outgoing }, PublicNote: { planDataMod: { trafficType } } }} />);
    expect(screen.getByText(label)).toBeTruthy();
    if (value) expect(screen.getByText(value)).toBeTruthy();
  });

  it.each(['1', '2', '3'])('prefers cycle transfer remaining quota under policy %s', (trafficType) => {
    render(<ServerCard server={{ ID: 1, Name: 'Quota', PublicNote: { planDataMod: { trafficType } } }} cycleTransferMap={{ 1: [{ remainingDisplay: '80GB', statusLevel: 'fine', remainingPercent: 80 }] }} />);
    expect(screen.getByText('剩余 80GB')).toBeTruthy();
  });

  it('shows compact status and fallback transfer without billing or connection noise', () => {
    const { container, rerender } = render(<ServerCard compact server={{ Name: 'Tiny', online: -1, Host: { MemTotal: 0.5 * GiB }, State: { NetInTransfer: GiB, NetOutTransfer: GiB, TcpConnCount: 3 } }} />);
    expect(screen.getByText('0.5G')).toBeTruthy();
    expect(screen.getByText('离线')).toBeTruthy();
    expect(screen.getByText('双向')).toBeTruthy();
    expect(screen.getByText('2G')).toBeTruthy();
    expect(screen.queryByText('连接 3/0')).toBeNull();
    expect(container.querySelector('.offline')).not.toBeNull();
    rerender(<ServerCard compact server={{ Name: 'Up', online: 1, LastActive: 1735776000, Host: { BootTime: 1735689600 } }} />);
    expect(screen.getByText('在线')).toBeTruthy();
    expect(screen.getByText('1天')).toBeTruthy();
  });

  it.each([
    ['0', '', '免费'], ['-1', 'month', '按量'], ['$10', '', '$10'],
  ])('formats billing amount %s', (amount, cycle, expected) => {
    render(<ServerCard server={{ Name: 'Bill', PublicNote: { billingDataMod: { amount, cycle } } }} />);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it.each([
    [99.2, '2025-01-05', 'success', 'danger'],
    [96, '2025-01-20', 'warning', 'warning'],
    [90, '2025-04-01', 'danger', 'success'],
    [100, '2024-01-01', 'success', 'danger'],
  ])('renders availability and billing warning thresholds at %s', (availability, endDate, availableStatus, remainingStatus) => {
    rs.useFakeTimers(); rs.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const { container } = render(<ServerCard server={{ Name: 'Server', availability, PublicNote: { billingDataMod: { endDate }, planDataMod: { IPv4: '1' } } }} />);
    expect(container.querySelector(`.availability-status--${availableStatus}`)).not.toBeNull();
    expect(container.querySelector(`.remaining-status--${remainingStatus}`)).not.toBeNull();
    expect(screen.getByText('仅IPv4')).toBeTruthy();
  });

  it('hides unavailable or disabled availability and renders IPv6-only and empty cards safely', () => {
    store.commit('SET_SHOW_AVAILABILITY', false);
    const { rerender } = render(<ServerCard server={{ Name: 'V6', availability: 100, PublicNote: { planDataMod: { IPv6: '1' } }, State: { NetInSpeed: 2048 } }} />);
    expect(screen.queryByText(/可用 /)).toBeNull();
    expect(screen.getByText('仅IPv6')).toBeTruthy();
    rerender(<ServerCard server={{}} />);
    expect(screen.getByText('-')).toBeTruthy();
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });

  it('renders a table of independently selectable cards', () => {
    const onSelect = rs.fn();
    const servers = [{ ID: 1, Name: 'A' }, { ID: 2, Name: 'B' }];
    render(<ServerTable servers={servers} onSelect={onSelect} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    fireEvent.click(screen.getByTitle('B'));
    expect(onSelect).toHaveBeenCalledWith(servers[1]);
  });
});
