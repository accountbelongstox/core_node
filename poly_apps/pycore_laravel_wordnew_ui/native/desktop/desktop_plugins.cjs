'use strict';
// Desktop implementations of the wordnew app plugins (Android: native/wordnew/android):
// DeviceStorage (disk volumes, usage, open / reveal), ForegroundSync (keeps the
// app from being suspended during long runs), LanInfo, Immersive (fullscreen).
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { BrowserWindow, powerSaveBlocker, shell } = require('electron');
const { absolutePath, directoryRoot } = require('./desktop_files.cjs');

const WINDOWS_DRIVE_LETTERS = 'CDEFGHIJKLMNOPQRSTUVWXYZ';
const LINUX_MOUNT_PARENTS = ['/mnt', '/media'];
const INTERNAL_VOLUME_ID = 'internal';
const MOUNTED_STATE = 'mounted';
const POWER_SAVE_MODE = 'prevent-app-suspension';
const IPV4_FAMILY = 'IPv4';

function slashPath(value) {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

async function capacity(root) {
  try {
    const stat = await fsp.statfs(root);
    return { totalBytes: stat.blocks * stat.bsize, freeBytes: stat.bavail * stat.bsize };
  } catch {
    return null;
  }
}

function volumeRootOf(target) {
  return process.platform === 'win32' ? path.parse(target).root : '/';
}

async function candidateRoots() {
  if (process.platform === 'win32') return [...WINDOWS_DRIVE_LETTERS].map((letter) => `${letter}:\\`);
  const roots = [];
  for (const parent of LINUX_MOUNT_PARENTS) {
    const children = await fsp.readdir(parent, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      if (!child.isDirectory()) continue;
      const mount = path.join(parent, child.name);
      if (parent === '/media') {
        const nested = await fsp.readdir(mount, { withFileTypes: true }).catch(() => []);
        nested.filter((entry) => entry.isDirectory()).forEach((entry) => roots.push(path.join(mount, entry.name)));
      } else {
        roots.push(mount);
      }
    }
  }
  return roots;
}

function createPlugins(appId) {
  let blockerId = null;

  const DeviceStorage = {
    /** The volume of the app data folder (internal) and every other disk (app folder + public folder). */
    async volumes() {
      const dataFolder = directoryRoot('DATA');
      const internalRoot = volumeRootOf(dataFolder);
      const volumes = [];
      const internalSize = await capacity(internalRoot);
      volumes.push({
        id: INTERNAL_VOLUME_ID,
        kind: 'internal',
        label: slashPath(internalRoot) || '/',
        appPath: slashPath(dataFolder),
        rootPath: slashPath(internalRoot),
        totalBytes: internalSize?.totalBytes ?? 0,
        freeBytes: internalSize?.freeBytes ?? 0,
        state: MOUNTED_STATE,
        removable: false,
      });
      for (const root of await candidateRoots()) {
        if (path.resolve(root).toLowerCase() === path.resolve(internalRoot).toLowerCase()) continue;
        const size = await capacity(root);
        if (!size || size.totalBytes <= 0) continue;
        const rootPath = slashPath(root);
        volumes.push({
          id: `volume:${rootPath}`,
          kind: process.platform === 'win32' ? 'shared' : 'removable',
          label: rootPath,
          appPath: `${rootPath}/${appId}`,
          rootPath,
          totalBytes: size.totalBytes,
          freeBytes: size.freeBytes,
          state: MOUNTED_STATE,
          removable: process.platform !== 'win32',
        });
      }
      return { volumes, allFilesAccess: true };
    },
    async directoryStats({ path: target }) {
      const totals = { bytes: 0, files: 0 };
      const walk = async (folder) => {
        const entries = await fsp.readdir(folder, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          const full = path.join(folder, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
          } else if (entry.isFile()) {
            totals.bytes += (await fsp.stat(full).catch(() => ({ size: 0 }))).size;
            totals.files += 1;
          }
        }
      };
      await walk(absolutePath(target));
      return totals;
    },
    async checkAllFilesAccess() {
      return { granted: true, settingsPage: false };
    },
    async requestAllFilesAccess() {
      return { granted: true, settingsPage: false };
    },
    async openFile({ path: target }) {
      const failure = await shell.openPath(absolutePath(target));
      if (failure) throw new Error(failure);
    },
    async shareFile({ path: target }) {
      const file = absolutePath(target);
      if (!fs.existsSync(file)) throw new Error(`File does not exist: ${file}`);
      shell.showItemInFolder(file);
    },
  };

  const ForegroundSync = {
    async start() {
      if (blockerId === null || !powerSaveBlocker.isStarted(blockerId)) blockerId = powerSaveBlocker.start(POWER_SAVE_MODE);
    },
    async update() {},
    async stop() {
      if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId);
      blockerId = null;
    },
  };

  const LanInfo = {
    async current() {
      const addresses = Object.values(os.networkInterfaces()).flat()
        .filter((entry) => entry && entry.family === IPV4_FAMILY && !entry.internal)
        .map((entry) => ({ address: entry.address, prefixLength: Number(String(entry.cidr || '').split('/')[1]) || 24 }));
      return { addresses, gateway: '', lan: addresses.length > 0 };
    },
  };

  const Immersive = {
    async enter(_options, sender) {
      BrowserWindow.fromWebContents(sender)?.setFullScreen(true);
    },
    async exit(_options, sender) {
      BrowserWindow.fromWebContents(sender)?.setFullScreen(false);
    },
  };

  return { DeviceStorage, ForegroundSync, LanInfo, Immersive };
}

module.exports = { createPlugins };
