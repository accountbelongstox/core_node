/*************************************************
 ** preload为预加载模块，该文件将会在程序启动时加载 **
 *************************************************/
const Addon = require('@egg/ee-core/addon');

/**
 * 预加载模块入口
 */
module.exports = async () => {
  Addon.get('trays').create();
  Addon.get('security').create();
  Addon.get('awaken').create();
  Addon.get('autoUpdater').create();

  //
  // const MountEgg = require('@ncore/practical/electron/main');
  // const coreNodeEgg = new MountEgg();
  // coreNodeEgg.start();
}




