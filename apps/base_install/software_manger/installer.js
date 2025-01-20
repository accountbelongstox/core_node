
installCommandBySystem(installCommand) {
    if (this.isWindows()) {
        console.log("Windows system detected. Installing with Chocolatey (choco) command.");
        this.installOnWindows(installCommand);
    } else if (this.isCentos()) {
        console.log("CentOS system detected. Installing with CentOS command.");
        this.installOnCentos(installCommand);
    } else if (this.isUbuntu()) {
        console.log("Ubuntu system detected. Installing with Ubuntu command.");
        this.installOnUbuntu(installCommand);
    } else if (this.isDebian()) {
        console.log("Debian system detected. Installing with Debian command.");
        this.installOnDebian(installCommand);
    } else {
        console.log("Unsupported system.");
    }
}

installOnWindows(installCommand) {
    try {
        execSync(`choco install ${installCommand}`, { stdio: 'inherit' });
        console.log("Installation successful with Chocolatey.");
    } catch (e) {
        console.error(`Error installing on Windows with Chocolatey: ${e}`);
    }
}



installOnCentos(installCommand) {
    try {
        execSync(`sudo yum install -y ${installCommand}`, { stdio: 'inherit' });
        console.log("Installation successful on CentOS.");
    } catch (e) {
        console.error(`Error installing on CentOS: ${e}`);
    }
}

installOnUbuntu(installCommand) {
    try {
        execSync(`sudo apt-get install -y ${installCommand}`, { stdio: 'inherit' });
        console.log("Installation successful on Ubuntu.");
    } catch (e) {
        console.error(`Error installing on Ubuntu: ${e}`);
    }
}

installOnDebian(installCommand) {
    try {
        execSync(`sudo apt-get install -y ${installCommand}`, { stdio: 'inherit' });
        console.log("Installation successful on Debian.");
    } catch (e) {
        console.error(`Error installing on Debian: ${e}`);
    }
}
