/**
 * 该模块不再增加新功能，请使用 /module/utils/index 模块
 */

import path from 'path';
import {readSync} from '../utils/json.js';
import UtilsPs from '../ps/index.js';
import UtilsHelper from '../utils/helper.js';
import Copy from '../utils/copyto.js';
import Conf from '../config/index.js';
import Channel from '../const/channel.js';

/**
 * Other module
 */
const exported = {};

Copy(UtilsPs)
.and(UtilsHelper)
.to(exported);


/**
 * 获取项目根目录package.json
 */
exported.getPackage = function() {
  const json = readSync(path.join(this.getHomeDir(), 'package.json'));
  return json;
};

/**
 * 获取 ee配置
 */
exported.getEeConfig = function() {
  const config = Conf.all();
  return config;
};

/**
 * 获取 app version
 */
exported.getAppVersion = function() {
  const v = Conf.all().appVersion;
  return v;
};

/**
 * 获取 插件配置
 */
exported.getAddonConfig = function() {
  const cfg = Conf.all().addons;
  return cfg;
};

/**
 * 获取 mainServer配置
 */
exported.getMainServerConfig = function() {
  const cfg = Conf.all().mainServer;
  return cfg;
};

/**
 * 获取 httpServer配置
 */
exported.getHttpServerConfig = function() {
  const cfg = Conf.all().httpServer;
  return cfg;
};

/**
 * 获取 socketServer配置
 */
exported.getSocketServerConfig = function() {
  const cfg = Conf.all().socketServer;
  return cfg;
};

/**
 * 获取 socketio port
 */
exported.getSocketPort = function() {
  const port = Conf.all().socketServer.port;
  return parseInt(port);
};

/**
 * 获取 socket channel
 */
exported.getSocketChannel = function() {
  return Channel.socketIo.partySoftware;
};

export default exported;
