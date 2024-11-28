import Base from '#@/ncore/utils/dev_tool/lang_compiler_deploy/libs/base_utils.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

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
}

export default new WSLUbuntuConfig();




    // 添加方法,启动wsl 时,设置为root默认启动

    // 添加方法,启动ubuntu时,自动执行一段ubuntu内的脚本(将startWSLAndSetupProject方法搬过来)

    // 添加一段脚本,自动写入wsl ubuntu,启动ubuntu时自动执行,
    //                 脚本功能为,
    //                 1:如果没有/www目录,自动创建, 
    //                 2:自动绑定/www/programin 目录到 /mnt/d/programing 使用bind绑写并写入到fstab,
    //                 3:如果没有安装git 等基础软件,自动安装
    //                 4:如果没有安装bt,提示需要clone安装脚本进行安装,如果已经安装bt,启动bt
    //                 5:如果没有安装docker,提示,如果已安装,则启动
    //                 6:如果/mnt/d/programing/node_core目录不存在,则使用git自动克隆到该目录,并自动将dd.sh设置为可执行,同时判断dd.sh是否安装过(根据docker和bt来判断)
    //                 (以上脚本已经完成在 apps/deploy/shells/ubuntu_22/local/stated/started.sh)
    
                    
    // 添加一个功能,设置ubuntu的源为华为
                    
    