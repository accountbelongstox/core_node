const { importConfigFromJs } = require('#@/ncore/global_vars/libs/config_tool.js');
const path = require('path');
const printImportConfig = false
const config = importConfigFromJs(path.join(__dirname, './open_config.js'),false,printImportConfig);

module.exports = config