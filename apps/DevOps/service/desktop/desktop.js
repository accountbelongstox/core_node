'use strict';

const { Service } = require('@egg/ee-core');
const Utils = require('@egg/ee-core/utils');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const fetch = require('node-fetch');
const child_process = require('child_process');

// const software = {
//     path: 'C:\\Program Files\\MySoftware\\mysoftware.exe',
//     target: 'C:\\Program Files\\MySoftware',
//     installation_method: 'manual',
//     id: '12345',
//     basename: 'mysoftware',
//     winget_id: 'mysoftware-id',
//     source_internet: 'http://example.com/mysoftware',
//     source_local: 'C:\\SoftwareBackups\\mysoftware',
//     source_winget: 'mysoftware',
//     default_icon: 'default-icon-path',
//     default_install_dir: 'C:\\Program Files',
//     install_type: 'regular',
// };
/*
{
    "setting_type":{
        "setting_group":{
            "api_url":"",
            "default_install_dir":"",
            "backup_path":"",
        }
    }
}

*/



class DesktopService extends Service {
    constructor(ctx) {
        super(ctx);
    }

    // 方法（1）初始化一个配置对象config，包含：default_install_dir、API地址、软件备份路径、用户登陆地址，并返回给this属性
    initConfig() {
        // 初始化一个配置对象
        const config = {
            default_install_dir: 'D:/applications',
            api_url: 'https://example.com/api',
            backup_path: 'D:/applications_bak',
            login_url: 'https://example.com/login',
        };
        // 设置 this.app.config 属性
        this.app.config = config;
    }

    // 方法（2）根据API拼接一个后缀地址“config/soft_group.json”，获取 软件分组URL（返回一个JSON|请进行转换）
    async getSoftwareGroup() {
        // 构建软件分组URL
        const apiUrl = `${this.app.config.api_url}/config/soft_group.json`;
        try {
            // 使用适当的方法（例如axios或node-fetch）从 apiUrl 获取软件分组数据
            const response = await fetch(apiUrl);
            if (response.status === 200) {
                // 解析 JSON 数据（假设 JSON 数据可用）
                const softwareGroup = await response.json();
                // 在这里可以进行对数据的处理或转换
                return softwareGroup;
            } else {
                throw new Error('Failed to retrieve software group data.');
            }
        } catch (error) {
            throw error;
        }
    }

    // 方法（3）根据API拼接一个后缀地址“config/soft_icons.json”，获取 软件图标URL（返回一个JSON|请进行转换）
    async getSoftwareIcons() {
        // 构建软件图标URL
        const apiUrl = `${this.app.config.api_url}/config/soft_icons.json`;
        try {
            // 使用适当的方法（例如axios或node-fetch）从 apiUrl 获取软件图标数据
            const response = await fetch(apiUrl);
            if (response.status === 200) {
                // 解析 JSON 数据（假设 JSON 数据可用）
                const softwareIcons = await response.json();
                // 在这里可以进行对数据的处理或转换
                return softwareIcons;
            } else {
                throw new Error('Failed to retrieve software icon data.');
            }
        } catch (error) {
            throw error;
        }
    }

    // 方法（4）根据API拼接一个后缀地址“config/soft_all.json”，获取 软件大全URL（返回一个JSON|请进行转换）
    async getSoftwareList() {
        // 构建软件大全URL
        const apiUrl = `${this.app.config.api_url}/config/soft_all.json`;
        try {
            // 使用适当的方法（例如axios或node-fetch）从 apiUrl 获取软件大全数据
            const response = await fetch(apiUrl);
            if (response.status === 200) {
                // 解析 JSON 数据（假设 JSON 数据可用）
                const softwareList = await response.json();
                // 在这里可以进行对数据的处理或转换
                return softwareList;
            } else {
                throw new Error('Failed to retrieve software list data.');
            }
        } catch (error) {
            throw error;
        }
    }

    // 方法（5）对两个JSON进行递归对比，如果完全相同则返回TRUE
    compareJSON(objA, objB) {
        // 检查 objA 和 objB 是否为对象
        if (typeof objA !== 'object' || typeof objB !== 'object') {
            return false;
        }
        // 获取 objA 和 objB 的所有键
        const keysA = Object.keys(objA);
        const keysB = Object.keys(objB);
        // 检查键的数量是否相同
        if (keysA.length !== keysB.length) {
            return false;
        }
        // 逐个比较键和值
        for (const key of keysA) {
            // 递归比较子对象
            if (typeof objA[key] === 'object' && typeof objB[key] === 'object') {
                if (!this.compareJSON(objA[key], objB[key])) {
                    return false;
                }
            } else if (objA[key] !== objB[key]) {
                return false;
            }
        }//有误 需要双层for循环才能取到iconbase64
        return true; // 如果所有键和值都相同，则返回true
    }

