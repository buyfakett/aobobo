# AoBoBo

English | [简体中文](./README.zh-CN.md)

AoBoBo is a frontend-only 3D visualization theme for [Nezha Monitoring](https://nezha.wiki/), built with **React 19 + TypeScript + Rsbuild + Tailwind CSS 4 + echarts-gl**. It displays the real-time status of VPS instances around the world on an interactive 3D globe.

> AoBoBo provides the frontend only. It does not include the Nezha Dashboard or Agent.
>
> This repository is based on the original project [hi2shark/aobobo](https://github.com/hi2shark/aobobo), with additional adjustments for my own use.

## Features

- **3D globe visualization** — Renders the globe with echarts-gl, custom ocean and land textures, and an atmospheric halo. VPS locations appear as status lights, clusters, or gray offline markers.
- **Native HTML marker overlays** — Uses custom projection to position HTML markers precisely over the 3D globe while preserving status lights, clusters, and offline indicators.
- **Light and dark themes** — Switch themes at runtime through `config.js` or the theme toggle.
- **English and Chinese interface** — Switch between English and Simplified Chinese in the top-right corner. Your selection is saved in browser localStorage and restored after a refresh. On the first visit, a Chinese browser language (`zh`) selects Chinese; other browser languages select English.
- **Nezha v1** — Designed for the Nezha v1 REST API and WebSocket data.
- **Real-time status updates** — Receives WebSocket updates within seconds.
- **Server list** — Shows status, name, region, operating system, specifications, uptime, network speed, traffic, connections, load, CPU, memory, and disk usage.
- **Server details** — Offers progress-bar and text status views, monitoring charts, and billing-cycle traffic cards.
- **Responsive layout** — Uses a two-column layout on large screens and a vertical layout on smaller screens, supporting desktops, tablets, and phones.
- **Runtime configuration** — Change the title, API paths, monitoring chart types, and more through `config.js` without rebuilding.
- **Custom styles** — Override background images, theme colors, and component styles through `style.css`.

## Before You Start

- AoBoBo is a frontend theme only. It does not include the Nezha Dashboard or Agent.
- A v1 deployment typically needs proxies for `/api` and `/api/v1/ws/server`.
- History-mode routing requires the web server to fall back to `index.html` for page routes while returning genuine 404 responses for missing static assets.

## Quick Start

Docker Compose is the recommended deployment method:

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

`NEZHA` must end with `/`, for example `http://nezha-dashboard.example.com/`.

### Build the Image Locally

To build your own image:

```bash
pnpm install
pnpm run build
docker build -t aobobo:latest .
```

## Configuration Files

| File | Purpose |
| --- | --- |
| `config.js` | Runtime settings, including the title, API paths, and monitoring chart types |
| `style.css` | Custom styles, including background images, theme colors, and component overrides |
| `favicon.svg` | Custom site icon |

Mount or replace these files when deploying to customize the site without rebuilding the image.

### Common `config.js` Settings

```js
window.$$aoboboConfig = {
  title: 'AoBoBo',              // Site title
  monitorChartType: 'multi',    // Monitoring chart type: single | multi
  monitorChartTypeToggle: true, // Allow switching monitoring chart types
  monitorRefreshTime: 30,       // Refresh interval in seconds; 0 disables refresh
  hideDetailCycleTransfer: false, // Hide the traffic card on the details page
  hideDetailServerGlobe: false, // Hide the miniature 3D globe in the details header
};
```

> Compatibility: AoBoBo also supports `window.$$nazhuaConfig`. If you already have a nazhua-front configuration file, you can mount and reuse it directly.

See [`docs/config.md`](./docs/config.md) for the full configuration reference in Chinese and [`public/config.js`](./public/config.js) for an example template.

## Data Sources

| Data | Nezha v1 endpoint |
| --- | --- |
| Site settings | `/api/v1/setting` |
| Real-time data | `/api/v1/ws/server` |
| Monitoring data | `/api/v1/server/{id}/service` (also supports `/api/v1/service/{id}`) |
| Resource history | `/api/v1/server/{id}/metrics` |
| Availability | `/api/v1/server/availability` (optional extension endpoint) |
| Billing-cycle traffic | `/api/v1/service` |
| Server groups | `/api/v1/server-group` |

## Local Development

Requires Node.js `>=24.0.0` (Node.js 24 or 26 is recommended) and pnpm `12.16.1`. On your first setup, use Corepack to enable the pnpm version pinned by the project:

```bash
corepack enable pnpm
```

Install dependencies and start the development server:

```bash
pnpm install
pnpm run dev
```

Configure development proxies in `.env.development.local`:

```bash
cp .env.development.local.example .env.development.local
```

```bash
API_HOST=http://your-nezha-host:8080
WS_HOST=http://your-nezha-host:8080
```

Set `WS_HOST` to the site's origin without a WebSocket path. The frontend connects to `/api/v1/ws/server`.

### Cloudflare Zero Trust

If the upstream server, such as `dash.cvm.im`, is protected by Cloudflare Access, configure a Service Token in `.env.development.local`. The Access application requires a separate policy with its Action set to **Service Auth**.

```bash
API_HOST=https://dash.cvm.im
WS_HOST=https://dash.cvm.im
CF_ACCESS_CLIENT_ID=
CF_ACCESS_CLIENT_SECRET=
# If Service Auth is not enabled yet, use a CF_Authorization cookie instead:
# CF_AUTHORIZATION=
```

Setting `CF_ACCESS_*` or `CF_AUTHORIZATION` causes `PROXY_WS_HOST` to be ignored. Environments without Access protection can still use `PROXY_WS_HOST` as a WebSocket relay. After starting `pnpm run dev`, the log should resemble `[aobobo-dev-proxy] remote=on access=on cookie=off`.

### Available Scripts

| Command | Description |
| --- | --- |
| `pnpm run dev` | Start the Rsbuild development server |
| `pnpm run build` | Build the Nezha v1 production bundle |
| `pnpm run build:analyze` | Build the production bundle and generate an offline Rsdoctor report |
| `pnpm run preview` | Preview the production build |
| `pnpm run lint` | Run Rslint |
| `pnpm run lint:fix` | Automatically fix Rslint issues |
| `pnpm run typecheck` | Run TypeScript type checking |
| `pnpm run test` | Run all Rstest tests |
| `pnpm run test:watch` | Watch files and rerun Rstest tests |
| `pnpm run test:coverage` | Run tests and generate coverage reports |
| `pnpm run test:ci` | Run tests and generate the test and coverage reports used by PR checks |

### Tests and PR Reports

The project uses Rstest to test business utilities, data transformations, state, and React interactions. After running `pnpm run test:coverage`, open `coverage/index.html` to inspect coverage. Test results are saved in `rstest-report/results.json` and `rstest-report/junit.xml`, with LCOV and JSON coverage summaries available for CI and other tools.

Coverage includes all TypeScript/TSX files in `src` and the development proxy, excluding type declarations. Required thresholds are 95% for statements, functions, and lines, and 90% for branches. Globe and chart tests use mocked renderers to verify configuration, interactions, and lifecycle behavior. Actual WebGL rendering still needs to be checked in a browser.

Every PR triggers the `Rstest and Rsdoctor Reports` workflow, which runs test coverage checks and Rsdoctor production build analysis in separate jobs. A test failure does not prevent build analysis. Each job attempts to save any generated reports when it finishes, while preserving its failure status.

Reports use the official integrations: Rstest's [`github-actions` reporter](https://rstest.rs/guide/basic/reporters#github-actions-reporter) generates test summaries and inline failure annotations; [`web-infra-dev/rsdoctor-action`](https://github.com/web-infra-dev/rsdoctor-action) generates bundle-size summaries, updates PR analysis comments, and creates HTML comparison reports when a baseline is available. Every push to `main` updates the build baseline, and PRs are compared against their target branch. The first run still generates the current build report without a baseline. For fork PRs restricted by GitHub's read-only token, Actions summaries and report artifacts remain available.

Open the workflow under the PR's **Checks** tab to view its generated summaries. From the workflow run's **Artifacts**, download `rstest-report` (test JSON, JUnit, and coverage files) and `rsdoctor-report` (build analysis HTML and JSON), retained for 30 days. Baseline and comparison reports generated by the Rsdoctor Action also appear in Artifacts. Extract the archive and open the relevant HTML file in your browser. The workflow can also be run manually from the Actions page.

### Build Performance Analysis

Run `pnpm run build:analyze` to enable Rsdoctor and inspect build timings, bundle sizes, module dependencies, and duplicate dependencies. The command works on Windows, macOS, and Linux. Once it completes, open `node_modules/.cache/rsdoctor/rsdoctor-report.html` in a browser. Raw analysis data is saved as `rsdoctor-data.json` in the same directory.

Analysis does not automatically start a report server or open a browser, and reports are kept out of the deployable `dist` directory. A regular `pnpm run build` does not enable Rsdoctor. Rsdoctor analyzes the build process and its output; use your browser's Performance tools to investigate runtime GPU usage, WebGL rendering, and animations.

## Project Structure

```
src/
├── components/react/     # Shared React components, 3D globe, charts, and details
├── views/                # Pages
│   └── Home.tsx          # Main page: globe, server list, and server details
├── hooks/                # React hooks
├── i18n/                 # English/Chinese translations and language preferences
├── store/                # Reactive external state store
├── ws/                   # WebSocket entry point and services
├── utils/                # Requests, data transformations, and utilities
│   ├── api.ts            # v1 API loading and response normalization
│   └── globe-textures.ts # Geographic data and custom globe texture generation
├── data/                 # Geographic location code tables
├── config/               # Runtime configuration defaults
├── assets/               # Tailwind entry point, theme variables, and component styles
└── main.tsx              # Application entry point
```

## Public Notes

The Nezha Agent's public notes (`PublicNote`) can customize node locations and other information.

### Locate a Node by Location Code

```json
{
  "customData": {
    "location": "TYO"
  }
}
```

This places the node in Tokyo.

### Locate a Node by Coordinates

If the built-in code tables do not include your location, specify its latitude and longitude directly:

```json
{
  "customData": {
    "latlng": "35.6762,139.6503"
  }
}
```

Alternatively, specify `lat` and `lng` separately:

```json
{
  "customData": {
    "lat": 35.6762,
    "lng": 139.6503,
    "locationLabel": "Tokyo"
  }
}
```

`latlng` accepts either of these formats:

- String: `"35.6762,139.6503"`
- Array: `[35.6762, 139.6503]`

If `location` is also provided, manual coordinates take precedence and reuse the name and country associated with that location code. A supplied `locationLabel` takes precedence as the display label.

## CI and Releases

The repository includes these GitHub Actions workflows:

| Workflow | Trigger | Description |
| --- | --- | --- |
| `rslint.yml` | Pull requests affecting `js/jsx/ts/tsx` files | Run Rslint checks |
| `docker-build.yml` | Push a `v*.*.*` tag or run manually | Build and push Docker images to GHCR |
| `release.yml` | Push a `v*.*.*` tag or run manually | Build archives and create a draft release |

Release artifacts:

| File | Purpose |
| --- | --- |
| `dist.zip` | Nezha v1 frontend static files |

## Related Links

- Repository: [https://github.com/buyfakett/aobobo](https://github.com/buyfakett/aobobo)
- Nezha Monitoring documentation: [https://nezha.wiki/](https://nezha.wiki/)
- Similar frontend theme: [https://github.com/hi2shark/nazhua](https://github.com/hi2shark/nazhua)
