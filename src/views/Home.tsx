import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import config from '@/config';
import store, { useStore } from '@/store';
import { resolveServerLocation, clusterLocations } from '@/utils/world-map';
import { calcDiskDisplay, calcTransfer, getCPUInfo, getSystemOSLabel } from '@/utils/host';
import { loadCycleTransferMap } from '@/utils/cycle-transfer';
import billing from '@/utils/billing';
import { formatCurrencyValue, parseBillingCostAmount } from '@/utils/exchange-rate';
import {
  compareServerOnlineStatus,
  defaultServerSortConfig,
  serverSortHandler,
  serverSortOptions,
} from '@/composables/server-sort';
import {
  loadGlobeRotation,
  persistGlobeRotation,
} from '@/utils/globe-rotation';
import useMediaQuery from '@/hooks/useMediaQuery';
import useAnimatedPresence from '@/hooks/useAnimatedPresence';
import {
  AppFooter,
  CurrentTime,
  DashboardButton,
  ThemeModeSwitch,
} from '@/components/react/Common';
import { ServerTable } from '@/components/react/ServerCard';
import GlobeEarth from '@/components/react/GlobeEarth';
import type { GlobeEarthHandle } from '@/types/ui';
import { GlobeControls, SortSelect, StatusFilter } from '@/components/react/HomeControls';
import { AllHostsModal, StatsModal } from '@/components/react/HomeModals';
import DetailContent from '@/components/react/detail/DetailContent';

const SIDEBAR_MIN_WIDTH = 380;
const SIDEBAR_MAX_WIDTH = 760;
const SIDEBAR_DEFAULT_WIDTH = 420;
const SIDEBAR_DOUBLE_COLUMN_WIDTH = 680;
const SIDEBAR_STORAGE_KEY = 'aobobo-server-sidebar-width';

function initialSidebarWidth() {
  const saved = Number(window.localStorage.getItem(SIDEBAR_STORAGE_KEY));
  return Number.isFinite(saved) && saved > 0
    ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, saved))
    : SIDEBAR_DEFAULT_WIDTH;
}

function getServerSearchText(server) {
  return [server?.Name, server?.Host?.CountryCode, server?.PublicNote?.customData?.location, getSystemOSLabel(server?.Host?.Platform), server?.Host?.Platform]
    .filter(Boolean).join(' ').toLowerCase();
}

function buildLocations(servers) {
  const map = new Map();
  servers.forEach((server) => {
    const location = resolveServerLocation(server);
    if (!location) return;
    if (!map.has(location.code)) map.set(location.code, { ...location, servers: [] });
    map.get(location.code).servers.push(server);
  });
  return clusterLocations([...map.values()].map((location) => ({
    ...location,
    key: location.code,
    codes: [location.code],
    label: location.country ? `${location.name}, ${location.country}` : location.name,
    hasOnline: location.servers.some((server) => server.online === 1),
  })));
}

