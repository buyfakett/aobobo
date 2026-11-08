import type { EChartsType } from 'echarts';
import config from '@/config';

export type GlobeRenderController = {
  isActive: () => boolean;
  setEnabled: (_enabled: boolean) => void;
  setAutoRotate: (_autoRotate: boolean) => void;
  dispose: () => void;
};

/** Bound only this globe's animation loop; other ECharts instances stay independent. */
export function manageGlobeRendering(
  chart: EChartsType,
  element: HTMLElement,
  onActiveChange: (_active: boolean) => void,
  enabled = true,
): GlobeRenderController {
  const zr = chart.getZr();
  const animation = zr.animation;
  const originalUpdate = animation.update;
  const normalizeFps = (value, fallback) => {
    const requestedFps = Number(value);
    return Number.isFinite(requestedFps) && requestedFps > 0
      ? Math.min(60, Math.max(15, requestedFps))
      : fallback;
  };
  const interval = 1000 / normalizeFps(config.aobobo.globeMaxFps, 30);
  const autoRotateInterval = 1000 / normalizeFps(config.aobobo.globeAutoRotateFps, 24);
  let lastFrame = Number.NEGATIVE_INFINITY;
  let inViewport = true;
  let active = false;
  let autoRotate = false;
  let interacting = false;
  let resizeFrame = 0;

  // ZRender has no FPS option. Gate its public update method before both the
  // OrbitControl frame event and the WebGL flush, retaining its elapsed time.
  animation.update = function (synchronous) {
    if (!active) return;
    if (synchronous) {
      originalUpdate.call(animation, synchronous);
      return;
    }
    const now = performance.now();
    const elapsed = now - lastFrame;
    const frameInterval = autoRotate && !interacting ? autoRotateInterval : interval;
    if (elapsed + 0.5 < frameInterval) return;
    lastFrame = Number.isFinite(elapsed)
      ? lastFrame + frameInterval * Math.max(1, Math.floor((elapsed + 0.5) / frameInterval))
      : now;
    originalUpdate.call(animation, synchronous);
  };

  const restoreSleep = () => {
    // echarts-gl disables sleep on every scene update. Auto rotation must stay
    // awake: OrbitControl's delayed restart after dragging does not wake ZRender.
    zr.setSleepAfterStill(autoRotate ? 0 : 10);
  };
  const resize = () => {
    resizeFrame = 0;
    if (!active || !element.clientWidth || !element.clientHeight) return;
    if (chart.getWidth() !== element.clientWidth || chart.getHeight() !== element.clientHeight) {
      chart.resize();
    }
  };
  const syncActivity = () => {
    const next = enabled && inViewport && !document.hidden;
    if (next === active) return;
    active = next;
    if (active) {
      lastFrame = Number.NEGATIVE_INFINITY;
      animation.resume();
      resize();
      zr.wakeUp();
    } else {
      animation.pause();
    }
    onActiveChange(active);
  };
  const wakeUp = () => {
    if (active) zr.wakeUp();
  };
  const beginInteraction = () => {
    interacting = true;
    lastFrame = Number.NEGATIVE_INFINITY;
    wakeUp();
  };
  const endInteraction = () => {
    interacting = false;
    lastFrame = Number.NEGATIVE_INFINITY;
    wakeUp();
  };
  const resizeObserver = new ResizeObserver(() => {
    if (!active || resizeFrame) return;
    resizeFrame = requestAnimationFrame(resize);
  });
  resizeObserver.observe(element);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    inViewport = entry.isIntersecting;
    syncActivity();
  });
  intersectionObserver.observe(element);
  document.addEventListener('visibilitychange', syncActivity);
  element.addEventListener('pointerdown', beginInteraction, { passive: true });
  element.addEventListener('pointerup', endInteraction, { passive: true });
  element.addEventListener('pointercancel', endInteraction, { passive: true });
  element.addEventListener('pointermove', wakeUp, { passive: true });
  element.addEventListener('wheel', wakeUp, { passive: true });
  zr.on('rendered', restoreSleep);
  restoreSleep();
  syncActivity();
  if (!active) animation.pause();

  return {
    isActive: () => active,
    setEnabled(value) {
      enabled = value;
      syncActivity();
    },
    setAutoRotate(value) {
      autoRotate = value;
      lastFrame = Number.NEGATIVE_INFINITY;
      restoreSleep();
    },
    dispose() {
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', syncActivity);
      element.removeEventListener('pointerdown', beginInteraction);
      element.removeEventListener('pointerup', endInteraction);
      element.removeEventListener('pointercancel', endInteraction);
      element.removeEventListener('pointermove', wakeUp);
      element.removeEventListener('wheel', wakeUp);
      zr.off('rendered', restoreSleep);
      animation.update = originalUpdate;
      animation.resume();
    },
  };
}
