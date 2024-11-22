"use strict";

import os from 'os';
import path from 'path';
import fs from 'fs';
import { exec, execSync } from 'child_process';
import { createHash } from 'crypto';
import Ps from '../ps/index.js';
import UtilsJson from './json.js';

// machine id
const { platform } = process;
const win32RegBinPath = {
  native: '%windir%\\System32',
  mixed: '%windir%\\sysnative\\cmd.exe /c %windir%\\System32'
};
const MachineGuid = {
  darwin: 'ioreg -rd1 -c IOPlatformExpertDevice',
  win32: `${win32RegBinPath[isWindowsProcessMixedOrNativeArchitecture()]}\\REG.exe ` +
      'QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography ' +
      '/v MachineGuid',
  linux: '( cat /var/lib/dbus/machine-id /etc/machine-id 2> /dev/null || hostname ) | head -n 1 || :',
  freebsd: 'kenv -q smbios.system.uuid || sysctl -n kern.hostuuid'
};

/**
 * 获取项目根目录package.json
 */
export function getPackage() {
  const json = UtilsJson.readSync(path.join(Ps.getHomeDir(), 'package.json'));
  
  return json;
}

/**
 * Get the first proper MAC address
 * @param iface If provided, restrict MAC address fetching to this interface
 */
export function getMAC(iface) {
  const zeroRegex = /(?:[0]{1,2}[:-]){5}[0]{1,2}/;
  const list = os.networkInterfaces();
  if (iface) {
    const parts = list[iface];
    if (!parts) {
      throw new Error(`interface ${iface} was not found`);
    }
    for (const part of parts) {
      if (zeroRegex.test(part.mac) === false) {
        return part.mac;
      }
    }
    throw new Error(`interface ${iface} had no valid mac addresses`);
  } else {
    for (const [key, parts] of Object.entries(list)) {
      if (!parts) continue;
      for (const part of parts) {
        if (zeroRegex.test(part.mac) === false) {
          return part.mac;
        }
      }
    }
  }
  throw new Error('failed to get the MAC address');
}

/**
 * Check if the input is a valid MAC address
 */
export function isMAC(macAddress) {
  const macRegex = /(?:[a-z0-9]{1,2}[:-]){5}[a-z0-9]{1,2}/i;
  return macRegex.test(macAddress);
}

/**
 * is encrypt
 */
export function isEncrypt(basePath) {
  const encryptDir = Ps.getEncryptDir(basePath);
  return fs.existsSync(encryptDir);
}

/**
 * get machine id
 */
export function machineIdSync(original) {
  let id = expose(execSync(MachineGuid[platform]).toString());
  return original ? id : hash(id);
}

/**
 * get machine id (promise)
 * original <Boolean>, If true return original value of machine id, otherwise return hashed value (sha-256), default: false
 */
export function machineId(original) {
  return new Promise((resolve, reject) => {
    exec(MachineGuid[platform], {}, (err, stdout, stderr) => {
      if (err) {
        return reject(
          new Error(`Error while obtaining machine id: ${err.stack}`)
        );
      }
      let id = expose(stdout.toString());
      resolve(original ? id : hash(id));
    });
  });
}

function isWindowsProcessMixedOrNativeArchitecture() {
  if (process.platform !== 'win32') {
    return '';
  }
  if (process.arch === 'ia32' && process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')) {
    return 'mixed';
  }
  return 'native';
}

function hash(guid) {
  return createHash('sha256').update(guid).digest('hex');
}

function expose(result) {
  switch (platform) {
    case 'darwin':
      return result
        .split('IOPlatformUUID')[1]
        .split('\n')[0].replace(/\=|\s+|\"/ig, '')
        .toLowerCase();
    case 'win32':
      return result
        .toString()
        .split('REG_SZ')[1]
        .replace(/\r+|\n+|\s+/ig, '')
        .toLowerCase();
    case 'linux':
      return result
        .toString()
        .replace(/\r+|\n+|\s+/ig, '')
        .toLowerCase();
    case 'freebsd':
      return result
        .toString()
        .replace(/\r+|\n+|\s+/ig, '')
        .toLowerCase();
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}
