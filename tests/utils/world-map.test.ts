import { afterEach, describe, expect, it } from '@rstest/core';
import config from '@/config';
import { clusterLocations, resolveServerLocation } from '@/utils/world-map';

afterEach(() => { delete config.aobobo.customCodeMap; });
const custom = (customData) => ({ PublicNote: { customData } });

describe('server location resolution', () => {
  it.each([undefined, {}, { Host: {} }, { Host: { CountryCode: 'unknown' } }])('ignores missing locations %j', (server) => {
    expect(resolveServerLocation(server)).toBeNull();
  });

  it('resolves country codes, city aliases, and configured locations', () => {
    expect(resolveServerLocation({ Host: { CountryCode: 'jp' } })).toMatchObject({
      code: 'TYO', name: '东京', source: 'code', country: '日本',
    });
    expect(resolveServerLocation(custom({ location: 'NRT' }))).toMatchObject({ code: 'TYO', aliasCode: 'NRT' });
    config.aobobo.customCodeMap = { HOME: { lat: 12, lng: 34, name: 'Home', country: '自定义' } };
    expect(resolveServerLocation(custom({ location: 'HOME' }))).toMatchObject({ code: 'HOME', lat: 12, lng: 34, name: 'Home' });
    config.aobobo.customCodeMap.HOME.lat = NaN;
    expect(resolveServerLocation(custom({ location: 'HOME' }))).toBeNull();
  });

  it.each([[12, 34], ['12', '34'], '12,34', '12，34', ' 12  34 '])('prioritizes manual coordinates %j', (latlng) => {
    expect(resolveServerLocation({
      ...custom({ latlng, location: 'NRT', locationLabel: 'My Tokyo' }), Host: { CountryCode: 'US' },
    })).toEqual({
      code: 'TYO', aliasCode: 'NRT', lat: 12, lng: 34, name: 'My Tokyo', country: '日本', source: 'manual',
    });
  });

  it('accepts separate coordinates and uses useful manual labels', () => {
    expect(resolveServerLocation(custom({ lat: '0', lng: '0' }))).toMatchObject({
      code: '0,0', lat: 0, lng: 0, name: '自定义位置', source: 'manual',
    });
    expect(resolveServerLocation(custom({ latlng: [1, 2], location: 'custom' }))).toMatchObject({
      code: 'custom', name: 'custom', country: '',
    });
    expect(resolveServerLocation(custom({ latlng: [1, 2], location: 'PEK' }))).toMatchObject({ name: '北京' });
  });

  it.each([[], [1], ['bad', 2], 'bad', 'bad,2', 42])('falls back when manual coordinates are invalid %j', (latlng) => {
    expect(resolveServerLocation(custom({ latlng, location: 'PEK' }))).toMatchObject({ code: 'PEK', source: 'code' });
    expect(resolveServerLocation(custom({ latlng }))).toBeNull();
  });

  it('ignores invalid separate coordinates', () => {
    expect(resolveServerLocation(custom({ lat: 'bad', lng: 1 }))).toBeNull();
  });
});

describe('location clustering', () => {
  const location = (code, lat, lng, servers = [{ online: 0 }], extra = {}) => ({
    code, key: code, lat, lng, servers, country: 'test', label: code, name: code, ...extra,
  });

  it('preserves empty and singleton inputs', () => {
    expect(clusterLocations(null)).toBeNull();
    const only = [location('A', 0, 0)];
    expect(clusterLocations(only)).toBe(only);
  });

  it('merges nearby servers with a weighted center without mutating inputs', () => {
    const a = location('A', 0, 0, [{ online: 0 }]);
    const b = location('B', 0, 1, [{ online: 1 }, { online: 0 }]);
    const far = location('C', 60, 120);
    const result = clusterLocations([a, b, far], 250);
    expect(result).toHaveLength(2);
    const merged = result.find((item) => item.key === 'A,B');
    expect(merged).toMatchObject({ codes: ['A', 'B'], servers: [...a.servers, ...b.servers], hasOnline: true, lat: 0 });
    expect(merged.lng).toBeCloseTo(2 / 3);
    expect(a).not.toHaveProperty('codes');
  });

  it('honors the threshold, supports the date line, and merges repeatedly', () => {
    expect(clusterLocations([location('A', 0, 0), location('B', 0, 1)], 0)).toHaveLength(2);
    const dateline = clusterLocations([location('A', 0, 179.9), location('B', 0, -179.9)], 30);
    expect(dateline).toHaveLength(1);
    const three = clusterLocations([
      location('A', 0, 0), location('B', 0, 0.1), location('C', 0, 0.2),
    ], 30);
    expect(three).toHaveLength(1);
    expect(three[0].codes.toSorted()).toEqual(['A', 'B', 'C']);
    expect(three[0].hasOnline).toBe(false);
  });
});
