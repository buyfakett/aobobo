import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as echarts from 'echarts';
import 'echarts-gl';
import {
  createGlobeOceanMap,
  getGlobeRendererPixelRatio,
  getPreferredGlobeTextureSize,
  THEME_COLORS,
} from '@/utils/globe-textures';
import { getLandPolygonsData } from '@/utils/globe-land-polygons';
import {
  buildActivitySeriesOptions,
  createAltitudeAnchorSeries,
} from '@/utils/globe-activity-effects';
import { formatLocationLocalTime } from '@/utils/location-time';
import useMediaQuery from '@/hooks/useMediaQuery';
import ServerCard from '@/components/react/ServerCard';

const textureCache = new Map();
let coastlineCache = null;

function getTexture(theme) {
  const size = getPreferredGlobeTextureSize({ maxWidth: 2048 });
  const key = `${theme}-${size.width}`;
  if (!textureCache.has(key)) {
    // echarts-gl 2.1 does not reliably enable canvas-backed diffuse textures
    // with ECharts 6. A data URL follows its stable image-loading path.
    textureCache.set(key, createGlobeOceanMap(theme, size).toDataURL('image/png'));
  }
  return textureCache.get(key);
}

function getCoastlines() {
  if (coastlineCache) return coastlineCache;
  coastlineCache = getLandPolygonsData().flatMap((polygon) => polygon.geometry.coordinates);
  return coastlineCache;
}

function markerSize(count) {
  if (count > 9) return 20;
  if (count >= 5) return 16;
  if (count >= 2) return 13;
  return 10;
}

function buildOption({ locations, theme, autoRotate, rotateSpeed, showServerConnections, isMobile }) {
  const colors = THEME_COLORS[theme] || THEME_COLORS.dark;
  const onlineColor = theme === 'light' ? '#ffae00' : '#eaf4fc';
  const offlineColor = theme === 'light' ? '#9aa3af' : '#6d7888';
  const markerData = locations.map((location) => {
    const onlineCount = location.servers.filter((server) => server.online === 1).length;
    return {
      value: [location.lng, location.lat, 0.015],
      name: location.label,
      location,
      symbolSize: markerSize(location.servers.length),
      itemStyle: {
        color: onlineCount > 0 ? onlineColor : offlineColor,
        opacity: onlineCount > 0 ? 1 : 0.72,
        borderWidth: onlineCount > 0 ? 2 : 1,
        borderColor: onlineCount > 0
          ? (theme === 'light' ? 'rgba(255,174,0,.35)' : 'rgba(46,207,255,.45)')
          : 'rgba(148,163,184,.25)',
      },
    };
  });
  const activity = buildActivitySeriesOptions({
    locations,
    colors: { connection: theme === 'light' ? '#5278d7' : '#89c3eb' },
    isMobile,
    enabled: showServerConnections,
    theme,
  });

  return {
    backgroundColor: 'transparent',
    globe: {
      baseTexture: getTexture(theme),
      shading: 'color',
      silent: false,
      atmosphere: {
        show: true,
        offset: isMobile ? 1.2 : 3,
        color: theme === 'light' ? '#a8d8ff' : '#9bd2ff',
        glowPower: isMobile ? 3 : 5,
        innerGlowPower: 2.5,
      },
      viewControl: {
        targetCoord: [114, 24.5],
        distance: isMobile ? 185 : 170,
        minDistance: 105,
        maxDistance: 330,
        alpha: 18,
        beta: 0,
        autoRotate,
        autoRotateSpeed: Math.max(Number(rotateSpeed) || 0.5, 0.1) * 2,
        damping: 0.82,
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
        id: 'globe-coastline',
        type: 'lines3D',
        coordinateSystem: 'globe',
        polyline: true,
        silent: true,
        lineStyle: {
          width: isMobile ? colors.mobileCoastlineWidth : colors.coastlineWidth,
          color: isMobile ? colors.mobileCoastline : colors.coastline,
          opacity: 1,
        },
        data: getCoastlines(),
      },
      createAltitudeAnchorSeries(),
      ...activity,
      {
        id: 'server-markers',
        type: 'scatter3D',
        coordinateSystem: 'globe',
        name: '服务器',
        symbol: 'circle',
        symbolSize: (_value, params) => params.data.symbolSize,
        emphasis: { itemStyle: { opacity: 1, borderWidth: 4 } },
        data: markerData,
      },
    ],
  };
}

