import { useEffect, useMemo, useRef, useState } from 'react';
import config from '@/config';
import store, { useStore } from '@/store';
import request from '@/utils/request';
import { hasTsdb, isTsdbEnabled } from '@/utils/tsdb';
import { calcTransfer, formatDiskSize } from '@/utils/host';
import { DetailPanel } from '@/components/react/Common';
import LineChart from '@/components/react/LineChart';

const REALTIME = 'realtime';
const METRICS = ['cpu', 'memory', 'swap', 'disk', 'process_count', 'net_in_speed', 'net_out_speed', 'tcp_conn', 'udp_conn'];
const RANGES = [
  { label: '实时', value: REALTIME },
  { label: '30分钟', value: 30 },
  { label: '1小时', value: 60 },
  { label: '6小时', value: 360 },
  { label: '12小时', value: 720 },
  { label: '24小时', value: 1440 },
  { label: '7天', value: 10080, long: true },
  { label: '30天', value: 43200, long: true },
];
const COLORS = {
  cpu: '#4e90ff', memory: '#27c975', swap: '#f59e0b', disk: '#22d3ee',
  process_count: '#f5b199', net_in_speed: '#f5b199', net_out_speed: '#89c3eb',
  tcp_conn: '#89c3eb', udp_conn: '#4e90ff',
};

type MetricPoint = { ts: number; value: number };
type MetricHistory = Record<string, MetricPoint[]>;

