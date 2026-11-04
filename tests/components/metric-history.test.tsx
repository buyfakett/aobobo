import { beforeEach, describe, expect, it, rstest } from '@rstest/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ResourceHistory from '@/components/react/detail/ResourceHistory';
import NetworkMonitor from '@/components/react/detail/NetworkMonitor';
import request from '@/utils/request';
import store from '@/store';
import config from '@/config';
import LineChart from '@/components/react/LineChart';

rstest.mock('@/utils/request', () => ({ default: rstest.fn() }));
rstest.mock('@/store', () => {
  const state = { setting: {}, profile: {}, serverTime: 2000000000000 };
  return { default: { state }, useStore: (selector) => selector(state) };
});
rstest.mock('@/components/react/LineChart', () => ({ default: rstest.fn(({ series }) => (
  <output data-testid="chart">{JSON.stringify(series)}</output>
)) }));

const now = 2000000000000;
const info = {
  ID: 5, Host: { MemTotal: 1024, SwapTotal: 1024, DiskTotal: 2048 },
  State: { CPU: 25, MemUsed: 512, SwapUsed: 256, DiskUsed: 1024, ProcessCount: 10, NetInSpeed: 100, NetOutSpeed: 200, TcpConnCount: 3, UdpConnCount: 4 },
};
function charts() {
  return screen.getAllByTestId('chart').map((element) => JSON.parse(element.textContent));
}
const send = rstest.mocked(request);

beforeEach(() => {
  store.state.setting = {};
  store.state.profile = {};
  send.mockReset();
  rstest.mocked(LineChart).mockClear();
  rstest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ResourceHistory', () => {
  it('captures live metrics, converts bytes to percentages, and expires samples after five minutes', () => {
    rstest.spyOn(Date, 'now').mockReturnValue(now);
    const { rerender } = render(<ResourceHistory info={info} />);
    expect(charts()[0][0].data).toEqual([[now, 25]]);
    expect(charts()[1].map((series) => series.data)).toEqual([[[now, 50]], [[now, 25]]]);
    expect(screen.queryByRole('button', { name: '7天' })).toBeNull();
    expect(screen.queryByRole('button', { name: '1小时' })).toBeNull();
    rstest.mocked(Date.now).mockReturnValue(now + 300001);
    rerender(<ResourceHistory info={{ ...info, State: { ...info.State, CPU: 30 } }} />);
    expect(charts()[0][0].data).toEqual([[now + 300001, 30]]);
    expect(send).not.toHaveBeenCalled();
  });

  it('shows empty data and resets unavailable persisted ranges', async () => {
    localStorage.setItem('aobobo_resource_history_period', '10080');
    render(<ResourceHistory info={{ ID: 1 }} />);
    expect(screen.getAllByText('等待实时数据')).toHaveLength(6);
    expect(screen.getByText('no swap')).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem('aobobo_resource_history_period')).toBe('realtime'));
  });

  it('loads historical metrics, normalizes formats, drops invalid points and applies the selected window', async () => {
    store.state.setting = { tsdb_enabled: true };
    send.mockImplementation(async ({ url }) => ({ data: { data: { data_points: [
      { ts: now, value: url.includes('metric=memory') ? 512 : 25 },
      { timestamp: now - 60000, avg: 30 }, { time: '2033-05-18T03:33:20Z', usage: 40 },
      { ts: now - 7200000, value: 5 }, { ts: 'bad', value: 2 }, { ts: now, value: 'bad' },
    ] } } }) as any);
    render(<ResourceHistory info={info} />);
    fireEvent.click(screen.getByRole('button', { name: '30分钟' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(9));
    await waitFor(() => expect(charts()[0][0].data).toEqual([[now - 60000, 30], [now, 25], [now, 40]]));
    expect(charts()[1][0].data.at(-2)[1]).toBe(50);
    expect(send).toHaveBeenCalledWith({ url: '/api/v1/server/5/metrics?metric=cpu&period=1d' });
    expect(localStorage.getItem('aobobo_resource_history_period')).toBe('30');
  });

  it('supports authenticated long ranges and query parameters in a configured URL', async () => {
    store.state.setting = { config: { tsdb_enabled: true } };
    store.state.profile = { username: 'admin' };
    const original = config.aobobo.v1ApiMetricsPath;
    config.aobobo.v1ApiMetricsPath = '/metrics/{id}?custom=1';
    try {
      send.mockResolvedValue({ data: { data: { DataPoints: [{ ts: now, value: 1 }] } } } as any);
      render(<ResourceHistory info={info} />);
      fireEvent.click(screen.getByRole('button', { name: '7天' }));
      await waitFor(() => expect(send).toHaveBeenCalledWith({ url: '/metrics/5?custom=1&metric=cpu&period=7d' }));
      fireEvent.click(screen.getByRole('button', { name: '30天' }));
      await waitFor(() => expect(send).toHaveBeenCalledWith({ url: '/metrics/5?custom=1&metric=cpu&period=30d' }));
    } finally { config.aobobo.v1ApiMetricsPath = original; }
  });

  it('handles failed history requests and ignores responses after unmount', async () => {
    store.state.setting = { tsdb_enabled: true };
    send.mockRejectedValue(new Error('offline'));
    const { unmount } = render(<ResourceHistory info={info} />);
    fireEvent.click(screen.getByRole('button', { name: '1小时' }));
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.getAllByText('暂无历史数据')).toHaveLength(6);
    unmount();
    const pending: Array<(_value: any) => void> = [];
    send.mockImplementation(() => new Promise((done) => { pending.push(done); }));
    localStorage.setItem('aobobo_resource_history_period', '60');
    const next = render(<ResourceHistory info={info} />);
    next.unmount();
    const calls = rstest.mocked(LineChart).mock.calls.length;
    await act(async () => {
      pending.forEach((resolve) => resolve({ data: { data: { data_points: [{ ts: now, value: 50 }] } } }));
    });
    expect(rstest.mocked(LineChart).mock.calls).toHaveLength(calls);
  });
});

