const { Tray, Menu } = require('electron');
const path = require('path');
const Ps = require('@egg/ee-core/ps');
const Log = require('@egg/ee-core/log');
const Electron = require('@egg/ee-core/electron');
const CoreWindow = require('@egg/ee-core/electron/window');
const Conf = require('@egg/ee-core/config');
const EE = require('@egg/ee-core/ee');
const { serve } = require("@ncore/practicals.js");
const { appname } = require("@ncore/globalvars");
const icons_dir = path.join(Ps.getHomeDir(), `public/${appname}/icons`);
const menu_dir = path.join(icons_dir, `menu`);

class TraysAddon {
  constructor() {
    this.tray = null;
    this.ctrl = {
      relaunch: () => {
        // 重新启动应用的逻辑
        Electron.app.relaunch();
        Electron.app.exit(0);
      },
      minimize: () => {
        // 最小化窗口的逻辑
        const mainWindow = CoreWindow.getMainWindow();
        if (mainWindow) {
          mainWindow.minimize();
        }
      },
      close: () => {
        // 关闭应用的逻辑
        Electron.app.quit();
      }
    };
  }

  /**
   * 创建托盘
   */
  create() {
    // 开发环境，代码热更新开启时，会导致托盘中有残影
    if (Ps.isDev() && Ps.isHotReload()) return;

    Log.info('[addon:trays] load');
    // const { CoreApp } = EE;
    const cfg = Conf.getValue('addons.tray');
    const mainWindow = CoreWindow.getMainWindow();

    // 托盘图标
    let iconPath = path.join(icons_dir, cfg.icon);

    // 托盘菜单功能列表
    let trayMenuTemplate = [
      {
        label: '重启软件',
        type: 'normal',
        click: () => {
          this.ctrl.relaunch();
        },
        icon: path.join(menu_dir, 'restart.png')
      },
      {
        label: '软件最小化',
        sublabel: "最小化",
        toolTip: "-最小化",
        type: 'normal',
        click: () => {
          this.ctrl.minimize();
        },
        icon: path.join(menu_dir, 'minimize.png')
      },
      {
        label: '网页版(客户端)界面',
        sublabel: "*节省内存",
        type: 'normal',
        click: () => {

          const cfg = Conf.all();
          console.log(cfg)
          // const frontendConf = appBinConfig.dev.frontend;
          // serve.openFrontendServerUrl(frontendConf);

        },
        icon: path.join(menu_dir, 'open_theWeb_page2.png')
      },
      {
        label: '普通界面',
        sublabel: "*占用内存",
        type: 'normal',
        click: () => {
          electronMain.startWithUi();
        },
        icon: path.join(menu_dir, 'open_interface.png')
      },
      {
        label: '设置中心',
        sublabel: "系统快捷设置",
        type: 'normal',
        click: () => {
          electronMain.startWithUi();
        },
        icon: path.join(menu_dir, 'open_interface1.png')
      },
      { type: 'separator' },
      {
        type: 'normal',
        label: '退出软件',
        click: () => {
          this.ctrl.close();
        },
        icon: path.join(menu_dir, 'quit.png')
      }
    ];

    // 点击关闭，最小化到托盘
    mainWindow.on('close', (event) => {
      if (Electron.extra.closeWindow == true) {
        return;
      }
      mainWindow.hide();
      event.preventDefault();
    });

    // 实例化托盘
    this.tray = new Tray(iconPath);
    this.tray.setToolTip(cfg.title);
    const contextMenu = Menu.buildFromTemplate(trayMenuTemplate);
    this.tray.setContextMenu(contextMenu);
  }
}

TraysAddon.toString = () => '[class TraysAddon]';
module.exports = TraysAddon;
