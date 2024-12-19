const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { pipeExecCmd, execPowerShell, execCmd } = require('#@utils_commander');

class WSLActivator {
    constructor() {
        // Define absolute paths for all executables used
        this.dismPath = 'C:\\Windows\\System32\\dism.exe';
        this.msiexecPath = 'C:\\Windows\\System32\\msiexec.exe';
        this.curlPath = 'C:\\Windows\\System32\\curl.exe';
        this.powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
        this.virtualSwitchName = 'LAN';
        this.targetRepoUrl = 'http://git.local.12gm.com:5021/adminroot/core_node.git';
    }

    checkAdminPrivileges() {
        try {
            execSync('fsutil dirty query %systemdrive%');
            return true;
        } catch (error) {
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
        try {
            console.log('Enabling WSL2...');
            execCmd(`${this.dismPath} /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart`);
            execCmd(`${this.dismPath} /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart`);
            console.log('WSL2 enabled.');
        } catch (error) {
            console.error('Error enabling WSL2:', error);
        }
    }

    enableHyperV() {
        try {
            console.log('Enabling Hyper-V...');
            execCmd(`${this.dismPath} /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart`);
            console.log('Hyper-V enabled.');
        } catch (error) {
            console.error('Error enabling Hyper-V:', error);
        }
    }

    installWSL2Update() {
        const wslUpdateUrl = 'https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi';
        const downloadPath = path.join(os.tmpdir(), 'wsl_update_x64.msi');

        try {
            if (!fs.existsSync(downloadPath)) {
                console.log('Downloading WSL2 update package...');
                execCmd(`${this.curlPath} -L -o "${downloadPath}" "${wslUpdateUrl}"`);
            }

            console.log('Installing WSL2 update package...');
            execCmd(`${this.msiexecPath} /i "${downloadPath}" /quiet /norestart`);
            console.log('WSL2 update package installed.');
        } catch (error) {
            console.error('Error installing WSL2 update package:', error);
        }
    }

    installUbuntu() {
        if (this.isUbuntuInstalled()) {
            console.log('Ubuntu is already installed.');
            return;
        }

        try {
            console.log('Installing Ubuntu...');
            const script = `
                Start-Process winget -ArgumentList "winget install --Id '9NZ3KLHXDJP5' --source msstore --accept-package-agreements --accept-source-agreements" -Wait -NoNewWindow
            `;
            execPowerShell(script);
            console.log('Ubuntu installation initiated.');
        } catch (error) {
            console.error('Error installing Ubuntu:', error);
        }
    }

    setDefaultWSL2() {
        try {
            console.log('Setting WSL2 as default version...');
            execCmd('wsl --set-default-version 2');
            console.log('WSL2 set as default version.');
        } catch (error) {
            console.error('Error setting WSL2 as default version:', error);
        }
    }

    // Additional methods omitted for brevity...

    start() {
        if (!this.checkAdminPrivileges()) {
            console.error('This script requires administrator privileges. Please run this script as an administrator.');
            return;
        }

        console.log('Admin privileges confirmed.');

        if (!this.checkWSL2Availability()) {
            console.error('WSL2 is not available on this version of Windows.');
            return;
        }

        if (!this.checkHyperVAvailability()) {
            console.error('Hyper-V is not available on this version of Windows.');
            return;
        }

        console.log('Starting WSL2 setup...');

        if (this.isWSL2Installed()) {
            console.log('WSL2 is already installed.');
            this.setDefaultWSL2();
        } else {
            this.enableHyperV();
            this.enableWSL2();
            this.setDefaultWSL2();
            console.log('Please restart your computer and run this script again to complete the WSL2 installation.');
            return;
        }

        this.installWSL2Update();
        this.installUbuntu();

        console.log('Configuration completed. Please restart WSL to apply changes.');
    }
}

module.exports = new WSLActivator();
