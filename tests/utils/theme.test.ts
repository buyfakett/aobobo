import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import {
  applyResolvedTheme, getThemeMediaQuery, loadThemeMode, normalizeThemeMode,
  persistThemeMode, resolveTheme,
} from '@/utils/theme';

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  rs.restoreAllMocks();
  rs.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe('theme preferences', () => {
  it.each(['auto', 'light', 'dark'])('round trips %s', (mode) => {
    persistThemeMode(mode);
    expect(loadThemeMode()).toBe(mode);
    expect(normalizeThemeMode(mode)).toBe(mode);
  });

  it.each([undefined, null, '', 'DARK', 'invalid'])('falls back for invalid preference %s', (mode) => {
    expect(normalizeThemeMode(mode)).toBe('auto');
    persistThemeMode(mode);
    expect(loadThemeMode()).toBe('auto');
  });

  it('follows the system only in automatic mode', () => {
    const query = { matches: true };
    const matchMedia = rs.fn(() => query);
    rs.stubGlobal('matchMedia', matchMedia);
    expect(resolveTheme('auto')).toBe('dark');
    query.matches = false;
    expect(resolveTheme('auto')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    expect(getThemeMediaQuery()).toBe(query);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('survives blocked storage and applies the chosen document theme', () => {
    rs.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    rs.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(loadThemeMode()).toBe('auto');
    expect(() => persistThemeMode('dark')).not.toThrow();
    applyResolvedTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('has safe server rendering defaults', () => {
    rs.stubGlobal('window', undefined);
    rs.stubGlobal('document', undefined);
    expect(loadThemeMode()).toBe('auto');
    expect(resolveTheme('auto')).toBe('dark');
    expect(getThemeMediaQuery()).toBeNull();
    expect(() => persistThemeMode('dark')).not.toThrow();
    expect(() => applyResolvedTheme('dark')).not.toThrow();
  });

  it('handles browsers without media query support', () => {
    rs.stubGlobal('matchMedia', undefined);
    expect(resolveTheme('auto')).toBe('dark');
    expect(getThemeMediaQuery()).toBeNull();
  });
});
