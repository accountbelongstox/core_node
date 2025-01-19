const os = require('os');
const path = require('path');
const fs = require('fs');
const { gdir } = require('#@globalvars'); 
const bdir = require('#@/ncore/gvar/bdir.js');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@commander');
const logger = require('#@logger');

const langdir = gconfig.DEV_LANG_DIR;

class GetRustWin {
    constructor() {
        this.rustupFileName = "rustup-init.exe";
        this.rustupUrl = "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe";
        this.installDir = path.join(langdir, 'rust');
        this.tempDir = path.join(langdir, 'tmp');
        this.cargoDir = path.join(this.installDir, '.cargo'); // Custom cargo directory
        this.rustPath = path.join(this.cargoDir, 'bin', 'rustc.exe'); // Path to the Rust compiler
    }

    getDefaultVersion() {
        const baseDir = new Set();
        if (fs.existsSync(this.rustPath)) {
            const rustBaseDir = path.dirname(this.rustPath);
            baseDir.add(rustBaseDir);
        }
        return {
            installDir: this.installDir,
            rustPath: this.rustPath,
            baseDir: Array.from(baseDir)
        };
    }

    async start() {
        try {
            await bdir.initializedBDir();
            this.tar = await bdir.getTarExecutable();
            this.v7z = await bdir.get7zExecutable();
            this.curl = await bdir.getCurlExecutable();

            this.prepareDirectories();
            if (await this.checkRustInstalled()) {
                logger.info(`Rust is already installed.`);
            } else {
                await this.downloadAndInstallRust();
            }
            await this.verifyInstallation();
            await this.configureRust();
        } catch (error) {
            logger.error(`Error during Rust setup: ${error}`);
        }
    }

    async checkRustInstalled() {
        return fs.existsSync(this.rustPath);
    }

    prepareDirectories() {
        if (!fs.existsSync(this.installDir)) {
            fs.mkdirSync(this.installDir, { recursive: true });
            logger.success(`Created installation directory at: ${this.installDir}`);
        } else {
            logger.info(`Installation directory already exists: ${this.installDir}`);
        }

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
            logger.success(`Created temporary directory at: ${this.tempDir}`);
        } else {
            logger.info(`Temporary directory already exists: ${this.tempDir}`);
        }
    }

    async downloadAndInstallRust() {
        logger.info(`Downloading Rustup installer from ${this.rustupUrl}...`);
        const tempRustupFile = path.join(this.tempDir, this.rustupFileName);
        await execCmd(`"${this.curl}" -L -k -o "${tempRustupFile}" "${this.rustupUrl}"`);
        logger.info(`Running Rustup installer...`);
        this.initEnv();
        const cmd = `"${tempRustupFile}" -y --default-toolchain stable --profile default --no-modify-path`;
        logger.info(cmd);
        await execCmd(cmd, false, this.env);
        await this.initRustup();
    }

    initEnv() {
        if(!this.env) {
            this.env = Object.assign({}, process.env, {
                CARGO_HOME: this.cargoDir,
                RUSTUP_HOME: this.installDir
            });
        }
    }

    async initRustup() {
        this.initEnv();
        const rustupExe = path.join(this.cargoDir, 'bin', 'rustup.exe');
        const setDefaultToolchain = `"${rustupExe}" default stable`;
        logger.info(setDefaultToolchain);
        await execCmd(setDefaultToolchain, false, this.env);
    }

    async verifyInstallation() {
        logger.info(`Verifying installation of Rust at ${this.rustPath}...`);
        if (fs.existsSync(this.rustPath)) {
            logger.success(`Rust installed successfully.`);
            try {
                const version = await execCmdResultText(`"${this.rustPath}" --version`);
                logger.info(`Rust version: ${version}`);
                return true;
            } catch (error) {
                await this.initRustup();
                logger.error(`Error getting Rust version: ${error}`);
                return false;
            }
        } else {
            logger.error(`Rust installation failed.`);
            return false;
        }
    }

    async configureRust() {
        const cargoBin = path.join(this.cargoDir, 'bin');
        if (!process.env.PATH.includes(cargoBin)) {
            process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH}`;
            logger.success(`Added Cargo bin directory to PATH: ${cargoBin}`);
        } else {
            logger.info(`Cargo bin directory already in PATH: ${cargoBin}`);
        }

        logger.success(`Rust configured successfully.`);
    }
}

module.exports = new GetRustWin();