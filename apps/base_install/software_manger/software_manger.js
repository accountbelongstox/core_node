
this.powershellPath = os.platform() === 'win32' ? this.findPowerShellPath() : null;
}

findPowerShellPath() {
    const standardPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    const corePath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';

    if (fs.existsSync(corePath)) {
        return corePath;
    } else if (fs.existsSync(standardPath)) {
        return standardPath;
    } else {
        console.error('PowerShell not found. Please ensure PowerShell is installed.');
        return null;
    }
}

installChoco() {
    console.log("Installing Chocolatey...");
    try {
        execSync("powershell -Command 'Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))'", { stdio: 'inherit' });
        console.log("Chocolatey installation successful.");
    } catch (e) {
        console.error(`Error installing Chocolatey: ${e}`);
    }
}


hasChocoInstalled() {
    try {
        execSync('choco --version', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}