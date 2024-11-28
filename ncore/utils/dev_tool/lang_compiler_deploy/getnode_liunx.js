import os from 'os';
import path from 'path';
import fs from 'fs';
import Base from '#@/ncore/utils/dev_tool/lang_compiler_deploy/libs/base_utils.js';
import {gdir} from '#@globalvars';

import bdir from '#@/ncore/gvar/bdir.js';
import gconfig from '#@/ncore/gvar/gconfig.js';
const langdir = gconfig.getBaseConfig().DEV_LANG_DIR

class GetNodeLinux extends Base {
  constructor() {
    super();
    this.nodeDirBase = langdir;
    this.tempDir = "/tmp/nodejs";
    this.binaries = ["pm2", "pnpm", "cnpm", "yarn"];
    this.binariesBins = ["npm", "corepack", "npx", "pm2", "pm2-dev", "pm2-docker", "pm2-runtime", "pnpm", "vsce", "yarn", "yarnpkg"];
    this.nodeVersions = {
      18: "v18.20.4",
      20: "v20.15.1",
      22: "v22.5.1"
    };
    this.nodeDefaultVersion = 20;
    this.nodeDefaultFullVersion = this.nodeVersions[this.nodeDefaultVersion];
    this.nodeDefaultVersionFull = `node-${this.nodeDefaultFullVersion}-linux-x64`;
    this.nodeDefaultDir = path.join(this.nodeDirBase, this.nodeDefaultVersionFull);
    this.nodeDefaultBinDir = path.join(this.nodeDefaultDir, "bin");
    this.nodeDefaultNbinDir = path.join(this.nodeDefaultDir, "nbin");
    this.sysLocalBinBase = "/usr/local/bin";
    this.sysBinBase = "/usr/bin";
    this.skipPrintBins = ["npx", "pnpx", "electron"];

  }

  prepareDirectories() {
    fs.mkdirSync(this.tempDir, { recursive: true });
    fs.mkdirSync(this.nodeDirBase, { recursive: true });
  }

  linkDefaultBins(dirPath) {
    this.info(`-> Setting default binaries from: ${dirPath}`);
    fs.readdirSync(dirPath).forEach(binary => {
      const binaryPath = path.join(dirPath, binary);

      [this.sysBinBase, this.sysLocalBinBase].forEach(binBase => {
        const targetPath = path.join(binBase, binary);
        if (fs.existsSync(targetPath) || fs.lstatSync(targetPath).isSymbolicLink()) {
          fs.unlinkSync(targetPath);
        }

        fs.symlinkSync(binaryPath, targetPath);
        fs.chmodSync(targetPath, 0o755);
        this.success(`-> Removed old binary: ${binary} from ${binBase} -> Created symlink -> Set permissions.`);
        this.info(`-> Binary name: ${binary}`);
        this.info(`-> Binary path: ${binaryPath}`);

        if (["node", "npm", "yarn"].includes(binary)) {
          const version = this.execCmd([path.join(this.sysBinBase, binary), '--version']);
          this.info(`-> Current system default ${binary} version: ${version}`);
        }
      });
    });
  }

  downloadAndExtract(url) {
    const filename = path.basename(url);
    const outputPath = path.join(this.tempDir, filename);

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    this.info(`Downloading Node.js from: ${url}`);
    this.execCmd(['wget', '-q', '--show-progress', url, '-P', this.tempDir]);

    this.info(`Downloaded Node.js to: ${outputPath}`);
    this.extractXz(outputPath, this.nodeDirBase);
  }

  extractXz(xzFile, extractDir) {
    this.info(`Extracting ${xzFile} to ${extractDir}`);
    this.execCmd(['sudo', 'tar', '-Jxf', String(xzFile), '-C', String(extractDir)]);
  }

