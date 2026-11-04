import config from '@/config';
import MessageSubscribe from '@/utils/subscribe';
import normalizeV1Server from '@/utils/normalize-v1-server';
import WSService, { WS_CONNECTION_STATUS } from './service';

function getWsApiPath() {
  const url = config?.aobobo?.v1WsPath;
  const a = document.createElement('a');
  a.href = url;
  return a.href.replace(/^http/, 'ws');
}

const msg = new MessageSubscribe();
let wsService: WSService | undefined;

function createWsService() {
  return new WSService({
    wsUrl: getWsApiPath(),
    onConnect: () => msg.emit('connect'),
    onClose: () => msg.emit('close'),
    onError: (error) => msg.emit('error', error),
    onMessage: (data) => {
      if (data?.now) {
        msg.emit('servers', {
          now: data.now,
          servers: data?.servers?.map?.((server) => normalizeV1Server(server)) || [],
        });
      } else {
        msg.emit('message', data);
      }
    },
  });
}

function ensureWsService() {
  const url = getWsApiPath();
  if (!wsService || wsService.$wsUrl !== url) {
    if (wsService) {
      wsService.close();
      WSService.instance = null;
    }
    wsService = createWsService();
  }
  return wsService;
}

export function restart() {
  const service = ensureWsService();
  if (service.connected !== WS_CONNECTION_STATUS.DISCONNECTED) {
    service.close();
  }
  service.active();
}

export { msg };

export default (actived?: () => void) => {
  const service = ensureWsService();
  if (service.connected === WS_CONNECTION_STATUS.CONNECTED) {
    if (actived) actived();
    return;
  }
  msg.once('connect', () => {
    if (actived) actived();
  });
  if (service.connected === WS_CONNECTION_STATUS.CONNECTING) return;
  service.active();
};
