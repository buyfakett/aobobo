import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core';
import { act, renderHook } from '@testing-library/react';
import config from '../src/config';
import store, { useStore } from '../src/store';
import { loadAvailability, loadProfile, loadServerGroup, loadSetting } from '../src/utils/api';
import { msg } from '../src/ws';

rstest.mock('../src/utils/api', () => ({
  loadAvailability: rstest.fn(),
  loadProfile: rstest.fn(),
  loadServerGroup: rstest.fn(),
  loadSetting: rstest.fn(),
}));
rstest.mock('../src/ws', () => ({ msg: { on: rstest.fn() } }));

describe('application store', () => {
  const originalTitle = config.aobobo.title;
  beforeEach(() => {
    rstest.mocked(loadAvailability).mockReset();
    rstest.mocked(loadProfile).mockReset().mockResolvedValue(null);
    rstest.mocked(loadServerGroup).mockReset().mockResolvedValue(null);
    rstest.mocked(loadSetting).mockReset().mockResolvedValue(null);
    store.commit('SET_SHOW_AVAILABILITY', false);
    store.commit('SET_AVAILABILITY', null);
    store.commit('SET_SERVERS', []);
    store.commit('SET_SERVER_GROUP', null);
    store.commit('SET_PROFILE', null);
    store.commit('SET_SETTING', null);
    store.commit('SET_THEME_MODE', 'auto');
    store.commit('CLEAR_GLOBE_FOCUS');
  });
  afterEach(() => {
    config.aobobo.title = originalTitle;
    delete window.$$aoboboConfig;
    delete window.$$nazhuaConfig;
    delete document.documentElement.dataset.theme;
  });

  it('notifies subscribers once per successful mutation and supports unsubscribe', async () => {
    const listener = rstest.fn();
    const unsubscribe = store.subscribe(listener);
    const version = store.getVersion();
    store.commit('SET_SERVER_TIME', 123);
    expect(store.state.serverTime).toBe(123);
    expect(store.getVersion()).toBe(version + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(() => store.commit('MISSING')).toThrow('Unknown store mutation: MISSING');
    expect(store.getVersion()).toBe(version + 1);
    unsubscribe();
    store.commit('SET_SETTING', { name: 'new' });
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(store.dispatch('missing')).rejects.toThrow('Unknown store action: missing');
  });

  it('sorts snapshots without mutating input and counts each connection status', () => {
    const servers = [
      { ID: 1, DisplayIndex: 1, online: -1, availability: 70 },
      { ID: 2, DisplayIndex: 3, online: 1 },
      { ID: 3, DisplayIndex: 2, online: 0 },
    ];
    store.commit('SET_SERVERS', servers);
    expect(store.state.serverList.map(({ ID }) => ID)).toEqual([2, 3, 1]);
    expect(store.state.serverList[2]).not.toHaveProperty('availability');
    expect(servers[0].availability).toBe(70);
    expect(servers.map(({ ID }) => ID)).toEqual([1, 2, 3]);
    expect(store.state.serverCount).toEqual({ total: 3, online: 1, offline: 1 });
    expect(store.state.init).toBe(true);
  });

  it('merges availability and retains public notes across live updates', () => {
    store.commit('SET_SHOW_AVAILABILITY', true);
    store.commit('SET_AVAILABILITY', { 1: 99.9 });
    expect(store.state.availabilityEnabled).toBe(true);
    store.commit('SET_SERVERS', [
      { ID: 1, DisplayIndex: 0, PublicNote: { location: 'TYO' } },
      { ID: 2, DisplayIndex: 1, PublicNote: null },
    ]);
    store.commit('UPDATE_SERVERS', [
      { ID: 1, DisplayIndex: 2, online: 1, PublicNote: null },
      { ID: 2, DisplayIndex: 1, online: -1, PublicNote: { location: 'LAX' } },
    ]);
    expect(store.state.serverList).toEqual([
      { ID: 1, DisplayIndex: 2, online: 1, PublicNote: { location: 'TYO' }, availability: 99.9 },
      { ID: 2, DisplayIndex: 1, online: -1, PublicNote: { location: 'LAX' } },
    ]);
    expect(store.state.serverCount).toEqual({ total: 2, online: 1, offline: 1 });
    store.commit('SET_AVAILABILITY', {});
    expect(store.state.availabilityEnabled).toBe(false);
  });

  it('updates selected React subscribers when state changes', () => {
    const { result } = renderHook(() => useStore((state) => state.profile.name));
    expect(result.current).toBeUndefined();
    act(() => store.commit('SET_PROFILE', { name: 'Alice' }));
    expect(result.current).toBe('Alice');
    const allState = renderHook(() => useStore());
    expect(allState.result.current).toBe(store.state);
  });

  it('normalizes and persists a chosen theme and applies the resolved theme', () => {
    rstest.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as any);
    store.dispatch('setThemeMode', 'dark');
    expect(store.state.themeMode).toBe('dark');
    expect(store.state.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('aobobo-theme-mode')).toBe('dark');
    store.dispatch('setThemeMode', 'invalid');
    expect(store.state.themeMode).toBe('auto');
    expect(store.state.resolvedTheme).toBe('light');
    expect(localStorage.getItem('aobobo-theme-mode')).toBe('auto');
  });

  it('follows system theme changes and replaces media listeners on initialization', () => {
    const media = { matches: false, addEventListener: rstest.fn(), removeEventListener: rstest.fn() };
    rstest.spyOn(window, 'matchMedia').mockReturnValue(media as any);
    localStorage.setItem('aobobo-theme-mode', 'auto');
    store.dispatch('initTheme');
    const callback = media.addEventListener.mock.calls[0][1];
    expect(store.state.resolvedTheme).toBe('light');
    media.matches = true;
    callback();
    expect(store.state.resolvedTheme).toBe('dark');
    store.dispatch('initTheme');
    expect(media.removeEventListener).toHaveBeenCalledWith('change', callback);
    expect(media.addEventListener).toHaveBeenCalledTimes(2);
  });

  it('supports legacy media listeners and environments without listener methods', () => {
    const media = { matches: true, addListener: rstest.fn(), removeListener: rstest.fn() };
    const matchMedia = rstest.spyOn(window, 'matchMedia').mockReturnValue(media as any);
    store.dispatch('initTheme');
    const callback = media.addListener.mock.calls[0][0];
    media.matches = false;
    callback();
    expect(store.state.resolvedTheme).toBe('light');
    matchMedia.mockReturnValue({ matches: false } as any);
    store.dispatch('initTheme');
    expect(media.removeListener).toHaveBeenCalledWith(callback);
  });

  it('loads server metadata and uses a dashboard title when no runtime title is set', async () => {
    rstest.mocked(loadServerGroup).mockResolvedValue([{ name: 'Asia', servers: [1] }]);
    rstest.mocked(loadSetting).mockResolvedValue({ config: { site_name: 'Dashboard' } });
    rstest.mocked(loadProfile).mockResolvedValue({ name: 'Alice' });
    await store.dispatch('initServerInfo');
    expect(store.state.serverGroup).toEqual([{ name: 'Asia', servers: [1] }]);
    expect(store.state.setting).toEqual({ config: { site_name: 'Dashboard' } });
    expect(store.state.profile).toEqual({ name: 'Alice' });
    expect(config.aobobo.title).toBe('Dashboard');
    expect(document.title).toBe('Dashboard');
    rstest.mocked(loadSetting).mockResolvedValue({ site_name: 'Legacy dashboard' });
    await store.dispatch('initServerInfo');
    expect(document.title).toBe('Legacy dashboard');
  });

  it.each(['$$aoboboConfig', '$$nazhuaConfig'])('preserves a custom runtime title from %s', async (key) => {
    window[key] = { title: 'Custom title' };
    config.aobobo.title = 'Custom title';
    document.title = 'Custom title';
    rstest.mocked(loadSetting).mockResolvedValue({ site_name: 'Dashboard' });
    await store.dispatch('initServerInfo');
    expect(config.aobobo.title).toBe('Custom title');
    expect(document.title).toBe('Custom title');
  });

  it('keeps existing metadata when API calls return no result', async () => {
    store.commit('SET_PROFILE', { name: 'existing' });
    store.commit('SET_SETTING', { site_name: 'existing' });
    store.commit('SET_SERVER_GROUP', [{ name: 'existing' }]);
    await store.dispatch('initServerInfo');
    expect(store.state.profile).toEqual({ name: 'existing' });
    expect(store.state.setting).toEqual({ site_name: 'existing' });
    expect(store.state.serverGroup).toEqual([{ name: 'existing' }]);
  });

  it('skips disabled availability, applies valid data and honors hidden responses', async () => {
    await store.dispatch('refreshAvailability');
    expect(loadAvailability).not.toHaveBeenCalled();
    store.commit('SET_SHOW_AVAILABILITY', true);
    store.commit('SET_SERVERS', [{ ID: 1, DisplayIndex: 0 }]);
    rstest.mocked(loadAvailability).mockResolvedValue({ 1: 98 });
    await store.dispatch('refreshAvailability');
    expect(store.state.serverList[0].availability).toBe(98);
    rstest.mocked(loadAvailability).mockResolvedValue(null);
    await store.dispatch('refreshAvailability');
    expect(store.state.availability).toEqual({ 1: 98 });
    rstest.mocked(loadAvailability).mockResolvedValue({ hidden: 1 });
    await store.dispatch('refreshAvailability');
    expect(store.state.showAvailability).toBe(false);
  });

  it('subscribes to WebSocket snapshots once and evaluates online status at the server time', async () => {
    await store.dispatch('initServerInfo');
    store.dispatch('watchWsMsg');
    store.dispatch('watchWsMsg');
    expect(msg.on).toHaveBeenCalledTimes(1);
    const [event, receive] = rstest.mocked(msg.on).mock.calls[0];
    expect(event).toBe('servers');
    const version = store.getVersion();
    receive(null);
    expect(store.getVersion()).toBe(version);
    const now = 1_700_000_020;
    receive({ now, servers: [
      { ID: 1, DisplayIndex: 1, LastActive: now, PublicNote: { location: 'TYO' } },
      { ID: 2, DisplayIndex: 2, LastActive: now - 10 },
      { ID: 3, DisplayIndex: 3, LastActive: now - 11 },
      { ID: 4, DisplayIndex: 4, LastActive: null },
    ] });
    expect(store.state.serverTime).toBe(now * 1000);
    expect(store.state.serverList.map(({ ID, online }) => [ID, online])).toEqual([[4, -1], [3, -1], [2, 1], [1, 1]]);
    expect(store.state.serverCount).toEqual({ total: 4, online: 2, offline: 2 });
    receive({ now: now + 1, servers: [{ ID: 1, DisplayIndex: 1, LastActive: now + 1 }] });
    expect(store.state.serverList[0].PublicNote).toEqual({ location: 'TYO' });
    rstest.useFakeTimers();
    rstest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    receive({ now: 'invalid' });
    expect(store.state.serverTime).toBe(Date.now());
    expect(store.state.serverList).toEqual([]);
  });

  it('sets and clears the globe focus', () => {
    store.dispatch('focusGlobeOnServer', { code: 'TYO', name: 'Tokyo' });
    expect(store.state.globeFocus).toEqual({ code: 'TYO', name: 'Tokyo' });
    store.dispatch('clearGlobeFocus');
    expect(store.state.globeFocus).toBeNull();
  });
});
