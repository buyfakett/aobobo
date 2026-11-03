import { useStore } from '@/store';
import {
  calcTransfer,
  getCPUInfo,
  getPlatformLogoIconClassName,
} from '@/utils/host';
import { duration } from '@/utils/date';
import truncateDecimal from '@/utils/number';
import { getCycleTransferSummaryByServer } from '@/utils/cycle-transfer';
import { getBillAndPlanByServer } from '@/composables/server-bill-and-plan';

function cpuCompany(server) {
  return getCPUInfo(server?.Host?.CPU?.[0] || '').company || '';
}

function cpuModel(server) {
  const info = getCPUInfo(server?.Host?.CPU?.[0] || '');
  return [info.model, info.modelNum].filter(Boolean).join(' ');
}

function formatMemorySize(bytes) {
  const value = Number(bytes) / 1024 ** 3;
  if (!Number.isFinite(value) || value <= 0) return '';
  const step = value > 1 ? 0.5 : 0.25;
  return String(Math.round(value / step) * step);
}

function formatDiskSize(bytes) {
  const value = Number(bytes) / 1024 ** 3;
  if (!Number.isFinite(value) || value <= 0) return '';
  return value >= 1000 ? `${Number((value / 1024).toFixed(1))}T` : `${Math.round(value)}G`;
}

function spec(server) {
  const cores = (server.Host?.CPU?.[0] || '').match(/(\d+)\s*(Virtual|Physical|Physics)\s*Core/i);
  return [
    cores ? `${cores[1]}C` : '',
    formatMemorySize(server.Host?.MemTotal) ? `${formatMemorySize(server.Host.MemTotal)}G` : '',
    formatDiskSize(server.Host?.DiskTotal),
  ].filter(Boolean).join('');
}

function formatTransfer(value) {
  const result = calcTransfer(value || 0);
  return `${result.value}${result.unit}`;
}

function traffic(server, cycleTransferMap, compact) {
  const summary = getCycleTransferSummaryByServer(cycleTransferMap, server);
  if (summary) return `剩余 ${summary.remainingDisplay}`;
  const incoming = server.State?.NetInTransfer || 0;
  const outgoing = server.State?.NetOutTransfer || 0;
  switch (+server?.PublicNote?.planDataMod?.trafficType) {
    case 1: return `单向出 ${formatTransfer(outgoing)}`;
    case 3: return outgoing >= incoming
      ? `最大出 ${formatTransfer(outgoing)}`
      : `最大入 ${formatTransfer(incoming)}`;
    case 2: return `双向 ${formatTransfer(incoming + outgoing)}`;
    default: return compact ? `双向 ${formatTransfer(incoming + outgoing)}` : '不限制';
  }
}

function billingText(server) {
  const { billing } = getBillAndPlanByServer(server);
  if (!billing) return '';
  if (billing.isFree || billing.value === '按量') return billing.value;
  return billing.cycleLabel ? `${billing.value}/${billing.cycleLabel}` : String(billing.value);
}

function remaining(server) {
  return getBillAndPlanByServer(server).remainingTime;
}

function remainingClass(item) {
  if (!item) return '';
  if (item.type === 'expired') return 'remaining-status--danger';
  if (item.type === 'infinity') return 'remaining-status--success';
  if (item.value2 <= 7) return 'remaining-status--danger';
  if (item.value2 <= 30) return 'remaining-status--warning';
  return 'remaining-status--success';
}

function planTags(server) {
  const data = server?.PublicNote?.planDataMod || {};
  const tags = [];
  if (data.networkRoute) tags.push(...String(data.networkRoute).split(','));
  if (data.extra) tags.push(...String(data.extra).split(','));
  if (data.IPv4 === '1' && data.IPv6 === '1') tags.push('双栈IP');
  else if (data.IPv4 === '1') tags.push('仅IPv4');
  else if (data.IPv6 === '1') tags.push('仅IPv6');
  return tags;
}

function availabilityClass(value) {
  if (value >= 99) return 'availability-status--success';
  if (value >= 95) return 'availability-status--warning';
  return 'availability-status--danger';
}

