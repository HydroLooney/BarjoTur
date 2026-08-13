import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Flat config ESLint 9 (C01). Périmètre volontairement resserré au code TS ; data/, dist/, docs exclus.
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'data/**',
      'sidecar/**',
      'calc/**',
      '**/*.config.*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
