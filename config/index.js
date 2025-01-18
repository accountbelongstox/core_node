const path = require('path');
const os = require('os');

const config = {
    APP_NAME: 'DevOps',
    API_TOKEN_SALT: 'EsX6aWwfVjfyF2qtnxkafw',
    ADMIN_JWT_SECRET: 'ENC:2f24cb77684a84e32b7a95685b87b239:c3118c9e7f3acb332d49c1fc4de4dfe750aa725da80a5968cf031ec2468fd671',
    TRANSFER_TOKEN_SALT: '/Hlht5l1E7EVmhxfFqlFRA',
    JWT_SECRET: 'ENC:177f0baf19eca3981e1c8a0b29bb80d4:c69ba4d04d7bc60fb047a5e1714fac90840dc2123c1901f7bde15731a35048f8',
    
    MYSQL_HOST: 'mysql.local.12gm.com',
    MYSQL_PORT: 13306,
    MYSQL_DB: 'dictapi_old',
    MYSQL_SSL: false,
    MYSQL_USER: 'root',
    MYSQL_PWD: 'ENC:606209ccb6e44eaed2c81df0bd80ee69:6ff1efb77eaf3b57b993f991b96a372b',
    
    AZURE_SPEECH_KEY: 'ENC:ccbc86cd4fd7be7c7825d127a888bd0f:78e7425b1377b7d26ba84d1454e8f828deb7159b2df93893af9cd503e9c6c071061f7185ff2edc79a940ac98626e9e71',
    AZURE_SPEECH_REGION: 'eastus',
    AZURE_SPEECH_SPEED: 1.0,
    
    STRAPI_HOST: '0.0.0.0',
    STRAPI_PORT: 1337,
    STRAPI_URL: 'https://dictapitest.local.12gm.com:910',
    STRAPI_TOKEN: 'ENC:89f3fee13af534abf558a0dad872338a:e499bdf457911da4384caa3cd728e6d3cb87059623d8f7fad96d08182c43134747b4fef5e9bd05d243a62a4df325ec29fe479fd3dc195e0cc2313c332f8c7c5041669e42a2213c121627af59ab163ef7c22c0c1654f381ea81463185cb0298abf752ca275ece65a8b2f37c4d1c8e0bb105d047d17994b47037021a4191262e54542ad36b4f9321298bf770d91ad348d392ca456022f1edd5b480ea81cd575d448aadad60d5357307fb0354642cce9123c075a2c66a55bc2255260315b7d6c3ad5459b185c98e767b70512fefecb9e4ceb93ae7b9156a611d9ced7b0e442623556950bfd3f5124727fadb5f2e1464dcb1d9c8cbc3a09b1af9907aafe2e9b5ea9e3e39bbc05b4f14e367072712e7e0f28b',
    GITEA_TOKEN: 'ENC:021e1374c4f3b521ecb0bd47c3f2b9bf:4ba97610f12cbcd91d129ab583ff61d5610bad529f83bdc5a919e403310f96c63b1a000d9ae1fac5079d514466728e5c',

    // Executable paths
    PYTHON_EXE: 'python',
    PYTHON3_EXE: 'python3',
    PIP_EXE: 'pip',
    PIP3_EXE: 'pip3',
    NPM_EXE: 'npm',
    NODE_EXE: 'node',
    GO_EXE: 'go',
    RUST_EXE: 'rustc',
    CARGO_EXE: 'cargo',
    JAVA_EXE: 'java',
    JAVAC_EXE: 'javac',
    GIT_EXE: 'git',
    DOCKER_EXE: 'docker',
    DOCKER_COMPOSE_EXE: 'docker-compose',

    // Directory paths
    DEV_LANG_DIR: path.join(os.platform() === 'win32' ? 'D:' : '/usr', 'lang_compiler'),
    APP_INSTALL_DIR: path.join(os.platform() === 'win32' ? 'D:' : '/usr', 'applications'),
    APP_PLATFORM_BIN_DIR: path.join(os.platform() === 'win32' ? 'D:' : '/usr', 'lang_compiler', 'bin')
};

module.exports = {
    ...config
};

