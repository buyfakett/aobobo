import {
  defineConfig,
  globalIgnores,
  globals,
  js,
  reactHooksPlugin,
  reactPlugin,
} from '@rslint/core';

export default defineConfig([
  {
    ...globalIgnores(['node_modules/**', 'dist/**', '**/*.local', '**/*.d.ts']),
  },
  js.configs.recommended,
  reactPlugin.configs.recommended,
  reactHooksPlugin.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['*.{ts,mts,cts}', 'rsbuild.*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/jsx-uses-react': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
]);
