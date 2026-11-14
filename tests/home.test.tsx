import { useImperativeHandle } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, rstest } from '@rstest/core';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import config from '@/config';
import i18n from '@/i18n';
import store from '@/store';
import { loadCycleTransferMap } from '@/utils/cycle-transfer';
import { loadExchangeRatesForCurrencies } from '@/utils/exchange-rate';
import { clusterLocations, resolveServerLocation } from '@/utils/world-map';
import { persistGlobeRotation } from '@/utils/globe-rotation';
import useMediaQuery from '@/hooks/useMediaQuery';
import GlobeEarth from '@/components/react/GlobeEarth';
import { ServerTable } from '@/components/react/ServerCard';
import { GlobeControls, SortSelect, StatusFilter } from '@/components/react/HomeControls';
import { AllHostsModal, StatsModal } from '@/components/react/HomeModals';
import Home from '@/views/Home';

rstest.mock('react-router-dom', () => ({ useNavigate: rstest.fn(), useParams: rstest.fn(), useSearchParams: rstest.fn() }));
rstest.mock('@/config', () => ({ default: { aobobo: {} } }));
rstest.mock('@/store', () => {
  const state = {};
  return { default: { state, dispatch: rstest.fn() }, useStore: (selector) => selector(state) };
});
rstest.mock('@/utils/cycle-transfer', () => ({ loadCycleTransferMap: rstest.fn() }));
rstest.mock('@/utils/exchange-rate', () => ({
  ...rstest.requireActual('@/utils/exchange-rate'), loadExchangeRatesForCurrencies: rstest.fn(),
}));
rstest.mock('@/utils/world-map', () => ({ resolveServerLocation: rstest.fn(), clusterLocations: rstest.fn() }));
rstest.mock('@/utils/globe-rotation', () => ({
  loadGlobeRotation: () => ({ autoRotate: true, rotateSpeed: 1, showServerConnections: false }), persistGlobeRotation: rstest.fn(),
}));
rstest.mock('@/hooks/useMediaQuery', () => ({ default: rstest.fn() }));
rstest.mock('@/components/react/Common', () => ({ AppFooter: () => null, CurrentTime: () => null, DashboardButton: () => null, LanguageSwitch: () => null, ThemeModeSwitch: () => null }));
rstest.mock('@/components/react/GlobeEarth', () => ({ default: rstest.fn() }));
rstest.mock('@/components/react/ServerCard', () => ({ ServerTable: rstest.fn() }));
rstest.mock('@/components/react/HomeControls', () => ({ GlobeControls: rstest.fn(), SortSelect: rstest.fn(), StatusFilter: rstest.fn() }));
rstest.mock('@/components/react/HomeModals', () => ({ StatsModal: rstest.fn(), AllHostsModal: rstest.fn() }));
rstest.mock('@/components/react/detail/DetailContent', () => ({ default: ({ info }) => <div>detail-{info.ID}</div> }));

const navigate = rstest.fn();
const setSearchParams = rstest.fn();
const focus = rstest.fn();
const clearFocus = rstest.fn();
const server = (ID, Name, online, overrides = {}) => ({
  ID, Name, online, DisplayIndex: ID,
  Host: { Platform: 'linux', CountryCode: 'JP', CPU: ['AMD EPYC 4 Virtual Core'], MemTotal: 1024 ** 3, DiskTotal: 10 * 1024 ** 3 },
  State: { NetInTransfer: 1024 ** 3, NetOutTransfer: 2 * 1024 ** 3, NetInSpeed: 1024, NetOutSpeed: 2048 },
  ...overrides,
});

function GlobeStub(props: any) {
  useImperativeHandle(props.ref, () => ({ focusLocationWithHighlight: focus, clearFocusBubble: clearFocus }));
  return <div data-testid="globe" data-active={String(props.active)}><button onClick={() => props.onSelectServer(store.state.serverList[0])}>globe-select</button></div>;
}

