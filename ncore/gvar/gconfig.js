const path = require('path');
const os = require('os');
const fs = require('fs');
let globalVarDir, localDir;
const homeDir = os.homedir();
const configTool = require('./libs/config_tool');
try {
    const { GLOBAL_VAR_DIR, LOCAL_DIR } = require('./gdir');
    globalVarDir = GLOBAL_VAR_DIR
    localDir = LOCAL_DIR
} catch (error) {
    localDir = os.platform() === 'win32'
        ? path.join(homeDir, '.core_node')
        : '/usr/core_node';
    globalVarDir = os.platform() === 'win32'
        ? path.join(homeDir, '.core_node/global_var')
        : path.join(localDir, 'global_var');
}
function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}
mkdir(globalVarDir);

class GlobalConfig {
    initializeConfig = null
    // Initialize maxDrive and homeDir
    maxDrive = os.platform() === 'win32' ? 'D:' : '/usr';
    homeDir = os.homedir();

    // Local directory for application data
    localDir = localDir;

    // Executable paths
    pythonExeName = 'python';
    pythonExe3Name = 'python3';
    pipExeName = 'pip';
    pipExe3Name = 'pip3';
    npmExeName = 'npm';
    nodeExeName = 'node';
    goExeName = 'go';
    rustExeName = 'rustc';
    cargoExeName = 'cargo';
    javaExeName = 'java';
    javacExeName = 'javac';
    gitExeName = 'git';
    dockerExeName = 'docker';
    dockerComposeExeName = 'docker-compose';

    // Directory paths
    DEV_LANG_DIR = path.join(this.maxDrive, 'lang_compiler');
    APP_INSTALL_DIR = path.join(this.maxDrive, 'applications');

    appPlatformBinDir = path.join(this.maxDrive, 'lang_compiler', 'bin');

    localStaticHttpsApiUrl = 'https://api.example.com';

    defaultEncoding = 'utf8';
    tempDir = os.tmpdir();

    // System paths
    systemBinDirs = os.platform() === 'win32' ? [
        'C:\\Windows\\System32',
        'C:\\Program Files',
        'C:\\Program Files (x86)'
    ] : [
        '/usr/bin',
        '/usr/local/bin',
        '/opt/local/bin',
        '/bin'
    ];

    constructor() {
        // Ensure all directories exist
        const dirsToCreate = [
            this.localDir,
            this.DEV_LANG_DIR,
            this.APP_INSTALL_DIR,
            this.appPlatformBinDir,
            path.join(this.localDir, 'cache'),
            path.join(this.localDir, 'logs'),
            path.join(this.localDir, 'data'),
            path.join(this.localDir, 'config'),
            path.join(this.localDir, 'temp')
        ];

        for (const dir of dirsToCreate) {
            try {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`Created directory: ${dir}`);
                }
            } catch (error) {
                console.error(`Failed to create directory ${dir}:`, error);
            }
        }
    }

    getBaseConfig = () => {
        // Get all own properties except methods
        const config = {};
        for (const key of Object.getOwnPropertyNames(this)) {
            // Skip methods and internal properties
            if (typeof this[key] !== 'function' && !key.startsWith('_')) {
                config[key] = this[key];
            }
        }
        configTool.setConfig(config);
        return config;
    }

    setConfig = (key, value) => {
        configTool.setConfig(key, value);
    }

    getConfig = (key) => {
        return configTool.getConfig(key);
    }

    getAllKeys = () => {
        return configTool.getAllKeys();
    }

    getConfigAll = () => {
        return configTool.getConfigAll();
    }
}

module.exports = new GlobalConfig();
