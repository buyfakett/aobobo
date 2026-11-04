import { describe, expect, it, rstest } from '@rstest/core';
import MessageSubscribe from '../src/utils/subscribe';

describe('message subscriptions', () => {
  it('delivers arguments to each listener in registration order', () => {
    const bus = new MessageSubscribe();
    const received = [];
    bus.on('message', (...args) => received.push(['first', ...args]));
    bus.on('message', (...args) => received.push(['second', ...args]));
    bus.emit('message', 1, { value: 2 });
    expect(received).toEqual([['first', 1, { value: 2 }], ['second', 1, { value: 2 }]]);
  });
  it('keeps event names independent and ignores unhandled events', () => {
    const bus = new MessageSubscribe();
    const callback = rstest.fn();
    bus.on('a', callback);
    bus.emit('b');
    bus.off('missing', callback);
    expect(callback).not.toHaveBeenCalled();
  });
  it('removes a listener without removing others', () => {
    const bus = new MessageSubscribe();
    const first = rstest.fn();
    const second = rstest.fn();
    bus.on('a', first);
    bus.on('a', second);
    bus.off('a', first);
    bus.emit('a');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
  it('fires a once listener only on the first emission', () => {
    const bus = new MessageSubscribe();
    const once = rstest.fn();
    const regular = rstest.fn();
    bus.once('a', once);
    bus.on('a', regular);
    bus.emit('a', 1, 'payload');
    bus.emit('a', 2);
    expect(once).toHaveBeenCalledExactlyOnceWith(1, 'payload');
    expect(regular).toHaveBeenCalledTimes(2);
  });
});
