import path from 'node:path';
import { defineConfig } from '@rstest/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  testEnvironment: 'happy-dom',
  include: ['tests/**/*.test.{ts,tsx}'],
  setupFiles: ['./tests/setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  unstubGlobals: true,
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  source: {
    define: {
      'import.meta.env.BASE_URL': JSON.stringify('/'),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify('test'),
    },
  },
  reporters: [
    'default',
    ...(process.env.GITHUB_ACTIONS ? ['github-actions' as const] : []),
    ['junit', { outputPath: './rstest-report/junit.xml' }],
    ['json', { outputPath: './rstest-report/results.json' }],
  ],
  coverage: {
    provider: 'v8',
    include: ['src/**/*.{ts,tsx}', 'rsbuild.dev-proxy.ts'],
    exclude: ['src/**/*.d.ts'],
    reportsDirectory: './coverage',
    reporters: ['text', 'html', 'lcovonly', 'json-summary'],
    reportOnFailure: true,
    thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
  },
});
