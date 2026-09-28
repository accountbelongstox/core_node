const path = require('path');
const serviceContract = require('./service_contract');
// Data drive and per-OS directory names come from the single ncore definition (globaldir.js)
const { DATA_DRIVER, LANG_COMPILER_DIRNAME, APP_INSTALL_NAME } = require('../ncore/global_vars/global_dir/globaldir.js');

const config = {
  APP_NAME: 'DevOps',
  API_TOKEN_SALT: 'SECRET:API_TOKEN_SALT_1',
  ADMIN_JWT_SECRET: 'SECRET:ADMIN_JWT_SECRET_1',
  TRANSFER_TOKEN_SALT: 'SECRET:TRANSFER_TOKEN_SALT_1',
  JWT_SECRET: 'SECRET:JWT_SECRET_1',

  MYSQL_HOST: serviceContract.serviceDomain('mysql_local'),
  MYSQL_PORT: serviceContract.port('mysql_legacy'),
  MYSQL_DB: 'dictapi_old',
  MYSQL_SSL: false,
  MYSQL_USER: 'root',
  MYSQL_PWD: 'SECRET:MYSQL_PWD_1',

  AZURE_SPEECH_KEY: 'SECRET:AZURE_SPEECH_KEYA_1',
  AZURE_SPEECH_REGION: 'eastus',
  AZURE_SPEECH_SPEED: 1.0,

  STRAPI_HOST: serviceContract.host('any'),
  STRAPI_PORT: serviceContract.port('strapi'),
  STRAPI_URL: serviceContract.url('https', serviceContract.serviceDomain('strapi_test_local'), serviceContract.port('strapi_proxy')),
  STRAPI_TOKEN: 'SECRET:STRAPI_TOKEN_1',
  GITEA_TOKEN: 'SECRET:GITEA_TOKEN_1',

  DATA_DRIVER,
  LANG_COMPILER_DIRNAME,
  APP_INSTALL_NAME,
  DEV_LANG_DIR: path.join(DATA_DRIVER, LANG_COMPILER_DIRNAME),
  APP_INSTALL_DIR: path.join(DATA_DRIVER, APP_INSTALL_NAME),
  APP_PLATFORM_BIN_DIR: path.join(DATA_DRIVER, LANG_COMPILER_DIRNAME, 'bin'),
  TEMP_DIR: path.join(DATA_DRIVER, '.tmp'),
  DOWNLOAD_DIR: path.join(DATA_DRIVER, '.tmp', '.downloads')
};

module.exports = {
  ...config
};
