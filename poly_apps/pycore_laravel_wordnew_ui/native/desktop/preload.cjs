'use strict';
// Desktop bridge for the page (contract: core/network/DesktopShell.ts). Sandboxed
// preload: every call is forwarded to the main process over IPC.
const { contextBridge, ipcRenderer } = require('electron');

const BRIDGE_GLOBAL = 'coreNodeDesktop';
const FS_CHANNEL = 'desktop:fs';
const PLUGIN_CHANNEL = 'desktop:plugin';
const FILE_URI_PREFIX = 'file://';
const FILE_URL_ORIGIN = 'app-file://localhost';
const FS_METHODS = [
  'writeFile', 'appendFile', 'readFile', 'deleteFile', 'mkdir', 'rmdir', 'readdir', 'stat',
  'rename', 'copy', 'getUri', 'downloadFile', 'checkPermissions', 'requestPermissions',
];
const PLUGIN_METHODS = {
  DeviceStorage: ['volumes', 'directoryStats', 'checkAllFilesAccess', 'requestAllFilesAccess', 'openFile', 'shareFile'],
  ForegroundSync: ['start', 'update', 'stop'],
  LanInfo: ['current'],
  Immersive: ['enter', 'exit'],
};

/** Plain data only crosses the bridge (progress callbacks and the like are dropped). */
function plain(options) {
  return options === undefined ? undefined : JSON.parse(JSON.stringify(options));
}

const fsApi = Object.fromEntries(FS_METHODS.map((method) => [
  method,
  (options) => ipcRenderer.invoke(FS_CHANNEL, method, plain(options)),
]));

const plugins = Object.fromEntries(Object.entries(PLUGIN_METHODS).map(([plugin, methods]) => [
  plugin,
  Object.fromEntries(methods.map((method) => [
    method,
    (options) => ipcRenderer.invoke(PLUGIN_CHANNEL, plugin, method, plain(options)),
  ])),
]));

contextBridge.exposeInMainWorld(BRIDGE_GLOBAL, {
  platform: process.platform,
  plugins,
  fs: fsApi,
  convertFileSrc(uri) {
    const value = String(uri || '');
    return value.startsWith(FILE_URI_PREFIX) ? `${FILE_URL_ORIGIN}${value.slice(FILE_URI_PREFIX.length)}` : value;
  },
});
