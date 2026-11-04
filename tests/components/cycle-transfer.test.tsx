import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import config from '@/config';
import CycleTransfer from '@/components/react/detail/CycleTransfer';
import { loadCycleTransferByServer } from '@/utils/cycle-transfer';
import * as cycleTransferActual from '@/utils/cycle-transfer' with { rstest: 'importActual' };

rs.mock('@/utils/cycle-transfer', () => ({
  ...cycleTransferActual,
  loadCycleTransferByServer: rs.fn(),
}));

const load = rs.mocked(loadCycleTransferByServer);
const info = { ID: 7, Name: 'Server' };
const rule = {
  source: 'v1', ruleId: '1', serverKey: '7', ruleName: 'Monthly quota', statusLevel: 'fine',
  periodStart: '2025-01-01', periodEnd: '2025-02-01', nextCheckDisplay: '2025.01.02 00:00:00',
  currentUsageDisplay: '20GB', remainingDisplay: '80GB', maxDisplay: '100GB', minDisplay: '0B', remainingPercent: 80,
};
beforeEach(() => {
  rs.useFakeTimers();
  config.aobobo.hideDetailCycleTransfer = false;
  config.aobobo.detailCycleTransferRefreshTime = 10;
  load.mockReset();
});
afterEach(() => {
  config.aobobo.hideDetailCycleTransfer = false;
  config.aobobo.detailCycleTransferRefreshTime = 60;
  rs.restoreAllMocks(); rs.useRealTimers();
});
const flushLoad = () => act(async () => { await Promise.resolve(); });

describe('cycle transfer panel', () => {
  it('loads the current server quota, refreshes periodically, and cancels on unmount', async () => {
    load.mockResolvedValue([rule]);
    const { container, unmount } = render(<CycleTransfer info={info} />);
    await flushLoad();
    expect(load).toHaveBeenCalledWith(info);
    expect(screen.getByText('Monthly quota')).toBeTruthy();
    expect(screen.getByText('周期 01.01 - 02.01')).toBeTruthy();
    expect(screen.getByText('已用 20GB')).toBeTruthy();
    expect(screen.queryByText(/下限/)).toBeNull();
    expect(container.querySelector<HTMLElement>('.progress-bar').style.width).toBe('80%');
    expect(screen.getByText('10s 自动刷新')).toBeTruthy();
    await act(async () => { await rs.advanceTimersByTimeAsync(10000); });
    expect(load).toHaveBeenCalledTimes(2);
    unmount();
    await rs.advanceTimersByTimeAsync(30000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('handles cross-year periods, malformed dates, minimum quotas and progress bounds', async () => {
    load.mockResolvedValue([
      { ...rule, remainingPercent: 120, minDisplay: '10GB', periodStart: '2024-12-01', periodEnd: '2025-01-01' },
      { ...rule, ruleId: '2', ruleName: 'Over quota', statusLevel: 'over', remainingPercent: -20, minDisplay: '-', periodStart: 'unknown', periodEnd: 'later' },
      { ...rule, ruleId: '3', ruleName: 'Unlimited', remainingPercent: NaN },
    ]);
    const { container } = render(<CycleTransfer info={info} />);
    await flushLoad();
    expect(screen.getByText('周期 2024.12.01 - 2025.01.01')).toBeTruthy();
    expect(screen.getByText('周期 unknown - later')).toBeTruthy();
    expect(screen.getByText('下限 10GB')).toBeTruthy();
    const bars = container.querySelectorAll<HTMLElement>('.progress-bar');
    expect([...bars].map((bar) => bar.style.width)).toEqual(['100%', '0%']);
  });

  it('clears the panel after a failed refresh and supports disabling polling', async () => {
    const error = new Error('offline');
    const log = rs.spyOn(console, 'error').mockImplementation(() => {});
    load.mockResolvedValueOnce([rule]).mockRejectedValueOnce(error);
    render(<CycleTransfer info={info} />);
    await flushLoad();
    expect(screen.getByText('Monthly quota')).toBeTruthy();
    await act(async () => { await rs.advanceTimersByTimeAsync(10000); });
    expect(screen.queryByText('Monthly quota')).toBeNull();
    expect(log).toHaveBeenCalledWith('Failed to load cycle transfer data:', error);
  });

  it('skips hidden or unidentified servers and accepts empty responses without polling', async () => {
    config.aobobo.hideDetailCycleTransfer = true;
    const { rerender, container } = render(<CycleTransfer info={info} />);
    expect(load).not.toHaveBeenCalled();
    config.aobobo.hideDetailCycleTransfer = false;
    rerender(<CycleTransfer info={{}} />);
    expect(load).not.toHaveBeenCalled();
    config.aobobo.detailCycleTransferRefreshTime = -1;
    load.mockResolvedValue(null);
    rerender(<CycleTransfer info={info} />);
    await flushLoad();
    expect(container.textContent).toBe('');
    await rs.advanceTimersByTimeAsync(60000);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('ignores responses that arrive after unmount', async () => {
    let resolve;
    load.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { unmount } = render(<CycleTransfer info={info} />);
    unmount();
    await act(async () => { resolve([rule]); });
    expect(rs.getTimerCount()).toBe(0);
  });
});
