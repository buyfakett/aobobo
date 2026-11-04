import { useEffect, useMemo, useState } from 'react';
import config from '@/config';
import request from '@/utils/request';
import store, { useStore } from '@/store';
import { hasTsdb, isTsdbEnabled } from '@/utils/tsdb';
import { getLineColor, getThreshold } from '@/composables/server-monitor';
import { DetailPanel } from '@/components/react/Common';
import LineChart from '@/components/react/LineChart';

const BASE_RANGES = [
  { label: '30分钟', value: 30 }, { label: '1小时', value: 60 }, { label: '3小时', value: 180 },
  { label: '6小时', value: 360 }, { label: '12小时', value: 720 }, { label: '24小时', value: 1440 },
];

function readBoolean(key, fallback) {
  const value = window.localStorage.getItem(key);
  return value === null ? fallback : value === 'true';
}

export default function NetworkMonitor({ info }) {
  const serverTime = useStore((state) => state.serverTime);
  const longAllowed = Boolean(store.state.profile?.username) && hasTsdb(store);
  const ranges = useMemo(() => (longAllowed
    ? [...BASE_RANGES.filter((item) => ![180, 360].includes(item.value)), { label: '7天', value: 10080 }, { label: '30天', value: 43200 }]
    : BASE_RANGES), [longAllowed]);
  const [range, setRange] = useState(1440);
  const [monitorData, setMonitorData] = useState([]);
  const [peakShaving, setPeakShaving] = useState(() => readBoolean('aobobo_monitor_peak_shaving', false));
  const [refresh, setRefresh] = useState(() => readBoolean('aobobo_monitor_refresh_data', true));
  const [chartType, setChartType] = useState(() => window.localStorage.getItem('aobobo_monitor_chart_type') || config.aobobo.monitorChartType || 'multi');
  const [hidden, setHidden] = useState({});

  useEffect(() => {
    if (!ranges.some((item) => item.value === range)) setRange(ranges.at(-1)?.value || 1440);
  }, [range, ranges]);

  useEffect(() => {
    let active = true;
    let timer;
    async function load() {
      let url = (hasTsdb(store) ? config.aobobo.v1ApiMonitorPath : config.aobobo.v1ApiMonitorPathFallback).replace('{id}', info.ID);
      if (isTsdbEnabled(store)) {
        const period = range === 10080 ? '7d' : range === 43200 ? '30d' : '1d';
        url += `${url.includes('?') ? '&' : '?'}period=${period}`;
      }
      try {
        const response = await request({ url });
        if (active && Array.isArray(response?.data?.data)) setMonitorData(response.data.data);
      } catch (error) {
        console.error('Failed to load network monitor:', error);
      }
      const refreshTime = Number.parseInt(config.aobobo.monitorRefreshTime, 10);
      if (active && refresh && range <= 1440 && refreshTime !== 0) {
        timer = window.setTimeout(load, Math.max(Number.isNaN(refreshTime) ? 30 : refreshTime, 10) * 1000);
      }
    }
    load();
    return () => { active = false; window.clearTimeout(timer); };
  }, [info.ID, range, refresh]);

  const chartData = useMemo(() => monitorData.map((item) => {
    const cutoff = (serverTime || 0) - range * 60000;
    const raw = (item.created_at || []).map((time, index) => [Number(time), Number(item.avg_delay?.[index])])
      .filter(([time, value]) => time >= cutoff && Number.isFinite(value));
    let points = raw;
    if (peakShaving && raw.length) {
      const threshold = getThreshold(raw.map((point) => point[1]));
      points = raw.map(([time, value]) => [time, Math.abs(value - threshold.median) > threshold.median * threshold.tolerancePercent ? null : value]);
    }
    const valid = points.filter((point) => Number.isFinite(point[1]));
    const average = valid.length ? valid.reduce((sum, point) => sum + point[1], 0) / valid.length : 0;
    const id = item.monitor_id;
    return {
      id,
      name: item.monitor_name,
      color: getLineColor(id),
      average: Number(average.toFixed(2)),
      success: raw.length ? Number(((valid.length / raw.length) * 100).toFixed(2)) : 0,
      data: points,
    };
  }).filter((item) => item.data.length > 0), [monitorData, peakShaving, range, serverTime]);

  if (!chartData.length) return null;
  const visible = chartData.filter((item) => !hidden[item.id]);
  const toggle = (setter, key, value) => {
    setter(value);
    window.localStorage.setItem(key, String(value));
  };
  return (
    <DetailPanel className={`server-detail-monitor [padding:16px_18px_18px] max-[768px]:[padding:12px_14px] chart-type--${chartType}`}>
      <div className="module-head-group [display:flex] [flex-wrap:wrap] [align-items:center] [justify-content:space-between] [gap:12px] [margin-bottom:12px]">
        <span className="module-title [min-height:28px] [font-size:15px]"><i className="ri-pulse-line" />网络监控</span>
        <div className="right-box">
          {config.aobobo.monitorChartTypeToggle && <button type="button" className="control-switch" onClick={() => toggle(setChartType, 'aobobo_monitor_chart_type', chartType === 'multi' ? 'single' : 'multi')}><span className="label-text">聚合</span><span className={`switch-box${chartType === 'multi' ? ' active' : ''}`}><span className="switch-dot" /></span></button>}
          <button type="button" className="control-switch" onClick={() => toggle(setRefresh, 'aobobo_monitor_refresh_data', !refresh)}><span className="label-text">刷新</span><span className={`switch-box${refresh ? ' active' : ''}`}><span className="switch-dot" /></span></button>
          <button type="button" className="control-switch" onClick={() => toggle(setPeakShaving, 'aobobo_monitor_peak_shaving', !peakShaving)}><span className="label-text">削峰</span><span className={`switch-box${peakShaving ? ' active' : ''}`}><span className="switch-dot" /></span></button>
          <div className="time-range-group [display:flex] [align-items:center] [gap:6px] [min-height:30px] [min-width:0] max-[768px]:[width:100%]"><span className="time-range-label">最近</span><div className="time-range-options">{ranges.map((item) => <button type="button" key={item.value} className={`time-range-item${range === item.value ? ' active' : ''}`} onClick={() => setRange(item.value)}>{item.label}</button>)}</div></div>
        </div>
      </div>
      <div className="monitor-cate-group [margin:8px_0_12px] [display:flex] [flex-wrap:wrap] [gap:7px]">{chartData.map((item) => <button key={item.id} type="button" className={`monitor-cate-item${hidden[item.id] ? ' disabled' : ''}`} style={{ '--cate-color': item.color }} title={`${item.name}\n平均延迟：${item.average}ms\n成功率：${item.success}%`} onClick={() => setHidden((state) => ({ ...state, [item.id]: !state[item.id] }))}><span className="cate-legend" /><span className="cate-name">{item.name}</span>{item.average > 0 && <span className="cate-avg-ms">{item.average}ms</span>}</button>)}</div>
      {chartType === 'single' ? <div className="monitor-chart-group [display:flex] [flex-wrap:wrap] [gap:12px]">{visible.map((item) => <div key={item.id} className="monitor-chart-item"><div className="cate-name-box"><span className="cate-name">{item.name}</span></div><LineChart series={[item]} height={240} /></div>)}</div> : <LineChart series={visible} height={280} />}
    </DetailPanel>
  );
}
