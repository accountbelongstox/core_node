const path = require('path');
const fs = require('fs');
const { GLOBAL_VAR_DIR } = require('#@global_dir');

const { getAppName } = require('../libs/app_parameter.js');
let appname = getAppName();

const ncore_dir = path.resolve(__dirname, '../../../ncore');
const rootdir = path.join(ncore_dir, '..');
const root_config_dir = path.join(rootdir, 'config');
const root_config_file = path.join(root_config_dir, 'index.js');
const apps_dir = path.join(rootdir, 'apps');
const app_dir = appname ? path.join(apps_dir, appname) : apps_dir;
const app_config_dir = path.join(app_dir, 'config');
const app_config_file = path.join(app_config_dir, 'index.js');

const {importConfigFromJs,setConfig,getConfig,getAllKeys,getConfigAll,getConfigDir} = require('../libs/config_tool.js');

const printImportConfig = false
importConfigFromJs(root_config_file,true,false,printImportConfig);
importConfigFromJs(app_config_file,true,false,printImportConfig);

function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}
mkdir(GLOBAL_VAR_DIR);

class GlobalConfig {

    constructor() {
        this._CONFIG_DIR = getConfigDir();
        const allConfig = getConfigAll();
        for (const key in allConfig) {
            if (allConfig.hasOwnProperty(key)) {
                if (key !== 'setConfig' && key !== 'getConfig' && key !== 'getAllKeys' && key !== 'getConfigAll') {
                    this[key] = allConfig[key];
                }
            }
        }
    }

    setConfig = (key, value) => {
        setConfig(key, value);
    }

    getConfig = (key) => {
        return getConfig(key);
    }

    getAllKeys = () => {
        return getAllKeys();
    }

    getConfigAll = () => {
        return getConfigAll();
    }
}

module.exports = new GlobalConfig();
