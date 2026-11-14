import { useTranslation } from 'react-i18next';
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
import { isOnlineHistorySupported, loadServerOnlineHistory } from '@/utils/api';
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
  const { t } = useTranslation();
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
    <DetailPanel className="server-online-history [display:flex] [flex-direction:column] [gap:12px] [padding:16px_18px_18px] max-[768px]:[padding:12px_14px]">
      <div className="history-head [flex-wrap:wrap] max-[460px]:[align-items:flex-start] max-[460px]:[flex-direction:column]">
        <span className="module-title [min-height:28px] [font-size:15px]"><i className="ri-history-line" />{t('在线历史')}</span>
        <div className="head-controls [flex-wrap:wrap] [gap:8px] max-[460px]:[width:100%] max-[460px]:[justify-content:space-between]">
          {history && <span className={`online-state [gap:5px] [color:var(--text-secondary)] [font-size:11px] [font-weight:600]${history.currently_online ? ' is-online' : ''}`}><span className="online-state__dot" />{history.currently_online ? t('在线') : t('离线')}</span>}
          <div className="range-switch" role="group" aria-label={t('在线历史时间范围')}>{DAY_OPTIONS.map((option) => <button key={option} type="button" className={`range-option [min-width:42px] [height:26px] [padding:0_9px]${days === option ? ' active' : ''}${option > maxDays ? ' locked' : ''}`} disabled={option > maxDays} onClick={() => selectDays(option)}>{t('{{days}}天', { days: option })}</button>)}</div>
        </div>
      </div>

      {loading && !history ? <div className="history-skeleton [display:flex] [flex-direction:column] [gap:12px]"><div className="skeleton-summary [display:grid] [grid-template-columns:repeat(4,_minmax(0,_1fr))] [gap:8px]">{[1, 2, 3, 4].map((item) => <span key={item} />)}</div><div className="skeleton-line [height:54px]" /></div> : error ? (
        <div className="history-message"><i className="ri-error-warning-line" /><span>{t(error)}</span><button type="button" className="text-button [min-height:26px] [padding:0_10px]" onClick={() => setReload((value) => value + 1)}>{t('重试')}</button></div>
      ) : history ? (
        <>
          <div className="summary-grid [display:grid] [grid-template-columns:repeat(4,_minmax(0,_1fr))] [border-top:1px_solid_var(--panel-stat-border)] [border-bottom:1px_solid_var(--panel-stat-border)] max-[768px]:[grid-template-columns:repeat(2,_minmax(0,_1fr))]">
            <div className="summary-item [display:flex] [min-width:0] [flex-direction:column] [align-items:center] [gap:4px] [padding:12px_8px] [text-align:center]"><span className="summary-label">{t('在线率')}</span><strong>{onlineRate}%</strong><span className="rate-track [width:72px] [height:3px] [overflow:hidden] [border-radius:999px] [background:var(--progress-track)]"><span className="rate-fill [display:block] [height:100%] [border-radius:inherit] [background:var(--accent-success)]" style={{ width: `${onlineRate}%` }} /></span><span className="summary-foot">{windowRange}</span></div>
            <div className="summary-item [display:flex] [min-width:0] [flex-direction:column] [align-items:center] [gap:4px] [padding:12px_8px] [text-align:center]"><span className="summary-label">{t('窗口内在线')}</span><strong>{formatDuration(history.total_online_seconds)}</strong><span className="summary-foot">{windowRange}</span></div>
            <div className="summary-item [display:flex] [min-width:0] [flex-direction:column] [align-items:center] [gap:4px] [padding:12px_8px] [text-align:center]"><span className="summary-label">{t('窗口内离线')}</span><strong>{formatDuration(offlineSeconds)}</strong><span className="summary-foot">{windowRange}</span></div>
            <div className="summary-item [display:flex] [min-width:0] [flex-direction:column] [align-items:center] [gap:4px] [padding:12px_8px] [text-align:center]"><span className="summary-label">{t('最后活跃')}</span><strong>{lastActive?.format('HH:mm:ss') || 'N/A'}</strong><span className="summary-foot">{lastActive?.format('YYYY-MM-DD') || t('暂无记录')}</span></div>
          </div>
          <div className="history-block [display:flex] [flex-direction:column] [gap:10px] [padding-top:12px] [border-top:1px_solid_var(--panel-stat-border)]">
            <div className="block-head"><span className="block-title [font-size:14px]">{t('每日在线')}</span><span className="block-meta [font-family:var(--font-mono)]">0:00 - 24:00{timezone && ` · ${timezone}`}</span></div>
            <div className="daily-grid [display:grid] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:8px] max-[768px]:[grid-template-columns:1fr]">{dailyRows.map((day) => <div key={day.date} className="daily-row [display:flex] [min-width:0] [flex-direction:column] [gap:6px] [padding:8px_10px] [border:1px_solid_var(--panel-stat-border)] [border-radius:8px] [background:var(--panel-metric-bg)]"><div className="daily-head [color:var(--text-secondary)] [font-family:var(--font-mono)] [font-size:11px] [font-variant-numeric:tabular-nums]"><span>{day.date}</span><span>{formatDuration(day.online_seconds)}</span></div><div className="timeline [position:relative] [height:8px] [overflow:hidden] [border-radius:999px] [background:var(--progress-track)]">{day.window.leftPct > 0 && <span className="timeline-shade [z-index:1] [pointer-events:none] timeline-shade--outside [left:0] [background-image:repeating-linear-gradient(135deg,_transparent,_transparent_3px,_var(--text-muted)_3px,_var(--text-muted)_4px)] [opacity:0.28]" style={{ width: `${day.window.leftPct}%` }} />}{day.window.rightPct < 100 && <span className="timeline-shade [z-index:1] [pointer-events:none] timeline-shade--future [background:var(--bg-primary)] [opacity:0.7]" style={{ left: `${day.window.rightPct}%`, width: `${100 - day.window.rightPct}%` }} />}{day.segments.map((segment) => { const end = segment.live ? t('持续中') : formatPeriodMoment(segment.segEnd, segment.segStart, timezone, true); const title = `${segment.segStart.format('HH:mm:ss')} → ${end}`; return <button key={`${segment.period.start}-${segment.leftPct}`} type="button" className={`online-segment [z-index:2] [min-width:2px] [padding:0] [border:0] [border-radius:999px] [background:var(--accent-success)] [cursor:help] [opacity:0.9] [transition:opacity_var(--transition-fast)]${segment.live ? ' is-live' : ''}`} style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }} title={title} aria-label={title} />; })}{[25, 50, 75].map((tick) => <span key={tick} className="timeline-tick [z-index:3] [width:1px] [background:var(--text-primary)] [opacity:0.14] [pointer-events:none]" style={{ left: `${tick}%` }} />)}</div><div className="timeline-scale [display:flex] [justify-content:space-between] [color:var(--text-muted)] [font-family:var(--font-mono)] [font-size:9px] [line-height:1] [font-variant-numeric:tabular-nums]">{[0, 6, 12, 18, 24].map((hour) => <span key={hour}>{hour}</span>)}</div></div>)}</div>
          </div>
          <div className="history-block [display:flex] [flex-direction:column] [gap:10px] [padding-top:12px] [border-top:1px_solid_var(--panel-stat-border)]">
            <div className="block-head"><span className="block-title [font-size:14px]">{mode === 'online' ? t('在线时段') : t('离线时段')}</span><div className="mode-switch"><button type="button" className={mode === 'online' ? 'active' : ''} onClick={() => setMode('online')}>{t('在线')}</button><button type="button" className={mode === 'offline' ? 'active' : ''} onClick={() => setMode('offline')}>{t('离线')}</button></div></div>
            {groups.length ? <div className="period-groups [display:flex] [flex-direction:column] [gap:12px]">{groups.slice(0, visibleDays).map((group) => <div key={group.date} className="period-group [display:flex] [flex-direction:column] [gap:6px]"><div className="period-group__head [color:var(--text-secondary)] [font-size:11px]"><span>{group.day.format('MM-DD')}{panelNow(timezone).isSame(panelDay(group.date, timezone), 'day') && <em> · {t('今天')}</em>}</span><span>{mode === 'online' ? t('在线') : t('离线')} {formatDuration(group.total)}</span></div><div className="period-chips [flex-wrap:wrap] [gap:5px]">{group.chips.map((chip, index) => <span key={`${chip.start.valueOf()}-${index}`} className={`period-chip [display:inline-flex] [max-width:100%] [min-height:28px] [align-items:center] [gap:5px] [padding:0_8px] [border:1px_solid_var(--panel-chip-border)] [border-radius:6px] [background:var(--panel-chip-bg)] [color:var(--text-secondary)] [font-family:var(--font-mono)] [font-size:10px] [font-variant-numeric:tabular-nums] [white-space:nowrap] [cursor:default] max-[460px]:[white-space:normal] period-chip--${mode}${chip.ongoing ? ' is-live' : ''}`}><span>{chip.start.format('HH:mm')}</span><span className="period-chip__arrow [color:var(--text-muted)]">→</span><span>{chip.ongoing ? t('持续中') : formatPeriodMoment(chip.end, chip.start, timezone)}</span><span className="period-chip__duration [color:var(--text-muted)]">{formatDuration(chip.end.diff(chip.start, 'second'))}</span></span>)}</div></div>)}{groups.length > visibleDays && <button type="button" className="expand-button [width:100%] [min-height:30px]" onClick={() => setVisibleDays((value) => value + 10)}>{t('展开更多')}</button>}</div> : <p className="history-empty">{mode === 'online' ? t('当前时间范围内没有在线记录。') : t('当前时间范围内没有离线记录。')}</p>}
          </div>
        </>
      ) : <div className="history-message"><i className="ri-information-line" /><span>{t('当前探针版本暂不提供在线历史接口。')}</span></div>}
    </DetailPanel>
  );
}