function lastProps(component: any) { return rstest.mocked(component).mock.calls.at(-1)[0]; }
function listedIds() { return lastProps(ServerTable).servers.map((item) => item.ID); }
function stats() { return lastProps(StatsModal).display; }
function sidebarWidth() { return screen.getByRole('separator').getAttribute('aria-valuenow'); }

beforeEach(() => {
  navigate.mockReset(); setSearchParams.mockReset(); focus.mockReset(); clearFocus.mockReset();
  rstest.mocked(useNavigate).mockReturnValue(navigate);
  rstest.mocked(useParams).mockReturnValue({});
  rstest.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), setSearchParams]);
  rstest.mocked(useMediaQuery).mockReturnValue(true);
  config.aobobo = { title: 'Test Dashboard', detailCycleTransferRefreshTime: 10, availabilityRefreshTime: 20 };
  Object.assign(store.state, {
    init: true, serverList: [server(3, 'gamma', -1), server(2, 'beta', 1), server(1, 'alpha', 1)],
    serverGroup: [{ name: 'Asia', servers: [1, 3] }, { name: 'Europe', servers: [2] }],
    serverCount: { total: 3, online: 2, offline: 1 }, resolvedTheme: 'dark', showAvailability: false, globeFocus: null,
  });
  rstest.mocked(loadCycleTransferMap).mockReset().mockResolvedValue({ 1: [{ name: 'cycle' }] });
  rstest.mocked(loadExchangeRatesForCurrencies).mockReset().mockResolvedValue({
    targetCurrency: 'CNY', rates: { CNY: { rate: 1, fetchedAt: 0, source: 'base' } }, missingCurrencies: [], staleCurrencies: [], fetchedCurrencies: [], cachedCurrencies: [], updatedAt: 0, disabled: false, error: '',
  });
  rstest.mocked(resolveServerLocation).mockImplementation((item) => item.ID === 3 ? null : ({ code: 'TYO', name: 'Tokyo', country: '日本' } as any));
  rstest.mocked(clusterLocations).mockImplementation((locations) => locations);
  rstest.mocked(GlobeEarth).mockImplementation(GlobeStub);
  rstest.mocked(ServerTable).mockImplementation(({ servers, onSelect, onHover }) => <div data-testid="table">{servers.map((item) => <button key={item.ID} onClick={() => onSelect(item)} onMouseEnter={() => onHover(item)} onMouseLeave={() => onHover(null)}>{item.Name}</button>)}</div>);
  rstest.mocked(StatsModal).mockImplementation(({ open, onClose }) => open ? <div data-testid="stats"><button onClick={onClose}>close-stats</button></div> : null);
  rstest.mocked(AllHostsModal).mockImplementation(({ open, onClose, onSelect, servers }) => open ? <div data-testid="hosts"><button onClick={onClose}>close-hosts</button><button onClick={() => onSelect(servers[0])}>select-host</button></div> : null);
  rstest.mocked(StatusFilter).mockImplementation(({ onChange }) => <button onClick={() => onChange('-1')}>offline-only</button>);
  rstest.mocked(SortSelect).mockImplementation(({ onChange }) => <button onClick={() => onChange({ prop: 'Name', order: 'asc' })}>sort-name</button>);
  rstest.mocked(GlobeControls).mockImplementation(({ onAutoRotate, onSpeed, onConnections }) => <><button onClick={() => onAutoRotate(false)}>stop-rotation</button><button onClick={() => onSpeed(2)}>speed-2</button><button onClick={() => onConnections(true)}>show-connections</button></>);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
});

