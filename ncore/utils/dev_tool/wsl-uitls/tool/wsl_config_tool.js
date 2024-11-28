import Base from '#@/ncore/utils/dev_tool/lang_compiler_deploy/libs/base_utils.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

class WSLConfigTool extends Base {
    constructor() {
        super();
    }

    isWSLConfigExists() {
        if (this.isWindows()) {
            const homeDir = os.homedir();
            const configFilePath = path.join(homeDir, '.wslconfig');

            try {
                return fs.existsSync(configFilePath);
            } catch (error) {
                this.error('Error checking WSL config file:', error);
                return false;
            }
        } else {
            this.warn('WSL config file check is only applicable on Windows.');
            return false;
        }
    }

    isSectionExists(sectionName) {
        if (!this.isWSLConfigExists()) {
            this.warn('.wslconfig file does not exist.');
            return false;
        }

        const homeDir = os.homedir();
        const configFilePath = path.join(homeDir, '.wslconfig');

        try {
            const fileContent = fs.readFileSync(configFilePath, 'utf-8');
            const sectionPattern = new RegExp(`^\\[${sectionName}\\]`, 'm');
            return sectionPattern.test(fileContent);
        } catch (error) {
            this.error('Error reading WSL config file:', error);
            return false;
        }
    }

    isKeyInSection(sectionName, key) {
        if (!this.isSectionExists(sectionName)) {
            this.warn(`Section [${sectionName}] does not exist.`);
            return false;
        }

        const homeDir = os.homedir();
        const configFilePath = path.join(homeDir, '.wslconfig');

        try {
            const fileContent = fs.readFileSync(configFilePath, 'utf-8');
            const sectionPattern = new RegExp(`^\\[${sectionName}\\][\\s\\S]*?^${key}=`, 'm');
            return sectionPattern.test(fileContent);
        } catch (error) {
            this.error(`Error checking key "${key}" in section [${sectionName}]:`, error);
            return false;
        }
    }
}

export default new WSLConfigTool();

// 可以使用以下代码来检查 .wslconfig 文件中是否存在特定的节
// const wslConfigTool = new WSLConfigTool();
// const sectionExists = wslConfigTool.isSectionExists('wsl2');
// console.log(`Section [wsl2] exists: ${sectionExists}`);


// 可以使用以下代码来检查 .wslconfig 文件中指定大项下是否存在特定的小项（key）：
// const wslConfigTool = new WSLConfigTool();
// const keyExists = wslConfigTool.isKeyInSection('wsl2', 'networkingMode');
// console.log(`Key "networkingMode" in section [wsl2] exists: ${keyExists}`);


// 增删改查使用方法：
// const wslConfigTool = new WSLConfigTool();
// // 增加或更新一个键值对
// wslConfigTool.addOrUpdateKeyInSection('wsl2', 'networkingMode', 'bridged');
// // 删除一个键值对
// wslConfigTool.deleteKeyInSection('wsl2', 'networkingMode');
// // 获取一个键的值
// const value = wslConfigTool.getKeyFromSection('wsl2', 'localhostForwarding');
// console.log(`localhostForwarding: ${value}`);

    // 添加一个功能,判断wslconfig文件是否存在
    // 添加一个功能,判断wslconfig文件中的一个大项是否存在 [xxxx]
    // 添加一个功能,判断wslconfig文件中的一个小项是否存在 [xxxx] 下面的key=xxx 参数(`大项名称`,`小项 key`)
    // 完成小项的增\删\改\查
    
    