import { useStore } from '@/store';
import {
  calcTransfer,
  formatDiskSize,
  getCPUInfo,
  getPlatformLogoIconClassName,
  truncateDecimal,
} from '@/utils/host';
import { duration } from '@/utils/date';
import { getCycleTransferSummaryByServer } from '@/utils/cycle-transfer';
import { getBillAndPlanByServer } from '@/composables/server-bill-and-plan';
import type { AnyCallback } from '@/types/ui';

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
}: {
  server: any;
  cycleTransferMap?: Record<string, any>;
  compact?: boolean;
  onSelect?: AnyCallback;
  onHover?: AnyCallback;
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
      className={`server-list-item [position:relative] [width:100%] [display:block] [padding:11px_14px] [appearance:none] [border:1px_solid_var(--panel-row-border)] [border-radius:14px] [background:var(--panel-row-bg)] [color:inherit] [font:inherit] [text-align:left] [cursor:pointer] [overflow:visible] [transition:border-color_var(--transition-fast),_background_var(--transition-fast),_box-shadow_var(--transition-fast)] max-[768px]:[padding:9px_11px] max-[768px]:[border-radius:12px]${server.online === 1 ? '' : ' offline'}`}
      onClick={() => onSelect?.(server)}
      onMouseEnter={() => onHover?.(server)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(server)}
      onBlur={() => onHover?.(null)}
    >
      <div className="server-list-item__content [display:grid] [gap:7px] [min-width:0]">
        <div className="server-list-item__head [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] [min-width:0]">
          <div className="server-list-item__name-group [min-width:0] [display:flex] [align-items:center] [gap:8px] [flex:1]">
            {!compact && (server.Host?.CountryCode
              ? <span className={`fi fi-${server.Host.CountryCode.toLowerCase()}`} />
              : <span className="flag-placeholder"><i className="ri-global-line" /></span>)}
            <span className="server-list-item__name [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap] [font-size:14px] [font-weight:700] [color:var(--text-primary)] max-[768px]:[font-size:13px]" title={server.Name}>{server.Name || '-'}</span>
          </div>
          {serverSpec && <span className="server-list-item__head-spec [display:inline-flex] [align-items:center] [gap:5px] [flex:0_0_auto] [font-size:11px] [font-weight:600] [color:var(--text-secondary)] [white-space:nowrap] [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] max-[768px]:[font-size:10px]"><i className={getPlatformLogoIconClassName(server?.Host?.Platform)} /><span>{serverSpec}</span></span>}
        </div>

        {compact ? (
          <div className="server-list-item__tags [display:flex] [flex-wrap:wrap] [gap:5px] [min-width:0] [min-height:22px] max-[768px]:[gap:4px]">
            <span className={`meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--status ${server.online === 1 ? 'online' : 'offline'}`}>{server.online === 1 ? '在线' : '离线'}</span>
            {company && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--cpu">{company}</span>}
            {trafficText && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px]">{trafficText}</span>}
            {uptime && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px]">{uptime}</span>}
          </div>
        ) : (
          <>
            {(company || model || trafficText) && (
              <div className="server-list-item__resource [display:flex] [align-items:center] [flex-wrap:wrap] [gap:8px] [min-width:0]">
                {company && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--cpu">{company}</span>}
                {model && <span className="resource-text resource-text--cpu">{model}</span>}
                {trafficText && <span className="resource-text resource-text--traffic"><i className="ri-arrow-up-down-line" /><span>{trafficText}</span></span>}
              </div>
            )}
            {(hasAvailability || uptime || bill || remainingItem || tags.length > 0) && (
              <div className="server-list-item__tags [display:flex] [flex-wrap:wrap] [gap:5px] [min-width:0] [min-height:22px] max-[768px]:[gap:4px] server-list-item__tags--bill [margin-top:2px]">
                {hasAvailability && <span className={`meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--availability [gap:4px] [padding-left:7px] ${availabilityClass(availability)}`}><i className="ri-shield-check-line" /><span>可用 {truncateDecimal(availability, 2)}%</span></span>}
                {uptime && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--uptime [color:var(--duration-color)] [border-color:rgba(var(--accent-primary-rgb),_0.22)] [background:rgba(var(--accent-primary-rgb),_0.08)]"><i className="ri-time-line" /><span>在线 {uptime}</span></span>}
                {bill && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--billing"><i className="ri-price-tag-3-line" /><span>{bill}</span></span>}
                {remainingItem && <span className={`meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--remaining ${remainingClass(remainingItem)}`}><i className="ri-hourglass-line" /><span>{remainingItem.label} {remainingItem.value}</span></span>}
                {tags.map((tag) => <span key={tag} className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--plan [color:var(--text-secondary)] [border-color:var(--panel-chip-border)] [background:var(--panel-chip-bg)] [font-weight:500]">{tag}</span>)}
              </div>
            )}
            {(tcp || udp || speedUp || speedDown) && (
              <div className="server-list-item__network [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] [margin-top:4px] [padding-top:8px] [border-top:1px_solid_var(--panel-stat-border)] [font-size:12px] [font-weight:600] [line-height:1.2]">
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

export function ServerTable({ servers, cycleTransferMap, onSelect, onHover }: {
  servers: any[];
  cycleTransferMap?: Record<string, any>;
  onSelect?: AnyCallback;
  onHover?: AnyCallback;
}) {
  return (
    <div className="server-table-wrap [flex:1] [min-height:0] [display:grid] [align-content:start] [gap:6px] [overflow-y:auto] [overflow-x:hidden] [padding:10px_12px_14px] [color:var(--text-primary)] [scrollbar-gutter:stable] max-[768px]:[grid-template-columns:minmax(0,_1fr)] max-[768px]:[padding:12px] max-[768px]:[gap:6px] max-[768px]:[padding-bottom:24px]">
      {servers.map((server) => (
        <ServerCard key={server.ID} server={server} cycleTransferMap={cycleTransferMap} onSelect={onSelect} onHover={onHover} />
      ))}
    </div>
  );
}
