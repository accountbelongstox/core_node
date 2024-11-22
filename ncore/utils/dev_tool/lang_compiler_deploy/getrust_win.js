import os from 'os';
import path from 'path';
import fs from 'fs';
import Base from '#@base';
import { gdir, com_bin } from '#@globalvars'; // Added com_bin for tar and curl
import { execSync } from 'child_process';

// Get tar and curl executables
const tar = com_bin.getTarExecutable();
const curl = com_bin.getCurlExecutable();

const langdir = gdir.getDevLangPath();

class GetRustWin extends Base {
    constructor() {
        super();
        this.rustupFileName = "rustup-init.exe";
        this.rustupUrl = "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe";
        this.installDir = path.join(langdir, 'rust');
        this.tempDir = path.join(langdir, 'tmp');
        this.cargoDir = path.join(this.installDir, '.cargo'); // Custom cargo directory
        this.rustPath = path.join(this.cargoDir, 'bin', 'rustc.exe'); // Path to the Rust compiler
        this.prepareDirectories();
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

    start() {
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

        // Use curl with -L -k options to download
        this.pipeExecCmd(`${curl} -L -k -o "${tempRustupFile}" "${this.rustupUrl}"`);

        console.log(`Running Rustup installer...`);

        // Set environment variables to install to the custom directory
        const env = Object.assign({}, process.env, {
            CARGO_HOME: this.cargoDir,
            RUSTUP_HOME: this.installDir
        });

        // Run the Rustup installer with the custom environment
        this.pipeExecCmd(`"${tempRustupFile}" -y --default-toolchain stable --profile minimal --no-modify-path`, true, null, false, env);
    }

    verifyInstallation() {
        console.log(`Verifying installation of Rust at ${this.rustPath}...`);
        if (fs.existsSync(this.rustPath)) {
            console.log(`Rust installed successfully.`);
            const version = this.execCmd(`"${this.rustPath}" --version`);
            console.log(`Rust version: ${version}`);
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
