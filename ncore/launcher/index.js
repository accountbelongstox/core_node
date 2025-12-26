// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
