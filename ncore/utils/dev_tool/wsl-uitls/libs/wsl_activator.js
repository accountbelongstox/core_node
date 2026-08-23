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

const os = require('os');
const fs = require('fs');
const path = require('path');
const { pipeExecCmd, execPowerShell, execCmd } = require('#@commander');
const logger = require('#@/ncore/basic/libs/logger.js');
const { getSettingsCenter } = require('#@global_vars');
const serviceContract = require('../../../../../config/service_contract');
const settingsScope = getSettingsCenter().scope('wsl');

class WSLActivator {
    constructor() {
        // Define absolute paths for all executables used
        this.dismPath = 'C:\\Windows\\System32\\dism.exe';
        this.msiexecPath = 'C:\\Windows\\System32\\msiexec.exe';
        this.curlPath = 'C:\\Windows\\System32\\curl.exe';
        this.powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
        this.virtualSwitchName = 'LAN';
        this.targetRepoUrl = serviceContract.url('http', serviceContract.serviceDomain('git_local'), serviceContract.port('git_http'), 'adminroot/core_node.git');

        // Define settings keys for tracking command execution
        this.SETTINGS_KEYS = {
            ADMIN_CHECK: 'admin_privileges_confirmed',
            WSL_ENABLED: 'features_enabled',
            HYPERV_ENABLED: 'hyperv_enabled',
            WSL_UPDATE_INSTALLED: 'update_installed',
            UBUNTU_INSTALLED: 'ubuntu_installed',
            WSL2_DEFAULT: 'wsl2_default_set'
        };
    }

    checkAdminPrivileges() {
        // First check environment variable cache
        const envAdminCheck = process.env.WSL_ADMIN_PRIVILEGES;
        if (envAdminCheck === 'true') {
            logger.info('Using cached admin privileges check: true');
            return true;
        }
        
        // Then check user settings
        if (settingsScope.get(this.SETTINGS_KEYS.ADMIN_CHECK)) {
            logger.info('Admin privileges were previously confirmed');
            // Set environment variable for future checks in this session
            process.env.WSL_ADMIN_PRIVILEGES = 'true';
            return true;
        }

        try {
            execCmd('fsutil dirty query %systemdrive%');
            // Cache the successful result
            process.env.WSL_ADMIN_PRIVILEGES = 'true';
            settingsScope.set(this.SETTINGS_KEYS.ADMIN_CHECK, true);
            return true;
        } catch (error) {
            process.env.WSL_ADMIN_PRIVILEGES = 'false';
            return false;
        }
    }

    checkWSL2Availability() {
        try {
            const version = os.release();
            const majorVersion = parseInt(version.split('.')[0], 10);
            return majorVersion >= 10;
        } catch (error) {
            console.error('Error checking WSL2 availability:', error);
            return false;
        }
    }

    checkHyperVAvailability() {
        try {
            const output = execCmd(`${this.dismPath} /online /get-features /format:table`);
            return output.includes('Microsoft-Hyper-V');
        } catch (error) {
            console.error('Error checking Hyper-V availability:', error);
            return false;
        }
    }

    isWSL2Installed() {
        try {
            const output = execCmd('wsl --list --verbose');
            return output.includes('2');
        } catch (error) {
            console.error('Error checking WSL2 installation status:', error);
            return false;
        }
    }

    isUbuntuInstalled() {
        try {
            const output = execCmd('wsl -l --quiet');
            return output.includes('Ubuntu');
        } catch (error) {
            console.error('Error checking Ubuntu installation status:', error);
            return false;
        }
    }

    enableWSL2() {
        if (settingsScope.get(this.SETTINGS_KEYS.WSL_ENABLED)) {
            logger.info('WSL2 features were previously enabled. Skipping...');
            return true;
        }

        try {
            logger.warn('Enabling WSL2...');
            execCmd(`${this.dismPath} /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart`);
            execCmd(`${this.dismPath} /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart`);
            settingsScope.set(this.SETTINGS_KEYS.WSL_ENABLED, true);
            logger.success('WSL2 features enabled successfully.');
            return true;
        } catch (error) {
            logger.error('Error enabling WSL2:', error);
            return false;
        }
    }

