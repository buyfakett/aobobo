import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import config from '@/config';
import {
  getCycleTransferRuleName,
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
  const { t } = useTranslation();
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
    progress: Number.isFinite(item.remainingPercent) ? Math.max(0, Math.min(100, item.remainingPercent)) : null,
  })), [items]);

  if (config.aobobo.hideDetailCycleTransfer || viewItems.length === 0) return null;
  return (
    <DetailPanel className="server-detail-cycle-transfer [padding:12px_18px]">
      <div className="module-head-group [display:flex] [flex-wrap:wrap] [align-items:center] [justify-content:space-between] [gap:12px] [margin-bottom:12px]"><span className="module-title [min-height:28px] [font-size:15px]"><i className="ri-exchange-funds-line" />{t('周期流量')}</span>{refreshSeconds > 0 && <span className="refresh-tip">{t('{{seconds}}s 自动刷新', { seconds: refreshSeconds })}</span>}</div>
      <div className="cycle-transfer-list">
        {viewItems.map((item) => (
          <div key={`${item.source}_${item.ruleId}_${item.serverKey}`} className={`cycle-transfer-item status--${item.statusLevel}`}>
            <div className="cycle-transfer-item-head"><span className="rule-name">{getCycleTransferRuleName(item)}</span><span className={`rule-status status--${item.statusLevel}`}>{getCycleTransferStatusLabel(item.statusLevel)}</span></div>
            <div className="cycle-transfer-meta"><span className="meta-item">{t('周期 {{period}}', { period: item.periodText })}</span><span className="meta-item">{t('下次 {{time}}', { time: item.nextCheckDisplay })}</span></div>
            <div className="cycle-transfer-stats"><span className="stats-item">{t('已用 {{value}}', { value: item.currentUsageDisplay })}</span><span className="stats-item">{t('剩余 {{value}}', { value: item.remainingDisplay })}</span><span className="stats-item">{t('上限 {{value}}', { value: item.maxDisplay })}</span>{item.minDisplay !== '0B' && item.minDisplay !== '-' && <span className="stats-item">{t('下限 {{value}}', { value: item.minDisplay })}</span>}</div>
            {item.progress !== null && <div className="progress-group"><div className="progress-track"><div className={`progress-bar status--${item.statusLevel}`} style={{ width: `${item.progress}%` }} /></div><div className="progress-text">{item.remainingDisplay} / {item.remainingPercent.toFixed(2)}%</div></div>}
          </div>
        ))}
      </div>
    </DetailPanel>
  );
}
