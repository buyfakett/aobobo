import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import config from '@/config';
import {
  getCycleTransferStatusLabel,
  loadCycleTransferByServer,
} from '@/utils/cycle-transfer';
import { DetailPanel } from '@/components/react/Common';

function formatPeriod(start, end) {
  const from = dayjs(start, 'YYYY.MM.DD HH:mm:ss');
  const to = dayjs(end, 'YYYY.MM.DD HH:mm:ss');
  if (!from.isValid() || !to.isValid()) return `${start} - ${end}`;
  const format = from.year() === to.year() ? 'MM.DD' : 'YYYY.MM.DD';
  return `${from.format(format)} - ${to.format(format)}`;
}

export default function CycleTransfer({ info }) {
  const [items, setItems] = useState([]);
  const refreshSeconds = Math.max(Number.parseInt(config.aobobo.detailCycleTransferRefreshTime, 10) || 60, 0);

  useEffect(() => {
    if (config.aobobo.hideDetailCycleTransfer || !info?.ID) return undefined;
    let active = true;
    let timer;
    const load = async () => {
      try {
        const result = await loadCycleTransferByServer(info);
        if (active) setItems(Array.isArray(result) ? result : []);
      } catch (error) {
        if (active) setItems([]);
        console.error('Failed to load cycle transfer data:', error);
      }
      if (active && refreshSeconds > 0) timer = window.setTimeout(load, refreshSeconds * 1000);
    };
    load();
    return () => { active = false; window.clearTimeout(timer); };
  }, [info, refreshSeconds]);

  const viewItems = useMemo(() => items.map((item) => ({
    ...item,
    periodText: formatPeriod(item.periodStart, item.periodEnd),
    statusLabel: getCycleTransferStatusLabel(item.statusLevel),
    progress: Number.isFinite(item.remainingPercent) ? Math.max(0, Math.min(100, item.remainingPercent)) : null,
  })), [items]);

  if (config.aobobo.hideDetailCycleTransfer || viewItems.length === 0) return null;
  return (
    <DetailPanel className="server-detail-cycle-transfer">
      <div className="module-head-group"><span className="module-title"><i className="ri-exchange-funds-line" />周期流量</span>{refreshSeconds > 0 && <span className="refresh-tip">{refreshSeconds}s 自动刷新</span>}</div>
      <div className="cycle-transfer-list">
        {viewItems.map((item) => (
          <div key={`${item.source}_${item.ruleId}_${item.serverKey}`} className={`cycle-transfer-item status--${item.statusLevel}`}>
            <div className="cycle-transfer-item-head"><span className="rule-name">{item.ruleName}</span><span className={`rule-status status--${item.statusLevel}`}>{item.statusLabel}</span></div>
            <div className="cycle-transfer-meta"><span className="meta-item">周期 {item.periodText}</span><span className="meta-item">下次 {item.nextCheckDisplay}</span></div>
            <div className="cycle-transfer-stats"><span className="stats-item">已用 {item.currentUsageDisplay}</span><span className="stats-item">剩余 {item.remainingDisplay}</span><span className="stats-item">上限 {item.maxDisplay}</span>{item.minDisplay !== '0B' && item.minDisplay !== '-' && <span className="stats-item">下限 {item.minDisplay}</span>}</div>
            {item.progress !== null && <div className="progress-group"><div className="progress-track"><div className={`progress-bar status--${item.statusLevel}`} style={{ width: `${item.progress}%` }} /></div><div className="progress-text">{item.remainingDisplay} / {item.remainingPercent.toFixed(2)}%</div></div>}
          </div>
        ))}
      </div>
    </DetailPanel>
  );
}