  configureNpm(nodePath, nodeVersionBinDir) {
    const notFound = [];
    const npmPath = path.join(nodeVersionBinDir, "npm");
    const nodeParentDir = path.dirname(path.dirname(nodePath));
    this.info(`${nodePath} ${npmPath} config set prefix ${nodeParentDir}`);
    this.info(`${nodePath} ${npmPath} config set registry https://mirrors.huaweicloud.com/repository/npm/`);
    this.execCmd([nodePath, npmPath, "config", "set", "prefix", nodeParentDir]);
    this.info(`   -> npm prefix ${nodeParentDir}`);
    this.execCmd([nodePath, npmPath, "config", "set", "registry", "https://mirrors.huaweicloud.com/repository/npm/"]);
    this.info(`   -> npm registry configured to https://mirrors.huaweicloud.com/repository/npm/.`);

    this.binaries.forEach(binary => {
      const binaryPath = path.join(nodeVersionBinDir, binary);
      this.info(`Binary ${binary} path: ${binaryPath}`);
      if (!fs.existsSync(binaryPath)) {
        notFound.push(binary);
      }
    });
    if (notFound.length) {
      this.warn(`Not found, Installing binaries: ${notFound.join(' ')}`);
      this.execCmd([nodePath, npmPath, "install", "-g", ...notFound]);
    }
  }

  createSymlinkBinFile(nodePath, exePath, binPath, binName) {
    if (!fs.existsSync(nodePath)) {
      this.warn(`Error: File '${nodePath}' not found.`);
      return 1;
    }

    if (!fs.existsSync(exePath)) {
      this.warn(`Error: File '${exePath}' not found.`);
      return 1;
    }

    fs.writeFileSync(binPath, `#!/bin/bash\n${nodePath} ${exePath} "$@"\n`);

    const targetPath = path.join("/usr/local/bin", binName);
    if (fs.existsSync(targetPath)) {
      this.info(`   -> Removing existing ${targetPath}`);
      fs.unlinkSync(targetPath);
    }

    this.info(`   -> Creating symlink: ${targetPath} -> ${binPath}`);
    fs.symlinkSync(binPath, targetPath);
    fs.chmodSync(targetPath, 0o755);
    this.success(`   -> Script written to ${binPath}`);
  }

  setupCustomBinaries(nodeVersionBinDir, nodePath, nodeItem, nodeVersionMainDir) {
    this.info(`Scanning directory: ${nodeVersionBinDir}`);
    fs.readdirSync(nodeVersionBinDir).forEach(binary => {
      const binaryPath = path.join(nodeVersionBinDir, binary);
      const filename = path.basename(binaryPath);
      if (filename === "node") {
        this.info(`   -> Skipping file: ${filename}`);
        return;
      }

      const nbinPath = path.join(nodeVersionMainDir, "nbin");
      const nbinName = `${nodeItem}${filename}`;
      const nbinNamePath = path.join(nbinPath, nbinName);

      if (!fs.existsSync(nbinPath)) {
        fs.mkdirSync(nbinPath, { recursive: true });
      }

      this.createSymlinkBinFile(nodePath, binaryPath, nbinNamePath, nbinName);
    });
  }

  installGlobalPackageWithYarn(nodeVersion, packageName) {
    const yarnPath = this.getNbinFile(nodeVersion, "yarn");
    if (yarnPath) {
      this.info(`Using yarn at: ${yarnPath} to install package: ${packageName}`);
      this.execCmd([yarnPath, "global", "add", packageName]);
      this.setBinPermissionsAndSync(nodeVersion);
    } else {
      this.warn(`Yarn binary not found for Node.js version ${nodeVersion}`);
    }
  }

  setBinPermissionsAndSync(nodeVersion) {
    const binPath = this.getBinPath(nodeVersion);
    this.info(`Setting execute permissions for all files in: ${binPath}`);
    fs.readdirSync(binPath).forEach(file => {
      const filePath = path.join(binPath, file);
      fs.chmodSync(filePath, 0o755);
    });
  }

  printVersions(nodeVersionBinDir, nodePath, nodeItem) {
    this.info("--------------------------------------------------");
    this.info(`-----------------Node.js ${nodeItem}------------------------`);
    this.info("--------------------------------------------------");
    this.info(`Scanning directory: ${nodeVersionBinDir}`);
    fs.readdirSync(nodeVersionBinDir).forEach(binary => {
      const binaryPath = path.join(nodeVersionBinDir, binary);
      const filename = path.basename(binaryPath);
      let command;
      if (filename === "node") {
        command = [binaryPath, '--version'];
      } else if (filename === "electron") {
        command = [binaryPath, '--version', '--no-sandbox'];
      } else if (this.skipPrintBins.includes(filename) || filename.endsWith('.cmd') || filename.endsWith('.exe') || filename.endsWith('.ps1')) {
        this.info(`Skip ${filename}`);
        return;
      } else {
        command = [nodePath, binaryPath, '--version'];
      }
      const version = this.execCmd(command);
      this.success(`   -> ${filename}: ${version}.`);
    });
  }

