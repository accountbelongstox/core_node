const Base = require('../../../globalvar/base/base');
//const { createShortcut } = require('../../../practicals/win');
const createShortcut = require('../../../../ncore/practical/win'); // 引入createShortcut函数
const os = require('os');
const path = require('path');

//#TODO 调用 practicals/win中的createShortcut（“名字”，“exe路径”， 将本程序 的exe创建桌面图标，名称为 DevOps
class Prestart extends Base {
    constructor() {
        super();
        console.log("Prestart class initialized.");
    }

    async main(appConfig, appBinConfig) {
        try {
            console.log("Executing prestart tasks...");

            // 确认appBinConfig有效且包含executablePath
            if (!appBinConfig || !appBinConfig.executablePath) {
                throw new Error("Missing executablePath in appBinConfig.");
            }

            const shortcutName = "DevOps";
            const exePath = appBinConfig.executablePath;
            // 图标路径格式：exe路径后跟逗号及图标资源索引，0表示第一个图标
            const iconPath = `${exePath},0`;

            // 调用createShortcut方法
            await createShortcut(shortcutName, exePath, iconPath);
            console.log(`Created shortcut named "${shortcutName}" at "${path.join(os.homedir(), 'Desktop', `${shortcutName}.lnk`)}.`);

            console.log("Performing additional prestart tasks...");
            // 添加其他预启动任务
        } catch (error) {
            console.error("Error during prestart tasks:", error);
        }
    }
}

module.exports = Prestart;
