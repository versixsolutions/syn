// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
// Reverte para configuração anterior baseada no pacote meta "typescript-eslint"
import storybook from 'eslint-plugin-storybook'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

// Config Flat mínima sem uso de 'eslint/config' para evitar erro de subpath.
export default [
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: globals.browser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      storybook,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