function aggregateStats(servers, groups, serverCount) {
  let memory = 0;
  let disk = 0;
  let incoming = 0;
  let outgoing = 0;
  let cores = 0;
  let monthlyCost = 0;
  const brands: Record<string, number> = {};
  const targetCurrency = config.aobobo.statsCostCurrency || 'CNY';
  servers.forEach((server) => {
    memory += Number(server.Host?.MemTotal) || 0;
    disk += Number(server.Host?.DiskTotal) || 0;
    incoming += Number(server.State?.NetInTransfer) || 0;
    outgoing += Number(server.State?.NetOutTransfer) || 0;
    const cpuText = server.Host?.CPU?.[0] || '';
    const count = Number(cpuText.match(/(\d+)\s*(?:Virtual|Physical|Physics)\s*Core/i)?.[1]) || 0;
    cores += count;
    const brand = getCPUInfo(cpuText).company || '其他';
    if (count) brands[brand] = (brands[brand] || 0) + count;
    const billingData = server.PublicNote?.billingDataMod;
    if (billingData?.amount !== undefined) {
      const parsed = parseBillingCostAmount(billingData.amount, config.aobobo.defaultCostCurrency || 'CNY');
      if (parsed.type === 'fixed' && parsed.currency === targetCurrency) {
        monthlyCost += parsed.value / Math.max(billing.getCycleMonths(billingData.cycle), 1);
      }
    }
  });
  const ids = new Set(servers.map((server) => String(server.ID)));
  return {
    totalServers: serverCount.total,
    onlineServers: serverCount.online,
    offlineServers: serverCount.offline,
    groupCounts: groups.map((group) => ({ name: group.name, count: (group.servers || []).filter((id) => ids.has(String(id))).length })).filter((item) => item.count),
    totalCores: cores,
    cpuBrandCores: Object.entries(brands).map(([brand, count]) => ({ brand, cores: count })).sort((a, b) => b.cores - a.cores),
    totalMemory: calcTransfer(memory),
    totalDisk: calcDiskDisplay(disk),
    netInTransfer: calcTransfer(incoming),
    netOutTransfer: calcTransfer(outgoing),
    totalTransfer: calcTransfer(incoming + outgoing),
    monthlyCost: monthlyCost > 0 ? formatCurrencyValue(monthlyCost, targetCurrency) : '',
    yearlyCost: monthlyCost > 0 ? formatCurrencyValue(monthlyCost * 12, targetCurrency) : '',
    costCurrency: targetCurrency,
  };
}

