import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, rs } from '@rstest/core';
import DetailContent from '@/components/react/detail/DetailContent';

rs.mock('@/components/react/detail/DetailHeader', () => ({ default: ({ info }) => <header>{info.Name}</header> }));
rs.mock('@/components/react/detail/DetailStatus', () => ({ default: () => <section>resource status</section> }));
rs.mock('@/components/react/detail/ResourceHistory', () => ({ default: () => <section>resource history</section> }));
rs.mock('@/components/react/detail/CycleTransfer', () => ({ default: () => <section>cycle quota</section> }));
rs.mock('@/components/react/detail/ServerInfo', () => ({ default: () => <section>server information</section> }));
rs.mock('@/components/react/detail/NetworkMonitor', () => ({ default: () => <section>network monitor</section> }));
rs.mock('@/components/react/detail/OnlineHistory', () => ({ default: () => <section>online history</section> }));

describe('server detail tabs', () => {
  it('starts with overview, switches to online history, and notifies the parent', () => {
    const onTabChange = rs.fn();
    render(<DetailContent info={{ Name: 'Server' }} onTabChange={onTabChange} />);
    expect(screen.getByText('Server')).toBeTruthy();
    expect(screen.getByRole('tab', { name: '概览' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('resource status')).toBeTruthy();
    expect(screen.getByText('network monitor')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '在线历史' }));
    expect(screen.getByRole('tab', { name: '在线历史' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('online history')).toBeTruthy();
    expect(screen.queryByText('resource status')).toBeNull();
    expect(onTabChange).toHaveBeenLastCalledWith('online');
    fireEvent.click(screen.getByRole('tab', { name: '概览' }));
    expect(screen.getByText('resource history')).toBeTruthy();
    expect(onTabChange).toHaveBeenLastCalledWith('overview');
  });

  it('honors the requested initial history tab without requiring a callback', () => {
    render(<DetailContent info={{ Name: 'Server' }} initialTab="online" />);
    expect(screen.getByText('online history')).toBeTruthy();
    expect(() => fireEvent.click(screen.getByRole('tab', { name: '概览' }))).not.toThrow();
    expect(screen.getByText('cycle quota')).toBeTruthy();
    expect(screen.getByText('server information')).toBeTruthy();
  });
});
