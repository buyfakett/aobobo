import { t } from '@/i18n';
/**
 * 服务器排序选项与处理逻辑
 * 参考 nazhua-front 实现
 */

import { getCPUInfo } from '@/utils/host';

export const serverSortOptions = () => [
  { label: t('排序值'), value: 'DisplayIndex' },
  { label: t('主机名称'), value: 'Name' },
  { label: t('国家地区'), value: 'Host.CountryCode' },
  { label: t('系统平台'), value: 'Host.Platform' },
  { label: t('在线时长'), value: 'Host.BootTime' },
  { label: t('入网速度'), value: 'State.NetInSpeed' },
  { label: t('出网速度'), value: 'State.NetOutSpeed' },
  { label: t('入网流量'), value: 'State.NetInTransfer' },
  { label: t('出网流量'), value: 'State.NetOutTransfer' },
  { label: t('合计流量'), value: '$.TotalTransfer' },
  { label: t('TCP连接'), value: 'State.TcpConnCount' },
  { label: t('UDP连接'), value: 'State.UdpConnCount' },
  { label: t('总连接数'), value: '$.TotalConnCount' },
  { label: t('1分钟负载'), value: 'State.Load1' },
  { label: t('CPU占用'), value: 'State.CPU' },
  { label: t('核心数量'), value: '$.CPU' },
  { label: t('内存占用'), value: 'State.MemUsed' },
  { label: t('内存大小'), value: 'Host.MemTotal' },
  { label: t('交换占用'), value: 'State.SwapUsed' },
  { label: t('交换大小'), value: 'Host.SwapTotal' },
  { label: t('硬盘占用'), value: 'State.DiskUsed' },
  { label: t('硬盘大小'), value: 'Host.DiskTotal' },
];

const sortCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function isEmptySortValue(value) {
  return value === undefined || value === null || value === '';
}

function getNumberValue(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getServerSortValue(server, sortby, currentTime) {
  if (!sortby) {
    return null;
  }

  const hasDot = sortby.includes('.');
  if (!hasDot) {
    return server?.[sortby];
  }

  const [sortby1, sortby2] = sortby.split('.');
  if (sortby1 !== '$') {
    if (sortby1 === 'Host' && sortby2 === 'BootTime') {
      const bootTime = getNumberValue(server?.Host?.BootTime);
      return bootTime === null ? null : currentTime - (bootTime * 1000);
    }
    return server?.[sortby1]?.[sortby2];
  }

  switch (sortby2) {
    case 'TotalTransfer': {
      const netInTransfer = getNumberValue(server?.State?.NetInTransfer);
      const netOutTransfer = getNumberValue(server?.State?.NetOutTransfer);
      if (netInTransfer === null || netOutTransfer === null) {
        return null;
      }
      return netInTransfer + netOutTransfer;
    }
    case 'TotalConnCount': {
      const tcpConnCount = getNumberValue(server?.State?.TcpConnCount);
      const udpConnCount = getNumberValue(server?.State?.UdpConnCount);
      if (tcpConnCount === null || udpConnCount === null) {
        return null;
      }
      return tcpConnCount + udpConnCount;
    }
    case 'CPU': {
      const cpu = server?.Host?.CPU;
      if (Array.isArray(cpu)) {
        const totalCores = cpu.reduce((sum, item) => {
          const info = getCPUInfo(item);
          const coreCount = parseInt(info.core, 10);
          return sum + (Number.isNaN(coreCount) ? 0 : coreCount);
        }, 0);
        return totalCores || null;
      }
      if (typeof cpu === 'string') {
        const info = getCPUInfo(cpu);
        const coreCount = parseInt(info.core, 10);
        return Number.isNaN(coreCount) ? null : coreCount;
      }
      return getNumberValue(cpu);
    }
    default:
      return null;
  }
}

function compareServerSortValue(aValue, bValue, order) {
  const aValueIsEmpty = isEmptySortValue(aValue);
  const bValueIsEmpty = isEmptySortValue(bValue);
  if (aValueIsEmpty && bValueIsEmpty) {
    return 0;
  }
  if (aValueIsEmpty) {
    return 1;
  }
  if (bValueIsEmpty) {
    return -1;
  }

  const direction = order === 'desc' ? -1 : 1;
  const aNumberValue = getNumberValue(aValue);
  const bNumberValue = getNumberValue(bValue);

  if (aNumberValue !== null && bNumberValue !== null) {
    return (aNumberValue - bNumberValue) * direction;
  }

  return sortCollator.compare(String(aValue), String(bValue)) * direction;
}

/**
 * 在线服务器优先，状态相同时保留原有顺序。
 */
export function compareServerOnlineStatus(a, b) {
  return Number(a?.online !== 1) - Number(b?.online !== 1);
}

/**
 * 服务器排序比较函数
 * @param {Object} a
 * @param {Object} b
 * @param {string} sortby 排序字段
 * @param {'asc'|'desc'} order
 */
export function serverSortHandler(a, b, sortby, order) {
  const currentTime = Date.now();
  const aValue = getServerSortValue(a, sortby, currentTime);
  const bValue = getServerSortValue(b, sortby, currentTime);
  return compareServerSortValue(aValue, bValue, order);
}

/**
 * 默认排序配置
 */
export const defaultServerSortConfig = () => ({
  prop: 'DisplayIndex',
  order: 'desc',
});
