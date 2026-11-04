import { useEffect, useMemo, useRef, useState } from 'react';
import { getSystemOSLabel } from '@/utils/host';
import ServerCard from '@/components/react/ServerCard';

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, open]);
}

export function StatsModal({ open, display, onClose }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="stats-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="stats-modal-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="stats-modal-card">
        <div className="stats-modal-header"><div className="stats-modal-title-group"><span className="stats-modal-icon"><i className="ri-dashboard-3-line" /></span><h3 id="stats-modal-title">服务器资源概览</h3></div><button type="button" className="stats-modal-close" aria-label="关闭" onClick={onClose}><i className="ri-close-line" /></button></div>
        <div className="stats-modal-body">
          <section className="overview-band"><div className="overview-main"><span className="overview-label">服务器总数</span><div className="overview-value"><strong>{display.totalServers || 0}</strong><span>台</span></div></div><div className="overview-chips"><span className="stat-badge online"><i className="ri-checkbox-blank-circle-fill" />{display.onlineServers || 0} 在线</span>{display.offlineServers > 0 && <span className="stat-badge offline"><i className="ri-checkbox-blank-circle-fill" />{display.offlineServers} 离线</span>}{display.groupCounts?.map((group) => <span key={group.name} className="stat-badge">{group.name} {group.count}</span>)}</div></section>
          <section className="dashboard-section dashboard-section--resources">
            <div className="section-heading"><span className="section-icon"><i className="ri-cpu-line" /></span><div><h4>资源池</h4><span>CPU / 内存 / 硬盘</span></div></div>
            <div className="resource-grid">
              <div className="metric-cell metric-cell--wide"><span className="metric-label">总核心数</span><div className="metric-value-row"><strong>{display.totalCores || 0}</strong><span>C</span></div><div className="metric-tags">{display.cpuBrandCores?.map((item) => <span key={item.brand} className="stat-badge">{item.brand} {item.cores}C</span>)}</div></div>
              <div className="metric-cell"><span className="metric-label">总内存</span><div className="metric-value-row"><strong>{display.totalMemory?.value || 0}</strong><span>{display.totalMemory?.unit || 'B'}</span></div></div>
              <div className="metric-cell"><span className="metric-label">总硬盘</span><div className="metric-value-row"><strong>{display.totalDisk?.value || 0}</strong><span>{display.totalDisk?.unit || 'B'}</span></div></div>
            </div>
          </section>
          <div className="detail-panels">
            <section className="dashboard-section"><div className="section-heading"><span className="section-icon"><i className="ri-arrow-up-down-line" /></span><div><h4>流量</h4><span>累计传输</span></div></div><div className="headline-metric"><span>总流量</span><strong>{display.totalTransfer?.value || 0}<small>{display.totalTransfer?.unit || 'B'}</small></strong></div><div className="split-row"><div><span className="split-label in"><i className="ri-arrow-down-line" />入站</span><strong>{display.netInTransfer?.value || 0}{display.netInTransfer?.unit || 'B'}</strong></div><div><span className="split-label out"><i className="ri-arrow-up-line" />出站</span><strong>{display.netOutTransfer?.value || 0}{display.netOutTransfer?.unit || 'B'}</strong></div></div></section>
            <section className="dashboard-section dashboard-section--cost"><div className="section-heading"><span className="section-icon"><i className="ri-money-cny-circle-line" /></span><div><h4>成本</h4><span>{display.costCurrency || 'CNY'} 统计</span></div></div><div className="cost-grid"><div><span>每月</span><strong>{display.monthlyCost || '—'}</strong></div><div><span>每年</span><strong>{display.yearlyCost || '—'}</strong></div></div></section>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AllHostsModal({ open, servers, groups, serverCount, cycleTransferMap, onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const bodyRef = useRef(null);
  useEscape(open, onClose);
  useEffect(() => { if (open) { setSearch(''); setStatus(''); } }, [open]);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return servers.filter((server) => {
      if (status && String(server.online) !== status) return false;
      const text = [server.Name, server.Host?.CountryCode, server.PublicNote?.customData?.location, getSystemOSLabel(server.Host?.Platform), server.Host?.Platform].filter(Boolean).join(' ').toLowerCase();
      return !keyword || text.includes(keyword);
    });
  }, [search, servers, status]);
  const displayGroups = useMemo(() => {
    const assigned = new Set();
    const result = groups.map((group) => {
      const ids = new Set((group.servers || []).map(String));
      const members = filtered.filter((server) => ids.has(String(server.ID)));
      members.forEach((server) => assigned.add(String(server.ID)));
      return { key: group.name, label: group.name, servers: members };
    }).filter((group) => group.servers.length);
    const ungrouped = filtered.filter((server) => !assigned.has(String(server.ID)));
    if (ungrouped.length) result.push({ key: '__ungrouped__', label: '未分组', servers: ungrouped });
    return result.map((group) => ({ ...group, offlineCount: group.servers.filter((server) => server.online !== 1).length }));
  }, [filtered, groups]);
  if (!open) return null;
  const isFiltered = Boolean(search.trim() || status);
  return (
    <div className="all-hosts-overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="all-hosts-modal">
        <div className="all-hosts-modal__header"><div className="all-hosts-modal__title-group"><span className="all-hosts-modal__icon"><i className="ri-server-line" /></span><h3>全部主机总览</h3></div><button type="button" className="all-hosts-modal__close" aria-label="关闭" onClick={onClose}><i className="ri-close-line" /></button></div>
        <div className="all-hosts-modal__toolbar"><label className="all-hosts-search"><i className="ri-search-line" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索名称 / 地区 / 系统" />{search && <button type="button" className="all-hosts-search__clear" onClick={() => setSearch('')}><i className="ri-close-line" /></button>}</label><div className="all-hosts-status-chips">{[{ label: '全部', value: '' }, { label: '在线', value: '1' }, { label: '离线', value: '-1' }].map((option) => <button key={option.value || 'all'} type="button" className={`status-chip${status === option.value ? ' active' : ''}`} onClick={() => setStatus(option.value)}>{option.label}</button>)}</div></div>
        <div className="all-hosts-modal__groups-bar"><div className="summary-badges"><span className="summary-badge"><i className="ri-server-line" />共 <strong>{serverCount.total}</strong> 台</span><span className="summary-badge summary-badge--online">在线 <strong>{serverCount.online}</strong></span>{serverCount.offline > 0 && <span className="summary-badge summary-badge--offline">离线 <strong>{serverCount.offline}</strong></span>}</div>{displayGroups.length > 1 && displayGroups.map((group, index) => <button key={group.key} type="button" className="group-jump-chip" onClick={() => bodyRef.current?.querySelector(`[data-group-index="${index}"]`)?.scrollIntoView({ behavior: 'smooth' })}><span className="group-jump-chip__name">{group.label}</span><span className="group-jump-chip__count">{group.servers.length}</span></button>)}{isFiltered && <div className="summary-filter-hint"><span className="summary-matched">{filtered.length} 条匹配</span><button type="button" className="summary-clear-btn" onClick={() => { setSearch(''); setStatus(''); }}>清除筛选</button></div>}</div>
        <div ref={bodyRef} className="all-hosts-modal__body">{displayGroups.map((group, index) => <section key={group.key} className="host-group" data-group-index={index}><div className="host-group__header"><h4 className="host-group__title">{group.label}</h4><div className="host-group__chips"><span className="stat-chip stat-chip--total">{group.servers.length}台</span>{group.offlineCount > 0 && <span className="stat-chip stat-chip--offline">{group.offlineCount}台离线</span>}</div></div><div className="host-group__grid">{group.servers.map((server) => <ServerCard key={server.ID} server={server} cycleTransferMap={cycleTransferMap} onSelect={onSelect} />)}</div></section>)}{displayGroups.length === 0 && <div className="all-hosts-empty"><i className="ri-inbox-line empty-icon" /><span>没有符合条件的服务器</span></div>}</div>
      </div>
    </div>
  );
}