    // 方法（6）合并两个JSON，如果完全相同则不用合并，并返回合并后的JSON
    mergeJSON(objA, objB) {
        if (this.compareJSON(objA, objB)) {
            return objA; // 如果两个JSON完全相同，不用合并，直接返回其中一个
        }
        // 使用深度合并将objB的内容合并到objA中
        return Object.assign({}, objA, objB);
    }

    // 方法（7）从本地数据目录中读取本地的软件分组JSON，如果没有则返回空
    readLocalSoftwareGroups() {
        const dataDir = path.join(this.app.config.appUserDataDir, 'data');
        const softwareGroupsFilePath = path.join(dataDir, 'software_groups.json');
        try {
            if (fs.existsSync(softwareGroupsFilePath)) {
                const softwareGroupsData = fs.readFileSync(softwareGroupsFilePath, 'utf8');
                return JSON.parse(softwareGroupsData);
            }
        } catch (error) {
            // 处理读取文件时可能发生的错误
            console.error('读取本地软件分组时出错:', error);
        }
        return {}; // 如果文件不存在或读取出错，返回空对象
    }

    // 方法（8）从本地数据目录中读取本地的软件图标JSON，如果没有则向远程请求，并更新到本地，同时返回该JSON，如果有，则异步读取远程合并更新（返回前不等待）
    async readAndUpdateLocalSoftwareIcons() {
        const dataDir = path.join(this.app.config.appUserDataDir, 'data');
        const softwareIconsFilePath = path.join(dataDir, 'software_icons.json');
        let localSoftwareIcons = {};
        try {
            if (fs.existsSync(softwareIconsFilePath)) {
                // 如果本地软件图标文件存在，同步读取它
                const softwareIconsData = fs.readFileSync(softwareIconsFilePath, 'utf8');
                localSoftwareIcons = JSON.parse(softwareIconsData);
            }
        } catch (error) {
            console.error('读取本地软件图标时出错:', error);
        }
        try {
            // 请求远程软件图标的JSON数据（用实际的 'REMOTE_ICON_JSON_URL' 替代）
            const response = await axios.get('REMOTE_ICON_JSON_URL');
            if (response.status === 200) {
                // 如果远程请求成功，更新本地软件图标数据
                localSoftwareIcons = { ...localSoftwareIcons, ...response.data };
                // 异步将更新后的图标JSON写回本地文件
                fs.writeFile(softwareIconsFilePath, JSON.stringify(localSoftwareIcons), (writeError) => {
                    if (writeError) {
                        console.error('写入本地软件图标时出错:', writeError);
                    }
                });
            }
        } catch (requestError) {
            console.error('请求远程软件图标时出错:', requestError);
        }
        return localSoftwareIcons;
    }

    // 方法（9）将远程软件分组URL读取，并与本地软件分组JSON进行对比合并，并更新为本地软件分组（不存在则创建）
    async updateLocalSoftwareGroups() {
        const dataDir = path.join(this.app.config.appUserDataDir, 'data');
        const softwareGroupsFilePath = path.join(dataDir, 'software_groups.json');
        let localSoftwareGroups = {};
        try {
            if (fs.existsSync(softwareGroupsFilePath)) {
                // 如果本地软件分组文件存在，同步读取它
                const softwareGroupsData = fs.readFileSync(softwareGroupsFilePath, 'utf8');
                localSoftwareGroups = JSON.parse(softwareGroupsData);
            }
        } catch (error) {
            console.error('读取本地软件分组时出错:', error);
        }
        try {
            // 请求远程软件分组的JSON数据（使用提供的 URL）
            const response = await axios.get(remoteSoftwareGroupsURL);
            if (response.status === 200) {
                const remoteSoftwareGroups = response.data;
                // 将远程软件分组合并到本地软件分组中
                Object.keys(remoteSoftwareGroups).forEach((groupName) => {
                    localSoftwareGroups[groupName] = localSoftwareGroups[groupName] || {};
                    const remoteGroup = remoteSoftwareGroups[groupName];
                    localSoftwareGroups[groupName] = { ...localSoftwareGroups[groupName], ...remoteGroup };
                });
                // 异步将更新后的软件分组JSON写回本地文件
                fs.writeFile(softwareGroupsFilePath, JSON.stringify(localSoftwareGroups), (writeError) => {
                    if (writeError) {
                        console.error('写入本地软件分组时出错:', writeError);
                    }
                });
            }
        } catch (requestError) {
            console.error('请求远程软件分组时出错:', requestError);
        }
    }

