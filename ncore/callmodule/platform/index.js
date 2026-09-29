/**
 * Platform-aware launcher exports
 */

const { launchPlatformAware } = require('./launcher');
const { launchWindowsTray } = require('./windows_tray');
const { launchLinuxService } = require('./linux_service');
const { getInstance: getSingletonManager, SingletonManager } = require('./singleton_manager');

module.exports = {
    launchPlatformAware,
    launchWindowsTray,
    launchLinuxService,
    getSingletonManager,
    SingletonManager
};
