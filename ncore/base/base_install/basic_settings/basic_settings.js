import Base from '#@base';
import os from 'os';
import fs from 'fs';

class BasicSettings extends Base {
    constructor() {
        super();
    }

    checkCurrentSettings() {
        const hideFileExt = this.execPowerShell("Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'HideFileExt'");
        const showHidden = this.execPowerShell("Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'Hidden'");
        const showSuperHidden = this.execPowerShell("Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'ShowSuperHidden'");

        const isFileExtVisible = hideFileExt.includes('0');
        const isHiddenVisible = showHidden.includes('1');
        const isSuperHiddenVisible = showSuperHidden.includes('1');

        return { isFileExtVisible, isHiddenVisible, isSuperHiddenVisible };
    }

    checkAndSetExecutionPolicy() {
        const currentPolicy = this.execPowerShell("Get-ExecutionPolicy").trim();
        if (currentPolicy !== 'RemoteSigned') {
            console.log('Setting PowerShell execution policy to RemoteSigned...');
            this.execPowerShell("Set-ExecutionPolicy RemoteSigned -Force");
            console.log('PowerShell execution policy set to RemoteSigned.');
        } else {
            console.log('PowerShell execution policy is already set to RemoteSigned.');
        }
    }

    applySettings() {
        const settings = this.checkCurrentSettings();
        let settingsChanged = false;

        if (!settings.isFileExtVisible) {
            this.execPowerShell("Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'HideFileExt' -Value 0");
            settingsChanged = true;
        }

        if (!settings.isHiddenVisible) {
            this.execPowerShell("Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'Hidden' -Value 1");
            settingsChanged = true;
        }

        if (!settings.isSuperHiddenVisible) {
            this.execPowerShell("Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'ShowSuperHidden' -Value 1");
            settingsChanged = true;
        }

        if (settingsChanged) {
            console.log('Settings applied successfully. Restarting Windows Explorer...');
            this.execPowerShell("Stop-Process -Name explorer -Force");
            this.execPowerShell("Start-Process explorer");
        } else {
            console.log('Settings are already applied.');
        }
    }

    start() {
        console.log('Starting to apply basic settings...');
        this.checkAndSetExecutionPolicy();
        this.applySettings();
    }
}

export default new BasicSettings();
