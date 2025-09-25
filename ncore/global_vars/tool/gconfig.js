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
const os = require('os');
const fs = require('fs');
const homeDir = os.homedir();

const { getAppName } = require('../libs/app_parameter.js');
let appname = getAppName();

const ncore_dir = path.resolve(__dirname, '../../../ncore');
const rootdir = path.join(ncore_dir, '..');
const root_config_dir = path.join(rootdir, 'config');
const root_config_file = path.join(root_config_dir, 'index.js');
const apps_dir = path.join(rootdir, 'apps');
const app_dir = path.join(apps_dir, appname);
const app_config_dir = path.join(app_dir, 'config');
const app_config_file = path.join(app_config_dir, 'index.js');

const {importConfigFromJs,setConfig,getConfig,getAllKeys,getConfigAll,getConfigDir} = require('../libs/config_tool.js');

const SCRIPT_NAME = `core_node`
const LOCAL_DIR = os.platform() === 'win32'
    ? path.join(homeDir, `.${SCRIPT_NAME}`)
    : `/usr/${SCRIPT_NAME}`;
const GLOBAL_VAR_DIR = path.join(LOCAL_DIR, 'global_var');
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
