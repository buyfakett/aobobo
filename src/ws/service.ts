export const WS_CONNECTION_STATUS = {
  DISCONNECTED: 0,
  CONNECTING: 1,
  CONNECTED: 2,
  CLOSED: -1,
} as const;

type WsStatus = (typeof WS_CONNECTION_STATUS)[keyof typeof WS_CONNECTION_STATUS];
type WsOptions = {
  wsUrl: string;
  debug?: boolean;
  onConnect?: (_event?: Event) => void;
  onClose?: (_event?: CloseEvent) => void;
  onError?: (_error: Event | Error) => void;
  onMessage?: (_data: any, _event?: MessageEvent) => void;
  onMessageError?: (_error: unknown, _event?: MessageEvent) => void;
};
type WsCallbacks = {
  close: (_event?: CloseEvent) => void;
  error: (_error: Event | Error) => void;
  connect: (_event?: Event) => void;
  message: (_data: any, _event?: MessageEvent) => void;
  messageError: (_error: unknown, _event?: MessageEvent) => void;
};

class WSService {
  static instance: WSService | null = null;

  debug = false;

  $wsUrl = '';

  connected: WsStatus = WS_CONNECTION_STATUS.DISCONNECTED;

  ws?: WebSocket;

  $on: WsCallbacks = {
    close: () => {},
    error: () => {},
    connect: () => {},
    message: () => {},
    messageError: () => {},
  };

  evt: (_event: MessageEvent) => void;

  constructor(options: WsOptions) {
    const {
      wsUrl, onConnect, onClose, onError, onMessage, onMessageError,
    } = options || {};
    this.debug = options?.debug || false;

    if (!wsUrl.startsWith('ws')) {
      throw new Error('WebSocket URL must start with ws:// or wss://');
    }
    this.$wsUrl = wsUrl;
    this.$on = {
      close: onClose || (() => {}),
      error: onError || (() => {}),
      connect: onConnect || (() => {}),
      message: onMessage || (() => {}),
      messageError: onMessageError || (() => {}),
    };

    if (WSService.instance) {
      this.$on.error(new Error('WebSocket connection already exists'));
      return;
    }

    WSService.instance = this;
    this.evt = (event) => {
      if (this.debug) console.log('Message from server ', event.data);
      try {
        const data = JSON.parse(event.data);
        this.$on.message(data, event);
      } catch (error) {
        console.error('socket message error', error);
        if (this.debug) console.log('message', event.data);
        this.$on.messageError(error, event);
      }
    };
  }

  get isConnected() {
    return this.connected === WS_CONNECTION_STATUS.CONNECTED;
  }

  active() {
    if (this.connected > WS_CONNECTION_STATUS.DISCONNECTED) {
      console.warn('WebSocket connection already exists or is connecting');
      return;
    }
    this.connected = WS_CONNECTION_STATUS.CONNECTING;
    this.ws = new WebSocket(this.$wsUrl);
    this.ws.addEventListener('open', (event) => {
      if (this.debug) console.log('socket connected', event);
      this.connected = WS_CONNECTION_STATUS.CONNECTED;
      this.$on.connect(event);
    });
    this.ws.addEventListener('close', (event) => {
      if (this.debug) console.log('socket closed', event);
      this.connected = WS_CONNECTION_STATUS.CLOSED;
      WSService.instance = null;
      this.$on.close(event);
    });
    this.ws.addEventListener('message', this.evt);
    this.ws.addEventListener('error', (event) => {
      console.log('socket error', event);
      WSService.instance = null;
      this.$on.error(event);
    });
  }

  send(data: unknown) {
    this?.ws?.send?.(JSON.stringify(data));
  }

  close() {
    this.ws?.close?.();
  }
}

export default WSService;
