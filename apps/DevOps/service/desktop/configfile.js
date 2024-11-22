'use strict';

const fs = require('fs');
const path = require('path');
const { Service } = require('@egg/ee-core');

class CreatfolderService extends Service {

  constructor(ctx) {
    super(ctx);
  }

  async createElectronEggFolder() {
    const userFolderPath = path.join('C:', 'Users', 'citop');
    // const userFolderPath = path.join('D:');
    const electronEggFolderPath = path.join(userFolderPath, '.electron-egg');

    try {
      // Ensure the .electron-egg folder exists
      if (!fs.existsSync(electronEggFolderPath)) {
        fs.mkdirSync(electronEggFolderPath);
        return { status: 'ok', message: '.electron-egg 文件夹创建成功。' };
      } else {
        return { status: 'ok', message: '.electron-egg 文件夹已存在。' };
      }
    } catch (error) {
      return { status: 'error', message: `创建 .electron-egg 文件夹时出错：${error.message}` };
    }
  }
}

CreatfolderService.toString = () => '[class CreatfolderService]';
module.exports = CreatfolderService;
