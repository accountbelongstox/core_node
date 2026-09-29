/**
 * NCore Launcher
 *
 * Unified application launcher for ncore applications.
 * 1:1 port from pycore/pylauncher
 *
 * Public API:
 *   LauncherConfig       - Configuration class
 *   ServiceLauncher      - Service launcher
 *   AppExecutableLauncher - App executable launcher
 *   SingletonDetector    - Cross-process singleton detector
 *   NativeUIConfig       - Native UI configuration
 *   launchWithNativeUI   - Native UI launcher
 *   SERVICE_STARTERS     - Service registration registry
 *
 * Usage:
 *   const { ServiceLauncher, LauncherConfig } = require('#@ncore/launcher');
 *
 *   const config = new LauncherConfig({
 *     appId: "my_app",
 *     appName: "My Application",
 *     singleton: true,
 *     services: {
 *       heartbeat: {},
 *       rpc_v2: { port: 58100 }
 *     }
 *   });
 *
 *   const launcher = new ServiceLauncher(config);
 *   await launcher.start();
 */

const { ServiceLauncher, LauncherConfig, launchServices, stopServices } = require('./launcher');
const { AppExecutableLauncher, getAppExecutableLauncher } = require('./app_executable_launcher');
const { SingletonDetector, DetectionResult, MessageType, detectSingleton } = require('./singleton_detector');
const { SERVICE_STARTERS, registerServiceStarter, getServiceStarter, getAllServiceNames } = require('./service_starters');
const { NativeUIConfig, launchWithNativeUI } = require('./native_launcher');

module.exports = {
    ServiceLauncher,
    LauncherConfig,
    AppExecutableLauncher,
    getAppExecutableLauncher,
    SingletonDetector,
    DetectionResult,
    MessageType,
    detectSingleton,
    launchServices,
    stopServices,
    SERVICE_STARTERS,
    registerServiceStarter,
    getServiceStarter,
    getAllServiceNames,
    NativeUIConfig,
    launchWithNativeUI
};
