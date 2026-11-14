import { t } from '@/i18n';
import { useTranslation } from 'react-i18next';
import config from '@/config';
import { DetailPanel } from '@/components/react/Common';

function temperatureItems(info) {
  return (info?.State?.Temperatures || []).map((item) => {
    const name = String(item.Name || t('传感器'));
    const lower = name.toLowerCase();
    let type = 'other';
    let label = name;
    if (lower.includes('cpu') || lower.includes('coretemp') || lower.includes('k10temp')) { type = 'cpu'; label = 'CPU'; }
    else if (lower.includes('gpu')) { type = 'gpu'; label = 'GPU'; }
    else if (lower.includes('nvme')) { type = 'nvme'; label = 'NVME'; }
    else if (lower.includes('acpitz') || lower.includes('board')) { type = 'motherboard'; label = t('主板'); }
    return { type, label, value: `${Number(item.Temperature || 0).toFixed(1)}℃`, title: `${name}: ${Number(item.Temperature || 0).toFixed(1)}℃` };
  });
}

const TEMP_ICONS = {
  cpu: 'ri-cpu-line', gpu: 'ri-gamepad-line', nvme: 'ri-hard-drive-3-line', motherboard: 'ri-instance-line', other: 'ri-temp-hot-line',
};

export default function ServerInfo({ info }) {
  const { t } = useTranslation();
  const temperatures = temperatureItems(info);
  const orderLink = info?.PublicNote?.customData?.orderLink;
  if (!temperatures.length && !orderLink) return null;
  const openOrder = () => window.open(decodeURIComponent(orderLink), '_blank', 'noopener,noreferrer');
  return (
    <DetailPanel className="server-detail-info [padding:14px_18px] max-[768px]:[padding:10px_12px]">
      <div className="info-grid [display:grid] [grid-template-columns:repeat(3,_minmax(0,_1fr))] [gap:8px] max-[768px]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[768px]:[gap:6px] max-[900px]:min-[769px]:[grid-template-columns:repeat(2,_minmax(0,_1fr))]">
        {temperatures.length > 0 && <div className="info-cell [display:flex] [align-items:center] [gap:8px] [padding:9px_11px] [border-radius:var(--radius-md)] [background:var(--panel-metric-bg)] [border:1px_solid_var(--panel-stat-border)] [transition:background_var(--transition-fast),_border-color_var(--transition-fast),_transform_var(--transition-fast)] max-[768px]:[flex-direction:column] max-[768px]:[align-items:stretch] max-[768px]:[gap:3px] max-[768px]:[padding:6px_8px] info-cell--full [grid-column:1/-1] [flex-direction:column] [align-items:stretch] [gap:6px] max-[768px]:[grid-column:1/-1]"><div className="info-cell-label [display:inline-flex] [align-items:center] [gap:5px] [flex-shrink:0] [color:var(--text-muted)] [font-weight:600] [font-size:11px] [line-height:1] max-[768px]:[gap:3px] max-[768px]:[font-size:10px] max-[768px]:[line-height:1]"><i className="ri-temp-hot-line" /><span>{t('温度')}</span></div><div className="info-cell-content [flex:1] [display:flex] [align-items:center] [justify-content:flex-end] [min-width:0] [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] [font-size:12px] max-[768px]:[justify-content:flex-start] max-[768px]:[font-size:11px]"><div className="info-chip-group [display:flex] [flex-wrap:wrap] [justify-content:flex-end] [gap:4px] max-[768px]:[justify-content:flex-start] max-[768px]:[gap:3px]">{temperatures.map((item, index) => <span key={`${item.title}-${index}`} className={`info-chip [display:inline-flex] [align-items:center] [gap:3px] [height:22px] [padding:0_6px] [border-radius:5px] [background:var(--panel-chip-bg)] [border:1px_solid_var(--panel-chip-border)] [font-size:11px] [transition:background_var(--transition-fast),_border-color_var(--transition-fast)] max-[768px]:[height:18px] max-[768px]:[padding:0_4px] max-[768px]:[font-size:10px] max-[768px]:[max-width:100%] max-[768px]:[overflow:hidden] max-[768px]:[text-overflow:ellipsis] max-[768px]:[white-space:nowrap] temperature--${item.type}`} title={item.title}><span className="info-chip-label [color:var(--text-secondary)]"><i className={TEMP_ICONS[item.type]} />{item.label}</span><span className="info-chip-value [color:var(--accent-primary)]">{item.value}</span></span>)}</div></div></div>}
        {orderLink && <div className="info-cell [display:flex] [align-items:center] [gap:8px] [padding:9px_11px] [border-radius:var(--radius-md)] [background:var(--panel-metric-bg)] [border:1px_solid_var(--panel-stat-border)] [transition:background_var(--transition-fast),_border-color_var(--transition-fast),_transform_var(--transition-fast)] max-[768px]:[flex-direction:column] max-[768px]:[align-items:stretch] max-[768px]:[gap:3px] max-[768px]:[padding:6px_8px] info-cell--full [grid-column:1/-1] [flex-direction:column] [align-items:stretch] [gap:6px] max-[768px]:[grid-column:1/-1] info-cell--action [background:transparent] [border-color:transparent] [padding:4px_0_0] max-[768px]:[padding:4px_0_0] max-[768px]:[background:transparent] max-[768px]:[border-color:transparent]"><button type="button" className="buy-btn [display:flex] [align-items:center] [justify-content:center] [width:100%] [height:36px] [padding:0_10px] [gap:5px] [line-height:1] [font-weight:700] [font-size:13px] [color:var(--accent-warning)] [border:1.5px_solid_var(--accent-warning)] [border-radius:var(--radius-md)] [transition:all_150ms_ease] [cursor:pointer]" onClick={openOrder}><span className={info?.PublicNote?.customData?.buyBtnIcon || config.aobobo.buyBtnIcon || 'ri-shopping-bag-3-line'} /><span>{info?.PublicNote?.customData?.buyBtnText || config.aobobo.buyBtnText || t('购买')}</span></button></div>}
      </div>
    </DetailPanel>
  );
}
