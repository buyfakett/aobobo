import { describe, expect, it } from '@rstest/core';
import { buildActivitySeriesOptions, createAltitudeAnchorSeries } from '@/utils/globe-activity-effects';

describe('globe server connections', () => {
  const locations = [
    { key: 'tokyo', lat: 35.7, lng: 139.7, country: 'JP' },
    { key: 'london', lat: 51.5, lng: -0.1, country: 'GB' },
    { key: 'nyc', lat: 40.7, lng: -74, country: 'US' },
  ];

  it('keeps a series when disabled or without enough distinct locations', () => {
    expect(buildActivitySeriesOptions()[0].data).toEqual([]);
    expect(buildActivitySeriesOptions({ locations, enabled: false })[0].data).toEqual([]);
    expect(buildActivitySeriesOptions({ locations: [locations[0]] })[0].data).toEqual([]);
    expect(buildActivitySeriesOptions({ locations: [locations[0], locations[0], { lat: 'bad', lng: 2 }] })[0].data).toEqual([]);
  });

  it('creates finite raised arcs with endpoints on the supplied locations', () => {
    const series = buildActivitySeriesOptions({ locations })[0];
    expect(series.type).toBe('lines3D');
    expect(series.effect.show).toBe(false);
    expect(series.data.length).toBeGreaterThanOrEqual(locations.length - 1);
    for (const { coords } of series.data) {
      expect(coords.length).toBeGreaterThanOrEqual(17);
      expect(coords.length).toBeLessThanOrEqual(49);
      for (const coordinate of coords) expect(coordinate.every(Number.isFinite)).toBe(true);
      expect(coords[0][2]).toBeCloseTo(0.015);
      expect(coords.at(-1)[2]).toBeCloseTo(0.015);
      expect(Math.max(...coords.map((point) => point[2]))).toBeGreaterThan(0.04);
      expect(Math.max(...coords.map((point) => point[2]))).toBeLessThanOrEqual(0.195);
      for (const endpoint of [coords[0], coords.at(-1)]) {
        expect(locations.some((loc) => Math.abs(loc.lat - endpoint[1]) < 1e-6 && Math.abs(loc.lng - endpoint[0]) < 1e-6)).toBe(true);
      }
    }
  });

  it('has deterministic geometry and normalizes equivalent longitudes', () => {
    expect(buildActivitySeriesOptions({ locations }).at(0).data).toEqual(buildActivitySeriesOptions({ locations: [...locations].reverse() }).at(0).data);
    expect(buildActivitySeriesOptions({ locations: [{ lat: 0, lng: 180 }, { lat: 0, lng: -180 }] })[0].data).toEqual([]);
  });

  it('handles almost identical and antipodal points without invalid coordinates', () => {
    for (const pair of [
      [{ lat: 0, lng: 0 }, { lat: 0, lng: 180 }],
      [{ lat: 0, lng: 0 }, { lat: 0.00001, lng: 0 }],
    ]) {
      const data = buildActivitySeriesOptions({ locations: pair })[0].data;
      expect(data).toHaveLength(1);
      expect(data[0].coords.flat().every(Number.isFinite)).toBe(true);
    }
  });

  it('bounds the number of arcs for large dashboards on desktop and mobile', () => {
    const many = Array.from({ length: 200 }, (_, index) => ({ key: `${index}`, lat: -50 + index * 0.5, lng: index * 1.7 }));
    expect(buildActivitySeriesOptions({ locations: many })[0].data).toHaveLength(160);
    expect(buildActivitySeriesOptions({ locations: many, isMobile: true })[0].data).toHaveLength(80);
  });

  it('adapts colors and line rendering to the theme and display', () => {
    const light = buildActivitySeriesOptions({ locations, theme: 'light', isMobile: true })[0];
    expect(light).toMatchObject({ blendMode: 'source-over', lineStyle: { color: '#5278d7', width: 1.6, opacity: 0.38 } });
    expect(buildActivitySeriesOptions({ colors: { connection: '#123456' } })[0].lineStyle.color).toBe('#123456');
    expect(createAltitudeAnchorSeries()).toMatchObject({ type: 'scatter3D', symbolSize: 0, data: [[0, 0, 0], [0, 0, 1]] });
  });
});
