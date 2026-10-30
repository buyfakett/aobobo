import config from '@/config';
import request from '@/utils/request';

function getOnlineHistoryUrl(serverId, days) {
  const template = config.aobobo.v1ApiOnlineHistoryPath
    || '/api/v1/server/{id}/online-history';
  const baseUrl = template.replace('{id}', serverId);
  const query = new URLSearchParams({ days: String(days) }).toString();
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}`;
}

export function isOnlineHistorySupported() {
  return config.aobobo.nezhaVersion === 'v1';
}

export async function loadServerOnlineHistory(serverId, days) {
  const res = await request({
    url: getOnlineHistoryUrl(serverId, days),
    method: 'GET',
  });
  const payload = res?.data?.data ?? res?.data?.result ?? res?.data;
  if (!payload || typeof payload !== 'object') {
    throw new Error('在线历史数据格式无效');
  }
  return payload;
}
