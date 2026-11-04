import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import useAnimatedPresence from '@/hooks/useAnimatedPresence';
import useMediaQuery from '@/hooks/useMediaQuery';

afterEach(() => { rs.restoreAllMocks(); rs.unstubAllGlobals(); rs.useRealTimers(); });

describe('animated presence', () => {
  function frames() {
    let nextId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    rs.stubGlobal('requestAnimationFrame', rs.fn((callback) => { callbacks.set(++nextId, callback); return nextId; }));
    rs.stubGlobal('cancelAnimationFrame', rs.fn((id) => callbacks.delete(id)));
    return {
      pending: callbacks,
      tick: () => act(() => {
        const current = [...callbacks];
        callbacks.clear();
        current.forEach(([, callback]) => callback(0));
      }),
    };
  }

  it('shows after two animation frames and retains content through the exit animation', () => {
    rs.useFakeTimers();
    const clock = frames();
    const { result, rerender, unmount } = renderHook(({ open }) => useAnimatedPresence(open), { initialProps: { open: true } });
    expect(result.current).toEqual({ rendered: true, visible: false });
    clock.tick();
    expect(result.current.visible).toBe(false);
    clock.tick();
    expect(result.current).toEqual({ rendered: true, visible: true });
    rerender({ open: false });
    expect(result.current).toEqual({ rendered: true, visible: false });
    act(() => rs.advanceTimersByTime(279));
    expect(result.current.rendered).toBe(true);
    act(() => rs.advanceTimersByTime(1));
    expect(result.current).toEqual({ rendered: false, visible: false });
    unmount();
  });

  it('cancels a pending exit when reopened and clears frames on unmount', () => {
    rs.useFakeTimers();
    const clock = frames();
    const { result, rerender, unmount } = renderHook(({ open }) => useAnimatedPresence(open, 100), { initialProps: { open: false } });
    expect(result.current.rendered).toBe(false);
    rerender({ open: true });
    clock.tick(); clock.tick();
    rerender({ open: false });
    act(() => rs.advanceTimersByTime(50));
    rerender({ open: true });
    clock.tick(); clock.tick();
    act(() => rs.advanceTimersByTime(100));
    expect(result.current).toEqual({ rendered: true, visible: true });
    rerender({ open: false });
    rerender({ open: true });
    expect(clock.pending.size).toBe(1);
    unmount();
    expect(clock.pending.size).toBe(0);
    expect(rs.getTimerCount()).toBe(0);
  });
});

describe('responsive media query', () => {
  it('tracks media changes and detaches listeners when the query changes or unmounts', () => {
    function media(matches) {
      const listeners = new Set<() => void>();
      return {
        matches,
        addEventListener: rs.fn((_event, listener) => listeners.add(listener)),
        removeEventListener: rs.fn((_event, listener) => listeners.delete(listener)),
        change(value) { this.matches = value; listeners.forEach((listener) => listener()); },
        listeners,
      };
    }
    const narrow = media(false);
    const wide = media(true);
    rs.stubGlobal('matchMedia', rs.fn((query) => query === '(max-width: 600px)' ? narrow : wide));
    const { result, rerender, unmount } = renderHook(({ query }) => useMediaQuery(query), { initialProps: { query: '(max-width: 600px)' } });
    expect(result.current).toBe(false);
    act(() => narrow.change(true));
    expect(result.current).toBe(true);
    rerender({ query: '(min-width: 1000px)' });
    expect(narrow.listeners.size).toBe(0);
    act(() => wide.change(false));
    expect(result.current).toBe(false);
    unmount();
    expect(wide.listeners.size).toBe(0);
  });

  it('supports media implementations without change listeners', () => {
    rs.stubGlobal('matchMedia', rs.fn(() => ({ matches: true })));
    const { result, unmount } = renderHook(() => useMediaQuery('(prefers-reduced-motion)'));
    expect(result.current).toBe(true);
    expect(() => unmount()).not.toThrow();
  });
});
