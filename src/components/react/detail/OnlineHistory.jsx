import { useEffect, useMemo, useState } from 'react';
import {
  buildDailyOnlineRows,
  buildOfflineGroups,
  formatDuration,
  formatPeriodMoment,
  groupOnlineRows,
  panelDay,
  panelNow,
  windowDurationSeconds,
} from '@/utils/online-history';
import { isOnlineHistorySupported, loadServerOnlineHistory } from '@/utils/load-online-history';
import { DetailPanel } from '@/components/react/Common';

const DAY_OPTIONS = [1, 7, 30];

function getErrorMessage(error) {
  const message = String(error?.response?.data?.error || error?.response?.data?.message || error?.message || '').toLowerCase();
  if (message.includes('only 1d data available for guests')) return '游客仅可查看最近 1 天在线历史。';
  if (error?.response?.status === 404) return '当前探针版本暂不提供在线历史接口。';
  if ([401, 403].includes(error?.response?.status)) return '登录后可查看更多在线历史。';
  return '在线历史加载失败，请稍后重试。';
}

export default function OnlineHistory({ info }) {
  const [days, setDays] = useState(1);
  const [maxDays, setMaxDays] = useState(30);
  const [mode, setMode] = useState('online');
  const [visibleDays, setVisibleDays] = useState(3);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!isOnlineHistorySupported() || !info?.ID) return undefined;
    let active = true;
    let timer;
    setLoading(true);
    setError('');
    loadServerOnlineHistory(info.ID, days).then((data) => {
      if (!active) return;
      setHistory(data);
      const available = Number(data.max_days);
      if (Number.isFinite(available) && available > 0) setMaxDays(Math.min(available, 30));
      timer = window.setTimeout(() => setReload((value) => value + 1), 60000);
    }).catch((loadError) => {
      if (!active) return;
      const guestLimited = String(loadError?.response?.data?.error || loadError?.message || '').toLowerCase().includes('only 1d data available for guests');
      if (guestLimited && days !== 1) {
        setMaxDays(1);
        setDays(1);
      } else setError(getErrorMessage(loadError));
    }).finally(() => active && setLoading(false));
    return () => { active = false; window.clearTimeout(timer); };
  }, [days, info?.ID, reload]);

  const timezone = history?.timezone || '';
  const dailyRows = useMemo(() => history ? buildDailyOnlineRows(
    history.periods, history.daily, history.window_start, history.window_end, timezone,
  ) : [], [history, timezone]);
  const groups = useMemo(() => {
    if (!history) return [];
    return mode === 'online'
      ? groupOnlineRows(dailyRows, timezone)
      : buildOfflineGroups(history.periods, history.daily, history.window_start, history.window_end, history.currently_online, timezone);
  }, [dailyRows, history, mode, timezone]);
  const onlineRate = Number(history?.online_rate || 0).toFixed(1);
  const totalDuration = history ? windowDurationSeconds(history.window_start, history.window_end, timezone) : 0;
  const offlineSeconds = Math.max(0, totalDuration - (Number(history?.total_online_seconds) || 0));
  const windowRange = history ? `${panelDay(history.window_start, timezone).format('MM-DD')} - ${panelDay(history.window_end, timezone).format('MM-DD')}` : '';
  const lastActive = history?.last_active ? panelDay(history.last_active, timezone) : null;

  function selectDays(value) {
    if (value > maxDays || value === days) return;
    setDays(value);
    setVisibleDays(3);
  }

  return (
    <DetailPanel className="server-online-history">
      <div className="history-head">
        <span className="module-title"><i className="ri-history-line" />在线历史</span>
        <div className="head-controls">
          {history && <span className={`online-state${history.currently_online ? ' is-online' : ''}`}><span className="online-state__dot" />{history.currently_online ? '在线' : '离线'}</span>}
          <div className="range-switch" role="group" aria-label="在线历史时间范围">{DAY_OPTIONS.map((option) => <button key={option} type="button" className={`range-option${days === option ? ' active' : ''}${option > maxDays ? ' locked' : ''}`} disabled={option > maxDays} onClick={() => selectDays(option)}>{option}天</button>)}</div>
        </div>
      </div>

      {loading && !history ? <div className="history-skeleton"><div className="skeleton-summary">{[1, 2, 3, 4].map((item) => <span key={item} />)}</div><div className="skeleton-line" /></div> : error ? (
        <div className="history-message"><i className="ri-error-warning-line" /><span>{error}</span><button type="button" className="text-button" onClick={() => setReload((value) => value + 1)}>重试</button></div>
      ) : history ? (
        <>
          <div className="summary-grid">
            <div className="summary-item"><span className="summary-label">在线率</span><strong>{onlineRate}%</strong><span className="rate-track"><span className="rate-fill" style={{ width: `${onlineRate}%` }} /></span><span className="summary-foot">{windowRange}</span></div>
            <div className="summary-item"><span className="summary-label">窗口内在线</span><strong>{formatDuration(history.total_online_seconds)}</strong><span className="summary-foot">{windowRange}</span></div>
            <div className="summary-item"><span className="summary-label">窗口内离线</span><strong>{formatDuration(offlineSeconds)}</strong><span className="summary-foot">{windowRange}</span></div>
            <div className="summary-item"><span className="summary-label">最后活跃</span><strong>{lastActive?.format('HH:mm:ss') || 'N/A'}</strong><span className="summary-foot">{lastActive?.format('YYYY-MM-DD') || '暂无记录'}</span></div>
          </div>
          <div className="history-block">
            <div className="block-head"><span className="block-title">每日在线</span><span className="block-meta">0:00 - 24:00{timezone && ` · ${timezone}`}</span></div>
            <div className="daily-grid">{dailyRows.map((day) => <div key={day.date} className="daily-row"><div className="daily-head"><span>{day.date}</span><span>{formatDuration(day.online_seconds)}</span></div><div className="timeline">{day.window.leftPct > 0 && <span className="timeline-shade timeline-shade--outside" style={{ width: `${day.window.leftPct}%` }} />}{day.window.rightPct < 100 && <span className="timeline-shade timeline-shade--future" style={{ left: `${day.window.rightPct}%`, width: `${100 - day.window.rightPct}%` }} />}{day.segments.map((segment) => { const end = segment.live ? '持续中' : formatPeriodMoment(segment.segEnd, segment.segStart, timezone, true); const title = `${segment.segStart.format('HH:mm:ss')} → ${end}`; return <button key={`${segment.period.start}-${segment.leftPct}`} type="button" className={`online-segment${segment.live ? ' is-live' : ''}`} style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }} title={title} aria-label={title} />; })}{[25, 50, 75].map((tick) => <span key={tick} className="timeline-tick" style={{ left: `${tick}%` }} />)}</div><div className="timeline-scale">{[0, 6, 12, 18, 24].map((hour) => <span key={hour}>{hour}</span>)}</div></div>)}</div>
          </div>
          <div className="history-block">
            <div className="block-head"><span className="block-title">{mode === 'online' ? '在线时段' : '离线时段'}</span><div className="mode-switch"><button type="button" className={mode === 'online' ? 'active' : ''} onClick={() => setMode('online')}>在线</button><button type="button" className={mode === 'offline' ? 'active' : ''} onClick={() => setMode('offline')}>离线</button></div></div>
            {groups.length ? <div className="period-groups">{groups.slice(0, visibleDays).map((group) => <div key={group.date} className="period-group"><div className="period-group__head"><span>{group.day.format('MM-DD')}{panelNow(timezone).isSame(panelDay(group.date, timezone), 'day') && <em> · 今天</em>}</span><span>{mode === 'online' ? '在线' : '离线'} {formatDuration(group.total)}</span></div><div className="period-chips">{group.chips.map((chip, index) => <span key={`${chip.start.valueOf()}-${index}`} className={`period-chip period-chip--${mode}${chip.ongoing ? ' is-live' : ''}`}><span>{chip.start.format('HH:mm')}</span><span className="period-chip__arrow">→</span><span>{chip.ongoing ? '持续中' : formatPeriodMoment(chip.end, chip.start, timezone)}</span><span className="period-chip__duration">{formatDuration(chip.end.diff(chip.start, 'second'))}</span></span>)}</div></div>)}{groups.length > visibleDays && <button type="button" className="expand-button" onClick={() => setVisibleDays((value) => value + 10)}>展开更多</button>}</div> : <p className="history-empty">当前时间范围内没有{mode === 'online' ? '在线' : '离线'}记录。</p>}
          </div>
        </>
      ) : <div className="history-message"><i className="ri-information-line" /><span>当前探针版本暂不提供在线历史接口。</span></div>}
    </DetailPanel>
  );
}
