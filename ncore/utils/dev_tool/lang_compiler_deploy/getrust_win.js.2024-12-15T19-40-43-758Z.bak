import os from 'os';
import path from 'path';
import fs from 'fs';
import { gdir } from '#@globalvars'; 
import { bdir } from '#@bdir';
import gconfig from '#@/ncore/gvar/gconfig.js';
import { execCmd, pipeExecCmd } from '#@utils_commander';
import logger from '#@utils_logger';

const langdir = gconfig.DEV_LANG_DIR;

const tar = bdir.getTarExecutable(); 
const v7zexe = bdir.get7zExecutable();
const curl = bdir.getCurlExecutable(); 
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
        this.prepareDirectories();
        if (this.checkRustInstalled()) {
            console.log(`Rust is already installed.`);
        } else {
            this.downloadAndInstallRust();
        }
        this.verifyInstallation();
        this.configureRust();
    }

    checkRustInstalled() {
        return fs.existsSync(this.rustPath);
    }

    prepareDirectories() {
        if (!fs.existsSync(this.installDir)) {
            fs.mkdirSync(this.installDir, { recursive: true });
        }

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    downloadAndInstallRust() {
        console.log(`Downloading Rustup installer from ${this.rustupUrl}...`);
        const tempRustupFile = path.join(this.tempDir, this.rustupFileName);
        pipeExecCmd(`${curl} -L -k -o "${tempRustupFile}" "${this.rustupUrl}"`);
        console.log(`Running Rustup installer...`);
        this.initEnv();
        const cmd = `"${tempRustupFile}" -y --default-toolchain stable --profile default --no-modify-path`;
        logger.info(cmd);
        pipeExecCmd(cmd, true, null, false, this.env);
        this.initRustup();
    }

    initEnv() {
        if(!this.env) {
            this.env = Object.assign({}, process.env, {
                CARGO_HOME: this.cargoDir,
                RUSTUP_HOME: this.installDir
            });
        }
    }

    initRustup() {
        this.initEnv();
        const rustupExe = path.join(this.cargoDir, 'bin', 'rustup.exe');
        const setDefaultToolchain = `"${rustupExe}" default stable`;
        logger.info(setDefaultToolchain);
        pipeExecCmd(setDefaultToolchain, true, null, false, this.env);
    }

    verifyInstallation() {
        console.log(`Verifying installation of Rust at ${this.rustPath}...`);
        if (fs.existsSync(this.rustPath)) {
            console.log(`Rust installed successfully.`);
            try {
                const version = execCmd(`"${this.rustPath}" --version`);
                console.log(`Rust version: ${version}`);
            } catch (error) {
                this.initRustup();
                console.error(`Error getting Rust version: ${error}`);
            }
        } else {
            console.error(`Rust installation failed.`);
        }
    }

    configureRust() {
        const cargoBin = path.join(this.cargoDir, 'bin');
        if (!process.env.PATH.includes(cargoBin)) {
            process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH}`;
        }

        console.log(`Rust configured successfully.`);
    }
}

const getRustWin = new GetRustWin();
export default getRustWin;
