/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  reportUnusedDisableDirectives: true,
  overrides: [
    {
      files: ['src/**/*.{ts,cts,mts}'],
      extends: ['@rightcapital/eslint-config-typescript'],
      env: { node: true },
      rules: {
        'no-void': ['error', { allowAsStatement: true }],
      },
    },
    {
      files: ['./*.{js,cjs,mjs}'],
      extends: ['@rightcapital/eslint-config-javascript'],
      env: { node: true },
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