const GlobeEarth = forwardRef(function GlobeEarth({
  locations,
  theme = 'dark',
  cycleTransferMap = {},
  autoRotate = false,
  rotateSpeed = 0.5,
  showServerConnections = true,
  onSelectServer,
}, ref) {
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  const globeOptionKeyRef = useRef('');
  const locationsRef = useRef(locations);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [clock, setClock] = useState(Date.now());
  const isMobile = useMediaQuery('(max-width: 768px)');
  locationsRef.current = locations;

  const option = useMemo(() => buildOption({
    locations,
    theme,
    autoRotate,
    rotateSpeed,
    showServerConnections,
    isMobile,
  }), [autoRotate, isMobile, locations, rotateSpeed, showServerConnections, theme]);

  useImperativeHandle(ref, () => ({
    ready: () => Promise.resolve(Boolean(instanceRef.current)),
    focusLocation(location) {
      if (!instanceRef.current || !location) return false;
      instanceRef.current.setOption({
        globe: { viewControl: { targetCoord: [location.lng, location.lat], distance: 135, autoRotate: false } },
      });
      return true;
    },
    async focusLocationWithHighlight(location) {
      if (!instanceRef.current || !location) return false;
      instanceRef.current.setOption({
        globe: { viewControl: { targetCoord: [location.lng, location.lat], distance: 135, autoRotate: false } },
      });
      setSelected(location);
      return true;
    },
    clearFocusBubble: () => setSelected(null),
  }), []);

  useEffect(() => {
    if (!chartRef.current) return undefined;
    let chart;
    try {
      chart = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
        devicePixelRatio: getGlobeRendererPixelRatio(),
      });
      instanceRef.current = chart;
      chart.on('click', (params) => {
        if (params.seriesId !== 'server-markers') return;
        const location = params.data?.location;
        if (!location) return;
        if (location.servers?.length === 1) onSelectServer?.(location.servers[0]);
        else setSelected(location);
      });
      const observer = new ResizeObserver(() => chart.resize());
      observer.observe(chartRef.current);
      setReady(true);
      setError(false);
      return () => {
        observer.disconnect();
        chart.dispose();
        instanceRef.current = null;
        globeOptionKeyRef.current = '';
      };
    } catch (initError) {
      console.error('Failed to initialize globe:', initError);
      setError(true);
      return undefined;
    }
  }, [onSelectServer]);

  useEffect(() => {
    if (!instanceRef.current) return;
    const globeOptionKey = `${theme}:${isMobile}:${autoRotate}:${rotateSpeed}`;
    const globeChanged = globeOptionKeyRef.current !== globeOptionKey;
    instanceRef.current.setOption(
      globeChanged ? option : { series: option.series },
      {
        notMerge: false,
        replaceMerge: ['series'],
        lazyUpdate: !globeChanged,
      },
    );
    globeOptionKeyRef.current = globeOptionKey;
  }, [autoRotate, isMobile, option, ready, rotateSpeed, theme]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div ref={rootRef} className={`globe-earth theme-${theme}`}>
      {!ready && <div className="globe-stage-fallback" aria-hidden="true" />}
      <div ref={chartRef} className="globe-container" style={{ opacity: ready ? 1 : 0, transition: 'opacity .25s ease' }} />
      {selected && (
        <div className={`popup-layer react-popup-layer${isMobile ? ' mobile' : ''}`} onClick={(event) => event.stopPropagation()}>
          <div className={`location-popup${isMobile ? ' mobile' : ''}`}>
            <div className="popup-header">
              <div className="title-group">
                <h3>{selected.label}</h3>
                <div className="popup-stats">
                  <span className="stat-chip total">{selected.servers.length}台</span>
                  <span className="stat-chip stat-chip--time">当地 {formatLocationLocalTime(selected, clock)}</span>
                </div>
              </div>
              <button type="button" className="close-btn" aria-label="关闭位置弹窗" onClick={() => setSelected(null)}><i className="ri-close-line" /></button>
            </div>
            <div className="server-list">
              {selected.servers.map((server) => (
                <ServerCard key={server.ID} compact server={server} cycleTransferMap={cycleTransferMap} onSelect={onSelectServer} />
              ))}
            </div>
          </div>
        </div>
      )}
      {!ready && (
        <div className="globe-loading">
          <i className={`${error ? 'ri-earth-line' : 'ri-loader-4-line spin'} empty-icon`} />
          <span>{error ? '地球初始化失败，请刷新重试' : '加载地球中...'}</span>
        </div>
      )}
    </div>
  );
});

export default GlobeEarth;
