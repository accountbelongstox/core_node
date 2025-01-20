const { importConfigFromJs } = require('#@/ncore/gvar/libs/config_tool.js');
const path = require('path');
const config = importConfigFromJs(path.join(__dirname, './open_config.js'),false);

module.exports = config