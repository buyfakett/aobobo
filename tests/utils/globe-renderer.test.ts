import { afterEach, describe, expect, it, rs } from '@rstest/core';
import type { EChartsType } from 'echarts';
import config from '@/config';
import { manageGlobeRendering } from '@/utils/globe-renderer';

afterEach(() => { rs.restoreAllMocks(); rs.unstubAllGlobals(); config.aobobo.globeMaxFps = 30; });

function createFixture(enabled = true) {
  let intersect: (_entries: any[]) => void;
  let resized: () => void;
  let scheduledResize: FrameRequestCallback;
  const intersectionDisconnect = rs.fn();
  const resizeDisconnect = rs.fn();
  rs.stubGlobal('ResizeObserver', class {
    constructor(callback) { resized = callback; }
    observe() {}
    disconnect = resizeDisconnect;
  });
  rs.stubGlobal('IntersectionObserver', class {
    constructor(callback) { intersect = callback; }
    observe() {}
    disconnect = intersectionDisconnect;
  });
  rs.stubGlobal('requestAnimationFrame', rs.fn((callback) => { scheduledResize = callback; return 42; }));
  rs.stubGlobal('cancelAnimationFrame', rs.fn());
  const hidden = rs.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const originalUpdate = rs.fn();
  const animation = { update: originalUpdate, resume: rs.fn(), pause: rs.fn() };
  const zr = { animation, wakeUp: rs.fn(), setSleepAfterStill: rs.fn(), on: rs.fn(), off: rs.fn() };
  const chart = { getZr: () => zr, getWidth: rs.fn(() => 10), getHeight: rs.fn(() => 10), resize: rs.fn() };
  const element = document.createElement('div');
  Object.defineProperties(element, { clientWidth: { configurable: true, value: 640 }, clientHeight: { configurable: true, value: 320 } });
  const onActiveChange = rs.fn();
  const controller = manageGlobeRendering(chart as unknown as EChartsType, element, onActiveChange, enabled);
  return {
    controller, element, chart, zr, animation, originalUpdate, onActiveChange, hidden,
    intersectionDisconnect, resizeDisconnect,
    intersect: (visible) => intersect([{ isIntersecting: visible }]),
    notifyResize: () => resized(),
    flushResize: () => scheduledResize(0),
  };
}

describe('globe rendering lifecycle', () => {
  it('pauses outside the viewport, on hidden tabs, and when disabled', () => {
    const f = createFixture();
    expect(f.controller.isActive()).toBe(true);
    expect(f.chart.resize).toHaveBeenCalledTimes(1);
    f.intersect(false);
    expect(f.controller.isActive()).toBe(false);
    expect(f.animation.pause).toHaveBeenCalledTimes(1);
    f.intersect(true);
    expect(f.controller.isActive()).toBe(true);
    f.hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(f.controller.isActive()).toBe(false);
    f.hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    f.controller.setEnabled(false);
    expect(f.controller.isActive()).toBe(false);
    f.controller.setEnabled(true);
    expect(f.controller.isActive()).toBe(true);
    expect(f.onActiveChange.mock.calls.map(([active]) => active)).toEqual([true, false, true, false, true, false, true]);
    f.controller.dispose();
  });

  it('throttles animation while allowing synchronous updates and resets on resume', () => {
    const now = rs.spyOn(performance, 'now');
    const f = createFixture();
    now.mockReturnValue(0); f.animation.update(false);
    now.mockReturnValue(10); f.animation.update(false);
    now.mockReturnValue(34); f.animation.update(false);
    expect(f.originalUpdate).toHaveBeenCalledTimes(2);
    f.animation.update(true);
    expect(f.originalUpdate).toHaveBeenCalledTimes(3);
    f.controller.setEnabled(false);
    f.animation.update(true);
    expect(f.originalUpdate).toHaveBeenCalledTimes(3);
    f.controller.setEnabled(true);
    f.animation.update(false);
    expect(f.originalUpdate).toHaveBeenCalledTimes(4);
    f.controller.dispose();
  });

  it.each([[0, 34], ['bad', 34], [120, 17], [1, 67]])('bounds configured frame rate %s', (fps, nextFrame) => {
    config.aobobo.globeMaxFps = fps;
    const now = rs.spyOn(performance, 'now');
    const f = createFixture();
    now.mockReturnValue(0); f.animation.update(false);
    now.mockReturnValue(1); f.animation.update(false);
    now.mockReturnValue(Number(nextFrame)); f.animation.update(false);
    expect(f.originalUpdate).toHaveBeenCalledTimes(2);
    f.controller.dispose();
  });

  it('coalesces resize notifications and wakes only active globes on interaction', () => {
    const f = createFixture();
    f.chart.resize.mockClear();
    f.zr.wakeUp.mockClear();
    f.notifyResize(); f.notifyResize();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    f.flushResize();
    expect(f.chart.resize).toHaveBeenCalledTimes(1);
    f.chart.getWidth.mockReturnValue(640);
    f.chart.getHeight.mockReturnValue(320);
    f.notifyResize(); f.flushResize();
    expect(f.chart.resize).toHaveBeenCalledTimes(1);
    for (const type of ['pointerdown', 'pointermove', 'wheel']) f.element.dispatchEvent(new Event(type));
    expect(f.zr.wakeUp).toHaveBeenCalledTimes(3);
    f.controller.setEnabled(false);
    f.element.dispatchEvent(new Event('pointerdown'));
    f.notifyResize();
    expect(f.zr.wakeUp).toHaveBeenCalledTimes(3);
    f.controller.dispose();
  });

  it('keeps auto rotation awake and restores chart state and all listeners on disposal', () => {
    const f = createFixture(false);
    expect(f.controller.isActive()).toBe(false);
    expect(f.animation.pause).toHaveBeenCalledTimes(1);
    f.controller.setAutoRotate(true);
    expect(f.zr.setSleepAfterStill).toHaveBeenLastCalledWith(0);
    f.controller.setAutoRotate(false);
    expect(f.zr.setSleepAfterStill).toHaveBeenLastCalledWith(10);
    f.controller.dispose();
    expect(f.animation.update).toBe(f.originalUpdate);
    expect(f.animation.resume).toHaveBeenCalledTimes(1);
    expect(f.intersectionDisconnect).toHaveBeenCalledTimes(1);
    expect(f.resizeDisconnect).toHaveBeenCalledTimes(1);
    expect(f.zr.off).toHaveBeenCalledWith('rendered', f.zr.on.mock.calls[0][1]);
    expect(cancelAnimationFrame).toHaveBeenCalled();
    const wakeCount = f.zr.wakeUp.mock.calls.length;
    f.element.dispatchEvent(new Event('pointerdown'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(f.zr.wakeUp).toHaveBeenCalledTimes(wakeCount);
  });
});
