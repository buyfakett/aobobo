import { describe, expect, it } from '@rstest/core';
import { hasTsdb, isTsdbEnabled } from '../src/utils/tsdb';

describe('TSDB settings', () => {
  it.each([undefined, {}, { state: {} }, { state: { setting: null } }])('handles missing settings', (store) => {
    expect(hasTsdb(store)).toBe(false);
    expect(isTsdbEnabled(store)).toBe(false);
  });
  it.each([
    [{}, false, false],
    [{ tsdb_enabled: true }, true, true],
    [{ tsdb_enabled: false }, true, false],
    [{ config: { tsdb_enabled: true } }, true, true],
    [{ config: { tsdb_enabled: false } }, true, false],
    [{ tsdb_enabled: 'true' }, true, false],
    [{ config: { tsdb_enabled: 1 } }, true, false],
    [{ config: { tsdb_enabled: false }, tsdb_enabled: true }, true, true],
  ])('distinguishes presence from explicit enabling', (setting, present, enabled) => {
    expect(hasTsdb({ state: { setting } })).toBe(present);
    expect(isTsdbEnabled({ state: { setting } })).toBe(enabled);
  });
});
