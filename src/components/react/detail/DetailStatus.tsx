import { calcBinary, calcTransfer, formatDiskSize, truncateDecimal } from '@/utils/host';
import { duration } from '@/utils/date';
import { useStore } from '@/store';
import { DetailPanel } from '@/components/react/Common';

function resourceItems(info) {
  const state = info?.State || {};
  const host = info?.Host || {};
  const percent = (used, total) => (Number(total) > 0 ? Math.min((Number(used || 0) / Number(total)) * 100, 100) : 0);
  const format = (bytes) => {
    const value = calcBinary(bytes || 0);
    if (value.t >= 1) return `${Number(value.t.toFixed(1))}T`;
    if (value.g >= 1) return `${Number(value.g.toFixed(1))}G`;
    return `${Math.ceil(value.m)}M`;
  };
  const cpuText = host.CPU?.[0] || '';
  const cores = cpuText.match(/(\d+)\s*(Virtual|Physical|Physics)\s*Core/i)?.[1];
  return [
    { type: 'cpu', icon: 'ri-cpu-line', label: 'CPU', value: `${Number(state.CPU || 0).toFixed(1)}%`, detail: cores ? `${cores} 核` : '', used: Number(state.CPU || 0), color: '#4e90ff' },
    { type: 'mem', icon: 'ri-server-line', label: '内存', value: format(state.MemUsed), detail: format(host.MemTotal), used: percent(state.MemUsed, host.MemTotal), color: '#27c975' },
    host.SwapTotal > 0 && { type: 'swap', icon: 'ri-hard-drive-2-line', label: '交换', value: format(state.SwapUsed), detail: format(host.SwapTotal), used: percent(state.SwapUsed, host.SwapTotal), color: '#f59e0b' },
    { type: 'disk', icon: 'ri-database-2-line', label: '磁盘', value: formatDiskSize(state.DiskUsed) || '-', detail: formatDiskSize(host.DiskTotal) || '-', used: percent(state.DiskUsed, host.DiskTotal), color: '#22d3ee' },
  ].filter(Boolean);
}

function RealtimeItem({ icon, label, value, unit, className = '' }: {
  icon: string;
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
}) {
  const fullValue = `${value}${unit || ''}`;
  return <div className={`real-time-item ${className}`.trim()}><i className={icon} /><div><span className="real-time-label">{label}</span><strong title={fullValue}>{value}<small>{unit}</small></strong></div></div>;
}

export default function DetailStatus({ info }) {
  const showAvailability = useStore((state) => state.showAvailability);
  const serverTime = useStore((state) => state.serverTime);
  const items = resourceItems(info);
  const incoming = calcTransfer(info?.State?.NetInSpeed || 0);
  const outgoing = calcTransfer(info?.State?.NetOutSpeed || 0);
  const transfer = calcTransfer((info?.State?.NetInTransfer || 0) + (info?.State?.NetOutTransfer || 0));
  const uptimeEnd = info?.LastActive ? new Date(info.LastActive).getTime() : serverTime;
  const uptime = info?.Host?.BootTime && uptimeEnd
    ? duration(info.Host.BootTime * 1000, uptimeEnd, true)
    : '-';
  const availability = Number(info?.availability);
  return (
    <DetailPanel className="server-detail-status [display:flex] [flex-direction:column] [gap:14px] [padding:14px_18px] max-[768px]:[padding:10px_12px] max-[768px]:[gap:10px]">
      <div className="status-section">
        <h3 className="section-title"><i className="ri-dashboard-3-line" />资源使用</h3>
        <div className={`resource-grid resource-count--${items.length}`}>
          {items.map((item) => (
            <div key={item.type} className={`resource-card resource-card--${item.type}`}>
              <div className="resource-icon"><i className={item.icon} /></div>
              <div className="resource-body">
                <div className="resource-main"><div className="resource-value"><span className="resource-main-value">{item.value}</span><span className="resource-label">{item.label}</span></div><div className="resource-capacity"><span className="resource-total">{item.detail}</span></div></div>
                <div className="resource-progress"><div className="resource-progress-bar" style={{ width: `${item.used}%`, backgroundColor: item.color }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="status-section">
        <h3 className="section-title"><i className="ri-speed-line" />实时数据</h3>
        <div className="server-real-time">
          {showAvailability && Number.isFinite(availability) && <RealtimeItem icon="ri-shield-check-line" label="可用性" value={truncateDecimal(availability, 2)} unit="%" />}
          <RealtimeItem icon="ri-time-line" label="在线" value={uptime} />
          <RealtimeItem icon="ri-arrow-up-down-line" label="双向流量" value={transfer.value} unit={transfer.unit} />
          <RealtimeItem icon="ri-download-line" label="入网" value={incoming.value} unit={`${incoming.unit}/s`} />
          <RealtimeItem icon="ri-upload-line" label="出网" value={outgoing.value} unit={`${outgoing.unit}/s`} />
        </div>
      </div>
    </DetailPanel>
  );
}