describe('Home filtering and navigation', () => {
  it('updates labels, statistics, locations and sorting when language changes without replacing server data', async () => {
    config.aobobo.title = '哪吒监控';
    store.state.serverList[1].PublicNote = { customData: { locationLabel: '我的节点' } };
    rstest.mocked(resolveServerLocation).mockImplementation((item) => item.ID === 3 ? null : ({
      code: item.ID === 2 ? 'CUSTOM' : 'TYO', name: item.ID === 2 ? '我的节点' : '东京', country: '日本',
    } as any));
    const { container } = render(<Home />);
    const serverList = store.state.serverList;
    await waitFor(() => expect(lastProps(GlobeEarth).cycleTransferMap).toEqual({ 1: [{ name: 'cycle' }] }));
    const summary = () => container.querySelector('.status-summary').textContent;
    const sortLabel = () => lastProps(SortSelect).options.find((option) => option.value === 'Name').label;
    const locations = () => lastProps(GlobeEarth).locations.map(({ label, name, country }) => ({ label, name, country }));
    expect(summary()).toContain('共 3 台服务器');
    expect(summary()).toContain('有1台离线');
    expect(sortLabel()).toBe('主机名称');
    expect(locations()).toEqual([
      { label: '我的节点, 日本', name: '我的节点', country: '日本' },
      { label: '东京, 日本', name: '东京', country: '日本' },
    ]);

    fireEvent.change(screen.getByPlaceholderText('搜索名称 / 地区 / 系统'), { target: { value: 'alpha' } });
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(store.state.serverList).toBe(serverList);
    expect(summary()).toContain('3 servers total');
    expect(summary()).toContain('1 offline');
    expect(screen.getByText('1 matches')).toBeTruthy();
    expect((screen.getByPlaceholderText('Search name / region / OS') as HTMLInputElement).value).toBe('alpha');
    expect(sortLabel()).toBe('Server name');
    expect(locations()).toEqual([
      { label: '我的节点, Japan', name: '我的节点', country: '日本' },
      { label: 'Tokyo, Japan', name: '东京', country: '日本' },
    ]);
    expect(document.title).toBe('Nezha Monitoring');

    await act(async () => { await i18n.changeLanguage('zh-CN'); });
    expect(summary()).toContain('共 3 台服务器');
    expect(sortLabel()).toBe('主机名称');
    expect(locations()[1].label).toBe('东京, 日本');
    expect(screen.getByText('1 条匹配')).toBeTruthy();
    expect(document.title).toBe('哪吒监控');
  });

  it('keeps online servers first, filters by text/status/group, and clears all filters', async () => {
    render(<Home />);
    expect(document.title).toBe('Test Dashboard');
    expect(listedIds()).toEqual([2, 1, 3]);
    fireEvent.click(screen.getByText('sort-name'));
    expect(listedIds()).toEqual([1, 2, 3]);
    fireEvent.change(screen.getByPlaceholderText('搜索名称 / 地区 / 系统'), { target: { value: ' ALPHA ' } });
    expect(listedIds()).toEqual([1]);
    expect(screen.getByText('1 条匹配')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('搜索名称 / 地区 / 系统'), { target: { value: '' } });
    fireEvent.click(screen.getByText('offline-only'));
    expect(listedIds()).toEqual([3]);
    fireEvent.click(screen.getByText('Europe'));
    expect(screen.getByText('没有符合条件的服务器')).toBeTruthy();
    fireEvent.click(screen.getByText('清除筛选'));
    expect(listedIds()).toEqual([1, 2, 3]);
    fireEvent.click(screen.getByText('Asia'));
    expect(listedIds()).toEqual([1, 3]);
    fireEvent.click(screen.getByText('全部'));
    expect(listedIds()).toEqual([1, 2, 3]);
    await waitFor(() => expect(lastProps(GlobeEarth).cycleTransferMap).toEqual({ 1: [{ name: 'cycle' }] }));
  });

  it('searches platform labels, country codes and custom locations', () => {
    store.state.serverList[0].Host.Platform = 'darwin';
    store.state.serverList[0].PublicNote = { customData: { location: 'Osaka' } };
    render(<Home />);
    const input = screen.getByPlaceholderText('搜索名称 / 地区 / 系统');
    for (const query of ['MacOS', 'Osaka']) {
      fireEvent.change(input, { target: { value: query } });
      expect(listedIds()).toEqual([3]);
    }
    fireEvent.change(input, { target: { value: 'JP' } });
    expect(listedIds()).toEqual([2, 1, 3]);
  });

  it('clears the search with its clear button', () => {
    const { container } = render(<Home />);
    const input = screen.getByPlaceholderText('搜索名称 / 地区 / 系统');
    fireEvent.change(input, { target: { value: 'alpha' } });
    expect(listedIds()).toEqual([1]);
    fireEvent.click(container.querySelector('.clear-search'));
    expect((input as HTMLInputElement).value).toBe('');
    expect(listedIds()).toEqual([2, 1, 3]);
  });

  it('navigates from table, globe and all-hosts modal selections', () => {
    render(<Home />);
    fireEvent.click(screen.getByText('alpha'));
    expect(navigate).toHaveBeenLastCalledWith('/server/1');
    fireEvent.click(screen.getByText('globe-select'));
    expect(navigate).toHaveBeenLastCalledWith('/server/3');
    fireEvent.click(screen.getByText('全部主机'));
    expect(screen.getByTestId('globe').getAttribute('data-active')).toBe('false');
    fireEvent.click(screen.getByText('close-hosts'));
    fireEvent.click(screen.getByText('全部主机'));
    fireEvent.click(screen.getByText('select-host'));
    expect(navigate).toHaveBeenLastCalledWith('/server/3');
    expect(screen.queryByTestId('hosts')).toBeNull();
  });

  it('redirects legacy detail query URLs while preserving unrelated query parameters', () => {
    rstest.mocked(useSearchParams).mockReturnValue([new URLSearchParams('detail=a/b&other=1'), setSearchParams]);
    render(<Home />);
    expect(navigate).toHaveBeenCalledWith('/server/a%2Fb?other=1', { replace: true });
  });

  it('shows a routed detail drawer, disables the globe and closes to the home route', () => {
    rstest.mocked(useParams).mockReturnValue({ id: '1' });
    render(<Home />);
    expect(screen.getByRole('dialog', { name: 'alpha 详情' })).toBeTruthy();
    expect(screen.getByText('detail-1')).toBeTruthy();
    expect(screen.getByTestId('globe').getAttribute('data-active')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: '关闭详情' }));
    expect(navigate).toHaveBeenLastCalledWith('/', { replace: true });
  });

  it('clears legacy detail queries when closing and redirects unknown routed IDs after initialization', () => {
    rstest.mocked(useSearchParams).mockReturnValue([new URLSearchParams('detail=3&x=y'), setSearchParams]);
    const view = render(<Home />);
    expect(screen.getByRole('dialog').className).toContain('server--offline');
    fireEvent.click(screen.getByRole('button', { name: '关闭详情' }));
    expect(setSearchParams).toHaveBeenLastCalledWith(expect.any(URLSearchParams), { replace: true });
    expect(setSearchParams.mock.calls.at(-1)[0].toString()).toBe('x=y');
    rstest.mocked(useParams).mockReturnValue({ id: '999' });
    view.rerender(<Home />);
    expect(navigate).toHaveBeenLastCalledWith('/', { replace: true });
  });

  it('shows initial loading and empty states without background cycle requests', () => {
    Object.assign(store.state, { init: false, serverList: [], serverGroup: [], serverCount: { total: 0, online: 0, offline: 0 } });
    render(<Home />);
    expect(screen.getByText('正在连接哪吒探针...')).toBeTruthy();
    expect(screen.getByText('暂无服务器数据')).toBeTruthy();
    expect(loadCycleTransferMap).not.toHaveBeenCalled();
  });
});

