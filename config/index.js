// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const path = require('path');
const fs = require('fs');
const os = require('os');
const serviceContract = require('./service_contract');
const isWindows = os.platform() === 'win32';

const osVersion = (() => {
  const platform = os.platform();
  if (platform === 'win32') {
    const release = os.release();
    if (release.startsWith('10')) {
      return 'win10';
    } else if (release.startsWith('11')) {
      return 'win11';
    }
  } else if (platform === 'linux') {
    const distro = os.type();
    const version = os.release();
    if (distro.includes('Ubuntu')) {
      return `ubuntu${version.split('.')[0]}`;
    } else if (distro.includes('Debian')) {
      return `debian${version.split('.')[0]}`;
    }
  }
  return platform;
})();

let DATA_DRIVER;
if (os.platform() === 'win32') {
  DATA_DRIVER = fs.existsSync('D:\\') ? 'D:\\' : 'C:\\';
} else {
  DATA_DRIVER = fs.existsSync('/mnt/d') ? '/mnt/d' : null;
  if (!DATA_DRIVER) {
    DATA_DRIVER = fs.existsSync('/www') ? '/www' : null;
  }
  if (!DATA_DRIVER) {
    DATA_DRIVER = '/usr/';
  }
}

const LANG_COMPILER_DIRNAME = `.dev_${osVersion}`;
const APP_INSTALL_NAME = `applications_${osVersion}`

const config = {
  APP_NAME: 'DevOps',
  API_TOKEN_SALT: 'EsX6aWwfVjfyF2qtnxkafw',
  ADMIN_JWT_SECRET: 'ENC:2f24cb77684a84e32b7a95685b87b239:c3118c9e7f3acb332d49c1fc4de4dfe750aa725da80a5968cf031ec2468fd671',
  TRANSFER_TOKEN_SALT: '/Hlht5l1E7EVmhxfFqlFRA',
  JWT_SECRET: 'ENC:177f0baf19eca3981e1c8a0b29bb80d4:c69ba4d04d7bc60fb047a5e1714fac90840dc2123c1901f7bde15731a35048f8',

  MYSQL_HOST: serviceContract.serviceDomain('mysql_local'),
  MYSQL_PORT: serviceContract.port('mysql_legacy'),
  MYSQL_DB: 'dictapi_old',
  MYSQL_SSL: false,
  MYSQL_USER: 'root',
  MYSQL_PWD: 'ENC:606209ccb6e44eaed2c81df0bd80ee69:6ff1efb77eaf3b57b993f991b96a372b',

  AZURE_SPEECH_KEY: 'ENC:ccbc86cd4fd7be7c7825d127a888bd0f:78e7425b1377b7d26ba84d1454e8f828deb7159b2df93893af9cd503e9c6c071061f7185ff2edc79a940ac98626e9e71',
  AZURE_SPEECH_REGION: 'eastus',
  AZURE_SPEECH_SPEED: 1.0,

  STRAPI_HOST: serviceContract.host('any'),
  STRAPI_PORT: serviceContract.port('strapi'),
  STRAPI_URL: serviceContract.url('https', serviceContract.serviceDomain('strapi_test_local'), serviceContract.port('strapi_proxy')),
  STRAPI_TOKEN: 'ENC:89f3fee13af534abf558a0dad872338a:e499bdf457911da4384caa3cd728e6d3cb87059623d8f7fad96d08182c43134747b4fef5e9bd05d243a62a4df325ec29fe479fd3dc195e0cc2313c332f8c7c5041669e42a2213c121627af59ab163ef7c22c0c1654f381ea81463185cb0298abf752ca275ece65a8b2f37c4d1c8e0bb105d047d17994b47037021a4191262e54542ad36b4f9321298bf770d91ad348d392ca456022f1edd5b480ea81cd575d448aadad60d5357307fb0354642cce9123c075a2c66a55bc2255260315b7d6c3ad5459b185c98e767b70512fefecb9e4ceb93ae7b9156a611d9ced7b0e442623556950bfd3f5124727fadb5f2e1464dcb1d9c8cbc3a09b1af9907aafe2e9b5ea9e3e39bbc05b4f14e367072712e7e0f28b',
  GITEA_TOKEN: 'ENC:021e1374c4f3b521ecb0bd47c3f2b9bf:4ba97610f12cbcd91d129ab583ff61d5610bad529f83bdc5a919e403310f96c63b1a000d9ae1fac5079d514466728e5c',

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
