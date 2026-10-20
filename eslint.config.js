import vue from 'eslint-plugin-vue'
import vueTs from '@vue/eslint-config-typescript'

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'src/typed-router.d.ts',
      'src/auto-imports.d.ts',
    ],
  },
  ...vue.configs['flat/recommended'],
  ...vueTs(),
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^cdxIcon' },
      ],
    },
  },
  {
    // Material Web elements use native `slot="…"` attributes (web-component
    // slots, not Vue slots), so the Vue 2 deprecation rule doesn't apply.
    files: ['src/prototypes/video-first-app-android/**/*.vue'],
    rules: {
      'vue/no-deprecated-slot-attribute': 'off',
    },
  },
]
