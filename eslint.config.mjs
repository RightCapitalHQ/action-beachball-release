import eslintConfigRightcapital from '@rightcapital/eslint-config';

const { config } = eslintConfigRightcapital.utils;

export default config(
  {
    ignores: ['dist'],
  },
  ...eslintConfigRightcapital.configs.recommended,
  {
    files: ['**/*.{ts,cts,mts}'],
    rules: {
      'no-void': ['error', { allowAsStatement: true }],
    },
  },
);
