import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import config from '@/config';
import store from '@/store';
import DetailHeader from '@/components/react/detail/DetailHeader';
import DetailStatus from '@/components/react/detail/DetailStatus';
import ServerInfo from '@/components/react/detail/ServerInfo';

rs.mock('@/components/react/detail/DetailGlobe', () => ({
  default: ({ location, theme }) => <span data-testid="detail-globe">{location.code} {theme}</span>,
}));

const originalConfig = { ...config.aobobo };
const GiB = 1024 ** 3;
beforeEach(() => {
  store.commit('SET_SHOW_AVAILABILITY', true);
  store.commit('SET_SERVER_TIME', 1735776000000);
  store.commit('SET_RESOLVED_THEME', 'dark');
  store.commit('CLEAR_GLOBE_FOCUS');
});
afterEach(() => {
  for (const key of Object.keys(config.aobobo)) delete config.aobobo[key];
  Object.assign(config.aobobo, originalConfig);
  rs.restoreAllMocks(); rs.useRealTimers();
});

describe('detail resource status', () => {
  it('renders capacities, resource limits, uptime and current traffic', () => {
    const info = {
      online: 1, LastActive: 1735776000, availability: 99.999,
      Host: { CPU: ['AMD EPYC 4 Virtual Core'], MemTotal: 2 * GiB, SwapTotal: GiB, DiskTotal: 50 * GiB, BootTime: 1735689600 },
      State: { CPU: 42.32, MemUsed: 3 * GiB, SwapUsed: 128 * 1024 ** 2, DiskUsed: 12.3 * GiB, NetInSpeed: 2 * 1024 ** 2, NetOutSpeed: 1024, NetInTransfer: GiB, NetOutTransfer: GiB },
    };
    const { container, rerender } = render(<DetailStatus info={info} />);
    expect(screen.getByText('42.3%')).toBeTruthy();
    expect(screen.getByText('4 核')).toBeTruthy();
    expect(screen.getByText('交换')).toBeTruthy();
    expect(screen.getByText('1天')).toBeTruthy();
    expect(screen.getByTitle('99.99%')).toBeTruthy();
    const memoryBar = container.querySelector<HTMLElement>('.resource-card--mem .resource-progress-bar');
    expect(memoryBar.style.getPropertyValue('--resource-ratio')).toBe('1');
    expect(screen.getByTitle('2M/s')).toBeTruthy();
    rerender(<DetailStatus info={{ ...info, online: -1, availability: 'unknown' }} />);
    expect(screen.queryByText('可用性')).toBeNull();
    expect(screen.getByTitle('-')).toBeTruthy();
  });

  it('handles missing metrics, hides disabled availability and formats large capacities', () => {
    const { container, rerender } = render(<DetailStatus info={{}} />);
    expect(container.querySelectorAll('.resource-card')).toHaveLength(3);
    expect(screen.queryByText('交换')).toBeNull();
    expect(screen.getByText('0.0%')).toBeTruthy();
    act(() => store.commit('SET_SHOW_AVAILABILITY', false));
    rerender(<DetailStatus info={{ availability: 100, Host: { MemTotal: 2 * 1024 ** 4 }, State: { MemUsed: 1024 ** 4 } }} />);
    expect(screen.queryByText('可用性')).toBeNull();
    expect(screen.getByText('1T')).toBeTruthy();
    expect(screen.getByText('2T')).toBeTruthy();
  });
});

describe('additional server information', () => {
  it('hides an empty panel and categorizes available temperature sensors', () => {
    const { container, rerender } = render(<ServerInfo info={{}} />);
    expect(container.textContent).toBe('');
    rerender(<ServerInfo info={{ State: { Temperatures: [
      { Name: 'coretemp Package', Temperature: 45.26 }, { Name: 'gpu0', Temperature: 50 },
      { Name: 'nvme0', Temperature: 38 }, { Name: 'acpitz', Temperature: 30 },
      { Name: 'ambient', Temperature: 20 }, {},
    ] } }} />);
    for (const title of ['coretemp Package: 45.3℃', 'gpu0: 50.0℃', 'nvme0: 38.0℃', 'acpitz: 30.0℃', 'ambient: 20.0℃', '传感器: 0.0℃']) {
      expect(screen.getByTitle(title)).toBeTruthy();
    }
    expect(screen.getByText('主板')).toBeTruthy();
  });

  it('opens the decoded purchase URL with server-specific and global button labels', () => {
    const open = rs.spyOn(window, 'open').mockReturnValue(null);
    const info = { PublicNote: { customData: { orderLink: encodeURIComponent('https://example.com/order?a=1'), buyBtnText: '续费', buyBtnIcon: 'ri-bank-card-line' } } };
    const { rerender } = render(<ServerInfo info={info} />);
    fireEvent.click(screen.getByRole('button', { name: '续费' }));
    expect(open).toHaveBeenCalledWith('https://example.com/order?a=1', '_blank', 'noopener,noreferrer');
    config.aobobo.buyBtnText = '订购';
    config.aobobo.buyBtnIcon = 'ri-store-line';
    rerender(<ServerInfo info={{ PublicNote: { customData: { orderLink: 'https://example.com' } } }} />);
    expect(screen.getByRole('button', { name: '订购' })).toBeTruthy();
    delete config.aobobo.buyBtnText;
    delete config.aobobo.buyBtnIcon;
    rerender(<ServerInfo info={{ PublicNote: { customData: { orderLink: 'https://example.com' } } }} />);
    expect(screen.getByRole('button', { name: '购买' })).toBeTruthy();
  });
});