describe('NetworkMonitor', () => {
  function monitorResponse() {
    return { data: { data: [
      { monitor_id: 1, monitor_name: 'Tokyo', created_at: [now - 90000000, now - 60000, now], avg_delay: [100, 10, 20] },
      { monitor_id: 2, monitor_name: 'London', created_at: [now, now - 60000, now - 120000], avg_delay: [10, 10, 1000] },
      { monitor_id: 3, monitor_name: 'invalid', created_at: [now], avg_delay: ['bad'] },
    ] } } as any;
  }

  it('filters samples, toggles series visibility and persists chart preferences', async () => {
    send.mockResolvedValue(monitorResponse());
    render(<NetworkMonitor info={info} />);
    expect(await screen.findByText('网络监控')).toBeTruthy();
    expect(charts()[0]).toHaveLength(2);
    expect(charts()[0][0].data).toEqual([[now - 60000, 10], [now, 20]]);
    expect(screen.getByText('Tokyo').closest('button').title).toBe('Tokyo\n平均延迟：15ms\n成功率：100%');
    fireEvent.click(screen.getByText('Tokyo'));
    expect(charts()[0]).toHaveLength(1);
    fireEvent.click(screen.getByText('Tokyo'));
    fireEvent.click(screen.getByRole('button', { name: '聚合' }));
    expect(charts()).toHaveLength(2);
    expect(localStorage.getItem('aobobo_monitor_chart_type')).toBe('single');
    fireEvent.click(screen.getByRole('button', { name: '削峰' }));
    expect(localStorage.getItem('aobobo_monitor_peak_shaving')).toBe('true');
    expect(charts()[1][0].data.some((point) => point[1] === null)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    expect(localStorage.getItem('aobobo_monitor_refresh_data')).toBe('false');
  });

  it('uses TSDB periods and authenticated long ranges', async () => {
    store.state.setting = { config: { tsdb_enabled: true } };
    store.state.profile = { username: 'admin' };
    send.mockResolvedValue(monitorResponse());
    render(<NetworkMonitor info={info} />);
    await screen.findByText('网络监控');
    expect(send).toHaveBeenCalledWith({ url: '/api/v1/server/5/service?period=1d' });
    fireEvent.click(screen.getByRole('button', { name: '7天' }));
    await waitFor(() => expect(send).toHaveBeenLastCalledWith({ url: '/api/v1/server/5/service?period=7d' }));
    fireEvent.click(screen.getByRole('button', { name: '30天' }));
    await waitFor(() => expect(send).toHaveBeenLastCalledWith({ url: '/api/v1/server/5/service?period=30d' }));
  });

  it('polls short ranges and cleans up the timer', async () => {
    rstest.useFakeTimers();
    send.mockResolvedValue(monitorResponse());
    const { unmount } = render(<NetworkMonitor info={info} />);
    await act(async () => { await Promise.resolve(); });
    expect(send).toHaveBeenCalledWith({ url: '/api/v1/service/5' });
    await act(async () => { await rstest.advanceTimersByTimeAsync(30000); });
    expect(send).toHaveBeenCalledTimes(2);
    unmount();
    await rstest.advanceTimersByTimeAsync(60000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('keeps the panel hidden for no data or network failures', async () => {
    send.mockRejectedValue(new Error('offline'));
    const { container } = render(<NetworkMonitor info={info} />);
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
