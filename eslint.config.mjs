import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import playwright from 'eslint-plugin-playwright';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'dist/**',
      'coverage/**',
      '**/*.tsbuildinfo',
      'junit-*.xml',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      playwright,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'playwright/no-skipped-test': 'warn',
      'playwright/no-conditional-in-test': 'off',
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      'playwright/expect-expect': 'warn',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-conditional-expect': 'warn',
    },
  },
];
