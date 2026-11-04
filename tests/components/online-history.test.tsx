import { beforeEach, describe, expect, it, rstest } from '@rstest/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OnlineHistory from '@/components/react/detail/OnlineHistory';
import { isOnlineHistorySupported, loadServerOnlineHistory } from '@/utils/api';

rstest.mock('@/utils/api', () => ({
  isOnlineHistorySupported: rstest.fn(() => true), loadServerOnlineHistory: rstest.fn(),
}));

const history = {
  timezone: 'UTC', max_days: 30, currently_online: true, total_online_seconds: 43200,
  online_rate: 50, last_active: '2026-11-04T12:00:00Z',
  window_start: '2026-11-01T00:00:00Z', window_end: '2026-11-05T00:00:00Z',
  daily: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((date) => ({ date })),
  periods: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((date) => ({
    start: `${date}T06:00:00Z`, end: `${date}T12:00:00Z`, ongoing: date === '2026-11-04',
  })),
};

describe('OnlineHistory', () => {
  const load = rstest.mocked(loadServerOnlineHistory);
  beforeEach(() => {
    load.mockReset();
    load.mockResolvedValue(history);
    rstest.mocked(isOnlineHistorySupported).mockReturnValue(true);
  });

  it('renders summaries and lets users switch modes, expand days and change the range', async () => {
    render(<OnlineHistory info={{ ID: 1 }} />);
    expect(await screen.findByText('50.0%')).toBeTruthy();
    expect(screen.getByText('12:00:00')).toBeTruthy();
    expect(screen.getByText('持续中')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '展开更多' }));
    expect(screen.queryByRole('button', { name: '展开更多' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '离线' }));
    expect(screen.getByText('离线时段')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '在线' }));
    expect(screen.getByText('在线时段')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '7天' }));
    await waitFor(() => expect(load).toHaveBeenLastCalledWith(1, 7));
    fireEvent.click(screen.getByRole('button', { name: '7天' }));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ response: { status: 404 } }, '当前探针版本暂不提供在线历史接口。'],
    [{ response: { status: 403 } }, '登录后可查看更多在线历史。'],
    [{ response: { data: { error: 'only 1d data available for guests' } } }, '游客仅可查看最近 1 天在线历史。'],
    [new Error('offline'), '在线历史加载失败，请稍后重试。'],
  ])('shows actionable error messages and retries', async (error, message) => {
    load.mockRejectedValueOnce(error);
    render(<OnlineHistory info={{ ID: 1 }} />);
    expect(await screen.findByText(message)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('50.0%')).toBeTruthy();
  });

  it('falls back to one day when guest access rejects a wider range', async () => {
    render(<OnlineHistory info={{ ID: 1 }} />);
    await screen.findByText('50.0%');
    load.mockRejectedValueOnce(new Error('only 1d data available for guests'));
    load.mockResolvedValue({ ...history, max_days: 1 });
    fireEvent.click(screen.getByRole('button', { name: '30天' }));
    await waitFor(() => expect(load).toHaveBeenLastCalledWith(1, 1));
    expect((screen.getByRole('button', { name: '30天' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('handles empty records, limited ranges and unavailable servers', async () => {
    load.mockResolvedValue({ ...history, max_days: 1, periods: [], last_active: null, currently_online: false });
    const { rerender } = render(<OnlineHistory info={{ ID: 1 }} />);
    expect(await screen.findByText('当前时间范围内没有在线记录。')).toBeTruthy();
    expect(screen.getByText('N/A')).toBeTruthy();
    expect((screen.getByRole('button', { name: '7天' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<OnlineHistory info={{}} />);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not start requests on unsupported backends', () => {
    rstest.mocked(isOnlineHistorySupported).mockReturnValue(false);
    render(<OnlineHistory info={{ ID: 1 }} />);
    expect(screen.getByText('当前探针版本暂不提供在线历史接口。')).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it('polls every minute and stops polling when unmounted', async () => {
    rstest.useFakeTimers();
    const { unmount } = render(<OnlineHistory info={{ ID: 1 }} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await rstest.advanceTimersByTimeAsync(60000); });
    expect(load).toHaveBeenCalledTimes(2);
    unmount();
    await rstest.advanceTimersByTimeAsync(120000);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
