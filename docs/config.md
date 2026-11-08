# AoBoBo 运行时配置说明

AoBoBo 通过 `config.js` 注入运行时常量，部署时只需替换该文件即可自定义站点行为，无需重新打包镜像。

> **兼容提示**：AoBoBo 同时读取 `window.$$aoboboConfig` 与 `window.$$nazhuaConfig`，如果之前使用过 nazhua-front 的配置，可以直接复用。

---

## 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `title` | `string` | `'哪吒监控'` | 网站标题，会显示在浏览器标签页与页面头部。 |

## 监控与详情页

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `monitorChartType` | `'single' / 'multi'` | `'multi'` | 服务器详情页监控图表默认展示模式。`single` 为单图切换，`multi` 为多指标并列。 |
| `monitorChartTypeToggle` | `boolean` | `true` | 是否允许用户在详情页切换监控图表类型。 |
| `monitorRefreshTime` | `number` | `30` | 监控数据刷新间隔（秒），设置为 `0` 则不自动刷新。 |
| `hideDetailCycleTransfer` | `boolean` | `false` | 是否隐藏服务器详情页的周期流量卡片。 |
| `detailCycleTransferRefreshTime` | `number` | `60` | 详情页周期流量刷新间隔（秒）。 |
| `hideDetailServerGlobe` | `boolean` | `false` | 是否隐藏服务器详情页头部的微缩 3D 地球。 |
| `globeActivityEffects` | `boolean` | `true` | 是否显示地图首页服务器地点之间的连线。默认直接连线，不依赖在线状态、网速或流量数据；设为 `false` 可关闭。 |
| `globeMaxFps` | `number` | `30` | 地球最大动画帧率，范围 `15–60`。降低可减少持续自转时的 GPU 开销，不改变自转速度。 |
| `globeAutoRotateFps` | `number` | `24` | 地球自转时的动画帧率，范围 `15–60`。拖拽地球时会恢复到 `globeMaxFps`，保证交互流畅。 |
| `globePixelRatio` | `number` | `1` | 地球渲染像素比上限，范围 `0.75–2`，同时不超过设备像素比。较低值更省 GPU，较高值更清晰；修改后刷新页面生效。 |

地球会在页面隐藏、离开可视区域时暂停；首页打开详情、资源统计或全部主机弹窗时也会暂停，关闭后恢复。CPU、流量等实时指标变化不会重建地球。低功耗设备可将 `globeAutoRotateFps` 设为 `20`、`globePixelRatio` 设为 `0.75`，或使用首页自转按钮暂停旋转。

## 成本与汇率

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `statsCostCurrency` | `string` | `'CNY'` | 资源统计弹窗中成本换算的目标币种。 |
| `defaultCostCurrency` | `string` | `'CNY'` | 当服务器价格未标注币种时使用的默认币种，例如纯数字 `"99"` 会被视为该币种。 |
| `exchangeRateEnabled` | `boolean` | `true` | 是否启用汇率换算。 |
| `exchangeRateApiBase` | `string` | `'https://api.frankfurter.dev/v2'` | 汇率 API 的基础地址。 |
| `exchangeRateCacheHours` | `number` | `24` | 汇率数据本地缓存时长（小时）。 |

## GPU 过滤

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `filterGPUKeywords` | `string[]` | `['Virtual Display']` | GPU 名称中包含以下关键字时会被过滤掉，不显示在服务器详情中。 |

## v1 接口路径（一般无需修改）

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `showAvailability` | `boolean` | `false` | 是否展示 `/api/v1/server/availability`（nezha-next 扩展）返回的可用性数据。 |
| `apiAvailabilityPath` | `string` | `'/api/v1/server/availability'` | v1 可用性数据接口路径。若后端提供该接口且返回有效数据，列表与详情页会展示服务器可用率。 |
| `availabilityRefreshTime` | `number` | `60` | 可用性数据刷新间隔（秒），设置为 `0` 则不自动刷新。 |
| `v1ApiMetricsPath` | `string` | `'/api/v1/server/{id}/metrics'` | v1 服务器指标历史接口路径，`{id}` 为服务器 ID 占位符。 |
| `v1ApiMonitorPath` | `string` | `'/api/v1/server/{id}/service'` | v1 监控数据接口路径，`{id}` 为服务器 ID 占位符。 |
| `v1ApiMonitorPathFallback` | `string` | `'/api/v1/service/{id}'` | v1 监控数据兜底路径，当主路径不可用或兼容旧版本时回退使用。 |
| `v1ApiServicePath` | `string` | `'/api/v1/service'` | v1 周期流量与服务信息接口路径。 |
| `v1WsPath` | `string` | `'/api/v1/ws/server'` | v1 WebSocket 实时数据路径。 |
| `v1GroupPath` | `string` | `'/api/v1/server-group'` | v1 服务器分组接口路径。 |
| `v1ApiSettingPath` | `string` | `'/api/v1/setting'` | v1 站点设置接口路径。 |
| `v1ApiProfilePath` | `string` | `'/api/v1/profile'` | v1 用户资料接口路径。 |

## v1 登录/管理后台入口

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `v1DashboardUrl` | `string` | `'/dashboard'` | v1 版本管理后台地址，顶部登录入口跳转目标。 |
| `v1HideNezhaDashboardBtn` | `boolean` | `false` | 是否隐藏顶部的管理后台/登录入口。 |

---

## 完整示例

```js
window.$$aoboboConfig = {
  title: 'AoBoBo',
  monitorChartType: 'multi',
  monitorChartTypeToggle: true,
  monitorRefreshTime: 30,

  hideDetailCycleTransfer: false,
  detailCycleTransferRefreshTime: 60,
  hideDetailServerGlobe: false,
  globeActivityEffects: true,
  globeMaxFps: 30,
  globeAutoRotateFps: 24,
  globePixelRatio: 1,

  statsCostCurrency: 'USD',
  defaultCostCurrency: 'CNY',
  exchangeRateEnabled: true,
  exchangeRateApiBase: 'https://api.frankfurter.dev/v2',
  exchangeRateCacheHours: 24,

  filterGPUKeywords: ['Virtual Display'],

  // 以下通常保持默认
  // nezha-next 扩展功能
  showAvailability: false,
  apiAvailabilityPath: '/api/v1/server/availability',
  availabilityRefreshTime: 60,

  v1ApiMetricsPath: '/api/v1/server/{id}/metrics',
  v1ApiMonitorPath: '/api/v1/server/{id}/service',
  v1ApiMonitorPathFallback: '/api/v1/service/{id}',
  v1ApiServicePath: '/api/v1/service',
  v1WsPath: '/api/v1/ws/server',
  v1GroupPath: '/api/v1/server-group',
  v1ApiSettingPath: '/api/v1/setting',
  v1ApiProfilePath: '/api/v1/profile',

  v1DashboardUrl: '/dashboard',
  v1HideNezhaDashboardBtn: false,
};
```

更多部署方式见 [README.md](../README.md)。