export default function Home() {
  const appState = useStore((state) => state);
  const navigate = useNavigate();
  const { id: routeServerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isWide = useMediaQuery('(min-width: 1001px)');
  const globeRef = useRef<GlobeEarthHandle>(null);
  const hoverTimerRef = useRef(null);
  const resizeRef = useRef(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [group, setGroup] = useState('');
  const [sort, setSort] = useState(defaultServerSortConfig);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [cycleTransferMap, setCycleTransferMap] = useState({});
  const [statsOpen, setStatsOpen] = useState(false);
  const [allHostsOpen, setAllHostsOpen] = useState(false);
  const savedRotation = useMemo(() => loadGlobeRotation(), []);
  const [autoRotate, setAutoRotate] = useState(savedRotation.autoRotate);
  const [rotateSpeed, setRotateSpeed] = useState(savedRotation.rotateSpeed);
  const [connections, setConnections] = useState(savedRotation.showServerConnections);
  const serverIds = useMemo(() => appState.serverList.map((server) => server.ID).join(','), [appState.serverList]);

  useEffect(() => {
    document.title = config.aobobo.title || '哪吒监控';
  }, []);

  const legacyDetailId = searchParams.get('detail');
  useEffect(() => {
    if (routeServerId || !legacyDetailId) return;
    const next = new URLSearchParams(searchParams);
    next.delete('detail');
    const query = next.toString();
    navigate(`/server/${encodeURIComponent(legacyDetailId)}${query ? `?${query}` : ''}`, { replace: true });
  }, [legacyDetailId, navigate, routeServerId, searchParams]);

  useEffect(() => {
    persistGlobeRotation({ autoRotate, rotateSpeed, showServerConnections: connections });
  }, [autoRotate, connections, rotateSpeed]);

  useEffect(() => {
    if (!appState.init || !serverIds) return undefined;
    let active = true;
    let timer;
    const load = async () => {
      try {
        const result = await loadCycleTransferMap();
        if (active) setCycleTransferMap(result || {});
      } catch (error) {
        console.error('Failed to load cycle transfer:', error);
      }
      const seconds = Math.max(Number(config.aobobo.detailCycleTransferRefreshTime) || 60, 10);
      if (active) timer = window.setTimeout(load, seconds * 1000);
    };
    load();
    return () => { active = false; window.clearTimeout(timer); };
  }, [appState.init, serverIds]);

  useEffect(() => {
    if (!appState.init || !appState.showAvailability) return undefined;
    store.dispatch('refreshAvailability');
    const seconds = Number(config.aobobo.availabilityRefreshTime);
    if (!seconds || seconds <= 0) return undefined;
    const timer = window.setInterval(() => store.dispatch('refreshAvailability'), seconds * 1000);
    return () => window.clearInterval(timer);
  }, [appState.init, appState.showAvailability]);

  const locations = useMemo(() => buildLocations(appState.serverList), [appState.serverList]);

  useEffect(() => {
    const focus = appState.globeFocus;
    if (!focus?.code || !globeRef.current) return;
    const location = locations.find((item) => item.code === focus.code || item.codes?.includes(focus.code));
    if (location) globeRef.current.focusLocationWithHighlight(location, focus.name);
    store.dispatch('clearGlobeFocus');
  }, [appState.globeFocus, locations]);

  useEffect(() => {
    const focusCode = searchParams.get('focus');
    if (!focusCode || !locations.length || !globeRef.current) return;
    const location = locations.find((item) => item.code === focusCode || item.codes?.includes(focusCode));
    if (!location) return;
    globeRef.current.focusLocationWithHighlight(location, searchParams.get('name') || location.label);
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    next.delete('name');
    setSearchParams(next, { replace: true });
  }, [locations, searchParams, setSearchParams]);

  const filteredServers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    let result = appState.serverList.filter((server) => !keyword || getServerSearchText(server).includes(keyword));
    if (status) result = result.filter((server) => String(server.online) === status);
    if (group) {
      const selected = appState.serverGroup.find((item) => item.name === group);
      const ids = new Set((selected?.servers || []).map(String));
      result = result.filter((server) => ids.has(String(server.ID)));
    }
    return [...result].sort((a, b) => {
      const onlineOrder = compareServerOnlineStatus(a, b);
      if (onlineOrder) return onlineOrder;
      return sort.prop === 'DisplayIndex' && sort.order === 'desc' ? 0 : serverSortHandler(a, b, sort.prop, sort.order as 'asc' | 'desc');
    });
  }, [appState.serverGroup, appState.serverList, group, search, sort, status]);

  const totalStats = useMemo(() => {
    const total = appState.serverList.reduce((acc, server) => ({
      inTransfer: acc.inTransfer + (Number(server.State?.NetInTransfer) || 0),
      outTransfer: acc.outTransfer + (Number(server.State?.NetOutTransfer) || 0),
      inSpeed: acc.inSpeed + (Number(server.State?.NetInSpeed) || 0),
      outSpeed: acc.outSpeed + (Number(server.State?.NetOutSpeed) || 0),
    }), { inTransfer: 0, outTransfer: 0, inSpeed: 0, outSpeed: 0 });
    return {
      netInTransfer: calcTransfer(total.inTransfer), netOutTransfer: calcTransfer(total.outTransfer),
      netInSpeed: calcTransfer(total.inSpeed), netOutSpeed: calcTransfer(total.outSpeed),
    };
  }, [appState.serverList]);
  const detailStats = useMemo(() => aggregateStats(appState.serverList, appState.serverGroup, appState.serverCount), [appState.serverCount, appState.serverGroup, appState.serverList]);

  const detailId = routeServerId || legacyDetailId;
  const detailServer = appState.serverList.find((server) => String(server.ID) === detailId);
  const detailOpen = Boolean(detailServer);
  const detailPresence = useAnimatedPresence(detailOpen, 320);
  const lastDetailServerRef = useRef(null);
  if (detailServer) lastDetailServerRef.current = detailServer;
  const visibleDetailServer = detailServer || lastDetailServerRef.current;

  useEffect(() => {
    if (appState.init && routeServerId && !detailServer) navigate('/', { replace: true });
  }, [appState.init, detailServer, navigate, routeServerId]);

  const selectServer = useCallback((server) => {
    navigate(`/server/${encodeURIComponent(server.ID)}`);
  }, [navigate]);

  const closeDetail = useCallback(() => {
    if (routeServerId) {
      navigate('/', { replace: true });
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete('detail');
    setSearchParams(next, { replace: true });
  }, [navigate, routeServerId, searchParams, setSearchParams]);

  const hoverServer = useCallback((server) => {
    window.clearTimeout(hoverTimerRef.current);
    globeRef.current?.clearFocusBubble?.();
    if (!server) return;
    hoverTimerRef.current = window.setTimeout(() => {
      const location = resolveServerLocation(server);
      const cluster = location && locations.find((item) => item.code === location.code || item.codes?.includes(location.code));
      if (cluster) globeRef.current?.focusLocationWithHighlight(cluster, server.Name);
    }, 3000);
  }, [locations]);

  useEffect(() => () => window.clearTimeout(hoverTimerRef.current), []);

  const beginResize = (event) => {
    if (!isWide || event.button !== 0) return;
    resizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    setSidebarResizing(true);
    document.documentElement.classList.add('sidebar-resizing');
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const resizeWithKeyboard = (event) => {
    if (!isWide || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') {
      setSidebarWidth(SIDEBAR_MIN_WIDTH);
      return;
    }
    if (event.key === 'End') {
      setSidebarWidth(SIDEBAR_MAX_WIDTH);
      return;
    }
    const step = event.shiftKey ? 40 : 16;
    setSidebarWidth((width) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width + (event.key === 'ArrowLeft' ? step : -step))));
  };
  useEffect(() => {
    if (!sidebarResizing) return undefined;
    const move = (event) => {
      const data = resizeRef.current;
      if (!data) return;
      setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, data.startWidth + data.startX - event.clientX)));
    };
    const end = () => {
      setSidebarResizing(false);
      resizeRef.current = null;
      document.documentElement.classList.remove('sidebar-resizing');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); document.documentElement.classList.remove('sidebar-resizing'); };
  }, [sidebarResizing]);
  useEffect(() => { window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(Math.round(sidebarWidth))); }, [sidebarWidth]);

  const effectiveSidebarOpen = isWide || sidebarOpen;
  const isFiltered = Boolean(search.trim() || status || group);
  const clearFilters = () => { setSearch(''); setStatus(''); setGroup(''); };

  return (
    <div className={`home-view [position:relative] [width:100%] [height:100dvh] [display:grid] [grid-template-rows:auto_minmax(0,_1fr)_auto] [gap:12px] [padding:14px_16px_12px] [overflow:hidden] [background:var(--page-bg)] min-[1024px]:[grid-template-columns:minmax(0,_1fr)_var(--server-sidebar-width,_420px)] max-[1023px]:[gap:0] max-[1023px]:[padding:0] max-[1023px]:[grid-template-rows:1fr]${effectiveSidebarOpen ? '' : ' sidebar-collapsed'}${sidebarResizing ? ' sidebar-resizing' : ''}`} style={{ '--server-sidebar-width': `${sidebarWidth}px` }}>
      {!appState.init && <div className="init-loading-overlay [position:absolute] [inset:0] [z-index:100] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [gap:14px] [background:var(--page-bg)] [color:var(--text-secondary)] [font-size:15px] [text-shadow:0_8px_18px_rgba(15,_23,_42,_0.08)]"><i className="ri-loader-4-line spin init-loading-icon" /><span className="init-loading-text">正在连接哪吒探针...</span></div>}
      <div className="status-bar [display:flex] [align-items:center] [justify-content:space-between] [flex-wrap:wrap] [gap:10px_14px] [padding:8px_14px] [position:relative] [overflow:hidden] [background:var(--status-bar-bg)] [backdrop-filter:blur(18px)_saturate(150%)] [border:1px_solid_var(--border-color)] [border-radius:calc(var(--radius-lg)_+_2px)] [box-shadow:var(--shadow-sm),_inset_0_1px_0_var(--surface-highlight)] [z-index:10] min-[1024px]:[grid-column:2/3] min-[1024px]:[grid-row:1/2] max-[1023px]:[padding:8px_10px] max-[1023px]:[gap:8px_10px] max-[1023px]:[font-size:12px] max-[1023px]:[border-radius:20px] max-[1023px]:[flex-wrap:nowrap] max-[1023px]:[align-items:center] max-[1023px]:[position:absolute] max-[1023px]:[top:10px] max-[1023px]:[left:10px] max-[1023px]:[right:10px] max-[1023px]:[z-index:20] max-[420px]:[padding:8px_10px] max-[420px]:[gap:8px] max-[420px]:[flex-wrap:nowrap] max-[420px]:[align-items:center]">
        <div className="status-group">
          {!isWide && <button type="button" className="mobile-menu-btn max-[1023px]:[display:inline-flex] max-[1023px]:[align-items:center] max-[1023px]:[justify-content:center] max-[1023px]:[width:32px] max-[1023px]:[height:32px] max-[1023px]:[padding:0] max-[1023px]:[border:1px_solid_var(--button-subtle-border)] max-[1023px]:[border-radius:10px] max-[1023px]:[background:var(--button-subtle-bg)] max-[1023px]:[color:var(--text-secondary)] max-[1023px]:[cursor:pointer] max-[1023px]:[transition:color_var(--transition-fast),_background_var(--transition-fast),_border-color_var(--transition-fast),_box-shadow_var(--transition-fast),_transform_var(--transition-fast)]" aria-label="展开服务器列表" onClick={() => setSidebarOpen(true)}><i className="ri-server-line" /></button>}
          <div className="status-summary"><span className="status-summary__total">共<strong>{appState.serverCount.total}</strong>台服务器</span>{appState.serverCount.offline > 0 && <span className="status-summary__item status-summary__item--offline">有{appState.serverCount.offline}台离线</span>}</div>
          <button type="button" className="all-hosts-entry-btn" onClick={() => setAllHostsOpen(true)}><span className="all-hosts-entry-btn__text">全部主机</span></button>
        </div>
        <div className="status-actions"><DashboardButton /><ThemeModeSwitch /></div>
      </div>

      <div className="globe-section [min-height:0] [position:relative] [overflow:hidden] [border-radius:var(--radius-xl)] [border:1px_solid_var(--globe-stage-border)] [background:var(--globe-stage-bg)] [box-shadow:var(--globe-stage-shadow)] min-[1024px]:[grid-column:1/2] min-[1024px]:[grid-row:1/4] max-[1023px]:[min-height:0] max-[1023px]:[border-radius:0] max-[1023px]:[border:none] max-[1023px]:[box-shadow:none]">
        <CurrentTime />
        {appState.serverList.length === 0 ? <div className="empty-state [position:absolute] [inset:0] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [gap:12px] [color:var(--text-secondary)] [font-size:14px] [text-shadow:0_8px_18px_rgba(15,_23,_42,_0.08)]"><i className="ri-earth-line empty-icon" /><span>暂无服务器数据</span></div> : <GlobeEarth ref={globeRef} locations={locations} theme={appState.resolvedTheme} cycleTransferMap={cycleTransferMap} autoRotate={autoRotate} rotateSpeed={rotateSpeed} showServerConnections={connections} onSelectServer={selectServer} />}
        <div className="globe-stats-floating [position:absolute] [left:18px] [bottom:18px] [z-index:10] [width:236px] [display:flex] [flex-direction:column] [gap:9px] [padding:13px_14px] [overflow:hidden] [border-radius:22px] [border:1px_solid_var(--border-color)] [background:linear-gradient(145deg,_rgba(var(--accent-primary-rgb),_0.08),_transparent_42%),_var(--panel-floating-bg)] [backdrop-filter:blur(18px)_saturate(150%)] [box-shadow:var(--shadow-md),_inset_0_1px_0_var(--surface-highlight)] [font-size:12px] [color:var(--text-secondary)] [pointer-events:none] max-[1023px]:[left:14px] max-[1023px]:[bottom:42px] max-[1023px]:[width:218px] max-[1023px]:[gap:7px] max-[1023px]:[padding:10px_12px_11px] max-[1023px]:[border-radius:18px] max-[1023px]:[box-shadow:var(--shadow-sm)] max-[420px]:[left:12px] max-[420px]:[bottom:38px] max-[420px]:[width:198px] max-[420px]:[gap:6px] max-[420px]:[padding:8px_10px_9px] max-[420px]:[border-radius:16px]">
          <div className="globe-stats-count"><span className="stats-count-icon"><i className="ri-server-line" /></span><span className="stats-count-text">共 <strong>{appState.serverCount.total}</strong> 台服务器</span><button type="button" className="stats-more-btn" onClick={() => setStatsOpen(true)}>更多</button></div>
          <div className="globe-stats-row"><span className="stats-label">流量</span><div className="stats-pair"><div className="globe-stats-item globe-stats-item--in"><i className="ri-arrow-down-line" /><span className="stats-value-group"><span className="stats-value">{totalStats.netInTransfer.value}</span><span className="stats-unit">{totalStats.netInTransfer.unit}</span></span></div><div className="globe-stats-item globe-stats-item--out"><i className="ri-arrow-up-line" /><span className="stats-value-group"><span className="stats-value">{totalStats.netOutTransfer.value}</span><span className="stats-unit">{totalStats.netOutTransfer.unit}</span></span></div></div></div>
          <div className="globe-stats-row"><span className="stats-label">网速</span><div className="stats-pair"><div className="globe-stats-item globe-stats-item--in"><i className="ri-arrow-down-line" /><span className="stats-value-group"><span className="stats-value">{totalStats.netInSpeed.value}</span><span className="stats-unit">{totalStats.netInSpeed.unit}/s</span></span></div><div className="globe-stats-item globe-stats-item--out"><i className="ri-arrow-up-line" /><span className="stats-value-group"><span className="stats-value">{totalStats.netOutSpeed.value}</span><span className="stats-unit">{totalStats.netOutSpeed.unit}/s</span></span></div></div></div>
          {appState.serverList.length > 0 && <div className="globe-stats-controls"><GlobeControls autoRotate={autoRotate} speed={rotateSpeed} connections={connections} onAutoRotate={setAutoRotate} onSpeed={setRotateSpeed} onConnections={setConnections} /></div>}
        </div>
      </div>

      <button type="button" className={`mobile-drawer-backdrop [display:none] max-[1023px]:[display:block] max-[1023px]:[position:fixed] max-[1023px]:[inset:0] max-[1023px]:[z-index:24] max-[1023px]:[border:none] max-[1023px]:[padding:0] max-[1023px]:[background:linear-gradient(180deg,_rgba(4,_10,_18,_0.12),_rgba(4,_10,_18,_0.42))] max-[1023px]:[opacity:0] max-[1023px]:[visibility:hidden] max-[1023px]:[pointer-events:none] max-[1023px]:[transition:opacity_var(--transition-normal),_visibility_var(--transition-normal)]${effectiveSidebarOpen ? ' visible' : ''}`} aria-label="关闭服务器列表" onClick={() => setSidebarOpen(false)} />
      {!effectiveSidebarOpen && !isWide && <button type="button" className="sidebar-expand-handle [position:absolute] [top:50%] [right:0] [z-index:15] [display:flex] [align-items:center] [justify-content:center] [width:36px] [height:72px] [padding:0] [border:1px_solid_var(--border-color)] [border-right:none] [border-radius:14px_0_0_14px] [background:var(--section-bg)] [color:var(--text-secondary)] [cursor:pointer] [transform:translateY(-50%)] [box-shadow:var(--shadow-sm)] [transition:color_var(--transition-fast),_background_var(--transition-fast),_border-color_var(--transition-fast),_box-shadow_var(--transition-fast)] max-[1023px]:[display:none]" aria-label="展开服务器列表" onClick={() => setSidebarOpen(true)}><i className="ri-server-line" /></button>}
      <div className={`server-list-section [position:relative] [min-height:0] [min-width:0] [border-radius:var(--radius-xl)] [border:1px_solid_var(--border-color)] [background:var(--section-bg)] [backdrop-filter:blur(18px)_saturate(150%)] [box-shadow:var(--shadow-sm),_inset_0_1px_0_var(--surface-highlight)] [overflow:hidden] [display:flex] [flex-direction:column] [transition:opacity_var(--transition-normal),_visibility_var(--transition-normal)] min-[1024px]:[grid-column:2/3] min-[1024px]:[grid-row:2/3] max-[1023px]:[position:fixed] max-[1023px]:[inset:10px_10px_10px_auto] max-[1023px]:[width:min(420px,_100vw_-_20px)] max-[1023px]:[height:auto] max-[1023px]:[z-index:30] max-[1023px]:[border-radius:28px_0_0_28px] max-[1023px]:[transform:translateX(0)] max-[1023px]:[transition:transform_var(--transition-normal),_opacity_var(--transition-normal),_visibility_var(--transition-normal)] max-[768px]:[inset:auto_10px_10px_10px] max-[768px]:[width:auto] max-[768px]:[height:min(72dvh,_660px)] max-[768px]:[border-radius:28px] max-[768px]:[transform:translateY(0)] max-[768px]:[transition:transform_var(--transition-normal),_height_var(--transition-normal),_opacity_var(--transition-normal),_visibility_var(--transition-normal)] max-[420px]:[inset:auto_8px_8px_8px] max-[420px]:[height:min(76dvh,_680px)]${effectiveSidebarOpen ? '' : ' collapsed'}${sidebarWidth >= SIDEBAR_DOUBLE_COLUMN_WIDTH ? ' is-double-column' : ''}`}>
        {isWide && <div className="desktop-sidebar-resizer" role="separator" aria-label="调整服务器列表宽度" aria-orientation="vertical" aria-valuemin={SIDEBAR_MIN_WIDTH} aria-valuemax={SIDEBAR_MAX_WIDTH} aria-valuenow={Math.round(sidebarWidth)} tabIndex={0} title="拖动调整宽度，双击恢复默认" onKeyDown={resizeWithKeyboard} onPointerDown={beginResize} onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}><span /></div>}
        <div className="tech-frame" aria-hidden="true" />
        <div className="section-header">
          {!isWide && <div className="section-title-row"><button type="button" className="close-sidebar" onClick={() => setSidebarOpen(false)}><i className="ri-arrow-right-s-line" /></button></div>}
          <div className="section-toolbar">
            <div className="toolbar-row toolbar-row--primary"><div className="search-filter-bar"><label className="search-box"><i className="ri-search-line" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索名称 / 地区 / 系统" />{search && <button type="button" className="clear-search" onClick={() => setSearch('')}><i className="ri-close-line" /></button>}</label>{appState.serverCount.offline > 0 && <StatusFilter value={status} onChange={setStatus} />}</div><SortSelect value={sort} options={serverSortOptions()} onChange={setSort} /></div>
            {appState.serverGroup.length > 0 && <div className="group-filter-bar"><button type="button" className={`group-chip${group === '' ? ' active' : ''}`} onClick={() => setGroup('')}>全部</button>{appState.serverGroup.map((item) => <button key={item.name} type="button" className={`group-chip${group === item.name ? ' active' : ''}`} onClick={() => setGroup(item.name)}>{item.name}</button>)}</div>}
          </div>
        </div>
        {filteredServers.length > 0 ? <ServerTable servers={filteredServers} cycleTransferMap={cycleTransferMap} onSelect={selectServer} onHover={hoverServer} /> : <div className="empty-list [flex:1] [min-height:0] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [gap:8px] [padding:40px_20px] [color:var(--text-muted)] [font-size:13px]"><i className="ri-inbox-line empty-icon" /><span>没有符合条件的服务器</span>{isFiltered && <button type="button" className="clear-filter-btn [margin-top:4px] [padding:6px_14px] [border-radius:999px] [border:1px_solid_var(--panel-chip-border)] [background:var(--panel-chip-bg)] [color:var(--text-secondary)] [font-size:12px] [font-weight:700] [line-height:1.4] [cursor:pointer] [transition:color_var(--transition-fast),_background_var(--transition-fast),_border-color_var(--transition-fast)]" onClick={clearFilters}>清除筛选</button>}</div>}
        {isFiltered && <div className="result-hint-floating"><span className="section-summary">{filteredServers.length} 条匹配</span></div>}
      </div>

      <StatsModal open={statsOpen} display={detailStats} onClose={() => setStatsOpen(false)} />
      <AllHostsModal open={allHostsOpen} servers={appState.serverList} groups={appState.serverGroup} serverCount={appState.serverCount} cycleTransferMap={cycleTransferMap} onClose={() => setAllHostsOpen(false)} onSelect={(server) => { setAllHostsOpen(false); selectServer(server); }} />
      <AppFooter className="app-footer--absolute [min-height:18px] [margin:0_0_6px] [padding:0_18px] max-[768px]:[position:absolute] max-[768px]:[bottom:10px] max-[768px]:[left:0] max-[768px]:[right:0] max-[768px]:[z-index:20] max-[768px]:[margin:0] max-[768px]:[min-height:auto] max-[768px]:[padding:8px] max-[768px]:[text-shadow:0_1px_2px_rgba(0,_0,_0,_0.1)] min-[1024px]:[grid-column:2/3] min-[1024px]:[grid-row:3/4] max-[1023px]:[position:absolute] max-[1023px]:[bottom:10px] max-[1023px]:[left:0] max-[1023px]:[right:0] max-[1023px]:[z-index:20] max-[1023px]:[margin:0] max-[1023px]:[min-height:auto] max-[1023px]:[padding:8px] max-[1023px]:[text-shadow:0_1px_2px_rgba(0,_0,_0,_0.1)]" />

      {detailPresence.rendered && visibleDetailServer && <><div className={`detail-drawer-backdrop [position:fixed] [inset:0] [z-index:200] [background:rgba(0,_0,_0,_0.35)] [backdrop-filter:blur(2px)] [will-change:opacity]${detailPresence.visible ? ' is-visible' : ''}`} onClick={closeDetail} /><aside className={`detail-drawer [position:fixed] [top:0] [right:0] [bottom:0] [z-index:201] [display:flex] [flex-direction:column] [width:900px] [max-width:100%] [background:var(--page-bg)] [box-shadow:var(--shadow-lg)] [outline:none] [will-change:transform] max-[1000px]:[width:100%]${detailPresence.visible ? ' is-visible' : ''}${visibleDetailServer.online === 1 ? '' : ' server--offline'}`} role="dialog" aria-modal="true" aria-label={`${visibleDetailServer.Name} 详情`}><div className="detail-drawer__header [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] [flex-shrink:0] [padding:14px_18px] [background:var(--section-header-bg)] [border-bottom:1px_solid_var(--border-color)]"><h2 className="detail-drawer__title [min-width:0] [margin:0] [font-size:16px] [font-weight:700] [color:var(--text-primary)] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap]">{visibleDetailServer.Name || '服务器详情'}</h2><button type="button" className="detail-drawer__close [display:inline-flex] [align-items:center] [justify-content:center] [width:34px] [height:34px] [flex-shrink:0] [border-radius:999px] [border:1px_solid_var(--button-subtle-border)] [background:var(--button-subtle-bg)] [color:var(--text-secondary)] [font-size:18px] [cursor:pointer] [transition:color_var(--transition-fast),_background_var(--transition-fast),_border-color_var(--transition-fast),_box-shadow_var(--transition-fast),_transform_var(--transition-fast)]" aria-label="关闭详情" onClick={closeDetail}><i className="ri-close-line" /></button></div><div className="detail-drawer__body [flex:1] [min-height:0] [overflow-y:auto] [padding:14px_16px_20px]"><div className="detail-drawer__stack [display:flex] [flex-direction:column] [gap:14px] [max-width:var(--detail-container-width)] [margin:0_auto] [width:100%]"><DetailContent key={visibleDetailServer.ID} info={visibleDetailServer} /></div></div></aside></>}
    </div>
  );
}