describe('Home globe focus and refresh', () => {
  it('builds location groups and consumes focus query parameters', () => {
    rstest.mocked(useSearchParams).mockReturnValue([new URLSearchParams('focus=TYO&name=Tokyo%20servers&keep=1'), setSearchParams]);
    render(<Home />);
    expect(lastProps(GlobeEarth).locations[0]).toMatchObject({ code: 'TYO', codes: ['TYO'], label: 'Tokyo, 日本', hasOnline: true });
    expect(lastProps(GlobeEarth).locations[0].servers).toHaveLength(2);
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ code: 'TYO' }), 'Tokyo servers');
    expect(setSearchParams.mock.calls.at(-1)[0].toString()).toBe('keep=1');
  });

  it('consumes store focus even when the location is missing', () => {
    store.state.globeFocus = { code: 'TYO', name: 'selected' };
    const view = render(<Home />);
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ code: 'TYO' }), 'selected');
    expect(store.dispatch).toHaveBeenCalledWith('clearGlobeFocus');
    focus.mockClear();
    store.state.globeFocus = { code: 'unknown' };
    view.rerender(<Home />);
    expect(focus).not.toHaveBeenCalled();
  });

  it('focuses after a three-second hover and cancels focus after mouse leave', async () => {
    rstest.useFakeTimers();
    render(<Home />);
    fireEvent.mouseEnter(screen.getByText('alpha'));
    await act(async () => { await rstest.advanceTimersByTimeAsync(2999); });
    expect(focus).not.toHaveBeenCalled();
    await act(async () => { await rstest.advanceTimersByTimeAsync(1); });
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ code: 'TYO' }), 'alpha');
    focus.mockClear();
    fireEvent.mouseEnter(screen.getByText('beta'));
    fireEvent.mouseLeave(screen.getByText('beta'));
    await act(async () => { await rstest.advanceTimersByTimeAsync(3000); });
    expect(focus).not.toHaveBeenCalled();
    expect(clearFocus).toHaveBeenCalled();
  });

  it('refreshes cycle and availability data on their own intervals and cleans timers on unmount', async () => {
    rstest.useFakeTimers();
    store.state.showAvailability = true;
    const view = render(<Home />);
    await act(async () => { await rstest.advanceTimersByTimeAsync(20000); });
    expect(loadCycleTransferMap).toHaveBeenCalledTimes(3);
    expect(rstest.mocked(store.dispatch).mock.calls.filter(([name]) => name === 'refreshAvailability')).toHaveLength(2);
    view.unmount();
    await act(async () => { await rstest.advanceTimersByTimeAsync(60000); });
    expect(loadCycleTransferMap).toHaveBeenCalledTimes(3);
  });

  it('continues scheduling cycle refreshes after errors', async () => {
    rstest.useFakeTimers();
    rstest.spyOn(console, 'error').mockImplementation(() => {});
    rstest.mocked(loadCycleTransferMap).mockRejectedValueOnce(new Error('offline'));
    render(<Home />);
    await act(async () => { await rstest.advanceTimersByTimeAsync(10000); });
    expect(loadCycleTransferMap).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith('Failed to load cycle transfer:', expect.any(Error));
  });

  it('ignores pending network results and avoids rescheduling after unmount', async () => {
    rstest.useFakeTimers();
    let resolveCycle: (_value: any) => void;
    let resolveExchange: (_value: any) => void;
    rstest.mocked(loadCycleTransferMap).mockReturnValue(new Promise((resolve) => { resolveCycle = resolve; }));
    rstest.mocked(loadExchangeRatesForCurrencies).mockReturnValue(new Promise((resolve) => { resolveExchange = resolve; }));
    const view = render(<Home />);
    view.unmount();
    await act(async () => {
      resolveCycle({});
      resolveExchange({ rates: {} });
      await rstest.advanceTimersByTimeAsync(60000);
    });
    expect(loadCycleTransferMap).toHaveBeenCalledTimes(1);
    expect(loadExchangeRatesForCurrencies).toHaveBeenCalledTimes(1);
  });

  it('persists globe rotation controls and pauses the globe while statistics are open', () => {
    render(<Home />);
    fireEvent.click(screen.getByText('stop-rotation'));
    fireEvent.click(screen.getByText('speed-2'));
    fireEvent.click(screen.getByText('show-connections'));
    expect(persistGlobeRotation).toHaveBeenLastCalledWith({ autoRotate: false, rotateSpeed: 2, showServerConnections: true });
    fireEvent.click(screen.getByText('更多'));
    expect(screen.getByTestId('globe').getAttribute('data-active')).toBe('false');
    fireEvent.click(screen.getByText('close-stats'));
    expect(screen.getByTestId('globe').getAttribute('data-active')).toBe('true');
  });
});

