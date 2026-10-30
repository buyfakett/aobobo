// Persists homepage globe rotation and connection-display preferences.

export const GLOBE_ROTATION_STORAGE_KEY = 'aobobo_globe_rotation';
export const GLOBE_ROTATION_STORAGE_VERSION = 3;

export const DEFAULT_AUTO_ROTATE = false;
export const DEFAULT_ROTATE_SPEED = 0.5;
export const MIN_ROTATE_SPEED = 0.2;
export const MAX_ROTATE_SPEED = 2;
export const ROTATE_SPEED_STEP = 0.1;

function clampSpeed(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_ROTATE_SPEED;
  }
  const clamped = Math.min(MAX_ROTATE_SPEED, Math.max(MIN_ROTATE_SPEED, numeric));
  return Math.round(clamped / ROTATE_SPEED_STEP) * ROTATE_SPEED_STEP;
}

function getDefaults() {
  return {
    autoRotate: DEFAULT_AUTO_ROTATE,
    rotateSpeed: DEFAULT_ROTATE_SPEED,
    showServerConnections: true,
  };
}

/**
 * @returns {{ autoRotate: boolean, rotateSpeed: number, showServerConnections: boolean }}
 */
export function loadGlobeRotation() {
  if (typeof window === 'undefined') {
    return getDefaults();
  }

  try {
    const raw = window.localStorage.getItem(GLOBE_ROTATION_STORAGE_KEY);
    if (!raw) {
      return getDefaults();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || ![1, 2, GLOBE_ROTATION_STORAGE_VERSION].includes(parsed.v)) {
      return getDefaults();
    }
    return {
      // Versions 1 and 2 inherited the old always-on default. Migrate them to
      // the low-power default once; users can explicitly turn rotation back on.
      autoRotate: parsed.v === GLOBE_ROTATION_STORAGE_VERSION
        ? parsed.autoRotate === true
        : DEFAULT_AUTO_ROTATE,
      rotateSpeed: clampSpeed(parsed.rotateSpeed),
      showServerConnections: parsed.v === 1
        ? parsed.showNetRays !== false
        : parsed.showServerConnections !== false,
    };
  } catch {
    return getDefaults();
  }
}

/**
 * @param {{ autoRotate?: boolean, rotateSpeed?: number, showServerConnections?: boolean }} prefs
 */
export function persistGlobeRotation(prefs) {
  if (typeof window === 'undefined' || !prefs) {
    return;
  }

  try {
    window.localStorage.setItem(
      GLOBE_ROTATION_STORAGE_KEY,
      JSON.stringify({
        v: GLOBE_ROTATION_STORAGE_VERSION,
        autoRotate: prefs.autoRotate === true,
        rotateSpeed: clampSpeed(prefs.rotateSpeed),
        showServerConnections: prefs.showServerConnections !== false,
      }),
    );
  } catch {
    // ignore storage write failures
  }
}

export function clampRotateSpeed(value) {
  return clampSpeed(value);
}
