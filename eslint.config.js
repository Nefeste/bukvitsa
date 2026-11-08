// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'dist-web/*', 'src/content/generated/*'],
  },
  {
    // движок чистый (ADR студии 0004, specs/2026-10-engine.md): ни часов, ни случайности
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Дата — аргументом.' },
        { object: 'Math', property: 'random', message: 'Случайность — из сборки (ADR 0005).' },
      ],
      'no-restricted-syntax': ['error', { selector: "NewExpression[callee.name='Date']", message: 'Дата — аргументом.' }],
    },
  },
]);
