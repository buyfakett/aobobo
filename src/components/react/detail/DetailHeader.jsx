import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import config from '@/config';
import store, { useStore } from '@/store';
import {
  calcBinary,
  calcTransfer,
  formatCPUText,
  getCPUInfo,
  getPlatformLogoIconClassName,
  getSystemOSLabel,
} from '@/utils/host';
import { resolveServerLocation } from '@/utils/world-map';
import truncateDecimal from '@/utils/number';
import { getBillAndPlanByServer } from '@/composables/server-bill-and-plan';
import DetailGlobe from '@/components/react/detail/DetailGlobe';

function capacityLabel(info) {
  const mem = calcBinary(info?.Host?.MemTotal || 0);
  const disk = calcBinary(info?.Host?.DiskTotal || 0);
  const parts = [];
  if (mem.g > 0) parts.push(`${mem.g > 10 ? Math.round(mem.g) : Number(mem.g.toFixed(1))}G RAM`);
  if (disk.g > 0) parts.push(`${disk.t >= 1 ? `${Number(disk.t.toFixed(1))}T` : `${Math.ceil(disk.g)}G`} 磁盘`);
  return parts.join(' · ');
}

function planTags(info) {
  const values = [];
  const { networkRoute, extra, IPv4, IPv6 } = info?.PublicNote?.planDataMod || {};
  if (networkRoute) values.push(...String(networkRoute).split(','));
  if (extra) values.push(...String(extra).split(','));
  if (IPv4 === '1' && IPv6 === '1') values.push('双栈IP');
  else if (IPv4 === '1') values.push('仅IPv4');
  else if (IPv6 === '1') values.push('仅IPv6');
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function billLabel(item) {
  if (!item?.value) return '';
  return item.label ? `${item.label} ${item.value}` : String(item.value);
}

export default function DetailHeader({ info }) {
  const navigate = useNavigate();
  const showAvailability = useStore((state) => state.showAvailability);
  const theme = useStore((state) => state.resolvedTheme);
  const cpuInfo = getCPUInfo(info?.Host?.CPU?.[0] || '');
  const location = resolveServerLocation(info);
  const bill = getBillAndPlanByServer(info);
  const availability = Number(info?.availability);
  const hasAvailability = showAvailability && Number.isFinite(availability);
  const load = [info?.State?.Load1, info?.State?.Load5, info?.State?.Load15]
    .filter((value) => value !== undefined).map((value) => Number(value).toFixed(2)).join(' / ');
  const incoming = calcTransfer(Number(info?.State?.NetInTransfer) || 0);
  const outgoing = calcTransfer(Number(info?.State?.NetOutTransfer) || 0);
  const hasTransfer = Number(info?.State?.NetInTransfer) || Number(info?.State?.NetOutTransfer);
  const tags = [
    location && { icon: 'ri-map-pin-line', text: location.name || location.code, className: 'meta-tag--region' },
    info?.Host?.Platform && { icon: getPlatformLogoIconClassName(info.Host.Platform), text: getSystemOSLabel(info.Host.Platform), className: 'meta-tag--os' },
    info?.Host?.CPU?.[0] && { icon: 'ri-cpu-line', text: formatCPUText(info.Host.CPU[0]), className: 'meta-tag--cpu' },
    capacityLabel(info) && { icon: 'ri-ram-line', text: capacityLabel(info), className: 'meta-tag--storage' },
    info?.Host?.PlatformVersion && { icon: 'ri-information-line', text: info.Host.PlatformVersion, className: 'meta-tag--version' },
    billLabel(bill.billing) && { icon: 'ri-wallet-3-line', text: billLabel(bill.billing), className: 'meta-tag--billing' },
    billLabel(bill.remainingTime) && { icon: 'ri-calendar-check-line', text: billLabel(bill.remainingTime), className: 'meta-tag--remaining' },
    billLabel(bill.bandwidth) && { icon: 'ri-speed-up-line', text: billLabel(bill.bandwidth), className: 'meta-tag--bandwidth' },
    billLabel(bill.traffic) && { icon: 'ri-bar-chart-box-line', text: billLabel(bill.traffic), className: 'meta-tag--traffic' },
    load && { icon: 'ri-pulse-line', text: `负载 ${load}`, className: 'meta-tag--load' },
    hasTransfer && { icon: 'ri-arrow-up-down-line', text: `入 ${incoming.value}${incoming.unit} · 出 ${outgoing.value}${outgoing.unit}`, className: 'meta-tag--transfer' },
    info?.Host?.BootTime && { icon: 'ri-restart-line', text: dayjs(info.Host.BootTime * 1000).format('MM-DD HH:mm'), className: 'meta-tag--boot' },
    info?.LastActive && { icon: 'ri-time-line', text: dayjs(info.LastActive).format('MM-DD HH:mm'), className: 'meta-tag--active' },
    ...planTags(info).map((text) => ({ icon: 'ri-price-tag-3-line', text, className: 'meta-tag--tag' })),
  ].filter(Boolean);

  function viewOnGlobe() {
    if (!location?.code) return;
    store.dispatch('focusGlobeOnServer', { code: location.code, name: info?.Name || '' });
    navigate('/');
  }

  const availabilityClass = availability >= 99
    ? 'availability-status--success'
    : availability >= 95 ? 'availability-status--warning' : 'availability-status--danger';

  return (
    <div className="server-detail-header">
      <div className="server-identity">
        <div className="server-flag-box">
          {info?.Host?.CountryCode
            ? <span className={`server-flag fi fi-${info.Host.CountryCode.toLowerCase()}`} />
            : <i className="ri-global-line" />}
        </div>
        <div className="server-name-and-meta">
          <div className="server-name-row">
            <h2 className="server-name">{info.Name}</h2>
            <span className="server-status-badge"><span className={`status-dot ${info.online === 1 ? 'online' : 'offline'}`} /><span>{info.online === 1 ? '在线' : '离线'}</span></span>
            {hasAvailability && <span className={`server-status-badge server-status-badge--availability ${availabilityClass}`}><i className="ri-shield-check-line" /><span>可用 {truncateDecimal(availability, 2)}%</span></span>}
          </div>
          {info?.PublicNote?.customData?.slogan ? (
            <div className="slogan-content"><span>“{info.PublicNote.customData.slogan}”</span></div>
          ) : cpuInfo.model && (
            <div className="cpu-model-info">
              {cpuInfo.company && <span className={`cpu-company cpu-company--${cpuInfo.company.toLowerCase()}`}>{formatCPUText(cpuInfo.company)}</span>}
              <span className="cpu-model">{cpuInfo.model}</span><span className="cpu-model-num">{cpuInfo.modelNum}</span>
            </div>
          )}
          {tags.length > 0 && <div className="meta-tag-row">{tags.map((tag, index) => <span key={`${tag.text}-${index}`} className={`meta-tag ${tag.className}`} title={tag.text}><i className={tag.icon} />{tag.text}</span>)}</div>}
        </div>
      </div>
      {location?.code && (
        <button type="button" className={`globe-focus-btn ${config.aobobo.hideDetailServerGlobe ? 'globe-focus-btn--text' : 'globe-focus-btn--visual react-detail-globe'}`} aria-label={`在地球上查看 ${info?.Name || '服务器'}`} onClick={viewOnGlobe}>
          {config.aobobo.hideDetailServerGlobe ? <><span className="react-detail-globe__orb"><i className="ri-earth-line" /></span><span>在地球上查看</span></> : <DetailGlobe location={location} theme={theme} />}
        </button>
      )}
    </div>
  );
}
