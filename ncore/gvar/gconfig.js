const path = require('path');
const os = require('os');
const fs = require('fs');
const homeDir = os.homedir();

const { getAppName } = require('./libs/appname.js');
let appname = getAppName();

const ncore_dir = path.resolve(__dirname, '../../ncore');
const rootdir = path.join(ncore_dir, '..');
const root_config_dir = path.join(rootdir, 'config');
const root_config_file = path.join(root_config_dir, 'index.js');
const apps_dir = path.join(rootdir, 'apps');
const app_dir = path.join(apps_dir, appname);
const app_config_dir = path.join(app_dir, 'config');
const app_config_file = path.join(app_config_dir, 'index.js');

const config_tool = require('./libs/config_tool.js');

const SCRIPT_NAME = `core_node`
const LOCAL_DIR = os.platform() === 'win32'
    ? path.join(homeDir, `.${SCRIPT_NAME}`)
    : `/usr/${SCRIPT_NAME}`;
const GLOBAL_VAR_DIR = path.join(LOCAL_DIR, 'global_var');

config_tool.importConfigFromJs(root_config_file);
config_tool.importConfigFromJs(app_config_file);

function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}
mkdir(GLOBAL_VAR_DIR);

class GlobalConfig {

    constructor() {
    }

    setConfig = (key, value) => {
        config_tool.setConfig(key, value);
    }

    getConfig = (key) => {
        return config_tool.getConfig(key);
    }

    getAllKeys = () => {
        return config_tool.getAllKeys();
    }

    getConfigAll = () => {
        return config_tool.getConfigAll();
    }
}

module.exports = new GlobalConfig();
