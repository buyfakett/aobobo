/**
 * Globe connections between server locations.
 */

const SERVER_CONNECTION_SERIES_ID = 'globe-server-connections';
const MIN_ARC_SEGMENTS = 16;
const MAX_ARC_SEGMENTS = 48;
const MAX_CONNECTIONS_DESKTOP = 160;
const MAX_CONNECTIONS_MOBILE = 80;

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

function angularDistance(start, end) {
  const startPoint = toCartesian(start.lat, start.lng);
  const endPoint = toCartesian(end.lat, end.lng);
  const dot = startPoint.reduce((sum, value, index) => sum + value * endPoint[index], 0);
  return Math.acos(clamp(dot, -1, 1));
}

function buildConnectionPairs(serverLocations, maxConnections) {
  if (serverLocations.length < 2 || maxConnections <= 0) {
    return [];
  }

  const pairs = [];
  const edgeKeys = new Set();
  const connected = new Set([0]);
  const nearestDistance = Array(serverLocations.length).fill(Number.POSITIVE_INFINITY);
  const nearestParent = Array(serverLocations.length).fill(-1);

  const updateNearest = (sourceIndex) => {
    for (let index = 0; index < serverLocations.length; index += 1) {
      if (connected.has(index)) {
        continue;
      }
      const distance = angularDistance(
        serverLocations[sourceIndex],
        serverLocations[index],
      );
      if (distance < nearestDistance[index]) {
        nearestDistance[index] = distance;
        nearestParent[index] = sourceIndex;
      }
    }
  };

  const addPair = (startIndex, endIndex) => {
    const low = Math.min(startIndex, endIndex);
    const high = Math.max(startIndex, endIndex);
    const key = `${low}:${high}`;
    if (edgeKeys.has(key) || pairs.length >= maxConnections) {
      return false;
    }
    edgeKeys.add(key);
    pairs.push([low, high]);
    return true;
  };

  // Begin with a bounded minimum-spanning tree so ordinary dashboards remain
  // connected without producing an O(n^2) all-pairs mesh.
  updateNearest(0);
  while (connected.size < serverLocations.length && pairs.length < maxConnections) {
    let nextIndex = -1;
    let nextDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < serverLocations.length; index += 1) {
      if (!connected.has(index) && nearestDistance[index] < nextDistance) {
        nextIndex = index;
        nextDistance = nearestDistance[index];
      }
    }
    if (nextIndex < 0 || nearestParent[nextIndex] < 0) {
      break;
    }
    addPair(nearestParent[nextIndex], nextIndex);
    connected.add(nextIndex);
    updateNearest(nextIndex);
  }

  // Add one local neighbour per location when the cap has room. This keeps the
  // network readable while giving small deployments more than a bare tree.
  for (let startIndex = 0;
    startIndex < serverLocations.length && pairs.length < maxConnections;
    startIndex += 1) {
    let nearestIndex = -1;
    let distance = Number.POSITIVE_INFINITY;
    for (let endIndex = 0; endIndex < serverLocations.length; endIndex += 1) {
      if (startIndex === endIndex) {
        continue;
      }
      const candidateDistance = angularDistance(
        serverLocations[startIndex],
        serverLocations[endIndex],
      );
      if (candidateDistance < distance) {
        nearestIndex = endIndex;
        distance = candidateDistance;
      }
    }
    if (nearestIndex >= 0) {
      addPair(startIndex, nearestIndex);
    }
  }

  return pairs;
}

function buildServerConnectionData(locations, isMobile = false) {
  const serverLocations = getServerLocations(locations);
  const maxConnections = isMobile ? MAX_CONNECTIONS_MOBILE : MAX_CONNECTIONS_DESKTOP;
  return buildConnectionPairs(serverLocations, maxConnections).map(([startIndex, endIndex]) => (
    buildConnectionArc(serverLocations[startIndex], serverLocations[endIndex])
  ));
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
      // A looping trail keeps echarts-gl rendering at the display refresh rate.
      // Static arcs let ZRender sleep when the globe is idle.
      show: false,
      constantSpeed: isMobile ? 24 : 20,
      trailWidth: isMobile ? 2.8 : 2.2,
      trailLength: isMobile ? 0.36 : 0.3,
      trailColor: color,
      trailOpacity: 0,
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
    ? buildServerConnectionData(locations, isMobile)
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
