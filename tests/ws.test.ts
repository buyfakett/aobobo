import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core';
import config from '../src/config';
import activate, { msg, restart } from '../src/ws';
import WSService, { WS_CONNECTION_STATUS } from '../src/ws/service';
import normalizeV1Server from '../src/utils/normalize-v1-server';

rstest.mock('../src/utils/normalize-v1-server', () => ({
  default: rstest.fn((server) => ({ ID: server.id, Name: server.name })),
}));

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  url: string;
  send = rstest.fn();
  close = rstest.fn(() => this.dispatchEvent(new CloseEvent('close')));
  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  open() { this.dispatchEvent(new Event('open')); }
  receive(data: string) { this.dispatchEvent(new MessageEvent('message', { data })); }
  fail() { this.dispatchEvent(new Event('error')); }
}

beforeEach(() => {
  WSService.instance = null;
  FakeWebSocket.instances = [];
  rstest.stubGlobal('WebSocket', FakeWebSocket);
  rstest.spyOn(console, 'log').mockImplementation(() => {});
  rstest.spyOn(console, 'warn').mockImplementation(() => {});
  rstest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  FakeWebSocket.instances.forEach((socket) => socket.close());
  WSService.instance = null;
});

describe('WebSocket service', () => {
  it('validates URLs and rejects a duplicate singleton through its error callback', () => {
    expect(() => new WSService({ wsUrl: 'https://example.test' })).toThrow('WebSocket URL must start with ws:// or wss://');
    const service = new WSService({ wsUrl: 'wss://example.test/socket' });
    const error = rstest.fn();
    new WSService({ wsUrl: 'ws://example.test/socket', onError: error });
    expect(WSService.instance).toBe(service);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'WebSocket connection already exists' }));
  });

  it('tracks connection lifecycle, prevents duplicate connections, and can reconnect after closing', () => {
    const onConnect = rstest.fn();
    const onClose = rstest.fn();
    const service = new WSService({ wsUrl: 'wss://example.test/socket', onConnect, onClose, debug: true });
    expect(service.connected).toBe(WS_CONNECTION_STATUS.DISCONNECTED);
    expect(service.isConnected).toBe(false);
    service.send({ ignored: true });
    service.close();
    service.active();
    expect(service.connected).toBe(WS_CONNECTION_STATUS.CONNECTING);
    expect(FakeWebSocket.instances[0].url).toBe('wss://example.test/socket');
    service.active();
    expect(FakeWebSocket.instances).toHaveLength(1);
    const socket = FakeWebSocket.instances[0];
    socket.open();
    expect(service.isConnected).toBe(true);
    expect(onConnect).toHaveBeenCalledWith(expect.any(Event));
    service.active();
    expect(FakeWebSocket.instances).toHaveLength(1);
    service.send({ command: 'ping' });
    expect(socket.send).toHaveBeenCalledWith('{"command":"ping"}');
    service.close();
    expect(service.connected).toBe(WS_CONNECTION_STATUS.CLOSED);
    expect(service.isConnected).toBe(false);
    expect(WSService.instance).toBeNull();
    expect(onClose).toHaveBeenCalledWith(expect.any(CloseEvent));
    service.active();
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(service.connected).toBe(WS_CONNECTION_STATUS.CONNECTING);
  });

  it('parses messages and reports malformed JSON while leaving later messages usable', () => {
    const onMessage = rstest.fn();
    const onMessageError = rstest.fn();
    const service = new WSService({ wsUrl: 'ws://example.test/socket', onMessage, onMessageError, debug: true });
    service.active();
    const socket = FakeWebSocket.instances[0];
    socket.receive('{"now":123}');
    expect(onMessage).toHaveBeenCalledWith({ now: 123 }, expect.any(MessageEvent));
    socket.receive('invalid json');
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessageError).toHaveBeenCalledWith(expect.any(SyntaxError), expect.any(MessageEvent));
    socket.receive('[1,2]');
    expect(onMessage).toHaveBeenLastCalledWith([1, 2], expect.any(MessageEvent));
  });

  it('forwards connection errors and releases the singleton', () => {
    const onError = rstest.fn();
    const service = new WSService({ wsUrl: 'ws://example.test/socket', onError });
    service.active();
    FakeWebSocket.instances[0].fail();
    expect(onError).toHaveBeenCalledWith(expect.any(Event));
    expect(WSService.instance).toBeNull();
  });

  it('provides safe default callbacks for all events', () => {
    const service = new WSService({ wsUrl: 'ws://example.test/socket' });
    new WSService({ wsUrl: 'ws://example.test/duplicate' });
    service.active();
    const socket = FakeWebSocket.instances[0];
    expect(() => {
      socket.open();
      socket.receive('{}');
      socket.receive('invalid json');
      socket.fail();
      socket.close();
    }).not.toThrow();
  });
});

describe('WebSocket message adapter', () => {
  const originalPath = config.aobobo.v1WsPath;
  const subscriptions: { event: string; listener: (..._args: any[]) => void }[] = [];
  let testId = 0;
  function listen(event: string) {
    const listener = rstest.fn();
    msg.on(event, listener);
    subscriptions.push({ event, listener });
    return listener;
  }
  beforeEach(() => {
    testId += 1;
    config.aobobo.v1WsPath = `https://dashboard.example/api/v1/ws/server?test=${testId}`;
  });
  afterEach(() => {
    subscriptions.splice(0).forEach(({ event, listener }) => msg.off(event, listener));
    config.aobobo.v1WsPath = originalPath;
  });

  it('shares an in-flight connection and runs all activation callbacks once connected', () => {
    const first = rstest.fn();
    const second = rstest.fn();
    const connected = listen('connect');
    activate(first);
    activate(second);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toBe(`wss://dashboard.example/api/v1/ws/server?test=${testId}`);
    expect(first).not.toHaveBeenCalled();
    FakeWebSocket.instances[0].open();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(connected).toHaveBeenCalledTimes(1);
    const third = rstest.fn();
    activate(third);
    activate();
    expect(third).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('normalizes server snapshots and forwards other messages and transport events', () => {
    activate();
    const servers = listen('servers');
    const messages = listen('message');
    const errors = listen('error');
    const closed = listen('close');
    const socket = FakeWebSocket.instances[0];
    socket.receive(JSON.stringify({ now: 123, servers: [{ id: 7, name: 'Tokyo' }] }));
    expect(normalizeV1Server).toHaveBeenCalledWith({ id: 7, name: 'Tokyo' });
    expect(servers).toHaveBeenCalledWith({ now: 123, servers: [{ ID: 7, Name: 'Tokyo' }] });
    socket.receive('{"now":124}');
    expect(servers).toHaveBeenLastCalledWith({ now: 124, servers: [] });
    socket.receive('{"kind":"notice"}');
    expect(messages).toHaveBeenCalledWith({ kind: 'notice' });
    socket.fail();
    expect(errors).toHaveBeenCalledWith(expect.any(Event));
    socket.close();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('restarts an existing connection and rebuilds it when the configured URL changes', () => {
    restart();
    const first = FakeWebSocket.instances[0];
    expect(first.close).not.toHaveBeenCalled();
    first.open();
    restart();
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
    const second = FakeWebSocket.instances[1];
    config.aobobo.v1WsPath = 'http://other.example/new-socket';
    activate();
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(3);
    expect(FakeWebSocket.instances[2].url).toBe('ws://other.example/new-socket');
  });
});