    // 方法（10）根据远程和本地合并后的软件分组进行解析
    parseSoftwareGroups(mergedSoftwareGroups) {
        const parsedSoftwareGroups = {};
        // 遍历合并后的软件分组中的每个分组
        for (const groupName in mergedSoftwareGroups) {
            const group = mergedSoftwareGroups[groupName];
            parsedSoftwareGroups[groupName] = {};
            // 遍历分组中的每个软件对象
            for (const softwareName in group) {
                const softwareObject = group[softwareName];
                // 检查是否提供了basename和target
                if (softwareObject.basename && softwareObject.target) {
                    // 将软件对象添加到解析后的分组
                    parsedSoftwareGroups[groupName][softwareName] = softwareObject;
                    // 检查本地是否存在目标文件
                    const targetPath = softwareObject.target;
                    if (fs.existsSync(targetPath)) {
                        softwareObject.localFileExists = true;
                    } else {
                        softwareObject.localFileExists = false;
                    }
                }
            }
        }
        return parsedSoftwareGroups;
    }
    // 方法（11）下载一个文件方法（URL）
    async downloadFile(url) {
        try {
            // 提取文件名
            const filename = path.basename(url);
            // 构建本地保存路径
            const localFilePath = path.join(this.app.config.userHome, 'temp', filename);
            // 如果本地文件已存在，检查文件大小是否匹配，不匹配则重新下载
            if (fs.existsSync(localFilePath)) {
                const localFileSize = fs.statSync(localFilePath).size;
                const response = await fetch(url);
                const remoteFileSize = parseInt(response.headers.get('content-length'), 10);
                if (localFileSize !== remoteFileSize) {
                    // 文件大小不匹配，重新下载
                    fs.unlinkSync(localFilePath);
                    const fileStream = fs.createWriteStream(localFilePath);
                    const responseStream = response.body;
                    await new Promise((resolve, reject) => {
                        responseStream.pipe(fileStream);
                        responseStream.on('end', () => {
                            resolve();
                        });
                        responseStream.on('error', (error) => {
                            reject(error);
                        });
                    });
                }
            } else {
                // 本地文件不存在，直接下载
                const response = await fetch(url);
                const fileStream = fs.createWriteStream(localFilePath);
                const responseStream = response.body;
                await new Promise((resolve, reject) => {
                    responseStream.pipe(fileStream);
                    responseStream.on('end', () => {
                        resolve();
                    });
                    responseStream.on('error', (error) => {
                        reject(error);
                    });
                });
            }
            return localFilePath;
        } catch (error) {
            throw new Error(`文件下载失败：${error.message}`);
        }
    }
    // 方法（12）执行一个软件
    async executeSoftware(software) {
        // 检查参数是否完整
        if (!software.path || !software.target || !software.installation_method) {
            throw new Error('执行软件所需的参数不完整');
        }
        // 检查本地是否存在目标文件
        if (fs.existsSync(software.target)) {
            // 本地文件已存在，直接打开
            child_process.exec(`explorer "${software.target}"`);
        } else {
            // 本地文件不存在，调用安装方法
            if (software.installation_method === 'winget') {
                // 使用winget安装
                if (!software.winget_id) {
                    throw new Error('winget安装所需的参数不完整');
                }
                const installDir = software.default_install_dir || this.app.config.default_install_dir;
                const installCommand = `winget install --id ${software.winget_id} --location "${installDir}"`;
                child_process.exec(installCommand);
            } else if (software.installation_method === 'unzip') {
                // 使用解压安装
                if (!software.basename || !software.source_internet) {
                    throw new Error('解压安装所需的参数不完整');
                }
                const installDir = software.default_install_dir || this.app.config.default_install_dir;
                const installPath = path.join(installDir, software.basename);
                // 检查本地是否已经下载过安装文件
                if (!fs.existsSync(installPath)) {
                    // 文件不存在，下载文件
                    const fileUrl = `${this.app.config.API}/${software.source_internet}`;
                    const localFilePath = await this.downloadFile(fileUrl);
                    // 解压安装
                    this.unzipFile(localFilePath, installDir);
                }
            } else {
                throw new Error('不支持的安装方法');
            }
        }
    }