    enableHyperV() {
        if (settingsScope.get(this.SETTINGS_KEYS.HYPERV_ENABLED)) {
            logger.info('Hyper-V was previously enabled. Skipping...');
            return true;
        }

        try {
            logger.warn('Enabling Hyper-V...');
            execCmd(`${this.dismPath} /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart`);
            settingsScope.set(this.SETTINGS_KEYS.HYPERV_ENABLED, true);
            logger.success('Hyper-V enabled successfully.');
            return true;
        } catch (error) {
            logger.error('Error enabling Hyper-V:', error);
            return false;
        }
    }

    installWSL2Update() {
        if (settingsScope.get(this.SETTINGS_KEYS.WSL_UPDATE_INSTALLED)) {
            logger.info('WSL2 update was previously installed. Skipping...');
            return true;
        }

        const wslUpdateUrl = 'https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi';
        const downloadPath = path.join(os.tmpdir(), 'wsl_update_x64.msi');

        try {
            if (!fs.existsSync(downloadPath)) {
                logger.warn('Downloading WSL2 update package...');
                execCmd(`${this.curlPath} -L -o "${downloadPath}" "${wslUpdateUrl}"`);
            }

            logger.warn('Installing WSL2 update package...');
            execCmd(`${this.msiexecPath} /i "${downloadPath}" /quiet /norestart`);
            settingsScope.set(this.SETTINGS_KEYS.WSL_UPDATE_INSTALLED, true);
            logger.success('WSL2 update package installed successfully.');
            return true;
        } catch (error) {
            logger.error('Error installing WSL2 update package:', error);
            return false;
        }
    }

    installUbuntu() {
        if (settingsScope.get(this.SETTINGS_KEYS.UBUNTU_INSTALLED) || this.isUbuntuInstalled()) {
            logger.info('Ubuntu was previously installed. Skipping...');
            return true;
        }

        try {
            logger.warn('Installing Ubuntu...');
            const script = `
                Start-Process winget -ArgumentList "winget install --Id '9NZ3KLHXDJP5' --source msstore --accept-package-agreements --accept-source-agreements" -Wait -NoNewWindow
            `;
            execPowerShell(script);
            settingsScope.set(this.SETTINGS_KEYS.UBUNTU_INSTALLED, true);
            logger.success('Ubuntu installation completed successfully.');
            return true;
        } catch (error) {
            logger.error('Error installing Ubuntu:', error);
            return false;
        }
    }

    setDefaultWSL2() {
        if (settingsScope.get(this.SETTINGS_KEYS.WSL2_DEFAULT)) {
            logger.info('WSL2 was previously set as default. Skipping...');
            return true;
        }

        try {
            logger.warn('Setting WSL2 as default version...');
            execCmd('wsl --set-default-version 2');
            settingsScope.set(this.SETTINGS_KEYS.WSL2_DEFAULT, true);
            logger.success('WSL2 set as default version successfully.');
            return true;
        } catch (error) {
            logger.error('Error setting WSL2 as default version:', error);
            return false;
        }
    }

    // Additional methods omitted for brevity...

    start() {
        if (!this.checkAdminPrivileges()) {
            logger.error('This script requires administrator privileges. Please run this script as an administrator.');
            return;
        }

        logger.success('Admin privileges confirmed.');

        if (!this.checkWSL2Availability()) {
            logger.error('WSL2 is not available on this version of Windows.');
            return;
        }

        if (!this.checkHyperVAvailability()) {
            logger.error('Hyper-V is not available on this version of Windows.');
            return;
        }

        logger.info('Starting WSL2 setup...');

        if (this.isWSL2Installed()) {
            logger.info('WSL2 is already installed.');
            this.setDefaultWSL2();
        } else {
            logger.info('WSL2 is not installed. Installing...');
            this.enableHyperV();
            this.enableWSL2();
            this.setDefaultWSL2();
        }
        
        this.installWSL2Update();
        this.installUbuntu();

        logger.success('Configuration completed. Please restart WSL to apply changes.');
    }
}

module.exports = new WSLActivator();
