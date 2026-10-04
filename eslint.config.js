import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import ts from 'typescript-eslint'
import svelteConfig from './svelte.config.js'

// Layers that talk to the car must stay fully typed (CLAUDE.md §13).
const protocolLayers = [
  'src/transport/**',
  'src/elm327/**',
  'src/isotp/**',
  'src/obd/**',
  'src/uds/**',
  'src/manufacturers/**',
]

export default ts.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // No eval / Function: PID formulas go through our own parser (CLAUDE.md §6.6).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    files: protocolLayers,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
)
