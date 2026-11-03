import { defineConfig, js, reactPlugin } from '@rslint/core';

export default defineConfig([
  {
    ignores: ['node_modules/**', 'dist/**', '**/*.local'],
  },
  js.configs.recommended,
  reactPlugin.configs.recommended,
  {
    rules: {
      // Rslint does not yet model browser globals or intrinsic JSX elements.
      'no-undef': 'off',
      'react/jsx-uses-react': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
]);
