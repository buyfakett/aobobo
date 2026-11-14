import { t } from '@/i18n';
import config from '@/config';
import request from '@/utils/request';

type AvailabilityMap = Record<string, number>;

function toAvailabilityMap(payload: unknown): AvailabilityMap | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const map: AvailabilityMap = {};
  if (Array.isArray(payload)) {
    payload.forEach((item: any) => {
      const serverId = item?.server_id ?? item?.id ?? item?.serverId;
      const percent = item?.availability_percent ?? item?.availability;
      if (serverId === undefined || serverId === null || percent === undefined || percent === null) {
        return;
      }
      const value = Number(percent);
      if (Number.isFinite(value)) {
        map[String(serverId)] = value;
      }
    });
  } else {
    Object.entries(payload).forEach(([key, value]) => {
      const number = Number(value);
      if (value !== undefined && value !== null && Number.isFinite(number)) {
        map[key] = number;
      }
    });
  }

  return Object.keys(map).length > 0 ? map : null;
}

function responsePayload(response: any): any {
  return response?.data?.data ?? response?.data?.result ?? response?.data;
}

export async function loadAvailability(): Promise<AvailabilityMap | null> {
  try {
    const response = await request({
      url: config.aobobo.apiAvailabilityPath,
      method: 'GET',
    });
    return toAvailabilityMap(responsePayload(response));
  } catch {
    return null;
  }
}

export async function loadServerGroup(): Promise<any[] | null> {
  try {
    const response = await request({
      url: config.aobobo.v1GroupPath || config.aobobo.v1ApiGroupPath,
      method: 'GET',
    });
    if (response?.status === 200 && response.data?.success) {
      const list = response.data?.data || [];
      return list.map((item: any) => ({
        ...item,
        name: item?.group?.name,
        count: item?.servers?.length,
      }));
    }
  } catch (error) {
    console.error('Failed to load server group:', error);
  }
  return null;
}

export async function loadSetting(): Promise<any | null> {
  try {
    const response = await request({
      url: config.aobobo.v1ApiSettingPath,
      method: 'GET',
    });
    return response?.status === 200 && response.data?.success
      ? response.data?.data || {}
      : null;
  } catch (error) {
    console.error('Failed to load setting:', error);
    return null;
  }
}

export async function loadProfile(check = false): Promise<any | boolean | null> {
  try {
    const response = await request({
      url: config.aobobo.v1ApiProfilePath,
      method: 'GET',
    });
    if (check) {
      return response?.status === 200;
    }
    return response?.status === 200 && response.data?.success
      ? response.data?.data || {}
      : null;
  } catch (error) {
    console.error('Failed to load profile:', error);
    return null;
  }
}

function getOnlineHistoryUrl(serverId: string | number, days: number): string {
  const template = config.aobobo.v1ApiOnlineHistoryPath
    || '/api/v1/server/{id}/online-history';
  const baseUrl = template.replace('{id}', String(serverId));
  const query = new URLSearchParams({ days: String(days) }).toString();
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}`;
}

export function isOnlineHistorySupported(): boolean {
  return true;
}

export async function loadServerOnlineHistory(serverId: string | number, days: number): Promise<any> {
  const response = await request({
    url: getOnlineHistoryUrl(serverId, days),
    method: 'GET',
  });
  const payload = responsePayload(response);
  if (!payload || typeof payload !== 'object') {
    throw new Error(t('在线历史数据格式无效'));
  }
  return payload;
}
