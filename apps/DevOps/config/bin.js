/**
 * ee-bin 配置
 * 仅适用于开发环境
 */
module.exports = {
  /**
   * development serve ("frontend" "electron" )
   * ee-bin dev
   */
  dev: {
    frontend: {
      directory: './frontend',
      cmd:'npm',
      args: ['run', 'dev'],
      protocol: 'http://',
      hostname: 'localhost',
      port: 3001,
      indexPath: 'index.html'
    },
    electron: {
      directory: './',
      cmd: 'electron',
      // cmd: null,
      args: ['.', '--env=local'],
    }
  },

  /**
   * 前端构建
   * ee-bin build
   */
  build: {
    directory: './frontend',
    cmd:'D:/lang_compiler/node-v18.17.0-win-x64/npm.cmd',
    args: ['run', 'build'],
  },

  /**
   * 移动资源
   * ee-bin rd
   */
  rd: {
    dist: './frontend/dist',
    target: './public/dist'
  },

  /**
   * 预发布模式（prod）
   * ee-bin start
   */
  start: {
    directory: './',
    cmd: 'electron',
    args: ['.', '--env=prod']
  },

  /**
   * 加密
   */  
  encrypt: {
    type: 'confusion',
    files: [
      'electron/**/*.(js|json)',
      '!electron/config/encrypt.js',
      '!electron/config/nodemon.json',
      '!electron/config/builder.json',
      '!electron/config/bin.json',
    ],
    fileExt: ['.js'],
    confusionOptions: {
      compact: true,      
      stringArray: true,
      stringArrayEncoding: ['none'],
      deadCodeInjection: false,
    }
  }
};