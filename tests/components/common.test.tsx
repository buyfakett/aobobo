import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import config from '@/config';
import store from '@/store';
import { AppFooter, CurrentTime, DashboardButton, DetailPanel, EmptyState, Modal, ThemeModeSwitch } from '@/components/react/Common';

const originalConfig = { ...config.aobobo };
beforeEach(() => {
  store.commit('SET_THEME_MODE', 'auto');
  store.commit('SET_PROFILE', {});
  rs.stubGlobal('matchMedia', rs.fn(() => ({ matches: false, addEventListener: rs.fn(), removeEventListener: rs.fn() })));
});
afterEach(() => {
  for (const key of Object.keys(config.aobobo)) delete config.aobobo[key];
  Object.assign(config.aobobo, originalConfig);
  rs.restoreAllMocks(); rs.unstubAllGlobals(); rs.useRealTimers();
});

describe('shared controls', () => {
  it('selects a theme and avoids dispatching an unchanged preference', () => {
    const dispatch = rs.spyOn(store, 'dispatch');
    render(<ThemeModeSwitch />);
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(store.state.themeMode).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('aobobo-theme-mode')).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(store.state.themeMode).toBe('dark');
  });

  it('cycles all theme modes with the compact mobile control', () => {
    rs.stubGlobal('matchMedia', rs.fn(() => ({ matches: true, addEventListener: rs.fn(), removeEventListener: rs.fn() })));
    render(<ThemeModeSwitch />);
    for (const [label, expected] of [['Auto', 'light'], ['Light', 'dark'], ['Dark', 'auto']]) {
      fireEvent.click(screen.getByRole('button', { name: `切换主题，当前：${label}` }));
      expect(store.state.themeMode).toBe(expected);
    }
  });

  it('changes the dashboard link after login and honors visibility and URL settings', () => {
    config.aobobo.v1DashboardUrl = '';
    const { rerender, container } = render(<DashboardButton />);
    expect(screen.getByRole('link', { name: '登录' }).getAttribute('href')).toBe('/dashboard');
    act(() => store.commit('SET_PROFILE', { username: 'admin' }));
    expect(screen.getByRole('link', { name: '管理后台' }).getAttribute('title')).toBe('访问管理后台');
    config.aobobo.v1DashboardUrl = '/admin';
    rerender(<DashboardButton />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/admin');
    config.aobobo.v1HideNezhaDashboardBtn = true;
    rerender(<DashboardButton />);
    expect(container.textContent).toBe('');
  });

  it('shows configured attribution and default attribution', () => {
    const { rerender } = render(<AppFooter />);
    expect(screen.getByRole('link', { name: '哪吒监控' }).getAttribute('href')).toBe('https://nezha.wiki');
    Object.assign(config.aobobo, { poweredByName: 'My Monitor', poweredByUrl: 'https://example.com', aoboboVersion: '9.0', aoboboUrl: 'https://example.com/theme' });
    rerender(<AppFooter className="custom-footer" />);
    expect(screen.getByRole('link', { name: 'My Monitor' }).getAttribute('href')).toBe('https://example.com');
    expect(screen.getByText('v9.0')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'buyfakett' }).getAttribute('href')).toBe('https://example.com/theme');
  });

  it('renders titled panels, action-only headers and empty states', () => {
    const { rerender, container } = render(<DetailPanel title="监控" icon="ri-pulse-line" actions={<button>刷新</button>}><EmptyState>暂无数据</EmptyState></DetailPanel>);
    expect(screen.getByRole('heading', { name: '监控' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '刷新' })).toBeTruthy();
    expect(screen.getByText('暂无数据')).toBeTruthy();
    rerender(<DetailPanel actions={<span>操作</span>}>内容</DetailPanel>);
    expect(container.querySelector('header')).not.toBeNull();
    rerender(<DetailPanel>内容</DetailPanel>);
    expect(container.querySelector('header')).toBeNull();
  });
});

describe('modal dismissal', () => {
  it('closes on Escape, the close button and backdrop but keeps interior clicks open', () => {
    const onClose = rs.fn();
    const { rerender, unmount } = render(<Modal open title="详情" onClose={onClose}><button>内部操作</button></Modal>);
    expect(document.body.classList.contains('modal-open')).toBe(true);
    fireEvent.mouseDown(screen.getByRole('button', { name: '内部操作' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    fireEvent.mouseDown(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(3);
    rerender(<Modal open={false} title="详情" onClose={onClose}>内容</Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
    rerender(<Modal open title="详情" onClose={onClose}>内容</Modal>);
    unmount();
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('supports informational dialogs without a close callback', () => {
    render(<Modal open title="说明">只读信息</Modal>);
    expect(() => { fireEvent.keyDown(window, { key: 'Escape' }); fireEvent.mouseDown(screen.getByRole('presentation')); }).not.toThrow();
  });
});

describe('current time', () => {
  it('updates every second across midnight and clears its timer when removed', () => {
    rs.useFakeTimers();
    rs.setSystemTime(new Date(2026, 10, 4, 23, 59, 59));
    const { unmount, rerender } = render(<CurrentTime panelWidth={250} />);
    expect(screen.getByLabelText('当前时间').style.getPropertyValue('--current-time-panel-width')).toBe('250px');
    expect(screen.getByText('2026.11.04')).toBeTruthy();
    expect(screen.getByLabelText('当前秒数').textContent).toBe('SEC59');
    act(() => rs.advanceTimersByTime(1000));
    expect(screen.getByText('2026.11.05')).toBeTruthy();
    expect(screen.getByLabelText('当前秒数').textContent).toBe('SEC00');
    rerender(<CurrentTime panelWidth="20rem" />);
    expect(screen.getByLabelText('当前时间').style.getPropertyValue('--current-time-panel-width')).toBe('20rem');
    unmount();
    expect(rs.getTimerCount()).toBe(0);
  });
});
