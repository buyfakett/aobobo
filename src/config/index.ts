// 优先读取 $$aoboboConfig，同时兼容 nazhua-front 的 $$nazhuaConfig
const runtimeConfig: Record<string, any> = window.$$aoboboConfig || window.$$nazhuaConfig || {};

const config: { aobobo: Record<string, any> } = {
  aobobo: {
    title: '哪吒监控',
    showAvailability: false,
    apiAvailabilityPath: '/api/v1/server/availability',
    availabilityRefreshTime: 60,
    v1ApiMetricsPath: '/api/v1/server/{id}/metrics',
    v1ApiOnlineHistoryPath: '/api/v1/server/{id}/online-history',
    v1ApiMonitorPath: '/api/v1/server/{id}/service',
    v1ApiMonitorPathFallback: '/api/v1/service/{id}',
    v1ApiServicePath: '/api/v1/service',
    v1WsPath: '/api/v1/ws/server',
    v1GroupPath: '/api/v1/server-group',
    v1ApiSettingPath: '/api/v1/setting',
    v1ApiProfilePath: '/api/v1/profile',
    v1DashboardUrl: '/dashboard',
    v1HideNezhaDashboardBtn: false,
    detailCycleTransferRefreshTime: 60,
    hideDetailCycleTransfer: false,
    hideDetailServerGlobe: false,
    globeActivityEffects: true,
    globeMaxFps: 30,
    globePixelRatio: 1.25,
    monitorRefreshTime: 30,
    monitorChartType: 'multi',
    monitorChartTypeToggle: true,
    statsCostCurrency: 'CNY',
    defaultCostCurrency: 'CNY',
    exchangeRateEnabled: true,
    exchangeRateApiBase: 'https://api.frankfurter.dev/v2',
    exchangeRateCacheHours: 24,
    filterGPUKeywords: ['Virtual Display'],
    ...runtimeConfig,
  },
};

export function mergeAoboboConfig(customConfig: Record<string, any>) {
  Object.keys(customConfig).forEach((key) => {
    config.aobobo[key] = customConfig[key];
  });
}

// 保留 nazhua 的命名作为兼容别名
export const mergeNazhuaConfig = mergeAoboboConfig;
window.$mergeAoboboConfig = mergeAoboboConfig;
window.$mergeNazhuaConfig = mergeAoboboConfig;

export const hasRuntimeShowAvailability = Object.prototype.hasOwnProperty.call(
  runtimeConfig,
  'showAvailability',
);

export default config;