describe('detail server header', () => {
  function CurrentPath() { return <output data-testid="current-path">{useLocation().pathname}</output>; }
  const header = (info) => <MemoryRouter initialEntries={['/server/1']}><DetailHeader info={info} /><CurrentPath /></MemoryRouter>;

  it('shows server metadata, deduplicates plan tags and focuses the server on the homepage globe', () => {
    rs.useFakeTimers(); rs.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const info = {
      ID: 1, Name: 'Tokyo VPS', online: 1, availability: 99.999, LastActive: 1735776000,
      Host: { CountryCode: 'jp', CPU: ['Intel Xeon Gold 6130 4 Virtual Core'], MemTotal: 16 * GiB, DiskTotal: 50 * GiB, Platform: 'debian', PlatformVersion: '12', BootTime: 1735689600 },
      State: { Load1: 0.1, Load5: 0.2, Load15: 0.3, NetInTransfer: GiB, NetOutTransfer: 2 * GiB },
      PublicNote: {
        billingDataMod: { amount: '$10', cycle: 'month', endDate: '2025-01-20' },
        planDataMod: { networkRoute: 'BGP, premium', extra: 'premium, NVMe', IPv4: '1', IPv6: '1', bandwidth: '1Gbps', trafficVol: '1TB', trafficType: '1' },
      },
    };
    render(header(info));
    expect(screen.getByRole('heading', { name: 'Tokyo VPS' })).toBeTruthy();
    expect(screen.getByText('可用 99.99%')).toBeTruthy();
    expect(screen.getByTitle('东京')).toBeTruthy();
    expect(screen.getByTitle('Debian')).toBeTruthy();
    expect(screen.getAllByTitle('premium')).toHaveLength(1);
    expect(screen.getByTitle('双栈IP')).toBeTruthy();
    expect(screen.getByTitle('负载 0.10 / 0.20 / 0.30')).toBeTruthy();
    expect(screen.getByTestId('detail-globe').textContent).toBe('TYO dark');
    fireEvent.click(screen.getByRole('button', { name: '在地球上查看 Tokyo VPS' }));
    expect(store.state.globeFocus).toEqual({ code: 'TYO', name: 'Tokyo VPS' });
    expect(screen.getByTestId('current-path').textContent).toBe('/');
  });

  it('shows an offline server without location or optional metadata', () => {
    render(header({ Name: 'Unknown', online: -1 }));
    expect(screen.getByText('离线')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/可用 /)).toBeNull();
  });

  it.each([
    [99.1, '2025-01-05', 'remaining-status--danger', 'availability-status--success'],
    [96.5, '2025-01-20', 'remaining-status--warning', 'availability-status--warning'],
    [90, '2025-04-01', 'remaining-status--success', 'availability-status--danger'],
    [100, '2024-01-01', 'remaining-status--danger', 'availability-status--success'],
    [100, '0000-00-00', 'remaining-status--success', 'availability-status--success'],
  ])('shows availability %s and remaining time %s with appropriate status', (availability, endDate, remainingClass, availabilityClass) => {
    rs.useFakeTimers(); rs.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    config.aobobo.hideDetailServerGlobe = true;
    const { container } = render(header({
      Name: 'Server', online: 1, availability,
      Host: { MemTotal: 2 * GiB, CountryCode: 'US' },
      PublicNote: { customData: { slogan: 'Stay online' }, billingDataMod: { endDate }, planDataMod: { IPv4: '1' } },
    }));
    expect(container.querySelector(`.${remainingClass}`)).not.toBeNull();
    expect(container.querySelector(`.${availabilityClass}`)).not.toBeNull();
    expect(screen.getByText('“Stay online”')).toBeTruthy();
    expect(screen.getByTitle('仅IPv4')).toBeTruthy();
    expect(screen.getByRole('button', { name: '在地球上查看 Server' }).textContent).toContain('在地球上查看');
  });

  it('hides availability when disabled and supports IPv6 plans', () => {
    store.commit('SET_SHOW_AVAILABILITY', false);
    render(header({ Name: 'V6', online: -1, availability: 100, PublicNote: { planDataMod: { IPv6: '1' } } }));
    expect(screen.queryByText(/可用 /)).toBeNull();
    expect(screen.getByTitle('仅IPv6')).toBeTruthy();
  });
});
