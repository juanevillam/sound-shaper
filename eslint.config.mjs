import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactNativePlugin from 'eslint-plugin-react-native';
import importPlugin from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';

export default [
  // Global ignores. Flat-config minimatch patterns are relative to this file,
  // so they must be globstar to also cover apps/* subtrees (CNG prebuild
  // output, .expo caches, build artifacts like functions/lib). A standalone
  // `ignores` object applies to every subsequent config block.
  {
    ignores: [
      '**/node_modules/**',
      '**/android/**',
      '**/ios/**',
      '**/build/**',
      '**/functions/lib/**',
      '**/.expo/**',
      '**/dist/**',
      '**/expo-env.d.ts',
      // Backend services (e.g. the Cloudflare Worker) have their own toolchain
      // and Workers globals — this RN/React lint config doesn't govern them.
      'services/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        React: true,
        JSX: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-native': reactNativePlugin,
      import: importPlugin,
      'unused-imports': unusedImportsPlugin,
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', ['internal']],
          pathGroups: [
            {
              pattern: 'react',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'react-native',
              group: 'external',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['react', 'react-native'],
          'newlines-between': 'always-and-inside-groups',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      // Guardrails for the monorepo's module boundaries — the tree is clean
      // today; these keep future sessions from eroding it.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@portfolio/*/src/*'],
              message:
                'Deep import into a package — import from the package root instead.',
            },
            {
              group: ['**/apps/*/src/*', '../../../*'],
              message:
                'Cross-app or deep relative import — move shared code into packages/*.',
            },
          ],
        },
      ],
    },
  },
];
