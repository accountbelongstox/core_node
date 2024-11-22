const path = require('path')
const Ps = require('@egg/ee-core/ps');
const { conf } = require('../../../../ncore/utils');
const { serve } = require('../../../../ncore/practicals.js');
const Conf = require('@egg/ee-core/config');
const AllConf = Conf.all()
let appBinConfig = conf.getAllAppBinConf()
let electronMain = null


class TrayMenu {
    constructor(mainClass, electronWindow) {
        electronMain = mainClass;
        this.electronWindow = electronWindow;
    }

    getMenuItems() {
        let icon = Ps ? path.join(Ps.getHomeDir(), AllConf.addons.tray.icon) : src.getDefaultImageFile();
        const title = AllConf.addons.tray.title;
        const menuItems = [
            {
                label: '重启软件',
                type: 'normal',
                click: () => {
                    this.ctrl.relaunch();
                },
                icon: path.join(Ps.getHomeDir(), `public/icons/menu/restart.png`),
            },
            {
                label: '软件最小化',
                sublabel: "最小化",
                toolTip: "-最小化",
                type: 'normal',
                click: () => {
                    this.ctrl.minimize();
                },
                icon: path.join(Ps.getHomeDir(), `public/icons/menu/minimize.png`),
            },
            {
                label: '网页版(客户端)界面',
                sublabel: "*节省内存",
                type: 'normal',
                click: () => {
                    const frontendConf = appBinConfig.dev.frontend
                    // const port = frontendConf.port
                    // const hostname = frontendConf.hostname
                    // const protocol = frontendConf.protocol
                    serve.openFrontendServerUrl(frontendConf);
                },
                icon: path.join(Ps.getHomeDir(), `public/icons/menu/open_theWeb_page2.png`),
            },
            {
                label: '普通界面',
                sublabel: "*占用内存",
                type: 'normal',
                click: () => {
                    electronMain.startWithUi();
                },
                icon: path.join(Ps.getHomeDir(), `public/icons/menu/open_interface.png`),
            },
            {
                label: '设置中心',
                sublabel: "系统快捷设置",
                type: 'normal',
                click: () => {
                    electronMain.startWithUi();
                },
                icon: path.join(Ps.getHomeDir(), `public/icons/menu/open_interface1.png`),
            },
            { type: 'separator' },
            {
                type: 'normal',
                label: '退出软件',
                click: () => {
                    this.ctrl.close();
                },
                icon: path.join(Ps.getHomeDir(), `public/icons/menu/quit.png`),
            }
        ];
        return {
            icon,
            menuItems,
            title
        }
    }
}
module.exports = TrayMenu