/**
 * 简易消息订阅类
 */
type Listener = (..._args: any[]) => void;

export default class MessageSubscribe {
  private events: Record<string, Listener[]> = {};

  on(event: string, callback: Listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  once(event: string, callback: Listener) {
    const onceCallback = (...args) => {
      callback(...args);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  off(event: string, callback: Listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((cb) => cb !== callback);
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    this.events[event].forEach((callback) => callback(...args));
  }
}
