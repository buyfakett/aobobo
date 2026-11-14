import { useTranslation } from 'react-i18next';
import { t } from '@/i18n';
import { useStore } from '@/store';
import {
  calcTransfer,
  formatDiskSize,
  getCPUInfo,
  getPlatformLogoIconClassName,
  truncateDecimal,
} from '@/utils/host';
import { duration, normalizeTimestamp } from '@/utils/date';
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

function usagePercent(used, total) {
  if (used == null || used === '' || total == null || total === '') return null;
  const value = Number(used);
  const capacity = Number(total);
  if (!Number.isFinite(value) || !Number.isFinite(capacity) || capacity <= 0) return null;
  return Math.max(0, Math.min((value / capacity) * 100, 100));
}

function resourceUsage(server) {
  const state = server.online === 1 ? server.State || {} : {};
  const host = server.Host || {};
  return [
    { key: 'cpu', label: 'CPU', used: state.CPU, total: 100, color: 'var(--accent-primary)' },
    { key: 'mem', label: t('内存'), used: state.MemUsed, total: host.MemTotal, color: 'var(--accent-success)' },
    { key: 'disk', label: t('硬盘'), used: state.DiskUsed, total: host.DiskTotal, color: '#22d3ee' },
  ].map((item) => {
    const percent = usagePercent(item.used, item.total);
    const value = percent === null ? '—' : `${percent.toFixed(1)}%`;
    const capacity = percent !== null && item.key !== 'cpu'
      ? `${formatTransfer(Math.max(0, Number(item.used)))} / ${formatTransfer(item.total)}`
      : '';
    return { ...item, percent, value, capacity };
  });
}

function traffic(server, cycleTransferMap, compact) {
  const summary = getCycleTransferSummaryByServer(cycleTransferMap, server);
  const incoming = server.State?.NetInTransfer || 0;
  const outgoing = server.State?.NetOutTransfer || 0;
  const trafficType = +server?.PublicNote?.planDataMod?.trafficType;
  if (summary) {
    return {
      type: t(trafficType === 1 ? '单向出' : trafficType === 3 ? '单向取最大' : '双向'),
      value: t('剩余 {{value}}', { value: summary.remainingDisplay }),
    };
  }
  switch (trafficType) {
    case 1: return { type: t('单向出'), value: formatTransfer(outgoing) };
    case 3: return {
      type: t('单向取最大'),
      value: outgoing >= incoming
        ? t('出 {{value}}', { value: formatTransfer(outgoing) })
        : t('入 {{value}}', { value: formatTransfer(incoming) }),
    };
    case 2: return { type: t('双向'), value: formatTransfer(incoming + outgoing) };
    default: return compact
      ? { type: t('双向'), value: formatTransfer(incoming + outgoing) }
      : { type: t('不限制'), value: '' };
  }
}

