import { afterEach, describe, expect, it, rs } from '@rstest/core';
import config from '@/config';
import {
  createGlobeOceanMap, getGlobeRendererPixelRatio, getLandPolygonsData,
  getPreferredGlobeTextureSize, THEME_COLORS,
} from '@/utils/globe-textures';

afterEach(() => { rs.restoreAllMocks(); rs.unstubAllGlobals(); config.aobobo.globePixelRatio = 1; });

describe('globe rendering budgets', () => {
  it.each([[1, 1.25, 1], [2, 1.25, 1.25], [3, 10, 2], [2, 0.5, 0.75], [2, 0, 1.25], [0, 'bad', 1]])(
    'caps device ratio %s using configuration %s', (dpr, requested, expected) => {
      rs.stubGlobal('devicePixelRatio', dpr);
      config.aobobo.globePixelRatio = requested;
      expect(getGlobeRendererPixelRatio()).toBe(expected);
    },
  );

  it('uses one pixel per logical pixel during server rendering', () => {
    rs.stubGlobal('window', undefined);
    expect(getGlobeRendererPixelRatio()).toBe(1);
  });

  it('detects GPU capabilities once, releases the temporary context, and respects requested texture sizes', () => {
    const loseContext = rs.fn();
    const gl = { MAX_TEXTURE_SIZE: 3379, getParameter: rs.fn(() => 8192), getExtension: rs.fn(() => ({ loseContext })) };
    const getContext = rs.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as any);
    expect(getPreferredGlobeTextureSize()).toEqual({ width: 4096, height: 2048 });
    expect(getPreferredGlobeTextureSize({ maxWidth: 3000 })).toEqual({ width: 3000, height: 1500 });
    expect(getPreferredGlobeTextureSize({ maxWidth: 512 })).toEqual({ width: 2048, height: 1024 });
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(gl.getParameter).toHaveBeenCalledWith(gl.MAX_TEXTURE_SIZE);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
});

describe('globe texture generation', () => {
  it('caches reusable polygon data with unique IDs', () => {
    const polygons = getLandPolygonsData();
    expect(polygons.length).toBeGreaterThan(0);
    expect(getLandPolygonsData()).toBe(polygons);
    expect(new Set(polygons.map((polygon) => polygon.id)).size).toBe(polygons.length);
    expect(polygons.every((polygon) => polygon.geometry.type === 'Polygon' && polygon.geometry.coordinates.length > 0)).toBe(true);
  });

  it.each(['light', 'dark'])('draws ocean, land and noise at the requested %s texture resolution', (theme) => {
    const contexts: any[] = [];
    rs.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
      const ctx = {
        canvas: this, fillStyle: '', globalAlpha: 1, globalCompositeOperation: 'source-over',
        fillRect: rs.fn(), createRadialGradient: rs.fn(() => ({ addColorStop: rs.fn() })),
        createImageData: rs.fn((width, height) => ({ data: new Uint8ClampedArray(width * height * 4) })),
        putImageData: rs.fn(), createPattern: rs.fn(() => ({})), save: rs.fn(), restore: rs.fn(),
        beginPath: rs.fn(), moveTo: rs.fn(), lineTo: rs.fn(), closePath: rs.fn(), fill: rs.fn(), stroke: rs.fn(),
      };
      contexts.push(ctx);
      return ctx as any;
    });
    const texture = createGlobeOceanMap(theme, { width: 128, height: 64 });
    expect(texture.width).toBe(128);
    expect(texture.height).toBe(64);
    expect(contexts[0].fillStyle).toBe(THEME_COLORS[theme].land);
    expect(contexts[0].fill).toHaveBeenCalledWith('evenodd');
    expect(contexts[0].fillRect).toHaveBeenCalledWith(0, 0, 128, 64);
    expect(contexts[1].putImageData).toHaveBeenCalledTimes(1);
    expect(contexts[0].stroke.mock.calls.length > 0).toBe(theme === 'dark');
  });
});
