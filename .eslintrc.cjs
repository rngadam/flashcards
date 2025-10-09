module.exports = {
  root: true,
  env: { es2021: true, node: true, browser: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended'],
  plugins: ['import'],
  rules: {
    'import/no-unresolved': 'error',
    'import/named': 'error'
  },
  settings: {
    'import/resolver': {
      node: { extensions: ['.js', '.mjs', '.cjs'] }
    }
  }
};

// Overrides for test environment and special wrappers
module.exports.overrides = [
  {
    files: ['test/**/*.js'],
    env: { mocha: true }
  },
  {
    files: ['lib/eld-wrapper.js', 'lib/idb-keyval-wrapper.js', 'lib/sqljs-wrapper.js'],
    rules: { 'import/no-unresolved': 'off' }
  },
  {
    files: ['lib/ui/**/*.js', 'app.js', 'dictation.js'],
    globals: { Diff: 'readonly' }
  }
];