    async installSoftware(software) {
        if (!software.path || !software.target || !software.installation_method) {
            throw new Error('安装软件所需的参数不完整');
        }
        if (software.installation_method === 'winget') {
            if (!software.winget_id) {
                throw new Error('winget安装所需的参数不完整');
            }
            const installDir = software.default_install_dir || this.app.config.default_install_dir;
            const installCommand = `winget install --id ${software.winget_id} --location "${installDir}"`;
            child_process.exec(installCommand);
        } else if (software.installation_method === 'unzip') {
            if (!software.basename || !software.source_internet) {
                throw new Error('解压安装所需的参数不完整');
            }
            const installDir = software.default_install_dir || this.app.config.default_install_dir;
            const installPath = path.join(installDir, software.basename);
            if (!fs.existsSync(installPath)) {
                const fileUrl = `${this.app.config.API}/${software.source_internet}`;
                const localFilePath = await this.downloadFile(fileUrl);
                this.unzipFile(localFilePath, installDir);
            }
        } else {
            throw new Error('不支持的安装方法');
        }
    }

    // 方法（14）winget安装方法
    async installWithWinget(software) {
        // 检查参数是否完整
        if (!software.winget_id || !software.installation_method) {
            throw new Error('winget安装所需的参数不完整');
        }
        const installDir = software.default_install_dir || this.app.config.default_install_dir;
        // 使用winget安装
        const installCommand = `winget install --id ${software.winget_id} --location "${installDir}"`;
        child_process.exec(installCommand);
    }

    // 方法（15）解压安装方法
    async installByUnpacking(software) {
        // 检查参数是否完整
        if (!software.basename || !software.installation_method) {
            throw new Error('解压安装所需的参数不完整');
        }
        const installDir = software.default_install_dir || this.app.config.default_install_dir;
        const basename = software.basename;
        const sourceInternet = software.source_internet;
        // 拼接下载URL
        const downloadUrl = `${sourceInternet}/applications/${basename}.zip`;
        // 获取目标路径
        const targetPath = path.join(installDir, basename);
        // 如果目标路径已存在，就不重复安装
        if (Utils.fs.existsSync(targetPath)) {
            console.log(`软件 ${basename} 已经安装在 ${targetPath}`);
            return;
        }
        // 下载并解压文件
        const tmpDir = this.app.config.HOME || this.app.config.userHome;
        const tmpFilePath = path.join(tmpDir, `${basename}.zip`);
        // 下载文件
        await this.downloadFile(downloadUrl, tmpFilePath);
        // 解压文件
        this.unzipFile(tmpFilePath, installDir);
    }
    // 解压文件方法
    unzipFile(filePath, targetDir) {
        // 使用 child_process 来执行7z命令进行解压
        const command = `7z x -o${targetDir} ${filePath}`;
        try {
            child_process.execSync(command);
            console.log(`文件解压成功: ${targetDir}`);
        } catch (error) {
            console.error(`文件解压失败: ${error}`);
        }
    }

    // 方法（16）备份软件方法
    async backupSoftware(software) {
        // 检查参数是否完整
        if (!software.target) {
            throw new Error('备份所需的参数不完整');
        }
        const targetPath = software.target;
        // 获取备份文件名
        const backupName = `${path.basename(targetPath)}.zip`;
        // 获取备份目录，通常为软件安装目录的上一级路径
        const backupDir = path.dirname(targetPath);
        // 备份文件的完整路径
        const backupFilePath = path.join(backupDir, backupName);
        try {
            // 使用zip命令将软件目录压缩为备份文件
            const command = `zip -r ${backupFilePath} ${path.basename(targetPath)}`;
            const result = child_process.execSync(command, { cwd: backupDir, encoding: 'utf-8' });
            // 检查压缩是否成功
            if (result.indexOf('updating:') !== -1) {
                console.log(`软件备份成功: ${backupFilePath}`);
            } else {
                console.error(`软件备份失败: ${backupFilePath}`);
            }
        } catch (error) {
            console.error(`软件备份失败: ${error}`);
        }
    }
}

DesktopService.toString = () => '[class DesktopService]';
module.exports = DesktopService;
