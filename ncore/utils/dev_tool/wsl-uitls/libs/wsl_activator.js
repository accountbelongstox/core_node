import Base from '#@/ncore/utils/dev_tool/lang_compiler_deploy/libs/base_utils.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class WSLActivator extends Base {
    constructor() {
        super();
        // Define absolute paths for all executables used
        this.dismPath = 'C:\\Windows\\System32\\dism.exe'; 
        this.msiexecPath = 'C:\\Windows\\System32\\msiexec.exe'; 
        this.curlPath = 'C:\\Windows\\System32\\curl.exe'; 
        this.powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
        this.virtualSwitchName = 'WSL External Switch';
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
            const output = this.execCmd(`${this.dismPath} /online /get-features /format:table`);
            return output.includes('Microsoft-Hyper-V');
        } catch (error) {
            console.error('Error checking Hyper-V availability:', error);
            return false;
        }
    }

    isWSL2Installed() {
        try {
            const output = this.execCmd('wsl --list --verbose');
            return output.includes('2');
        } catch (error) {
            console.error('Error checking WSL2 installation status:', error);
            return false;
        }
    }

    isUbuntuInstalled() {
        try {
            const output = this.execCmd('wsl -l --quiet');
            return output.includes('Ubuntu');
        } catch (error) {
            console.error('Error checking Ubuntu installation status:', error);
            return false;
        }
    }

    enableWSL2() {
        try {
            console.log('Enabling WSL2...');
            this.execCmd(`${this.dismPath} /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart`);
            this.execCmd(`${this.dismPath} /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart`);
            console.log('WSL2 enabled.');
        } catch (error) {
            console.error('Error enabling WSL2:', error);
        }
    }

    enableHyperV() {
        try {
            console.log('Enabling Hyper-V...');
            this.execCmd(`${this.dismPath} /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart`);
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
                this.execCmd(`${this.curlPath} -L -o "${downloadPath}" "${wslUpdateUrl}"`);
            }

            console.log('Installing WSL2 update package...');
            this.execCmd(`${this.msiexecPath} /i "${downloadPath}" /quiet /norestart`);
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
            this.execPowerShell(script);
            console.log('Ubuntu installation initiated.');
        } catch (error) {
            console.error('Error installing Ubuntu:', error);
        }
    }

    setDefaultWSL2() {
        try {
            console.log('Setting WSL2 as default version...');
            this.execCmd('wsl --set-default-version 2');
            console.log('WSL2 set as default version.');
        } catch (error) {
            console.error('Error setting WSL2 as default version:', error);
        }
    }

    getNetworkAdapters() {
        try {
            console.log('Getting network adapters...');
            const script = `Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -ExpandProperty Name`;
            const output = this.execPowerShell(script,true);
            console.log('Raw adapter output:', output);
            const adapters = output.trim().split('\n').map(name => name.trim()).filter(name => name.length > 0);
            console.log('Available network adapters:', adapters);
            return adapters;
        } catch (error) {
            console.error('Error getting network adapters:', error);
            throw error;
        }
    }

    deleteExistingVirtualSwitch() {
        try {
            const script = `
                $switch = Get-VMSwitch -Name '${this.virtualSwitchName}' -ErrorAction SilentlyContinue
                if ($switch) {
                    Remove-VMSwitch -Name '${this.virtualSwitchName}' -Force
                    Write-Output "Existing virtual switch '${this.virtualSwitchName}' deleted."
                }
            `;
            this.execPowerShell(script);
        } catch (error) {
            console.error(`Error deleting existing virtual switch "${this.virtualSwitchName}":`, error);
        }
    }

    createVirtualSwitch() {
        try {
            const adapters = this.getNetworkAdapters();
            if (adapters.length === 0) {
                console.error('No suitable network adapter found.');
                return;
            }

            this.deleteExistingVirtualSwitch();

            const adapterName = adapters[0]; // Select the first available adapter
            console.log(`Creating virtual switch "${this.virtualSwitchName}" with adapter "${adapterName}"...`);
            const script = `
                New-VMSwitch -Name '${this.virtualSwitchName}' -NetAdapterName '${adapterName}' -AllowManagementOS $true -SwitchType External
            `;
            this.execPowerShell(script);
            console.log(`Virtual switch "${this.virtualSwitchName}" created.`);
        } catch (error) {
            console.error(`Error creating virtual switch "${this.virtualSwitchName}":`, error);
        }
    }

    verifyVirtualSwitch() {
        try {
            const script = `Get-VMSwitch -Name '${this.virtualSwitchName}'`;
            const output = this.execPowerShell(script);
            return output.includes(this.virtualSwitchName);
        } catch (error) {
            console.error(`Error verifying virtual switch "${this.virtualSwitchName}":`, error);
            return false;
        }
    }

    updateWSLConfig() {
        const wslConfigPath = path.join(os.homedir(), '.wslconfig');
        const configContent = `
[wsl2]
user=root
networkingMode=bridged
vmSwitch=${this.virtualSwitchName}
localhostForwarding=true
        `;
        try {
            console.log('Updating .wslconfig...');
            fs.writeFileSync(wslConfigPath, configContent, { encoding: 'utf8', flag: 'w' });
            console.log('.wslconfig updated.');
        } catch (error) {
            console.error('Error updating .wslconfig:', error);
        }
    }

    startWSLAndSetupProject() {
        try {
            console.log('Starting WSL and setting up the project...');

            const script = `
                wsl -u root -e sh -c "
                cd /mnt/c
                mkdir -p www/programming
                cd www/programming
                if [ ! -d \\"script\\" ]; then
                    apt-get update
                    apt-get install -y git unzip
                    git clone ${this.targetRepoUrl} script
                else
                    echo \\"Directory 'script' already exists.\\"
                fi
                "
            `;
            this.execPowerShell(script);

            console.log('WSL started and project setup completed.');
        } catch (error) {
            console.error('Error starting WSL and setting up the project:', error);
        }
    }

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
            console.log('Please restart your computer and run this script again to complete the WSL2 installation.');
            return;
        }

        this.installWSL2Update();
        this.installUbuntu();

        this.createVirtualSwitch();

        if (!this.verifyVirtualSwitch()) {
            console.error(`Failed to create or verify virtual switch "${this.virtualSwitchName}".`);
            return;
        }

        this.updateWSLConfig();

        console.log('Configuration completed. Please restart WSL to apply changes.');

        // Start WSL and setup project
        this.startWSLAndSetupProject();
    }
}

export default new WSLActivator();