export default function ServerCard({
  server,
  cycleTransferMap = {},
  compact = false,
  onSelect,
  onHover,
}) {
  const showAvailability = useStore((state) => state.showAvailability);
  const serverTime = useStore((state) => state.serverTime);
  const serverSpec = spec(server);
  const company = cpuCompany(server);
  const model = cpuModel(server);
  const trafficText = traffic(server, cycleTransferMap, compact);
  const uptimeEnd = server?.LastActive ? new Date(server.LastActive).getTime() : serverTime;
  const uptime = server?.Host?.BootTime && uptimeEnd
    ? duration(server.Host.BootTime * 1000, uptimeEnd, true)
    : '';
  const bill = billingText(server);
  const remainingItem = remaining(server);
  const tags = planTags(server);
  const availability = Number(server?.availability);
  const hasAvailability = showAvailability && Number.isFinite(availability);
  const tcp = server.State?.TcpConnCount || 0;
  const udp = server.State?.UdpConnCount || 0;
  const speedUp = server.State?.NetOutSpeed ? `${formatTransfer(server.State.NetOutSpeed)}/s` : '';
  const speedDown = server.State?.NetInSpeed ? `${formatTransfer(server.State.NetInSpeed)}/s` : '';

  return (
    <button
      type="button"
      className={`server-list-item${server.online === 1 ? '' : ' offline'}`}
      onClick={() => onSelect?.(server)}
      onMouseEnter={() => onHover?.(server)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(server)}
      onBlur={() => onHover?.(null)}
    >
      <div className="server-list-item__content">
        <div className="server-list-item__head">
          <div className="server-list-item__name-group">
            {!compact && (server.Host?.CountryCode
              ? <span className={`fi fi-${server.Host.CountryCode.toLowerCase()}`} />
              : <span className="flag-placeholder"><i className="ri-global-line" /></span>)}
            <span className="server-list-item__name" title={server.Name}>{server.Name || '-'}</span>
          </div>
          {serverSpec && <span className="server-list-item__head-spec"><i className={getPlatformLogoIconClassName(server?.Host?.Platform)} /><span>{serverSpec}</span></span>}
        </div>

        {compact ? (
          <div className="server-list-item__tags">
            <span className={`meta-tag meta-tag--status ${server.online === 1 ? 'online' : 'offline'}`}>{server.online === 1 ? '在线' : '离线'}</span>
            {company && <span className="meta-tag meta-tag--cpu">{company}</span>}
            {trafficText && <span className="meta-tag">{trafficText}</span>}
            {uptime && <span className="meta-tag">{uptime}</span>}
          </div>
        ) : (
          <>
            {(company || model || trafficText) && (
              <div className="server-list-item__resource">
                {company && <span className="meta-tag meta-tag--cpu">{company}</span>}
                {model && <span className="resource-text resource-text--cpu">{model}</span>}
                {trafficText && <span className="resource-text resource-text--traffic"><i className="ri-arrow-up-down-line" /><span>{trafficText}</span></span>}
              </div>
            )}
            {(hasAvailability || uptime || bill || remainingItem || tags.length > 0) && (
              <div className="server-list-item__tags server-list-item__tags--bill">
                {hasAvailability && <span className={`meta-tag meta-tag--availability ${availabilityClass(availability)}`}><i className="ri-shield-check-line" /><span>可用 {truncateDecimal(availability, 2)}%</span></span>}
                {uptime && <span className="meta-tag meta-tag--uptime"><i className="ri-time-line" /><span>在线 {uptime}</span></span>}
                {bill && <span className="meta-tag meta-tag--billing"><i className="ri-price-tag-3-line" /><span>{bill}</span></span>}
                {remainingItem && <span className={`meta-tag meta-tag--remaining ${remainingClass(remainingItem)}`}><i className="ri-hourglass-line" /><span>{remainingItem.label} {remainingItem.value}</span></span>}
                {tags.map((tag) => <span key={tag} className="meta-tag meta-tag--plan">{tag}</span>)}
              </div>
            )}
            {(tcp || udp || speedUp || speedDown) && (
              <div className="server-list-item__network">
                {(tcp || udp) ? <span className="network-stat network-stat--conn"><i className="ri-link-m" /><span>连接 {tcp}/{udp}</span></span> : <span />}
                {(speedUp || speedDown) && <span className="network-stat network-stat--speed">{speedUp && <span className="speed-up">↑ {speedUp}</span>}<span className="speed-sep">|</span>{speedDown && <span className="speed-down">↓ {speedDown}</span>}</span>}
              </div>
            )}
          </>
        )}
      </div>
    </button>
  );
}

export function ServerTable({ servers, cycleTransferMap, twoColumns, onSelect, onHover }) {
  return (
    <div className={`server-table-wrap${twoColumns ? ' two-columns' : ''}`}>
      {servers.map((server) => (
        <ServerCard key={server.ID} server={server} cycleTransferMap={cycleTransferMap} onSelect={onSelect} onHover={onHover} />
      ))}
    </div>
  );
}
