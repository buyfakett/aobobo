import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import packageJson from './package.json' with { type: 'json' };
import { createAoboboDevProxy } from './rsbuild.dev-proxy.js';

const isDevelopment = process.env.NODE_ENV === 'development';
if (isDevelopment) dotenv.config({ path: '.env.development.local' });

const assetPrefix = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  plugins: [pluginReact(), pluginSass()],
  source: {
    entry: { index: './src/main.jsx' },
    define: {
      'import.meta.env.BASE_URL': JSON.stringify(assetPrefix),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VERSION || packageJson.version),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '~@': path.resolve(import.meta.dirname, './src'),
    },
  },
  html: { template: './index.html' },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: isDevelopment ? createAoboboDevProxy(process.env) : undefined,
  },
  output: {
    assetPrefix,
    distPath: { root: 'dist' },
    dataUriLimit: 8192,
    sourceMap: { js: false, css: false },
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
