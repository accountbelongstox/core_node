'use strict';
const path = require('path');

/**
 * 默认配置
 */
module.exports =  (appInfo) => {
  console.log(`appInfo`,appInfo)
  const config = {};

  /**
   * 开发者工具
   */
  config.openDevTools = false;

  /**
   * 应用程序顶部菜单
   */
  config.openAppMenu = 'dev-show';

  config.showMain = false;
  /**
   * 主窗口
   */
  config.windowsOption = {
    title: '工作开发平台',
    width: 1800,
    height: 1200,
    minWidth: 980,
    minHeight: 650,
    webPreferences: {
      webSecurity: false,
      contextIsolation: true,
      nodeIntegration: true,
      // preload: path.join(appInfo.baseDir, 'preload', 'bridge.js'),
    },
    frame: true,
    show: false,
    icon: path.join(appInfo.home, 'public', 'icons', '32x32.png'),
  };

  /**
   * ee框架日志
   */
  config.logger = {
    encoding: 'utf8',
    level: 'INFO',
    outputJSON: false,
    buffer: true,
    enablePerformanceTimer: false,
    rotator: 'day',
    appLogName: 'ee.log',
    coreLogName: 'ee-core.log',
    errorLogName: 'ee-error.log',
    dir: path.join(appInfo.execDir, 'logs'),
  }

  /**
   * 远程模式-web地址
   */
  config.remoteUrl = {
    enable: true,
    url: 'http://localhost:21354/'
  };

  /**
   * 内置socket服务
   */
  config.socketServer = {
    enable: true,
    port: 7070,
    path: "/socket.io/",
    connectTimeout: 45000,
    pingTimeout: 30000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8,
    transports: ["polling", "websocket"],
    cors: {
      origin: true,
      credentials: false,
    }
  };
  /**
   * 内置http服务
   */
  config.httpServer = {
    enable: true,
    https: {
      enable: true,
      key: '/public/ssl/local.fcant.tech.key',
      cert: '/public/ssl/local.fcant.tech.pem'
    },
    host: '0.0.0.0',
    port: 7071,
    cors: {
      origin: "*"
    },
    body: {
      multipart: true,
      formidable: {
        keepExtensions: true
      }
    },
    filterRequest: {
      uris: [
        'favicon.ico'
      ],
      returnData: ''
    }
  };

  /**
   * 主进程
   */
  config.mainServer = {
    protocol: 'file://',
    indexPath: '/public/dist/index.html',
    host: '127.0.0.1',
    port: 7072,
  };

  /**
   * 硬件加速
   */
  config.hardGpu = {
    enable: false
  };

  /**
   * 异常捕获
   */
  config.exception = {
    mainExit: true,
    childExit: true,
    rendererExit: true,
  };

  /**
   * 插件功能
   */
  config.addons = {
    window: {
      enable: false,
    },
    tray: {
      enable: false,
      title: '开发平台',
      icon: '32x32.png'
    },
    security: {
      enable: true,
    },
    awaken: {
      enable: true,
      protocol: 'ee',
      args: []
    },
    autoUpdater: {
      enable: true,
      windows: false,
      macOS: false,
      linux: false,
      options: {
        provider: 'generic',
        url: 'http://kodo.qiniu.com/'
      },
      force: false,
    },
    javaServer: {
      enable: false,
      port: 18080,
      jreVersion: 'jre1.8.0_201',
      opt: '-server -Xms512M -Xmx512M -Xss512k -Dspring.profiles.active=prod -Dserver.port=${port} -Dlogging.file.path="${path}" ',
      name: 'java-app.jar'
    }
  };
  return {
    ...config
  };
}
