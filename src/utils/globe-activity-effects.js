/**
 * Animated globe connections between server locations.
 */

const SERVER_CONNECTION_SERIES_ID = 'globe-server-connections';
const MIN_ARC_SEGMENTS = 16;
const MAX_ARC_SEGMENTS = 48;

export const GLOBE_ALTITUDE_ANCHOR_SERIES_ID = 'globe-effect-altitude-anchor';
export const GLOBE_ACTIVITY_SERIES_IDS = [SERVER_CONNECTION_SERIES_ID];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLng(lng) {
  return ((lng + 540) % 360) - 180;
}

function toCartesian(lat, lng) {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  return [
    cosLat * Math.cos(lngRad),
    cosLat * Math.sin(lngRad),
    Math.sin(latRad),
  ];
}

function toLatLng([x, y, z]) {
  return {
    lat: (Math.asin(clamp(z, -1, 1)) * 180) / Math.PI,
    lng: normalizeLng((Math.atan2(y, x) * 180) / Math.PI),
  };
}

function interpolateGreatCircle(start, end, t, angle, sinAngle) {
  if (angle < 1e-6) {
    return toLatLng(start);
  }

  let point;
  if (Math.abs(sinAngle) < 1e-6) {
    point = start.map((value, index) => value + (end[index] - value) * t);
    const length = Math.hypot(...point) || 1;
    point = point.map((value) => value / length);
  } else {
    const startWeight = Math.sin((1 - t) * angle) / sinAngle;
    const endWeight = Math.sin(t * angle) / sinAngle;
    point = start.map((value, index) => (
      value * startWeight + end[index] * endWeight
    ));
  }

  return toLatLng(point);
}

function buildConnectionArc(startLocation, endLocation) {
  const start = toCartesian(startLocation.lat, startLocation.lng);
  const end = toCartesian(endLocation.lat, endLocation.lng);
  const dot = clamp(start.reduce((sum, value, index) => sum + value * end[index], 0), -1, 1);
  const angle = Math.acos(dot);
  const sinAngle = Math.sin(angle);
  const segments = clamp(Math.ceil(angle * 24), MIN_ARC_SEGMENTS, MAX_ARC_SEGMENTS);
  const peakAltitude = clamp(0.12 + angle * 0.22, 0.12, 0.55);
  const coords = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const point = interpolateGreatCircle(start, end, t, angle, sinAngle);
    coords.push([
      point.lng,
      point.lat,
      0.02 + Math.sin(Math.PI * t) * peakAltitude,
    ]);
  }

  return { coords };
}

function getServerLocations(locations) {
  const uniqueLocations = new Map();

  (locations || []).forEach((location) => {
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const coordinateKey = `${lat.toFixed(5)}:${normalizeLng(lng).toFixed(5)}`;
    if (!uniqueLocations.has(coordinateKey)) {
      uniqueLocations.set(coordinateKey, {
        key: String(location?.key || location?.code || coordinateKey),
        country: String(location?.country || '').trim().toLocaleLowerCase(),
        lat,
        lng: normalizeLng(lng),
      });
    }
  });

  return [...uniqueLocations.values()].sort((a, b) => (
    `${a.country}:${a.key}`.localeCompare(`${b.country}:${b.key}`)
  ));
}

function buildServerConnectionData(locations) {
  const serverLocations = getServerLocations(locations);
  const data = [];
  for (let startIndex = 0; startIndex < serverLocations.length; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < serverLocations.length; endIndex += 1) {
      data.push(buildConnectionArc(
        serverLocations[startIndex],
        serverLocations[endIndex],
      ));
    }
  }
  return data;
}

function createServerConnectionSeries(color, data, theme = 'dark', isMobile = false) {
  const isLight = theme === 'light';
  return {
    id: SERVER_CONNECTION_SERIES_ID,
    type: 'lines3D',
    coordinateSystem: 'globe',
    polyline: true,
    silent: true,
    blendMode: isLight ? 'source-over' : 'lighter',
    lineStyle: {
      width: isMobile ? 1.6 : 1.25,
      color,
      opacity: isLight ? 0.38 : 0.3,
    },
    effect: {
      show: data.length > 0,
      constantSpeed: isMobile ? 24 : 20,
      trailWidth: isMobile ? 2.8 : 2.2,
      trailLength: isMobile ? 0.36 : 0.3,
      trailColor: color,
      trailOpacity: isLight ? 0.9 : 0.84,
      spotIntensity: 4,
    },
    data,
  };
}

/**
 * Invisible scatter3D that creates the altitude axis used by raised arcs.
 */
export function createAltitudeAnchorSeries() {
  return {
    id: GLOBE_ALTITUDE_ANCHOR_SERIES_ID,
    type: 'scatter3D',
    coordinateSystem: 'globe',
    silent: true,
    symbolSize: 0,
    itemStyle: {
      opacity: 0,
    },
    data: [
      [0, 0, 0],
      [0, 0, 1],
    ],
  };
}

export function buildActivitySeriesOptions({
  locations,
  colors,
  isMobile = false,
  enabled = true,
  theme = 'dark',
} = {}) {
  const color = colors?.connection
    || (theme === 'light' ? '#5278d7' : '#89c3eb');
  const data = enabled && Array.isArray(locations)
    ? buildServerConnectionData(locations)
    : [];
  return [createServerConnectionSeries(color, data, theme, isMobile)];
}

export function buildServerConnectionSignature(locations) {
  const serverLocations = getServerLocations(locations);
  if (serverLocations.length === 0) {
    return 'empty';
  }
  return serverLocations.map((location) => (
    `${location.country}:${location.key}@${location.lat.toFixed(5)},${location.lng.toFixed(5)}`
  )).join('|');
}

export function isGlobeActivitySeriesId(id) {
  return GLOBE_ACTIVITY_SERIES_IDS.includes(id);
}

export default buildActivitySeriesOptions;
