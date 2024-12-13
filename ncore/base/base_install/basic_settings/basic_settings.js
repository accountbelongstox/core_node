import os from 'os';
import fs from 'fs';
import {execPowerShell} from '#@utils_commander';

class BasicSettings  {
    constructor() {
    }

    checkCurrentSettings() {
        const hideFileExt = execPowerShell("Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'HideFileExt'");
        const showHidden = execPowerShell("Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'Hidden'");
        const showSuperHidden = execPowerShell("Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'ShowSuperHidden'");

        const isFileExtVisible = hideFileExt.includes('0');
        const isHiddenVisible = showHidden.includes('1');
        const isSuperHiddenVisible = showSuperHidden.includes('1');

        return { isFileExtVisible, isHiddenVisible, isSuperHiddenVisible };
    }

    checkAndSetExecutionPolicy() {
        const currentPolicy = execPowerShell("Get-ExecutionPolicy").trim();
        if (currentPolicy !== 'RemoteSigned') {
            console.log('Setting PowerShell execution policy to RemoteSigned...');
            execPowerShell("Set-ExecutionPolicy RemoteSigned -Force");
            console.log('PowerShell execution policy set to RemoteSigned.');
        } else {
            console.log('PowerShell execution policy is already set to RemoteSigned.');
        }
    }

    applySettings() {
        const settings = this.checkCurrentSettings();
        let settingsChanged = false;

        if (!settings.isFileExtVisible) {
            execPowerShell("Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'HideFileExt' -Value 0");
            settingsChanged = true;
        }

        if (!settings.isHiddenVisible) {
            execPowerShell("Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'Hidden' -Value 1");
            settingsChanged = true;
        }

        if (!settings.isSuperHiddenVisible) {
            execPowerShell("Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'ShowSuperHidden' -Value 1");
            settingsChanged = true;
        }

        if (settingsChanged) {
            console.log('Settings applied successfully. Restarting Windows Explorer...');
            execPowerShell("Stop-Process -Name explorer -Force");
            execPowerShell("Start-Process explorer");
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
