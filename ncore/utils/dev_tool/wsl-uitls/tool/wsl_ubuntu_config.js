const Base = require('#@/ncore/utils/dev_tool/lang_compiler_deploy/libs/base_utils.js');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');

    class WSLUbuntuConfig extends Base {
        constructor() {
            super();
            this.scriptPath = '~/apps/deploy/shells/ubuntu_22/local/stated/started.sh';
        }

        setWSLDefaultUserToRoot() {
            if (!this.isWindows()) {
                this.warn('This configuration is only applicable on Windows.');
                return false;
            }

            const homeDir = os.homedir();
            const configFilePath = path.join(homeDir, '.wslconfig');

            let fileContent = '';
            if (this.isFile(configFilePath)) {
                fileContent = fs.readFileSync(configFilePath, 'utf-8');
            }

            const sectionName = 'user';
            const key = 'default';
            const value = 'root';

            let sectionPattern = new RegExp(`^\\[${sectionName}\\]`, 'm');
            let keyPattern = new RegExp(`^${key}=.*$`, 'm');

            if (sectionPattern.test(fileContent)) {
                if (keyPattern.test(fileContent)) {
                    fileContent = fileContent.replace(keyPattern, `${key}=${value}`);
                } else {
                    const sectionIndex = fileContent.indexOf(`[${sectionName}]`);
                    const nextSectionIndex = fileContent.indexOf('[', sectionIndex + 1);
                    const insertPosition = nextSectionIndex === -1 ? fileContent.length : nextSectionIndex;
                    fileContent = fileContent.slice(0, insertPosition) + `${key}=${value}\n` + fileContent.slice(insertPosition);
                }
            } else {
                fileContent += `\n[${sectionName}]\n${key}=${value}\n`;
            }

            try {
                fs.writeFileSync(configFilePath, fileContent, 'utf-8');
                this.success(`WSL default user set to root in .wslconfig.`);
                return true;
            } catch (error) {
                this.error('Error writing WSL config file:', error);
                return false;
            }
        }

        addScriptToBashrc() {
            const homeDir = os.homedir();
            const bashrcPath = path.join(homeDir, '.bashrc');
            const scriptPath = this.scriptPath.replace('~', homeDir); // 替换 `~` 为实际的用户主目录路径

            const command = `bash ${scriptPath}`;

            try {
                let bashrcContent = '';
                if (this.isFile(bashrcPath)) {
                    bashrcContent = fs.readFileSync(bashrcPath, 'utf-8');
                }

                if (!bashrcContent.includes(command)) {
                    fs.appendFileSync(bashrcPath, `\n# Run the startup script\n${command}\n`, 'utf-8');
                    this.success('Startup script added to .bashrc.');
                } else {
                    this.warn('Startup script is already present in .bashrc.');
                }
            } catch (error) {
                this.error('Error updating .bashrc:', error);
            }
        }

        startWSLAsRootAndSetup() {
            if (this.setWSLDefaultUserToRoot()) {
                this.addScriptToBashrc();
                this.startWSLAndSetupProject();
            } else {
                console.error('Failed to set WSL default user to root. Aborting setup.');
            }
        }

        startWSLAndSetupProject() {
            try {
                console.log('Starting WSL and setting up the project...');

                const script = `
                    wsl -u root -e sh -c '
                    cd /mnt/c
                    mkdir -p /www/programming
                    cd /www/programming
                    if [ ! -d \\"script\\" ]; then
                        apt-get update
                        apt-get install -y git unzip
                        git clone ${this.targetRepoUrl} script
                    else
                        echo \\"Directory 'script' already exists.\\"
                    fi
                    '
                `;
                this.execPowerShell(script);

                console.log('WSL started and project setup completed.');
            } catch (error) {
                console.error('Error starting WSL and setting up the project:', error);
            }
        }
    }

    module.exports = new WSLUbuntuConfig();