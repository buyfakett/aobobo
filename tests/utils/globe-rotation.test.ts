import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { clampRotateSpeed, loadGlobeRotation, persistGlobeRotation } from '@/utils/globe-rotation';

const storageKey = 'aobobo_globe_rotation';
const defaults = { autoRotate: true, rotateSpeed: 0.5, showServerConnections: true };
beforeEach(() => window.localStorage.clear());
afterEach(() => { rs.restoreAllMocks(); rs.unstubAllGlobals(); });

describe('globe rotation preferences', () => {
  it.each([undefined, '', 'null', '{', '{"v":99}'])('uses defaults for missing or corrupt data %s', (raw) => {
    if (raw !== undefined) window.localStorage.setItem(storageKey, raw);
    expect(loadGlobeRotation()).toEqual(defaults);
  });

  it.each([1, 2, 3])('migrates rotation defaults from version %s', (v) => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      v, autoRotate: false, rotateSpeed: 9, showNetRays: false, showServerConnections: false,
    }));
    expect(loadGlobeRotation()).toEqual({ autoRotate: true, rotateSpeed: 2, showServerConnections: false });
  });

  it('preserves explicit choices with the current version', () => {
    persistGlobeRotation({ autoRotate: false, rotateSpeed: 0.78, showServerConnections: false });
    expect(JSON.parse(window.localStorage.getItem(storageKey))).toEqual({
      v: 4, autoRotate: false, rotateSpeed: 0.8, showServerConnections: false,
    });
    expect(loadGlobeRotation()).toEqual({ autoRotate: false, rotateSpeed: 0.8, showServerConnections: false });
    persistGlobeRotation({ autoRotate: true });
    expect(loadGlobeRotation()).toEqual(defaults);
  });

  it.each([[NaN, 0.5], [Infinity, 0.5], ['bad', 0.5], [-4, 0.2], [0, 0.2], [9, 2], ['1.26', 1.3]])(
    'clamps and quantizes %s', (value, expected) => expect(clampRotateSpeed(value)).toBeCloseTo(expected as number),
  );

  it('ignores unavailable storage and invalid writes', () => {
    persistGlobeRotation(null);
    expect(window.localStorage.getItem(storageKey)).toBeNull();
    rs.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    rs.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(loadGlobeRotation()).toEqual(defaults);
    expect(() => persistGlobeRotation(defaults)).not.toThrow();
    rs.stubGlobal('window', undefined);
    expect(loadGlobeRotation()).toEqual(defaults);
    expect(() => persistGlobeRotation(defaults)).not.toThrow();
  });
});
