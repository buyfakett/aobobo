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
  getLandPolygonsData,
  THEME_COLORS,
} from '@/utils/globe-textures';
import {
  buildActivitySeriesOptions,
  createAltitudeAnchorSeries,
} from '@/utils/globe-activity-effects';
import { formatLocationLocalTime } from '@/utils/location-time';
import { loadGlobeView, persistGlobeView } from '@/utils/globe-view';
import { DEFAULT_AUTO_ROTATE, DEFAULT_ROTATE_SPEED } from '@/utils/globe-rotation';
import useMediaQuery from '@/hooks/useMediaQuery';
import ServerCard from '@/components/react/ServerCard';
import type { AnyCallback, GlobeEarthHandle } from '@/types/ui';

const textureCache = new Map();
let coastlineCache = null;
const GLOBE_RADIUS = 100;
const VIEW_PERSIST_DELAY = 800;

type GlobeEarthProps = {
  locations: any[];
  theme?: string;
  cycleTransferMap?: Record<string, any>;
  autoRotate?: boolean;
  rotateSpeed?: number;
  showServerConnections?: boolean;
  onSelectServer?: AnyCallback;
};

function normalizeLongitude(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function getLiveGlobeView(chart) {
  const globeView = chart?._componentsViews?.find((view) => view?._control);
  const control = globeView?._control;
  if (!control) return null;
  const lat = Number(control.getAlpha?.());
  const lng = normalizeLongitude(Number(control.getBeta?.()) - 90);
  const distance = Number(control.getDistance?.()) - GLOBE_RADIUS;
  if (![lat, lng, distance].every(Number.isFinite) || distance <= 0) return null;
  return { lat, lng, distance };
}

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

function buildOption({ locations, theme, autoRotate, rotateSpeed, showServerConnections, isMobile, view }) {
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
  const activity = (buildActivitySeriesOptions as any)({
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
        targetCoord: view ? [view.lng, view.lat] : [114, 24.5],
        distance: view?.distance || (isMobile ? 185 : 170),
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

const GlobeEarth = forwardRef<GlobeEarthHandle, GlobeEarthProps>(function GlobeEarth({
  locations,
  theme = 'dark',
  cycleTransferMap = {},
  autoRotate = DEFAULT_AUTO_ROTATE,
  rotateSpeed = DEFAULT_ROTATE_SPEED,
  showServerConnections = true,
  onSelectServer,
}, ref) {
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  const globeOptionKeyRef = useRef('');
  const viewRef = useRef(loadGlobeView());
  const persistTimerRef = useRef(null);
  const locationsRef = useRef(locations);
  const onSelectServerRef = useRef(onSelectServer);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [clock, setClock] = useState(Date.now());
  const isMobile = useMediaQuery('(max-width: 768px)');
  locationsRef.current = locations;
  onSelectServerRef.current = onSelectServer;
  const option = useMemo(() => buildOption({
    locations,
    theme,
    autoRotate,
    rotateSpeed,
    showServerConnections,
    isMobile,
    view: viewRef.current,
  }), [autoRotate, isMobile, locations, rotateSpeed, showServerConnections, theme]);

  const syncView = () => {
    const view = getLiveGlobeView(instanceRef.current);
    if (view) viewRef.current = view;
    return view;
  };

  const scheduleViewPersist = () => {
    window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      const view = syncView();
      if (view) persistGlobeView(view);
    }, VIEW_PERSIST_DELAY);
  };

  useImperativeHandle(ref, () => ({
    ready: () => Promise.resolve(Boolean(instanceRef.current)),
    focusLocation(location) {
      if (!instanceRef.current || !location) return false;
      viewRef.current = { lat: location.lat, lng: location.lng, distance: 135 };
      instanceRef.current.setOption({
        globe: { viewControl: { targetCoord: [location.lng, location.lat], distance: 135, autoRotate: false } },
      });
      persistGlobeView(viewRef.current);
      return true;
    },
    async focusLocationWithHighlight(location) {
      if (!instanceRef.current || !location) return false;
      viewRef.current = { lat: location.lat, lng: location.lng, distance: 135 };
      instanceRef.current.setOption({
        globe: { viewControl: { targetCoord: [location.lng, location.lat], distance: 135, autoRotate: false } },
      });
      persistGlobeView(viewRef.current);
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
        const locationKey = params.data?.location?.key || params.data?.location?.code;
        const location = locationsRef.current.find((item) => (
          (item.key || item.code) === locationKey
        ));
        if (!location) return;
        if (location.servers?.length === 1) onSelectServerRef.current?.(location.servers[0]);
        else setSelected(location);
      });
      const observer = new ResizeObserver(() => chart.resize());
      observer.observe(chartRef.current);
      setReady(true);
      setError(false);
      return () => {
        window.clearTimeout(persistTimerRef.current);
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
  }, []);

  useEffect(() => {
    setSelected((current) => {
      if (!current) return current;
      const currentKey = current.key || current.code;
      return locations.find((location) => (location.key || location.code) === currentKey) || null;
    });
  }, [locations]);

  useEffect(() => {
    if (!instanceRef.current) return;
    const globeOptionKey = `${theme}:${isMobile}:${autoRotate}:${rotateSpeed}`;
    const globeChanged = globeOptionKeyRef.current !== globeOptionKey;
    const liveView = syncView() || viewRef.current;
    const viewControl = liveView ? {
      targetCoord: [liveView.lng, liveView.lat],
      distance: liveView.distance,
      autoRotate,
      autoRotateSpeed: Math.max(Number(rotateSpeed) || 0.5, 0.1) * 2,
    } : null;
    const nextOption = globeChanged
      ? {
        ...option,
        globe: viewControl
          ? { ...option.globe, viewControl: { ...option.globe.viewControl, ...viewControl } }
          : option.globe,
      }
      : {
        series: option.series,
        ...(viewControl ? { globe: { viewControl } } : {}),
      };
    instanceRef.current.setOption(
      nextOption,
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
    <div
      ref={rootRef}
      className={`globe-earth [width:100%] [height:100%] [position:relative] theme-${theme}`}
      onPointerUp={scheduleViewPersist}
      onPointerCancel={scheduleViewPersist}
      onWheel={scheduleViewPersist}
    >
      {!ready && <div className="globe-stage-fallback [position:absolute] [inset:0] [z-index:0] [background:var(--globe-stage-bg)] [pointer-events:none]" aria-hidden="true" />}
      <div ref={chartRef} className="globe-container [width:100%] [height:100%] [position:relative] [z-index:1]" style={{ opacity: ready ? 1 : 0, transition: 'opacity .25s ease' }} />
      {selected && (
        <div className={`popup-layer [position:absolute] [z-index:5] [transition:opacity_0.24s_ease,_transform_0.24s_ease] react-popup-layer${isMobile ? ' mobile' : ''}`} onClick={(event) => event.stopPropagation()}>
          <div className={`location-popup [position:relative] [width:min(380px,_100vw_-_32px)] [max-height:min(440px,_100vh_-_64px)] [display:flex] [flex-direction:column] [gap:16px] [padding:18px] [border-radius:24px] [background:var(--globe-popup-bg)] [border:1px_solid_var(--globe-popup-border)] [box-shadow:var(--globe-popup-shadow)] [backdrop-filter:blur(20px)_saturate(150%)] [color:var(--text-primary)] [overflow:hidden] max-[768px]:[width:100%] max-[768px]:[max-height:min(60dvh,_500px)]${isMobile ? ' mobile' : ''}`}>
            <div className="popup-header [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] [position:relative] [z-index:1] max-[768px]:[align-items:flex-start] max-[768px]:[gap:10px]">
              <div className="title-group [min-width:0] [display:flex] [flex-direction:column] [align-items:flex-start] [gap:8px] max-[768px]:[flex:1_1_auto] max-[768px]:[min-width:0] max-[768px]:[align-items:flex-start] max-[768px]:[flex-direction:column] max-[768px]:[gap:6px]">
                <h3>{selected.label}</h3>
                <div className="popup-stats [display:inline-flex] [flex-wrap:wrap] [align-items:center] [gap:6px] max-[768px]:[gap:5px]">
                  <span className="stat-chip [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_8px] [border-radius:999px] [border:1px_solid_var(--globe-popup-chip-border)] [background:var(--globe-popup-chip-bg)] [font-size:11px] [font-weight:600] [color:var(--globe-popup-muted)] [white-space:nowrap] [box-shadow:inset_0_1px_0_rgba(255,_255,_255,_0.08)] max-[768px]:[min-height:20px] max-[768px]:[padding:0_7px] max-[768px]:[font-size:10px] total">{selected.servers.length}台</span>
                  <span className="stat-chip [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_8px] [border-radius:999px] [border:1px_solid_var(--globe-popup-chip-border)] [background:var(--globe-popup-chip-bg)] [font-size:11px] [font-weight:600] [color:var(--globe-popup-muted)] [white-space:nowrap] [box-shadow:inset_0_1px_0_rgba(255,_255,_255,_0.08)] max-[768px]:[min-height:20px] max-[768px]:[padding:0_7px] max-[768px]:[font-size:10px] stat-chip--time">当地 {formatLocationLocalTime(selected, clock)}</span>
                </div>
              </div>
              <button type="button" className="close-btn [width:34px] [height:34px] [flex:0_0_auto] [display:inline-flex] [align-items:center] [justify-content:center] [border:1px_solid_var(--button-subtle-border)] [border-radius:14px] [background:var(--button-subtle-bg)] [color:var(--text-secondary)] [cursor:pointer] [transition:color_var(--transition-fast),_background_var(--transition-fast),_border-color_var(--transition-fast),_box-shadow_var(--transition-fast),_transform_var(--transition-fast)] max-[768px]:[width:30px] max-[768px]:[height:30px] max-[768px]:[border-radius:10px] max-[768px]:[margin-top:-2px]" aria-label="关闭位置弹窗" onClick={() => setSelected(null)}><i className="ri-close-line" /></button>
            </div>
            <div className="server-list [display:grid] [gap:6px] [min-height:0] [overflow-y:auto] [padding-right:2px] [position:relative] [z-index:1] max-[768px]:[gap:5px]">
              {selected.servers.map((server) => (
                <ServerCard key={server.ID} compact server={server} cycleTransferMap={cycleTransferMap} onSelect={onSelectServer} />
              ))}
            </div>
          </div>
        </div>
      )}
      {!ready && (
        <div className="globe-loading [position:absolute] [inset:0] [z-index:5] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [gap:12px] [background-color:var(--bg-primary)] [color:var(--text-secondary)] [font-size:14px] [text-shadow:0_0_24px_rgba(15,_23,_42,_0.08)]">
          <i className={`${error ? 'ri-earth-line' : 'ri-loader-4-line spin'} empty-icon`} />
          <span>{error ? '地球初始化失败，请刷新重试' : '加载地球中...'}</span>
        </div>
      )}
    </div>
  );
});

export default GlobeEarth;