describe('Home statistics and exchange rates', () => {
  it('aggregates hardware, traffic, group counts and monthly/yearly converted costs', async () => {
    store.state.serverList[0].PublicNote = { billingDataMod: { amount: 'USD 12', cycle: '年' } };
    store.state.serverList[1].PublicNote = { billingDataMod: { amount: 'CNY 10', cycle: 'month' } };
    store.state.serverList[2].PublicNote = { billingDataMod: { amount: -1 } };
    rstest.mocked(loadExchangeRatesForCurrencies).mockResolvedValue({ rates: { USD: { rate: 7 } }, updatedAt: Date.parse('2026-01-01T12:00:00Z'), staleCurrencies: [], disabled: false } as any);
    render(<Home />);
    await waitFor(() => expect(stats().monthlyCost).toBe('¥17.00'));
    expect(stats()).toMatchObject({ totalServers: 3, totalCores: 12, cpuBrandCores: [{ brand: 'AMD', cores: 12 }], totalDisk: { value: 30, unit: 'G' }, yearlyCost: '¥204.00', groupCounts: [{ name: 'Asia', count: 2 }, { name: 'Europe', count: 1 }] });
    expect(stats().costSummary).toMatchObject({ sourceCurrencies: ['CNY', 'USD'], ignoredCount: 1, unconvertedCount: 0, exchangeRate: { statusText: '汇率已更新', warning: false } });
    expect(stats().costSummary.exchangeRate.updatedAtText).toMatch(/^01-01 /);
    expect(loadExchangeRatesForCurrencies).toHaveBeenCalledWith(['USD'], 'CNY', expect.objectContaining({ enabled: true }));
  });

  it.each([
    [{ disabled: true }, '汇率已关闭'],
    [{ rates: {} }, '部分未换算'],
    [{ rates: { USD: { rate: 7 } }, staleCurrencies: ['USD'] }, '使用缓存汇率'],
    [{ rates: { USD: { rate: 7 } } }, '汇率已缓存'],
  ])('reports exchange-rate state %s', async (result, statusText) => {
    store.state.serverList[0].PublicNote = { billingDataMod: { amount: '$10' } };
    rstest.mocked(loadExchangeRatesForCurrencies).mockResolvedValue({ rates: {}, ...result } as any);
    render(<Home />);
    await waitFor(() => expect(stats().costSummary.exchangeRate.statusText).toBe(statusText));
  });

  it('reports failed exchange loading', async () => {
    rstest.spyOn(console, 'error').mockImplementation(() => {});
    rstest.mocked(loadExchangeRatesForCurrencies).mockRejectedValue(new Error('API failed'));
    render(<Home />);
    await waitFor(() => expect(stats().costSummary.exchangeRate.statusText).toBe('汇率更新失败'));
    expect(stats().costSummary.exchangeRate.warning).toBe(true);
  });

  it('reports ignored or absent cost entries and supports disabled conversion', async () => {
    config.aobobo.exchangeRateEnabled = false;
    store.state.serverList[0].PublicNote = { billingDataMod: { amount: 'invalid' } };
    render(<Home />);
    await waitFor(() => expect(stats().costSummary.exchangeRate.statusText).toBe('含未计入项'));
    expect(stats().monthlyCost).toBe('');
    expect(loadExchangeRatesForCurrencies).toHaveBeenCalledWith([], 'CNY', expect.objectContaining({ enabled: false }));
  });

  it('handles missing hardware and billing fields without invalid aggregate values', async () => {
    store.state.serverList = [{ ID: 1, Name: 'minimal', online: 1, Host: {}, State: {} }, { ID: 2, Name: 'free', PublicNote: { billingDataMod: { amount: 0 } } }];
    store.state.serverGroup = [{ name: 'empty' }, { name: 'stale', servers: [999] }];
    rstest.mocked(resolveServerLocation).mockReturnValue({ code: 'OTHER', name: 'Other' } as any);
    render(<Home />);
    await waitFor(() => expect(stats().costSummary.exchangeRate.statusText).toBe('无需汇率'));
    expect(stats()).toMatchObject({ totalCores: 0, cpuBrandCores: [], groupCounts: [], monthlyCost: '', totalDisk: { value: 0, unit: 'G' } });
    expect(lastProps(GlobeEarth).locations[0].label).toBe('Other');
  });
});

