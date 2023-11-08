const baseConfig = require('@rightcapital/prettier-config');

/** @type {import('prettier').Options} */
const config = {
  ...baseConfig,
  plugins: ['prettier-plugin-packagejson'],
};

module.exports = config;
