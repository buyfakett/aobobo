# AoBoBo

[English](./README.md) | 简体中文

AoBoBo 是一个为 [哪吒监控](https://nezha.wiki/) 设计的纯前端 3D 可视化主题，基于 **React 19 + TypeScript + Rsbuild + Tailwind CSS 4 + echarts-gl** 构建，在全球 3D 地球上直观展示各地 VPS 的实时运行状态。

> AoBoBo 仅包含前端展示，不包含哪吒 Dashboard 或 Agent。
>
> 本仓库基于原作者的项目 [hi2shark/aobobo](https://github.com/hi2shark/aobobo) 修改；我在其基础上加入了一些便于自己使用的调整。

## 特性

- **3D 地球可视化** — 使用 echarts-gl 渲染地球，自定义海洋/陆地纹理与大气轮廓光晕；VPS 位置以状态光点、聚合簇、离线灰点等样式标注。
- **原生 HTML 标点叠加** — 通过自定义投影将标记点精确叠加在 3D 地球表面，保留状态光点、聚合、离线等视觉风格。
- **深浅双主题** — 支持浅色 / 深色主题切换，运行时通过 `config.js` 或主题切换按钮切换。
- **中英文界面** — 右上角可切换 English / 简体中文，选择保存在浏览器 localStorage 中，刷新后仍然生效；首次访问根据浏览器语言选择中文（`zh`）或英文。
- **哪吒 v1** — 专注哪吒 v1 的 REST API 与 WebSocket 实时数据。
- **实时状态更新** — WebSocket 推送，数据秒级同步。
- **服务器列表** — 展示状态 / 名称 / 地区 / 系统 / 规格 / 在线时长 / 网速 / 流量 / 连接 / 负载 / CPU / 内存 / 硬盘。
- **服务器详情页** — 支持进度条 / 文本两种状态展示，支持监控图表与周期流量卡片。
- **响应式布局** — 大屏左右分栏、小屏纵向堆叠，适配桌面 / 平板 / 手机。
- **运行时配置** — 通过 `config.js` 修改标题、接口路径、监控图表类型等，无需重新打包。
- **自定义样式** — 通过 `style.css` 覆盖背景图、主题色、局部样式。

## 使用前须知

- AoBoBo 只是前端主题，不包含哪吒 Dashboard 或 Agent。
- v1 部署通常需要代理 `/api` 与 `/api/v1/ws/server`。
- H5 路由模式需要 Web 服务将普通页面路径回退到 `index.html`，但静态资源路径应保留真实 404。

## 快速开始

推荐使用 Docker Compose 部署：

```yaml
services:
  aobobo:
    image: ghcr.io/buyfakett/aobobo:latest
    container_name: aobobo
    ports:
      - 80:80
    environment:
      - DOMAIN=_
      - NEZHA=http://nezha-dashboard.example.com/
    volumes:
      # - ./config.js:/home/wwwroot/html/config.js:ro
      # - ./style.css:/home/wwwroot/html/style.css:ro
      # - ./favicon.svg:/home/wwwroot/html/favicon.svg:ro
    restart: unless-stopped
```

`NEZHA` 需要以 `/` 结尾，例如 `http://nezha-dashboard.example.com/`。

### 本地构建镜像

如果你想本地构建：

```bash
pnpm install
pnpm run build
docker build -t aobobo:latest .
```

## 配置入口

| 文件 | 用途 |
| --- | --- |
| `config.js` | 运行时配置，例如标题、接口路径、监控图表类型 |
| `style.css` | 自定义样式，例如背景图、主题色、局部样式覆盖 |
| `favicon.svg` | 自定义站点图标 |

部署时可通过挂载或替换这些文件来自定义，无需重新打包镜像。

### 常用 `config.js` 配置

```js
window.$$aoboboConfig = {
  title: 'AoBoBo',              // 网站标题
  monitorChartType: 'multi',    // 监控图表类型：single | multi
  monitorChartTypeToggle: true, // 是否允许切换监控图表类型
  monitorRefreshTime: 30,       // 监控刷新间隔（秒），0 为不刷新
  hideDetailCycleTransfer: false, // 是否隐藏详情页周期流量卡片
  hideDetailServerGlobe: false, // 是否隐藏详情页头部微缩 3D 地球
};
```

> 兼容提示：AoBoBo 同时支持 `window.$$nazhuaConfig`，如果你之前使用过 nazhua-front 的配置文件，可以直接挂载复用。

完整配置项说明见 [`docs/config.md`](./docs/config.md)，示例模板见 [`public/config.js`](./public/config.js)。

## 数据来源

| 数据类型 | 哪吒 v1 接口 |
| --- | --- |
| 站点配置 | `/api/v1/setting` |
| 实时数据 | `/api/v1/ws/server` |
| 监控数据 | `/api/v1/server/{id}/service`（兼容 `/api/v1/service/{id}`） |
| 资源历史 | `/api/v1/server/{id}/metrics` |
| 可用性数据 | `/api/v1/server/availability`（可选扩展接口） |
| 周期流量 | `/api/v1/service` |
| 分组数据 | `/api/v1/server-group` |

## 本地开发

需要 Node.js `>=24.0.0`（推荐 Node.js 24 或 26）和 pnpm `12.16.1`。首次使用可通过 Corepack 启用项目固定的 pnpm 版本：

```bash
corepack enable pnpm
```

安装依赖后启动开发服务：

```bash
pnpm install
pnpm run dev
```

开发环境可在 `.env.development.local` 中配置代理：

```bash
cp .env.development.local.example .env.development.local
```

```bash
API_HOST=http://your-nezha-host:8080
WS_HOST=http://your-nezha-host:8080
```

`WS_HOST` 填站点 origin，不要带 WebSocket 路径；前端会连接 `/api/v1/ws/server`。

### Cloudflare Zero Trust

若上游（如 `dash.cvm.im`）在 Cloudflare Access 后面，在 `.env.development.local` 中配置 Service Token。Access 应用需要单独一条 Action = **Service Auth** 的策略。

```bash
API_HOST=https://dash.cvm.im
WS_HOST=https://dash.cvm.im
CF_ACCESS_CLIENT_ID=
CF_ACCESS_CLIENT_SECRET=
# 尚未开 Service Auth 时，可改贴 CF_Authorization cookie：
# CF_AUTHORIZATION=
```

配置 `CF_ACCESS_*` 或 `CF_AUTHORIZATION` 后会忽略 `PROXY_WS_HOST`。未加闸的环境仍可用 `PROXY_WS_HOST` 做 WS 中继。启动 `pnpm run dev` 后日志应类似 `[aobobo-dev-proxy] remote=on access=on cookie=off`。

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm run dev` | 启动 Rsbuild 开发服务 |
| `pnpm run build` | 构建哪吒 v1 生产版本 |
| `pnpm run build:analyze` | 构建生产版本并生成 Rsdoctor 离线分析报告 |
| `pnpm run preview` | 预览生产构建 |
| `pnpm run lint` | 运行 Rslint |
| `pnpm run lint:fix` | 自动修复 Rslint 问题 |
| `pnpm run typecheck` | 运行 TypeScript 类型检查 |
| `pnpm run test` | 运行全部 Rstest 测试 |
| `pnpm run test:watch` | 监听文件变化并运行 Rstest 测试 |
| `pnpm run test:coverage` | 运行测试并生成覆盖率报告 |
| `pnpm run test:ci` | 运行测试并生成 PR 所需的测试与覆盖率报告 |

### 测试与 PR 报告

项目使用 Rstest 测试业务工具、数据转换、状态与 React 交互。运行 `pnpm run test:coverage` 后，可在 `coverage/index.html` 查看覆盖率；测试结果保存在 `rstest-report/results.json` 与 `rstest-report/junit.xml`，同时输出 LCOV 和 JSON 覆盖率摘要，便于 CI 或其他工具读取。

覆盖率包含全部 `src` TypeScript/TSX 文件和开发代理（不含类型声明），门槛为语句、函数、行 95%，分支 90%。地球与图表测试通过模拟渲染器验证配置、交互及生命周期，实际 WebGL 视觉效果仍需浏览器验证。

每个 PR 都会触发 `Rstest and Rsdoctor Reports` 工作流，分别运行测试覆盖率检查和 Rsdoctor 生产构建分析。两个任务独立执行，测试失败不会阻止构建分析；各自结束后仍会尝试保存已生成的报告，失败状态会正常保留。

报告使用官方自动化：Rstest 的 [`github-actions` reporter](https://rstest.rs/guide/basic/reporters#github-actions-reporter) 自动生成测试摘要与失败行注解；[`web-infra-dev/rsdoctor-action`](https://github.com/web-infra-dev/rsdoctor-action) 自动生成构建体积摘要、更新 PR 分析评论，并在基线可用时生成 HTML 差异报告。`main` 分支每次 push 都会更新构建基线，PR 按目标分支比较；首次运行没有基线时仍会生成当前构建报告。来自 fork 的 PR 受 GitHub 只读令牌限制时，保留 Actions 摘要与报告文件。

在 PR 的 **Checks** 中打开该工作流查看自动生成的摘要。从运行页面的 **Artifacts** 下载 `rstest-report`（测试 JSON、JUnit 和覆盖率文件）及 `rsdoctor-report`（构建分析 HTML、JSON），保留 30 天；Rsdoctor Action 生成的基线和差异报告也会出现在 Artifacts 中。解压后用浏览器打开对应 HTML 文件即可查看。该工作流也支持在 Actions 页面手动运行。

### 构建性能分析

运行 `pnpm run build:analyze` 可启用 Rsdoctor，查看构建耗时、产物体积、模块依赖和重复依赖。命令兼容 Windows、macOS 和 Linux，完成后可直接用浏览器打开 `node_modules/.cache/rsdoctor/rsdoctor-report.html`，原始分析数据保存在同目录的 `rsdoctor-data.json`。

分析过程不会自动启动报告服务或打开浏览器，报告也不会混入 `dist` 部署产物。普通 `pnpm run build` 不启用 Rsdoctor。Rsdoctor 分析的是构建过程和打包产物；页面运行时的 GPU 占用需结合浏览器 Performance 工具检查 WebGL 渲染和动画。

## 项目结构

```
src/
├── components/react/     # React 公共组件与 3D 地球、图表、详情组件
├── views/                # 页面
│   └── Home.tsx          # 主页面（地球 + 列表、服务器详情）
├── hooks/                # React Hooks
├── i18n/                 # 中英文翻译与语言偏好
├── store/                # 响应式外部状态仓库
├── ws/                   # WebSocket 入口与服务
├── utils/                # 请求、数据转换、工具函数
│   ├── api.ts            # v1 接口加载与响应归一化
│   └── globe-textures.ts # 地理数据与自定义地球纹理生成
├── data/                 # 地理位置码表
├── config/               # 运行时默认配置
├── assets/               # Tailwind 入口、主题变量与组件样式层
└── main.tsx              # 应用入口
```

## 公开备注

哪吒探针的公开备注（PublicNote）可用于自定义节点位置等信息。

### 通过位置代码定位

```json
{
  "customData": {
    "location": "TYO"
  }
}
```

即可让该节点定位到东京。

### 通过手动坐标定位

如果内置码表没有你要的位置，可以直接指定经纬度：

```json
{
  "customData": {
    "latlng": "35.6762,139.6503"
  }
}
```

或分别指定 `lat` 和 `lng`：

```json
{
  "customData": {
    "lat": 35.6762,
    "lng": 139.6503,
    "locationLabel": "东京"
  }
}
```

`latlng` 支持以下格式：

- 字符串：`"35.6762,139.6503"`
- 数组：`[35.6762, 139.6503]`

如果同时提供了 `location`，手动坐标会优先生效，并复用 `location` 对应的名称/国家信息；如提供了 `locationLabel`，则优先显示该标签。

## CI / 发布

仓库内置以下 GitHub Actions 工作流：

| 工作流 | 触发条件 | 说明 |
| --- | --- | --- |
| `rslint.yml` | 涉及 `js/jsx/ts/tsx` 的 Pull Request | 运行 Rslint 检查 |
| `docker-build.yml` | 推送 `v*.*.*` 标签 / 手动触发 | 构建并推送 Docker 镜像到 GHCR |
| `release.yml` | 推送 `v*.*.*` 标签 / 手动触发 | 构建压缩包并创建 Draft Release |

Release 产物说明：

| 文件名 | 适用场景 |
| --- | --- |
| `dist.zip` | 哪吒 v1 前端静态文件 |

## 相关链接

- 项目仓库：[https://github.com/buyfakett/aobobo](https://github.com/buyfakett/aobobo)
- 哪吒监控文档：[https://nezha.wiki/](https://nezha.wiki/)
- 同类型前端主题：[https://github.com/hi2shark/nazhua](https://github.com/hi2shark/nazhua)