  getBinPath(nodeVersion) {
    const nodeVersionFull = `node-${this.nodeVersions[nodeVersion]}-linux-x64`;
    return path.join(this.nodeDirBase, nodeVersionFull, "bin");
  }

  getNbinPath(nodeVersion, binary) {
    const nodeVersionFull = `node-${this.nodeVersions[nodeVersion]}-linux-x64`;
    return path.join(this.nodeDirBase, nodeVersionFull, "nbin", `${nodeVersion}${binary}`);
  }

  getBinFile(nodeVersion, binaryName) {
    const binPath = this.getBinPath(nodeVersion);
    const binaryFile = path.join(binPath, binaryName);
    if (fs.existsSync(binaryFile) && fs.accessSync(binaryFile, fs.constants.X_OK)) {
      return binaryFile;
    } else {
      this.warn(`Binary file '${binaryName}' not found or not executable in bin path: ${binPath}`);
      return null;
    }
  }

  getNbinFile(nodeVersion, binaryName) {
    const nbinPath = this.getNbinPath(nodeVersion, binaryName);
    if (fs.existsSync(nbinPath) && fs.accessSync(nbinPath, fs.constants.X_OK)) {
      return nbinPath;
    } else {
      this.warn(`Binary file '${binaryName}' not found or not executable in nbin path: ${nbinPath}`);
      return null;
    }
  }

  start() {
    this.prepareDirectories();
    for (const [nodeItem, nodeVersion] of Object.entries(this.nodeVersions)) {
      const nodeVersionFull = `node-${nodeVersion}-linux-x64`;
      const nodeVersionMainDir = path.join(this.nodeDirBase, nodeVersionFull);
      const nodeVersionBinDir = path.join(nodeVersionMainDir, "bin");
      const nodePath = path.join(nodeVersionBinDir, "node");

      this.info(`Selected NODE_VERSION: ${nodeVersion}`);
      this.info(`NODE_VERSION_FULL: ${nodeVersionFull}`);
      this.info(`NODE_DIR: ${nodeVersionMainDir}`);

      if (!fs.existsSync(nodePath)) {
        this.warn(`Node executable not found at ${nodePath}. Downloading and extracting...`);

        if (fs.existsSync(nodeVersionMainDir)) {
          this.rmdirSyncRecursive(nodeVersionMainDir);
        }

        const nodeTarUrl = `https://nodejs.org/dist/${nodeVersion}/${nodeVersionFull}.tar.xz`;
        this.info(`NODE_TAR_URL: ${nodeTarUrl}`);

        this.downloadAndExtract(nodeTarUrl);
      }

      this.configureNpm(nodePath, nodeVersionBinDir);
      this.setupCustomBinaries(nodeVersionBinDir, nodePath, nodeItem, nodeVersionMainDir);

      this.info("Set execute binary permissions");
      fs.readdirSync(nodeVersionBinDir).forEach(file => {
        fs.chmodSync(path.join(nodeVersionBinDir, file), 0o755);
      });

      this.info("--------------------------------");
      this.printVersions(nodeVersionBinDir, nodePath, nodeItem);
    }

    this.info(`   -> Default Node.js Version: ${this.nodeDefaultFullVersion}`);
    this.info(`   -> Default Node.js Directory: ${this.nodeDefaultDir}`);
    this.info(`   -> Default nbin Directory: ${this.nodeDefaultNbinDir}`);

    this.linkDefaultBins(this.nodeDefaultBinDir);
    this.linkDefaultBins(this.nodeDefaultNbinDir);
  }

  rmdirSyncRecursive(directoryPath) {
    if (fs.existsSync(directoryPath)) {
      fs.readdirSync(directoryPath).forEach((file, index) => {
        const curPath = path.join(directoryPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          this.rmdirSyncRecursive(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(directoryPath);
    }
  }
}

export default new GetNodeLinux();
