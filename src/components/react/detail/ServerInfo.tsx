import config from '@/config';
import { DetailPanel } from '@/components/react/Common';

function temperatureItems(info) {
  return (info?.State?.Temperatures || []).map((item) => {
    const name = String(item.Name || '传感器');
    const lower = name.toLowerCase();
    let type = 'other';
    let label = name;
    if (lower.includes('cpu') || lower.includes('coretemp') || lower.includes('k10temp')) { type = 'cpu'; label = 'CPU'; }
    else if (lower.includes('gpu')) { type = 'gpu'; label = 'GPU'; }
    else if (lower.includes('nvme')) { type = 'nvme'; label = 'NVME'; }
    else if (lower.includes('acpitz') || lower.includes('board')) { type = 'motherboard'; label = '主板'; }
    return { type, label, value: `${Number(item.Temperature || 0).toFixed(1)}℃`, title: `${name}: ${Number(item.Temperature || 0).toFixed(1)}℃` };
  });
}

const TEMP_ICONS = {
  cpu: 'ri-cpu-line', gpu: 'ri-gamepad-line', nvme: 'ri-hard-drive-3-line', motherboard: 'ri-instance-line', other: 'ri-temp-hot-line',
};

export default function ServerInfo({ info }) {
  const temperatures = temperatureItems(info);
  const orderLink = info?.PublicNote?.customData?.orderLink;
  if (!temperatures.length && !orderLink) return null;
  const openOrder = () => window.open(decodeURIComponent(orderLink), '_blank', 'noopener,noreferrer');
  return (
    <DetailPanel className="server-detail-info">
      <div className="info-grid">
        {temperatures.length > 0 && <div className="info-cell info-cell--full"><div className="info-cell-label"><i className="ri-temp-hot-line" /><span>温度</span></div><div className="info-cell-content"><div className="info-chip-group">{temperatures.map((item, index) => <span key={`${item.title}-${index}`} className={`info-chip temperature--${item.type}`} title={item.title}><span className="info-chip-label"><i className={TEMP_ICONS[item.type]} />{item.label}</span><span className="info-chip-value">{item.value}</span></span>)}</div></div></div>}
        {orderLink && <div className="info-cell info-cell--full info-cell--action"><button type="button" className="buy-btn" onClick={openOrder}><span className={info?.PublicNote?.customData?.buyBtnIcon || config.aobobo.buyBtnIcon || 'ri-shopping-bag-3-line'} /><span>{info?.PublicNote?.customData?.buyBtnText || config.aobobo.buyBtnText || '购买'}</span></button></div>}
      </div>
    </DetailPanel>
  );
}
