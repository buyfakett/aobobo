import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import 'echarts-gl';
import {
  createGlobeOceanMap,
  getGlobeRendererPixelRatio,
  getPreferredGlobeTextureSize,
  THEME_COLORS,
} from '@/utils/globe-textures';
import { getLandPolygonsData } from '@/utils/globe-land-polygons';

const textureCache = new Map();
let coastlineCache = null;

function getTexture(theme) {
  const size = getPreferredGlobeTextureSize({ maxWidth: 2048 });
  const key = `${theme}-${size.width}`;
  if (!textureCache.has(key)) {
    textureCache.set(key, createGlobeOceanMap(theme, size).toDataURL('image/png'));
  }
  return textureCache.get(key);
}

function getCoastlines() {
  if (coastlineCache) return coastlineCache;
  coastlineCache = getLandPolygonsData().flatMap((polygon) => polygon.geometry.coordinates);
  return coastlineCache;
}

function buildOption(location, theme) {
  const colors = THEME_COLORS[theme] || THEME_COLORS.dark;
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  return {
    backgroundColor: 'transparent',
    globe: {
      baseTexture: getTexture(theme),
      shading: 'color',
      silent: true,
      atmosphere: {
        show: true,
        offset: 2,
        color: theme === 'light' ? '#a8d8ff' : '#9bd2ff',
        glowPower: 4,
        innerGlowPower: 2.5,
      },
      viewControl: {
        targetCoord: [lng, lat],
        distance: 190,
        minDistance: 150,
        maxDistance: 240,
        alpha: 18,
        beta: 0,
        autoRotate: false,
        damping: 0.85,
      },
      light: {
        ambient: { intensity: theme === 'light' ? 1.4 : 1.2 },
        main: { intensity: 0, shadow: false },
      },
      postEffect: { enable: false },
      temporalSuperSampling: { enable: false },
    },
    series: [
      {
        id: 'detail-globe-coastline',
        type: 'lines3D',
        coordinateSystem: 'globe',
        polyline: true,
        silent: true,
        lineStyle: {
          width: 0.8,
          color: colors.coastline,
          opacity: 1,
        },
        data: getCoastlines(),
      },
      {
        id: 'detail-globe-marker-halo',
        type: 'scatter3D',
        coordinateSystem: 'globe',
        silent: true,
        symbol: 'circle',
        symbolSize: 18,
        data: [{
          value: [lng, lat, 0.035],
          itemStyle: {
            color: 'rgba(255, 70, 86, 0.32)',
            opacity: 0.9,
          },
        }],
      },
      {
        id: 'detail-globe-marker',
        type: 'scatter3D',
        coordinateSystem: 'globe',
        silent: true,
        symbol: 'circle',
        symbolSize: 7,
        data: [{
          value: [lng, lat, 0.05],
          itemStyle: {
            color: '#ff3f57',
            opacity: 1,
            borderColor: '#fff4f5',
            borderWidth: 1.5,
          },
        }],
      },
    ],
  };
}

export default function DetailGlobe({ location, theme = 'dark' }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  const validLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const option = useMemo(
    () => (validLocation ? buildOption({ lat, lng }, theme) : null),
    [lat, lng, theme, validLocation],
  );

  useEffect(() => {
    if (!chartRef.current || !validLocation) return undefined;
    let chart;
    try {
      chart = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
        devicePixelRatio: getGlobeRendererPixelRatio(),
      });
      instanceRef.current = chart;
      const observer = new ResizeObserver(() => chart.resize());
      observer.observe(chartRef.current);
      return () => {
        observer.disconnect();
        chart.dispose();
        instanceRef.current = null;
      };
    } catch (error) {
      console.error('Failed to initialize detail globe:', error);
      return undefined;
    }
  }, [validLocation]);

  useEffect(() => {
    if (!instanceRef.current || !option) return;
    instanceRef.current.setOption(option, { notMerge: true, lazyUpdate: false });
  }, [option]);

  return (
    <span className="server-detail-globe [position:relative] [display:block] [width:100%] [height:100%] [min-width:0] [overflow:visible] [border-radius:0] [pointer-events:none]" aria-hidden="true">
      {validLocation ? <span ref={chartRef} className="server-detail-globe__chart [filter:drop-shadow(0_10px_18px_rgba(var(--accent-primary-rgb),_0.18))] max-[768px]:[filter:drop-shadow(0_8px_14px_rgba(var(--accent-primary-rgb),_0.14))]" /> : <span className="server-detail-globe__placeholder [display:flex] [align-items:center] [justify-content:center] [color:var(--globe-marker-active)] [background:transparent]"><i className="ri-earth-line" /></span>}
    </span>
  );
}
