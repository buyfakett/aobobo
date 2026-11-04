import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { loadGlobeView, persistGlobeView } from '@/utils/globe-view';

const storageKey = 'aobobo_globe_view';
beforeEach(() => window.localStorage.clear());
afterEach(() => { rs.restoreAllMocks(); rs.unstubAllGlobals(); });

describe('persisted globe camera', () => {
  it.each([
    { lat: 0, lng: 0, distance: 160 },
    { lat: -90, lng: -180, distance: 0.1 },
    { lat: 90, lng: 180, distance: 9999 },
  ])('round trips valid view %j', (view) => {
    persistGlobeView(view);
    expect(loadGlobeView()).toEqual(view);
    expect(JSON.parse(window.localStorage.getItem(storageKey)).v).toBe(1);
  });

  it.each([
    null, { lat: 91, lng: 0, distance: 1 }, { lat: -91, lng: 0, distance: 1 },
    { lat: 0, lng: 181, distance: 1 }, { lat: 0, lng: -181, distance: 1 },
    { lat: 0, lng: 0, distance: 0 }, { lat: 0, lng: 0, distance: -1 },
    { lat: NaN, lng: 0, distance: 1 }, { lat: 0, lng: Infinity, distance: 1 },
    { lat: '0', lng: 0, distance: 1 },
  ])('rejects invalid camera values %j', (view) => {
    persistGlobeView(view as any);
    expect(window.localStorage.getItem(storageKey)).toBeNull();
    window.localStorage.setItem(storageKey, JSON.stringify(view && { ...view, v: 1 }));
    expect(loadGlobeView()).toBeNull();
  });

  it.each(['', '{', 'null', '{"v":2,"lat":0,"lng":0,"distance":1}'])('ignores corrupt or incompatible data %s', (raw) => {
    window.localStorage.setItem(storageKey, raw);
    expect(loadGlobeView()).toBeNull();
  });

  it('survives storage failures and server rendering', () => {
    expect(loadGlobeView()).toBeNull();
    rs.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    rs.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(loadGlobeView()).toBeNull();
    expect(() => persistGlobeView({ lat: 0, lng: 0, distance: 1 })).not.toThrow();
    rs.stubGlobal('window', undefined);
    expect(loadGlobeView()).toBeNull();
    expect(() => persistGlobeView({ lat: 0, lng: 0, distance: 1 })).not.toThrow();
  });
});
