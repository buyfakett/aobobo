import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, rs } from '@rstest/core';
import { AllHostsModal, StatsModal } from '@/components/react/HomeModals';

rs.mock('@/components/react/ServerCard', () => ({ default: ({ server, onSelect }) => <button data-server-id={server.ID} onClick={() => onSelect?.(server)}>{server.Name}</button> }));

describe('resource overview modal', () => {
  it('shows resource totals, costs, currencies and exchange-rate warnings', () => {
    render(<StatsModal open onClose={rs.fn()} display={{
      totalServers: 3, onlineServers: 2, offlineServers: 1, totalCores: 8,
      groupCounts: [{ name: 'Edge', count: 2 }], cpuBrandCores: [{ brand: 'AMD', cores: 8 }],
      totalMemory: { value: 16, unit: 'G' }, totalDisk: { value: 512, unit: 'G' },
      totalTransfer: { value: 3, unit: 'T' }, netInTransfer: { value: 1, unit: 'T' }, netOutTransfer: { value: 2, unit: 'T' },
      costCurrency: 'USD', monthlyCost: '$20', yearlyCost: '$240',
      costSummary: { sourceCurrencies: ['USD', 'EUR'], unconvertedCount: 1, ignoredCount: 2, exchangeRate: { warning: true, loading: true, statusText: '使用缓存汇率', updatedAtText: '昨天更新' } },
    }} />);
    expect(screen.getByRole('dialog', { name: '服务器资源概览' })).toBeTruthy();
    for (const text of ['2 在线', '1 离线', 'Edge 2', 'AMD 8C', '$20', '$240', 'USD / EUR', '1 项未换算', '2 项未计入', '使用缓存汇率', '昨天更新']) expect(screen.getByText(text)).toBeTruthy();
  });

  it('handles missing metrics and closes by button, Escape and backdrop only', () => {
    rs.useFakeTimers();
    const onClose = rs.fn();
    const { rerender } = render(<StatsModal open display={{}} onClose={onClose} />);
    expect(screen.getByText('无需汇率')).toBeTruthy();
    expect(screen.getByText('CNY')).toBeTruthy();
    fireEvent.mouseDown(screen.getByText('资源池'));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(3);
    rerender(<StatsModal open={false} display={{}} onClose={onClose} />);
    act(() => rs.advanceTimersByTime(280));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('stays unmounted when closed and falls back to the configured currency', () => {
    const { rerender } = render(<StatsModal open={false} display={{}} onClose={rs.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<StatsModal open display={{ costCurrency: 'JPY' }} onClose={rs.fn()} />);
    expect(screen.getByText('JPY')).toBeTruthy();
  });
});

describe('all hosts modal', () => {
  const servers = [
    { ID: 1, Name: 'Tokyo offline', online: -1, Host: { CountryCode: 'JP', Platform: 'debian' } },
    { ID: 2, Name: 'Tokyo online', online: 1, Host: { CountryCode: 'JP', Platform: 'ubuntu' }, PublicNote: { customData: { location: 'TYO' } } },
    { ID: 3, Name: 'London', online: 1, Host: { CountryCode: 'GB', Platform: 'linux' } },
  ];
  const props = { open: true, servers, groups: [{ name: 'Asia', servers: ['1', 2] }, { name: 'Empty', servers: [] }], serverCount: { total: 3, online: 2, offline: 1 }, cycleTransferMap: {}, onClose: () => {}, onSelect: () => {} };

  it('groups servers, sorts online members first, jumps to groups and selects a server', () => {
    const onSelect = rs.fn();
    const { container } = render(<AllHostsModal {...props} onSelect={onSelect} />);
    expect(screen.getByRole('heading', { name: 'Asia' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '未分组' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Empty' })).toBeNull();
    const firstGroup = container.querySelector('[data-group-index="0"]');
    expect([...firstGroup.querySelectorAll('[data-server-id]')].map((element) => element.getAttribute('data-server-id'))).toEqual(['2', '1']);
    const ungrouped = container.querySelector<HTMLElement>('[data-group-index="1"]');
    ungrouped.scrollIntoView = rs.fn();
    fireEvent.click(container.querySelectorAll('.group-jump-chip')[1]);
    expect(ungrouped.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    fireEvent.click(screen.getByRole('button', { name: 'London' }));
    expect(onSelect).toHaveBeenCalledWith(servers[2]);
  });

  it('filters by name, country, operating system and custom location and clears searches', () => {
    const { container } = render(<AllHostsModal {...props} />);
    const input = screen.getByPlaceholderText('搜索名称 / 地区 / 系统');
    for (const [keyword, names] of [
      [' tokyo ', ['Tokyo online', 'Tokyo offline']],
      ['GB', ['London']], ['Debian', ['Tokyo offline']], ['TYO', ['Tokyo online']],
    ] as [string, string[]][]) {
      fireEvent.change(input, { target: { value: keyword } });
      expect([...container.querySelectorAll('[data-server-id]')].map((element) => element.textContent)).toEqual(names);
      expect(screen.getByText(`${names.length} 条匹配`)).toBeTruthy();
    }
    fireEvent.click(container.querySelector('.all-hosts-search__clear'));
    expect((input as HTMLInputElement).value).toBe('');
    expect(container.querySelectorAll('[data-server-id]')).toHaveLength(3);
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    expect(screen.getByText('没有符合条件的服务器')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(container.querySelectorAll('[data-server-id]')).toHaveLength(3);
  });

  it('filters online state, resets on reopening and removes dismissal listeners after closing', () => {
    rs.useFakeTimers();
    const onClose = rs.fn();
    const { rerender, container } = render(<AllHostsModal {...props} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '离线' }));
    expect(container.querySelectorAll('[data-server-id]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '在线' }));
    expect(container.querySelectorAll('[data-server-id]')).toHaveLength(2);
    fireEvent.mouseDown(screen.getByRole('heading', { name: '全部主机总览' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(3);
    rerender(<AllHostsModal {...props} open={false} onClose={onClose} />);
    act(() => rs.advanceTimersByTime(280));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
    rerender(<AllHostsModal {...props} onClose={onClose} />);
    expect(container.querySelectorAll('[data-server-id]')).toHaveLength(3);
  });

  it('shows an empty state without groups or servers', () => {
    render(<AllHostsModal {...props} groups={[]} servers={[]} serverCount={{ total: 0, online: 0, offline: 0 }} />);
    expect(screen.getByText('没有符合条件的服务器')).toBeTruthy();
    expect(screen.queryByText('台离线')).toBeNull();
  });
});
