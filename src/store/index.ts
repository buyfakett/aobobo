import { useSyncExternalStore } from 'react';
import config from '@/config';
import { normalizeTimestamp } from '@/utils/date';
import {
  loadAvailability,
  loadServerGroup as loadNezhaV1ServerGroup,
  loadSetting as loadNezhaV1Setting,
  loadProfile as loadNezhaV1Profile,
} from '@/utils/api';
import { msg } from '@/ws';
import {
  THEME_MODES,
  applyResolvedTheme,
  getThemeMediaQuery,
  loadThemeMode,
  normalizeThemeMode,
  persistThemeMode,
  resolveTheme,
} from '@/utils/theme';

const state: any = {
  init: false,
  serverTime: 0,
  serverGroup: [],
  serverList: [],
  serverCount: { total: 0, online: 0, offline: 0 },
  availability: {},
  availabilityEnabled: false,
  showAvailability: config.aobobo.showAvailability !== false,
  profile: {},
  setting: {},
  themeMode: THEME_MODES.AUTO,
  resolvedTheme: 'dark',
  globeFocus: null,
};

const listeners = new Set<() => void>();
let version = 0;
let firstSetServers = true;
let removeThemeListener = null;
let watchingWs = false;

function emitChange() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function isOnline(lastActive: any, currentTime = Date.now()) {
  const lastActiveTime = normalizeTimestamp(lastActive);
  if (!lastActiveTime) return -1;
  const normalizedCurrentTime = normalizeTimestamp(currentTime, Date.now());
  return normalizedCurrentTime - lastActiveTime > 10 * 1000 ? -1 : 1;
}

function resolveOnline(server: any, currentTime = Date.now()) {
  return isOnline(server?.LastActive, currentTime);
}

function handleServerCount(servers: any[]) {
  return {
    total: servers.length,
    online: servers.filter((item) => item.online === 1).length,
    offline: servers.filter((item) => item.online === -1).length,
  };
}

function mergeAvailability(servers: any[], availabilityMap: Record<string, number>, enabled: boolean) {
  return servers.map((server) => {
    if (!enabled) {
      if (!Object.prototype.hasOwnProperty.call(server, 'availability')) return server;
      const next = { ...server };
      delete next.availability;
      return next;
    }
    const value = availabilityMap?.[String(server.ID)];
    return value === undefined ? server : { ...server, availability: value };
  });
}

const mutations: Record<string, (_payload?: any) => void> = {
  SET_SERVER_TIME(time) { state.serverTime = time; },
  SET_SERVER_GROUP(serverGroup) { state.serverGroup = serverGroup || []; },
  SET_SERVERS(servers) {
    const next = mergeAvailability([...servers], state.availability, state.showAvailability)
      .sort((a, b) => b.DisplayIndex - a.DisplayIndex);
    state.serverList = next;
    state.serverCount = handleServerCount(next);
    state.init = true;
  },
  UPDATE_SERVERS(servers) {
    const previous = new Map<any, any>(state.serverList.map((server) => [server.ID, server]));
    const next = servers.map((server) => ({
      ...server,
      ...(previous.get(server.ID)?.PublicNote ? { PublicNote: previous.get(server.ID).PublicNote } : {}),
    }));
    state.serverList = mergeAvailability(next, state.availability, state.showAvailability)
      .sort((a, b) => b.DisplayIndex - a.DisplayIndex);
    state.serverCount = handleServerCount(state.serverList);
    state.init = true;
  },
  SET_AVAILABILITY(availability) {
    state.availability = availability || {};
    state.availabilityEnabled = Object.keys(state.availability).length > 0;
  },
  SET_PROFILE(profile) { state.profile = profile || {}; },
  SET_SETTING(setting) { state.setting = setting || {}; },
  SET_SHOW_AVAILABILITY(enabled) { state.showAvailability = Boolean(enabled); },
  SET_THEME_MODE(themeMode) { state.themeMode = themeMode; },
  SET_RESOLVED_THEME(resolvedTheme) { state.resolvedTheme = resolvedTheme; },
  SET_GLOBE_FOCUS(focus) { state.globeFocus = focus; },
  CLEAR_GLOBE_FOCUS() { state.globeFocus = null; },
};

function commit(type: string, payload?: any) {
  const mutation = mutations[type];
  if (!mutation) throw new Error(`Unknown store mutation: ${type}`);
  mutation(payload);
  emitChange();
}

const actions: Record<string, (_payload?: any) => any> = {
  initTheme() {
    commit('SET_THEME_MODE', loadThemeMode());
    actions.syncTheme();
    removeThemeListener?.();
    const mediaQuery = getThemeMediaQuery();
    if (!mediaQuery) return;
    const handleThemeChange = () => actions.syncTheme();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleThemeChange);
      removeThemeListener = () => mediaQuery.removeEventListener('change', handleThemeChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleThemeChange);
      removeThemeListener = () => mediaQuery.removeListener(handleThemeChange);
    }
  },
  setThemeMode(themeMode) {
    const normalizedMode = normalizeThemeMode(themeMode);
    commit('SET_THEME_MODE', normalizedMode);
    persistThemeMode(normalizedMode);
    actions.syncTheme();
  },
  syncTheme() {
    const resolvedTheme = resolveTheme(state.themeMode);
    commit('SET_RESOLVED_THEME', resolvedTheme);
    applyResolvedTheme(resolvedTheme);
  },
  async initServerInfo() {
    firstSetServers = true;
    loadNezhaV1ServerGroup().then((result) => result && commit('SET_SERVER_GROUP', result));
    loadNezhaV1Setting().then((result) => {
      if (!result) return;
      commit('SET_SETTING', result);
      if (!(window.$$aoboboConfig?.title ?? window.$$nazhuaConfig?.title)) {
        config.aobobo.title = result.config?.site_name || result.site_name;
        document.title = config.aobobo.title;
      }
    });
    loadNezhaV1Profile().then((result) => result && commit('SET_PROFILE', result));
  },
  async refreshAvailability() {
    if (!state.showAvailability) return;
    const availability = await loadAvailability();
    if (availability?.hidden) {
      commit('SET_SHOW_AVAILABILITY', false);
    } else if (availability) {
      commit('SET_AVAILABILITY', availability);
      commit('UPDATE_SERVERS', state.serverList);
    }
  },
  watchWsMsg() {
    if (watchingWs) return;
    watchingWs = true;
    msg.on('servers', (result) => {
      if (!result) return;
      const currentTime = normalizeTimestamp(result.now, Date.now());
      commit('SET_SERVER_TIME', currentTime);
      const servers = result.servers?.map?.((server) => ({
        ...server,
        online: resolveOnline(server, currentTime),
      })) || [];
      if (firstSetServers) {
        firstSetServers = false;
        commit('SET_SERVERS', servers);
      } else {
        commit('UPDATE_SERVERS', servers);
      }
    });
  },
  focusGlobeOnServer({ code, name }) { commit('SET_GLOBE_FOCUS', { code, name }); },
  clearGlobeFocus() { commit('CLEAR_GLOBE_FOCUS'); },
};

const store = {
  state,
  commit,
  dispatch(type: string, payload?: any) {
    const action = actions[type];
    if (!action) return Promise.reject(new Error(`Unknown store action: ${type}`));
    return action(payload);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getVersion: () => version,
};

export function useStore<T = any>(selector: (_currentState: any) => T = ((currentState) => currentState) as any): T {
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  return selector(state);
}

export default store;