function billingText(server) {
  const { billing } = getBillAndPlanByServer(server);
  if (!billing) return '';
  if (billing.isFree || billing.value === t('按量')) return billing.value;
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
  if (data.IPv4 === '1' && data.IPv6 === '1') tags.push(t('双栈IP'));
  else if (data.IPv4 === '1') tags.push(t('仅IPv4'));
  else if (data.IPv6 === '1') tags.push(t('仅IPv6'));
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
  const { t } = useTranslation();
  const showAvailability = useStore((state) => state.showAvailability);
  const serverTime = useStore((state) => state.serverTime);
  const serverSpec = spec(server);
  const company = cpuCompany(server);
  const model = cpuModel(server);
  const cpuText = [company, model].filter(Boolean).join(' ');
  const trafficInfo = traffic(server, cycleTransferMap, compact);
  const uptimeEnd = normalizeTimestamp(server?.LastActive, serverTime);
  const uptime = server?.online === 1 && server?.Host?.BootTime && uptimeEnd
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
  const resources = resourceUsage(server);

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
            {!compact && server.online !== 1 && <span className="meta-tag [display:inline-flex] [align-items:center] [flex:0_0_auto] [min-height:19px] [padding:0_7px] [border-radius:5px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:10px] [font-weight:700] [line-height:1] [font-family:var(--font-sans)] [white-space:nowrap] meta-tag--status offline">{t('离线')}</span>}
          </div>
          {serverSpec && <span className="server-list-item__head-spec [display:inline-flex] [align-items:center] [gap:5px] [flex:0_0_auto] [font-size:11px] [font-weight:600] [color:var(--text-secondary)] [white-space:nowrap] [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] max-[768px]:[font-size:10px]"><i className={getPlatformLogoIconClassName(server?.Host?.Platform)} /><span>{serverSpec}</span></span>}
        </div>

        <div className="server-list-item__usage [display:grid] [grid-template-columns:repeat(3,_minmax(0,_1fr))] [gap:12px] [padding:3px_0] max-[768px]:[gap:8px]">
          {resources.map((item) => (
            <div key={item.key} className="[min-width:0]" title={t('{{resource}}占用 {{value}}{{capacity}}', { resource: item.label, value: item.value, capacity: item.capacity ? ` (${item.capacity})` : '' })}>
              <div className="[display:flex] [align-items:center] [justify-content:space-between] [gap:4px] [font-size:11px] [line-height:1.4] [white-space:nowrap]">
                <span className="[color:var(--text-secondary)]">{item.label}</span>
                <span className="[font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] [font-weight:600]">{item.value}</span>
              </div>
              <div
                role="meter"
                aria-label={t('{{resource}}占用', { resource: item.label })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={item.percent ?? 0}
                aria-valuetext={item.percent === null ? t('暂无数据') : `${item.value}${item.capacity ? `, ${item.capacity}` : ''}`}
                className="[height:4px] [margin-top:5px] [overflow:hidden] [border-radius:999px] [background:var(--progress-track)]"
              >
                <div className="[height:100%] [border-radius:inherit]" style={{ width: `${item.percent ?? 0}%`, backgroundColor: item.color }} />
              </div>
              {!compact && item.capacity && <div className="[margin-top:4px] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap] [font-size:10px] [line-height:1.4] [color:var(--text-muted)] [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums]">{item.capacity}</div>}
            </div>
          ))}
        </div>

        {compact ? (
          <div className="server-list-item__tags [display:flex] [flex-wrap:wrap] [gap:5px] [min-width:0] [min-height:22px] max-[768px]:[gap:4px]">
            <span className={`meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--status ${server.online === 1 ? 'online' : 'offline'}`}>{t(server.online === 1 ? '在线' : '离线')}</span>
            {cpuText && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--cpu" title={cpuText}>{cpuText}</span>}
            {trafficInfo.type && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--traffic-type">{trafficInfo.type}</span>}
            {trafficInfo.value && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--traffic">{trafficInfo.value}</span>}
            {uptime && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--uptime">{uptime}</span>}
          </div>
        ) : (
          <>
            {(cpuText || trafficInfo.type || trafficInfo.value) && (
              <div className="server-list-item__resource [display:flex] [align-items:center] [flex-wrap:wrap] [gap:8px] [min-width:0]">
                {cpuText && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--cpu" title={cpuText}>{cpuText}</span>}
                {trafficInfo.type && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--traffic-type">{trafficInfo.type}</span>}
                {trafficInfo.value && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--traffic">{trafficInfo.value}</span>}
              </div>
            )}
            {(hasAvailability || uptime || bill || remainingItem || tags.length > 0) && (
              <div className="server-list-item__tags [display:flex] [flex-wrap:wrap] [gap:5px] [min-width:0] [min-height:22px] max-[768px]:[gap:4px] server-list-item__tags--bill [margin-top:2px]">
                {hasAvailability && <span className={`meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--availability [gap:4px] [padding-left:7px] ${availabilityClass(availability)}`}><i className="ri-shield-check-line" /><span>{t('可用 {{value}}%', { value: truncateDecimal(availability, 2) })}</span></span>}
                {uptime && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--uptime [color:var(--duration-color)] [border-color:rgba(var(--accent-primary-rgb),_0.22)] [background:rgba(var(--accent-primary-rgb),_0.08)]"><i className="ri-time-line" /><span>{t('在线 {{duration}}', { duration: uptime })}</span></span>}
                {bill && <span className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--billing"><i className="ri-price-tag-3-line" /><span>{bill}</span></span>}
                {remainingItem && <span className={`meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--remaining ${remainingClass(remainingItem)}`}><i className="ri-hourglass-line" /><span>{remainingItem.label} {remainingItem.value}</span></span>}
                {tags.map((tag) => <span key={tag} className="meta-tag [display:inline-flex] [align-items:center] [min-height:22px] [padding:0_9px] [border-radius:6px] [border:1px_solid_var(--list-tag-border)] [background:var(--list-tag-bg)] [color:var(--list-tag-text)] [font-size:11px] [font-weight:600] [line-height:1.2] [font-family:var(--font-sans)] [white-space:nowrap] [max-width:100%] [overflow:hidden] [text-overflow:ellipsis] max-[768px]:[min-height:19px] max-[768px]:[padding:0_6px] max-[768px]:[font-size:10px] max-[768px]:[border-radius:5px] meta-tag--plan [color:var(--text-secondary)] [border-color:var(--panel-chip-border)] [background:var(--panel-chip-bg)] [font-weight:500]">{tag}</span>)}
              </div>
            )}
            {(tcp || udp || speedUp || speedDown) && (
              <div className="server-list-item__network [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] [margin-top:4px] [padding-top:8px] [border-top:1px_solid_var(--panel-stat-border)] [font-size:12px] [font-weight:600] [line-height:1.2]">
                {(tcp || udp) ? <span className="network-stat network-stat--conn"><i className="ri-link-m" /><span>{t('连接 {{tcp}}/{{udp}}', { tcp, udp })}</span></span> : <span />}
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