function emptyHistory(): MetricHistory {
  return Object.fromEntries(METRICS.map((metric) => [metric, []]));
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percent(used, total) {
  const value = finite(used);
  const max = finite(total);
  return value === null || !max ? null : (value / max) * 100;
}

function normalizePoint(metric, point, info) {
  const tsRaw = point?.ts ?? point?.timestamp ?? point?.time;
  let ts = Number(tsRaw);
  if (!Number.isFinite(ts)) ts = Date.parse(tsRaw || '');
  let value = finite(point?.value ?? point?.avg ?? point?.usage);
  if (!Number.isFinite(ts) || value === null) return null;
  const totals = { memory: info?.Host?.MemTotal, swap: info?.Host?.SwapTotal, disk: info?.Host?.DiskTotal };
  if (totals[metric] && value > 100) value = percent(value, totals[metric]);
  return { ts, value };
}

function periodFor(range) {
  if (range === 10080) return '7d';
  if (range === 43200) return '30d';
  return '1d';
}

async function loadV1Metric(id, metric, period, info) {
  const base = config.aobobo.v1ApiMetricsPath.replace('{id}', id);
  const query = new URLSearchParams({ metric, period }).toString();
  const response = await request({ url: `${base}${base.includes('?') ? '&' : '?'}${query}` });
  const data = response?.data?.data || {};
  const points = data.data_points || data.dataPoints || data.DataPoints || [];
  return (Array.isArray(points) ? points : [])
    .map((point) => normalizePoint(metric, point, info)).filter(Boolean).sort((a, b) => a.ts - b.ts);
}

function formatBytes(value) {
  if (!Number.isFinite(Number(value))) return '-';
  const result = calcTransfer(Number(value));
  return `${result.value}${result.unit}`;
}

function formatNumber(value, suffix = '') {
  return Number.isFinite(Number(value)) ? `${Number(Number(value).toFixed(1))}${suffix}` : '-';
}

function buildSeries(history, ...definitions) {
  return definitions.map(([metric, name]) => ({
    id: metric,
    name,
    color: COLORS[metric],
    data: (history[metric] || []).map((point) => [point.ts, point.value]),
  }));
}

function MetricCard({ title, summary, details = [], series, yAxis = {}, loading, emptyText }: {
  title: string;
  summary?: string;
  details?: Array<{ label: string; value: string; detail?: string; color: string }>;
  series: any[];
  yAxis?: Record<string, any>;
  loading: boolean;
  emptyText: string;
}) {
  const hasData = series.some((item) => item.data.length > 0);
  return (
    <article className="history-card [display:grid] [grid-template-rows:52px_180px] [gap:8px] [min-width:0] [padding:12px] [border-radius:var(--radius-md)] [border:1px_solid_var(--panel-stat-border)] [background:var(--resource-history-card-bg)] [box-shadow:inset_0_1px_0_var(--surface-highlight)] max-[768px]:[grid-template-rows:50px_140px] max-[768px]:[padding:10px] max-[768px]:[gap:7px]">
      <div className={`history-card__head [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] [min-height:52px] [min-width:0] max-[768px]:[gap:10px] max-[768px]:[min-height:50px] history-card__head--${details.length ? 'metrics' : 'summary'}`}>
        <h3 className="history-card__title [flex:1_1_auto] [margin:0] [min-width:0] [font-size:17px] [font-weight:700] [line-height:1.2] [white-space:nowrap] [overflow:hidden] [text-overflow:ellipsis] [color:var(--text-primary)] max-[768px]:[font-size:15px]">{title}</h3>
        {details.length ? (
          <div className="history-card__metrics [display:flex] [flex-direction:column] [gap:4px] [min-width:0] [width:100%] [flex:0_1_110px] [max-width:30%]">{details.map((detail) => <div key={detail.label} className="history-card__metric-row [display:grid] [grid-template-columns:auto_auto_auto_minmax(0,_1fr)] [align-items:center] [column-gap:6px] [min-width:0] [min-height:22px] [padding:0_8px] [border-radius:999px] [border:1px_solid_var(--panel-chip-border)] [background:var(--panel-chip-bg)] [box-shadow:inset_0_1px_0_var(--surface-highlight)] [overflow:hidden] max-[768px]:[min-height:20px] max-[768px]:[padding:0_7px] max-[768px]:[column-gap:5px]" style={{ '--metric-color': detail.color }}><span className="history-card__metric-dot [width:6px] [height:6px] [border-radius:999px] [background:var(--metric-color)] [box-shadow:0_0_0_3px_var(--surface-subtle)]" /><span className="history-card__metric-label [color:var(--text-secondary)] [font-size:11px] [line-height:1] [white-space:nowrap]">{detail.label}</span><span className="history-card__metric-value [color:var(--text-primary)] [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] [font-size:11px] [font-weight:700] [line-height:1] [white-space:nowrap]">{detail.value}</span><span className="history-card__metric-detail [min-width:0] [justify-self:end] [color:var(--text-secondary)] [font-size:10px] [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] [line-height:1] [white-space:nowrap] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[font-size:9px]">{detail.detail}</span></div>)}</div>
        ) : <span className="history-card__summary [display:inline-flex] [align-items:center] [min-height:24px] [max-width:100%] [padding:0_9px] [border-radius:999px] [border:1px_solid_var(--panel-chip-border)] [background:var(--panel-chip-bg)] [box-shadow:inset_0_1px_0_var(--surface-highlight)] [color:var(--text-primary)] [font-family:var(--font-mono)] [font-size:12px] [font-weight:700] [font-variant-numeric:tabular-nums] [line-height:1] [white-space:nowrap] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:22px] max-[768px]:[padding:0_8px] max-[768px]:[font-size:11px]">{summary}</span>}
      </div>
      <div className="history-card__chart-shell [position:relative] [display:flex] [align-items:stretch] [height:180px] [min-height:0] [border-radius:12px] [border:1px_solid_var(--panel-stat-border)] [background:rgba(255,_255,_255,_0.016)] [overflow:hidden] max-[768px]:[height:140px] max-[768px]:[min-height:0]">
        {hasData ? <LineChart series={series} height={170} yAxis={yAxis} /> : <div className="history-card__empty [flex:1] [display:flex] [align-items:center] [justify-content:center] [padding:12px] [color:var(--text-muted)] [font-size:12px] [text-align:center]">{emptyText}</div>}
        {loading && <div className="history-card__loading [position:absolute] [inset:0] [display:flex] [align-items:center] [justify-content:center] [background:var(--resource-history-card-bg)] [z-index:2]"><i className="ri-loader-4-line spin history-card__loading-icon [font-size:24px] [color:var(--accent-primary)]" /></div>}
      </div>
    </article>
  );
}

export default function ResourceHistory({ info }) {
  useStore((state) => ({ setting: state.setting, profile: state.profile }));
  const canHistory = isTsdbEnabled(store);
  const canLong = hasTsdb(store) && Boolean(store.state.profile?.username);
  const ranges = RANGES.filter((item) => !item.long || canLong).filter((item) => item.value === REALTIME || canHistory);
  const [range, setRange] = useState(() => {
    const stored = window.localStorage.getItem('aobobo_resource_history_period');
    return stored === REALTIME ? REALTIME : Number(stored) || REALTIME;
  });
  const [history, setHistory] = useState(emptyHistory);
  const [live, setLive] = useState(emptyHistory);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const metricInfo = useMemo(() => ({
    Host: {
      MemTotal: info?.Host?.MemTotal,
      SwapTotal: info?.Host?.SwapTotal,
      DiskTotal: info?.Host?.DiskTotal,
    },
  }), [info?.Host?.DiskTotal, info?.Host?.MemTotal, info?.Host?.SwapTotal]);

  useEffect(() => {
    if (!ranges.some((item) => item.value === range)) setRange(ranges[0]?.value || REALTIME);
  }, [range, ranges]);

  useEffect(() => {
    window.localStorage.setItem('aobobo_resource_history_period', String(range));
  }, [range]);

  useEffect(() => {
    const now = Date.now();
    const state = info?.State;
    if (!state) return;
    const values = {
      cpu: finite(state.CPU), memory: percent(state.MemUsed, info?.Host?.MemTotal),
      swap: percent(state.SwapUsed, info?.Host?.SwapTotal), disk: percent(state.DiskUsed, info?.Host?.DiskTotal),
      process_count: finite(state.ProcessCount), net_in_speed: finite(state.NetInSpeed), net_out_speed: finite(state.NetOutSpeed),
      tcp_conn: finite(state.TcpConnCount), udp_conn: finite(state.UdpConnCount),
    };
    setLive((previous) => Object.fromEntries(METRICS.map((metric) => {
      const recent = (previous[metric] || []).filter((point) => point.ts > now - 5 * 60 * 1000);
      return [metric, values[metric] === null ? recent : [...recent, { ts: now, value: values[metric] }]];
    })));
  }, [info?.Host?.DiskTotal, info?.Host?.MemTotal, info?.Host?.SwapTotal, info?.State]);

  useEffect(() => {
    if (range === REALTIME || !canHistory || !info?.ID) {
      setLoading(false);
      return undefined;
    }
    const serial = requestRef.current + 1;
    requestRef.current = serial;
    setLoading(true);
    const period = periodFor(range);
    const task = Promise.all(METRICS.map(async (metric) => [metric, await loadV1Metric(info.ID, metric, period, metricInfo)]))
      .then(Object.fromEntries);
    task.then((rawResult) => {
      const result = rawResult as MetricHistory;
      if (serial !== requestRef.current) return;
      if (Number(range) <= 1440) {
        const latest = Math.max(...Object.values(result).flat().map((point) => point.ts), 0);
        const cutoff = latest - Number(range) * 60000;
        setHistory(Object.fromEntries(Object.entries(result).map(([key, points]) => [key, points.filter((point) => point.ts >= cutoff)])));
      } else setHistory(result);
    }).catch((error) => console.error('Failed to load resource history:', error)).finally(() => {
      if (serial === requestRef.current) setLoading(false);
    });
    return () => { requestRef.current += 1; };
  }, [canHistory, info?.ID, metricInfo, range]);

  const active = range === REALTIME ? live : history;
  const cards = useMemo(() => [
    { title: 'CPU', summary: formatNumber(info?.State?.CPU, '%'), series: buildSeries(active, ['cpu', 'CPU']), yAxis: { max: 100 } },
    { title: '内存 / 交换', details: [
      { label: '内存', value: formatBytes(info?.State?.MemUsed), detail: `/ ${formatBytes(info?.Host?.MemTotal)}`, color: COLORS.memory },
      { label: '交换', value: info?.Host?.SwapTotal ? formatBytes(info?.State?.SwapUsed) : 'no swap', detail: info?.Host?.SwapTotal ? `/ ${formatBytes(info?.Host?.SwapTotal)}` : '', color: COLORS.swap },
    ], series: buildSeries(active, ['memory', '内存'], ['swap', '交换']), yAxis: { max: 100 } },
    { title: '磁盘', summary: `${formatDiskSize(info?.State?.DiskUsed) || '-'} / ${formatDiskSize(info?.Host?.DiskTotal) || '-'}`, series: buildSeries(active, ['disk', '磁盘']), yAxis: { max: 100 } },
    { title: '进程数', summary: formatNumber(info?.State?.ProcessCount), series: buildSeries(active, ['process_count', '进程']) },
    { title: '上传 / 下载', details: [
      { label: '上传', value: `${formatBytes(info?.State?.NetInSpeed)}/s`, color: COLORS.net_in_speed },
      { label: '下载', value: `${formatBytes(info?.State?.NetOutSpeed)}/s`, color: COLORS.net_out_speed },
    ], series: buildSeries(active, ['net_in_speed', '上传'], ['net_out_speed', '下载']) },
    { title: 'TCP / UDP', details: [
      { label: 'TCP', value: formatNumber(info?.State?.TcpConnCount), color: COLORS.tcp_conn },
      { label: 'UDP', value: formatNumber(info?.State?.UdpConnCount), color: COLORS.udp_conn },
    ], series: buildSeries(active, ['tcp_conn', 'TCP'], ['udp_conn', 'UDP']) },
  ], [active, info]);

  return (
    <DetailPanel className="server-detail-resource-history [padding:16px_18px_18px] max-[768px]:[padding:12px_14px]">
      <div className="module-head-group [display:flex] [flex-wrap:wrap] [align-items:center] [justify-content:space-between] [gap:12px] [margin-bottom:12px]">
        <span className="module-title [min-height:28px] [font-size:15px]"><i className="ri-line-chart-line" />资源历史</span>
        <div className="time-range-group [display:flex] [align-items:center] [gap:6px] [min-height:30px] [min-width:0] max-[768px]:[width:100%]"><span className="time-range-label">范围</span><div className="time-range-options">{ranges.map((item) => <button key={item.value} type="button" className={`time-range-item${range === item.value ? ' active' : ''}`} onClick={() => setRange(item.value)}>{item.label}</button>)}</div></div>
      </div>
      <div className="history-grid [display:grid] [gap:12px] [grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[768px]:[gap:8px] max-[768px]:[grid-template-columns:1fr]">{cards.map((card) => <MetricCard key={card.title} {...card} loading={loading} emptyText={range === REALTIME ? '等待实时数据' : '暂无历史数据'} />)}</div>
    </DetailPanel>
  );
}
