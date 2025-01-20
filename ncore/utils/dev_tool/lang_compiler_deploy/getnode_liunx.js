const os = require('os');
const path = require('path');
const fs = require('fs');
const { gdir } = require('#@globalvars');
const bdir = require('#@/ncore/gvar/bdir.js');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@/ncore/basic/libs/commander.js');
const logger = require('#@logger');
const langdir = gconfig.getBaseConfig().DEV_LANG_DIR;

class GetNodeLinux {
  constructor() {
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

  async linkDefaultBins(dirPath) {
    logger.info(`-> Setting default binaries from: ${dirPath}`);
    fs.readdirSync(dirPath).forEach(async binary => {
      const binaryPath = path.join(dirPath, binary);

      for (const binBase of [this.sysBinBase, this.sysLocalBinBase]) {
        const targetPath = path.join(binBase, binary);
        if (fs.existsSync(targetPath) || fs.lstatSync(targetPath).isSymbolicLink()) {
          fs.unlinkSync(targetPath);
        }

        fs.symlinkSync(binaryPath, targetPath);
        fs.chmodSync(targetPath, 0o755);
        logger.success(`-> Removed old binary: ${binary} from ${binBase} -> Created symlink -> Set permissions.`);
        logger.info(`-> Binary name: ${binary}`);
        logger.info(`-> Binary path: ${binaryPath}`);

        if (["node", "npm", "yarn"].includes(binary)) {
          const version = await execCmdResultText(`${path.join(this.sysBinBase, binary)} --version`);
          logger.info(`-> Current system default ${binary} version: ${version}`);
        }
      }
    });
  }

  async downloadAndExtract(url) {
    const filename = path.basename(url);
    const outputPath = path.join(this.tempDir, filename);

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    logger.info(`Downloading Node.js from: ${url}`);
    await execCmd(`wget -q --show-progress ${url} -P ${this.tempDir}`);

    logger.info(`Downloaded Node.js to: ${outputPath}`);
    await this.extractXz(outputPath, this.nodeDirBase);
  }

  async extractXz(xzFile, extractDir) {
    logger.info(`Extracting ${xzFile} to ${extractDir}`);
    await execCmd(`sudo tar -Jxf ${xzFile} -C ${extractDir}`);
  }

  async configureNpm(nodePath, nodeVersionBinDir) {
    const notFound = [];
    const npmPath = path.join(nodeVersionBinDir, "npm");
    const nodeParentDir = path.dirname(path.dirname(nodePath));
    logger.info(`${nodePath} ${npmPath} config set prefix ${nodeParentDir}`);
    logger.info(`${nodePath} ${npmPath} config set registry https://mirrors.huaweicloud.com/repository/npm/`);
    await execCmd(`${nodePath} ${npmPath} config set prefix ${nodeParentDir}`);
    logger.info(`   -> npm prefix ${nodeParentDir}`);
    await execCmd(`${nodePath} ${npmPath} config set registry https://mirrors.huaweicloud.com/repository/npm/`);
    logger.info(`   -> npm registry configured to https://mirrors.huaweicloud.com/repository/npm/.`);

    this.binaries.forEach(binary => {
      const binaryPath = path.join(nodeVersionBinDir, binary);
      logger.info(`Binary ${binary} path: ${binaryPath}`);
      if (!fs.existsSync(binaryPath)) {
        notFound.push(binary);
      }
    });
    if (notFound.length) {
      logger.warn(`Not found, Installing binaries: ${notFound.join(' ')}`);
      await execCmd(`${nodePath} ${npmPath} install -g ${notFound.join(' ')}`);
    }
  }

  async start() {
    await bdir.initializedBDir();
    this.tar = await bdir.getTarExecutable();
    this.curl = await bdir.getCurlExecutable();

    this.prepareDirectories();
    for (const [nodeItem, nodeVersion] of Object.entries(this.nodeVersions)) {
      const nodeVersionFull = `node-${nodeVersion}-linux-x64`;
      const nodeVersionMainDir = path.join(this.nodeDirBase, nodeVersionFull);
      const nodeVersionBinDir = path.join(nodeVersionMainDir, "bin");
      const nodePath = path.join(nodeVersionBinDir, "node");

      logger.info(`Selected NODE_VERSION: ${nodeVersion}`);
      logger.info(`NODE_VERSION_FULL: ${nodeVersionFull}`);
      logger.info(`NODE_DIR: ${nodeVersionMainDir}`);

      if (!fs.existsSync(nodePath)) {
        logger.warn(`Node executable not found at ${nodePath}. Downloading and extracting...`);

        if (fs.existsSync(nodeVersionMainDir)) {
          this.rmdirSyncRecursive(nodeVersionMainDir);
        }

        const nodeTarUrl = `https://nodejs.org/dist/${nodeVersion}/${nodeVersionFull}.tar.xz`;
        logger.info(`NODE_TAR_URL: ${nodeTarUrl}`);

        await this.downloadAndExtract(nodeTarUrl);
      }

      await this.configureNpm(nodePath, nodeVersionBinDir);
      await this.setupCustomBinaries(nodeVersionBinDir, nodePath, nodeItem, nodeVersionMainDir);

      logger.info("Set execute binary permissions");
      fs.readdirSync(nodeVersionBinDir).forEach(file => {
        fs.chmodSync(path.join(nodeVersionBinDir, file), 0o755);
      });

      logger.info("--------------------------------");
      await this.printVersions(nodeVersionBinDir, nodePath, nodeItem);
    }

    logger.info(`   -> Default Node.js Version: ${this.nodeDefaultFullVersion}`);
    logger.info(`   -> Default Node.js Directory: ${this.nodeDefaultDir}`);
    logger.info(`   -> Default nbin Directory: ${this.nodeDefaultNbinDir}`);

    await this.linkDefaultBins(this.nodeDefaultBinDir);
    await this.linkDefaultBins(this.nodeDefaultNbinDir);
  }

  rmdirSyncRecursive(directoryPath) {
    if (fs.existsSync(directoryPath)) {
      fs.readdirSync(directoryPath).forEach((file) => {
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

  async setupCustomBinaries(nodeVersionBinDir, nodePath, nodeItem, nodeVersionMainDir) {
    const nbinDir = path.join(nodeVersionMainDir, "nbin");
    if (!fs.existsSync(nbinDir)) {
      fs.mkdirSync(nbinDir, { recursive: true });
    }

    this.binariesBins.forEach(binary => {
      const binaryPath = path.join(nodeVersionBinDir, binary);
      if (fs.existsSync(binaryPath)) {
        const nbinPath = path.join(nbinDir, binary);
        fs.copyFileSync(binaryPath, nbinPath);
        fs.chmodSync(nbinPath, 0o755);
      }
    });
  }

  async printVersions(nodeVersionBinDir, nodePath, nodeItem) {
    fs.readdirSync(nodeVersionBinDir).forEach(async binary => {
      if (!this.skipPrintBins.includes(binary)) {
        const binaryPath = path.join(nodeVersionBinDir, binary);
        if (fs.existsSync(binaryPath)) {
          try {
            const version = await execCmdResultText(`${binaryPath} --version`);
            logger.info(`   -> ${binary} version: ${version}`);
          } catch (error) {
            logger.error(`   -> Failed to get version for ${binary}`);
          }
        }
      }
    });
  }
}

module.exports = new GetNodeLinux();
