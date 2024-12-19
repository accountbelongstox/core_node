import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GlobalConfig {
    // Initialize maxDrive and homeDir
    maxDrive = os.platform() === 'win32' ? 'D:' : '/usr';
    homeDir = os.homedir();
    
    // Local directory for application data
    localDir = os.platform() === 'win32' 
        ? path.join(this.homeDir, '.core_node')
        : path.join(this.homeDir, '.local', 'share', 'core_node');
    
    // Executable paths
    pythonExe = 'python';
    pythonExe3 = 'python3';
    pipExe = 'pip';
    pipExe3 = 'pip3';
    npmExe = 'npm';
    nodeExe = 'node';
    goExe = 'go';
    rustExe = 'rustc';
    cargoExe = 'cargo';
    javaExe = 'java';
    javacExe = 'javac';
    gitExe = 'git';
    dockerExe = 'docker';
    dockerComposeExe = 'docker-compose';

    // Directory paths
    DEV_LANG_DIR = path.join(this.maxDrive, 'lang_compiler');
    APP_INSTALL_DIR = path.join(this.maxDrive, 'applications');
    APP_DATA_DIR = path.join(this.homeDir, '.local', 'share');
    APP_CACHE_DIR = path.join(this.homeDir, '.cache');
    APP_CONFIG_DIR = path.join(this.homeDir, '.config');
    
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
            this.APP_DATA_DIR,
            this.APP_CACHE_DIR,
            this.APP_CONFIG_DIR,
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
                // Don't throw error, continue with other directories
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
        return config;
    }
}

export default new GlobalConfig();