describe('Home sidebar sizing', () => {
  it.each([['100', '380'], ['900', '760'], ['NaN', '420'], ['0', '420']])('clamps saved width %s', (saved, expected) => {
    localStorage.setItem('aobobo-server-sidebar-width', saved);
    render(<Home />);
    expect(sidebarWidth()).toBe(expected);
  });

  it('supports keyboard resizing, clamping, two columns and default reset', () => {
    const { container } = render(<Home />);
    const separator = screen.getByRole('separator');
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(sidebarWidth()).toBe('436');
    fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    expect(sidebarWidth()).toBe('396');
    fireEvent.keyDown(separator, { key: 'Home' });
    expect(sidebarWidth()).toBe('380');
    fireEvent.keyDown(separator, { key: 'End' });
    expect(sidebarWidth()).toBe('760');
    expect(container.querySelector('.server-list-section').className).toContain('is-double-column');
    fireEvent.keyDown(separator, { key: 'Escape' });
    expect(sidebarWidth()).toBe('760');
    fireEvent.doubleClick(separator);
    expect(sidebarWidth()).toBe('420');
    expect(localStorage.getItem('aobobo-server-sidebar-width')).toBe('420');
  });

  it('handles pointer resizing and cleans the global resize class', () => {
    render(<Home />);
    const separator = screen.getByRole('separator');
    fireEvent.pointerDown(separator, { button: 1, clientX: 800 });
    expect(document.documentElement.classList.contains('sidebar-resizing')).toBe(false);
    fireEvent.pointerDown(separator, { button: 0, clientX: 800, pointerId: 1 });
    expect(document.documentElement.classList.contains('sidebar-resizing')).toBe(true);
    fireEvent.pointerMove(window, { clientX: 600 });
    expect(sidebarWidth()).toBe('620');
    fireEvent.pointerUp(window);
    expect(document.documentElement.classList.contains('sidebar-resizing')).toBe(false);
    expect(localStorage.getItem('aobobo-server-sidebar-width')).toBe('620');
  });

  it('opens and closes the mobile drawer', () => {
    rstest.mocked(useMediaQuery).mockReturnValue(false);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 });
    const { container } = render(<Home />);
    expect(container.querySelector('.home-view').className).toContain('sidebar-collapsed');
    fireEvent.click(screen.getAllByRole('button', { name: '展开服务器列表' })[0]);
    expect(container.querySelector('.home-view').className).not.toContain('sidebar-collapsed');
    fireEvent.click(screen.getByRole('button', { name: '关闭服务器列表' }));
    expect(container.querySelector('.home-view').className).toContain('sidebar-collapsed');
    fireEvent.click(screen.getAllByRole('button', { name: '展开服务器列表' })[0]);
    fireEvent.click(container.querySelector('.close-sidebar'));
    expect(container.querySelector('.home-view').className).toContain('sidebar-collapsed');
  });
});
