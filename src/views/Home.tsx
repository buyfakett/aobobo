import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import config from '@/config';
import store, { useStore } from '@/store';
import { resolveServerLocation, clusterLocations } from '@/utils/world-map';
import { calcTransfer, getCPUInfo, getSystemOSLabel } from '@/utils/host';
import { loadCycleTransferMap } from '@/utils/cycle-transfer';
import billing from '@/utils/billing';
import { formatCurrencyValue, parseBillingCostAmount } from '@/utils/exchange-rate';
import {
  defaultServerSortConfig,
  serverSortHandler,
  serverSortOptions,
} from '@/composables/server-sort';
import {
  loadGlobeRotation,
  persistGlobeRotation,
} from '@/utils/globe-rotation';
import useMediaQuery from '@/hooks/useMediaQuery';
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
    totalDisk: calcTransfer(disk),
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
      const onlineOrder = Number(a.online !== 1) - Number(b.online !== 1);
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

  const detailId = searchParams.get('detail');
  const detailServer = appState.serverList.find((server) => String(server.ID) === detailId);
  const detailOpen = Boolean(isWide && detailServer);

  const selectServer = useCallback((server) => {
    if (isWide) {
      const next = new URLSearchParams(searchParams);
      next.set('detail', server.ID);
      setSearchParams(next);
    } else navigate(`/server/${server.ID}`);
  }, [isWide, navigate, searchParams, setSearchParams]);

  const closeDetail = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('detail');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
    event.currentTarget.setPointerCapture?.(event.pointerId);
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
    <div className={`home-view${effectiveSidebarOpen ? '' : ' sidebar-collapsed'}${sidebarResizing ? ' sidebar-resizing' : ''}`} style={{ '--server-sidebar-width': `${sidebarWidth}px` }}>
      {!appState.init && <div className="init-loading-overlay"><i className="ri-loader-4-line spin init-loading-icon" /><span className="init-loading-text">正在连接哪吒探针...</span></div>}
      <div className="status-bar">
        <div className="status-group">
          {!isWide && <button type="button" className="mobile-menu-btn" aria-label="展开服务器列表" onClick={() => setSidebarOpen(true)}><i className="ri-server-line" /></button>}
          <div className="status-summary"><span className="status-summary__total">共<strong>{appState.serverCount.total}</strong>台服务器</span>{appState.serverCount.offline > 0 && <span className="status-summary__item status-summary__item--offline">有{appState.serverCount.offline}台离线</span>}</div>
          <button type="button" className="all-hosts-entry-btn" onClick={() => setAllHostsOpen(true)}><span className="all-hosts-entry-btn__text">全部主机</span></button>
        </div>
        <div className="status-actions"><DashboardButton /><ThemeModeSwitch /></div>
      </div>

      <div className="globe-section">
        <CurrentTime />
        {appState.serverList.length === 0 ? <div className="empty-state"><i className="ri-earth-line empty-icon" /><span>暂无服务器数据</span></div> : <GlobeEarth ref={globeRef} locations={locations} theme={appState.resolvedTheme} cycleTransferMap={cycleTransferMap} autoRotate={autoRotate} rotateSpeed={rotateSpeed} showServerConnections={connections} onSelectServer={selectServer} />}
        <div className="globe-stats-floating">
          <div className="globe-stats-count"><span className="stats-count-icon"><i className="ri-server-line" /></span><span className="stats-count-text">共 <strong>{appState.serverCount.total}</strong> 台服务器</span><button type="button" className="stats-more-btn" onClick={() => setStatsOpen(true)}>更多</button></div>
          <div className="globe-stats-row"><span className="stats-label">流量</span><div className="stats-pair"><div className="globe-stats-item globe-stats-item--in"><i className="ri-arrow-down-line" /><span className="stats-value-group"><span className="stats-value">{totalStats.netInTransfer.value}</span><span className="stats-unit">{totalStats.netInTransfer.unit}</span></span></div><div className="globe-stats-item globe-stats-item--out"><i className="ri-arrow-up-line" /><span className="stats-value-group"><span className="stats-value">{totalStats.netOutTransfer.value}</span><span className="stats-unit">{totalStats.netOutTransfer.unit}</span></span></div></div></div>
          <div className="globe-stats-row"><span className="stats-label">网速</span><div className="stats-pair"><div className="globe-stats-item globe-stats-item--in"><i className="ri-arrow-down-line" /><span className="stats-value-group"><span className="stats-value">{totalStats.netInSpeed.value}</span><span className="stats-unit">{totalStats.netInSpeed.unit}/s</span></span></div><div className="globe-stats-item globe-stats-item--out"><i className="ri-arrow-up-line" /><span className="stats-value-group"><span className="stats-value">{totalStats.netOutSpeed.value}</span><span className="stats-unit">{totalStats.netOutSpeed.unit}/s</span></span></div></div></div>
          {appState.serverList.length > 0 && <div className="globe-stats-controls"><GlobeControls autoRotate={autoRotate} speed={rotateSpeed} connections={connections} onAutoRotate={setAutoRotate} onSpeed={setRotateSpeed} onConnections={setConnections} /></div>}
        </div>
      </div>

      <button type="button" className={`mobile-drawer-backdrop${effectiveSidebarOpen ? ' visible' : ''}`} aria-label="关闭服务器列表" onClick={() => setSidebarOpen(false)} />
      {!effectiveSidebarOpen && !isWide && <button type="button" className="sidebar-expand-handle" aria-label="展开服务器列表" onClick={() => setSidebarOpen(true)}><i className="ri-server-line" /></button>}
      <div className={`server-list-section${effectiveSidebarOpen ? '' : ' collapsed'}`}>
        {isWide && <div className="desktop-sidebar-resizer" role="separator" tabIndex={0} onPointerDown={beginResize} onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}><span /></div>}
        <div className="tech-frame" aria-hidden="true" />
        <div className="section-header">
          {!isWide && <div className="section-title-row"><button type="button" className="close-sidebar" onClick={() => setSidebarOpen(false)}><i className="ri-arrow-right-s-line" /></button></div>}
          <div className="section-toolbar">
            <div className="toolbar-row toolbar-row--primary"><div className="search-filter-bar"><label className="search-box"><i className="ri-search-line" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索名称 / 地区 / 系统" />{search && <button type="button" className="clear-search" onClick={() => setSearch('')}><i className="ri-close-line" /></button>}</label>{appState.serverCount.offline > 0 && <StatusFilter value={status} onChange={setStatus} />}</div><SortSelect value={sort} options={serverSortOptions()} onChange={setSort} /></div>
            {appState.serverGroup.length > 0 && <div className="group-filter-bar"><button type="button" className={`group-chip${group === '' ? ' active' : ''}`} onClick={() => setGroup('')}>全部</button>{appState.serverGroup.map((item) => <button key={item.name} type="button" className={`group-chip${group === item.name ? ' active' : ''}`} onClick={() => setGroup(item.name)}>{item.name}</button>)}</div>}
          </div>
        </div>
        {filteredServers.length > 0 ? <ServerTable servers={filteredServers} cycleTransferMap={cycleTransferMap} onSelect={selectServer} onHover={hoverServer} /> : <div className="empty-list"><i className="ri-inbox-line empty-icon" /><span>没有符合条件的服务器</span>{isFiltered && <button type="button" className="clear-filter-btn" onClick={clearFilters}>清除筛选</button>}</div>}
        {isFiltered && <div className="result-hint-floating"><span className="section-summary">{filteredServers.length} 条匹配</span></div>}
      </div>

      <StatsModal open={statsOpen} display={detailStats} onClose={() => setStatsOpen(false)} />
      <AllHostsModal open={allHostsOpen} servers={appState.serverList} groups={appState.serverGroup} serverCount={appState.serverCount} cycleTransferMap={cycleTransferMap} onClose={() => setAllHostsOpen(false)} onSelect={(server) => { setAllHostsOpen(false); selectServer(server); }} />
      <AppFooter className="app-footer--absolute" />

      {detailOpen && <><div className="detail-drawer-backdrop" onClick={closeDetail} /><aside className={`detail-drawer${detailServer.online === 1 ? '' : ' server--offline'}`} role="dialog" aria-modal="true" aria-label={`${detailServer.Name} 详情`}><div className="detail-drawer__header"><h2 className="detail-drawer__title">{detailServer.Name || '服务器详情'}</h2><button type="button" className="detail-drawer__close" aria-label="关闭详情" onClick={closeDetail}><i className="ri-close-line" /></button></div><div className="detail-drawer__body"><div className="detail-drawer__stack"><DetailContent key={detailServer.ID} info={detailServer} /></div></div></aside></>}
    </div>
  );
}
