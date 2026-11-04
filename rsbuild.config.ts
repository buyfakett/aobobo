import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';
import { RsdoctorRspackPlugin } from '@rsdoctor/core';
import packageJson from './package.json' with { type: 'json' };
import { createAoboboDevProxy } from './rsbuild.dev-proxy';

const isDevelopment = process.env.NODE_ENV === 'development';
if (isDevelopment) dotenv.config({ path: '.env.development.local' });

const basePath = process.env.VITE_BASE_PATH || '/';
const assetPrefix = basePath.endsWith('/') ? basePath : `${basePath}/`;

export default defineConfig({
  plugins: [pluginReact(), pluginTailwindcss()],
  source: {
    entry: { index: './src/main.tsx' },
    define: {
      'import.meta.env.BASE_URL': JSON.stringify(assetPrefix),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VERSION || packageJson.version),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  html: {
    template: './index.html',
    favicon: './public/favicon.svg',
  },
  server: {
    base: assetPrefix,
    host: '0.0.0.0',
    port: 3000,
    historyApiFallback: true,
    proxy: isDevelopment ? createAoboboDevProxy(process.env) : undefined,
  },
  output: {
    assetPrefix,
    dataUriLimit: 8192,
  },
  tools: {
    rspack: {
      plugins: [
        process.env.RSDOCTOR === 'true' && new RsdoctorRspackPlugin({
          disableClientServer: true,
          output: {
            mode: 'brief',
            reportDir: path.resolve(import.meta.dirname, 'node_modules/.cache/rsdoctor'),
            options: { type: ['html', 'json'] },
          },
        }),
      ],
    },
  },
  performance: {
    chunkSplit: {
      strategy: 'split-by-experience',
      override: {
        cacheGroups: {
          globe: {
            test: /[\\/]node_modules[\\/](?:echarts-gl|claygl)[\\/]/,
            name: 'globe',
            priority: 20,
          },
          worldGeo: {
            test: /src[\\/]data[\\/]world\.geo\.json$/,
            name: 'world-geo',
            priority: 20,
          },
        },
      },
    },
  },
});
