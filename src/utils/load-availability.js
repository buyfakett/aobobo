import config from '@/config';
import request from '@/utils/request';

function toAvailabilityMap(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const map = {};

  if (Array.isArray(payload)) {
    payload.forEach((item) => {
      const serverId = item?.server_id ?? item?.id ?? item?.serverId;
      const percent = item?.availability_percent ?? item?.availability;
      const hasServerId = serverId !== undefined && serverId !== null;
      const hasPercent = percent !== undefined && percent !== null;
      if (hasServerId && hasPercent) {
        const num = Number(percent);
        if (Number.isFinite(num)) {
          map[String(serverId)] = num;
        }
      }
    });
  } else {
    Object.entries(payload).forEach(([key, value]) => {
      const num = Number(value);
      if (value !== undefined && value !== null && Number.isFinite(num)) {
        map[key] = num;
      }
    });
  }

  return Object.keys(map).length > 0 ? map : null;
}

/**
 * 加载服务器可用性数据
 * config.aobobo.apiAvailabilityPath
 * 支持两种返回格式：
 *   1. 数组形式：{ result: [{ server_id: 1, availability_percent: 99.9 }] }
 *   2. 对象形式：{ "1": 99.9, "2": 98.5 }
 */
export default async function loadAvailability() {
  try {
    const res = await request({
      url: config.aobobo.apiAvailabilityPath,
      method: 'GET',
    });

    const payload = res?.data?.data ?? res?.data?.result ?? res?.data;
    return toAvailabilityMap(payload);
  } catch {
    // 接口不可用时不影响主流程
    return null;
  }
}
