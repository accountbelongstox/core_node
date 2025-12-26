#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { processBatchEncryption, DEFAULT_PASSWORD } from './_daemon_tools/build_encryptor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("=== Build Factory Daemon Service (Node.js) ===");
console.log("Started at:", new Date().toISOString());
console.log("Working directory:", process.cwd());
console.log("APP_ROOT:", process.env.APP_ROOT || "N/A");
console.log("DEBUG_MODE:", process.env.DEBUG_MODE || "false");
console.log("");

// Configuration
const CORE_NODE_ROOT = process.env.CORE_NODE_ROOT ||
                       path.resolve(__dirname, '../../..');

const APP_NAME = process.env.APP_NAME ||
                 path.basename(process.env.APP_ROOT || process.cwd());

const OUTPUT_DIR = path.join(CORE_NODE_ROOT, 'poly_apps/appfactory-master-dashboard');

const SCAN_INTERVAL = 1000;

const BATCH_SIZE = 10;
const BATCH_TIMEOUT = 5000;

// Simple path mapping without bash dependency
function getWebPath(pathKey) {
    const baseDir = process.env.WEB_BASE_DIR || '/www';

    switch (pathKey) {
        case 'www':
            return baseDir;
        case 'build_dir':
            return path.join(baseDir, '_build_dir');
        default:
            return baseDir;
    }
}

function getBuildDirectory() {
    // Allow custom build directory via environment variable
    if (process.env.BUILD_DIR) {
        return process.env.BUILD_DIR;
    }
    return getWebPath('build_dir');
}

function getAppBuildDirectory() {
    const buildDir = getBuildDirectory();
    // If custom BUILD_DIR is set and already includes app name, use it directly
    if (process.env.BUILD_DIR && path.basename(buildDir) === APP_NAME) {
        return buildDir;
    }
    return path.join(buildDir, APP_NAME);
}

function getRealUser() {
    return process.env.SUDO_USER || process.env.USER || 'ubuntu';
}

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        console.log(`[CREATE] Directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });

        const user = getRealUser();
        if (process.getuid && process.getuid() === 0 && user !== 'root') {
            try {
                import('child_process').then(({ execSync }) => {
                    execSync(`chown -R ${user}:${user} "${dirPath}"`, { stdio: 'ignore' });
                    execSync(`chmod -R 755 "${dirPath}"`, { stdio: 'ignore' });
                }).catch(error => {
                    console.warn(`[WARN] Could not change permissions: ${error.message}`);
                });
            } catch (error) {
                console.warn(`[WARN] Could not change permissions: ${error.message}`);
            }
        }

        return true;
    }
    return false;
}

const processedFiles = new Set();
const pendingFiles = [];
let batchTimer = null;

function scanForNewFiles(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            return [];
        }

        const newFiles = [];

        function scanRecursive(currentPath) {
            const files = fs.readdirSync(currentPath);

            for (const file of files) {
                const filePath = path.join(currentPath, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    // Recursively scan subdirectories
                    scanRecursive(filePath);
                } else {
                    // Skip already processed files
                    if (processedFiles.has(filePath)) {
                        continue;
                    }

                    // Skip encrypted files (*.en.js)
                    if (file.endsWith('.en.js')) {
                        continue;
                    }

                    newFiles.push(filePath);
                }
            }
        }

        scanRecursive(dirPath);
        return newFiles;
    } catch (error) {
        console.error(`Failed to scan directory ${dirPath}:`, error.message);
        return [];
    }
}

async function processBatch() {
    if (pendingFiles.length === 0) {
        return;
    }

    const filesToProcess = [...pendingFiles];
    pendingFiles.length = 0;

    console.log(`[BATCH] Processing ${filesToProcess.length} file(s)`);

    try {
        const result = await processBatchEncryption(
            filesToProcess,
            OUTPUT_DIR,
            DEFAULT_PASSWORD
        );

        for (const outputResult of result.outputResults) {
            if (outputResult.success) {
                processedFiles.add(outputResult.originalPath);

                // Delete original file after successful encryption
                try {
                    fs.unlinkSync(outputResult.originalPath);
                    console.log(`[DELETE] Removed original file: ${path.basename(outputResult.originalPath)}`);
                } catch (error) {
                    console.warn(`[WARN] Could not delete original file: ${error.message}`);
                }
            }
        }

        console.log(`[BATCH] Completed: ${result.successful}/${result.total} files in ${result.duration}ms`);
    } catch (error) {
        console.error(`[BATCH ERROR]`, error.message);

        for (const file of filesToProcess) {
            processedFiles.add(file);
        }
    }
}

function scheduleBatch() {
    if (batchTimer) {
        clearTimeout(batchTimer);
    }

    if (pendingFiles.length >= BATCH_SIZE) {
        processBatch();
    } else if (pendingFiles.length > 0) {
        batchTimer = setTimeout(() => {
            processBatch();
        }, BATCH_TIMEOUT);
    }
}

function addToBatch(files) {
    for (const file of files) {
        if (!pendingFiles.includes(file)) {
            pendingFiles.push(file);
            console.log(`[QUEUE] ${path.basename(file)} (${pendingFiles.length} in queue)`);
        }
    }

    scheduleBatch();
}

let scanCount = 0;

async function mainLoop() {
    try {
        scanCount++;

        const appBuildDir = getAppBuildDirectory();

        if (scanCount === 1) {
            ensureDirectory(appBuildDir);
        }

        const newFiles = scanForNewFiles(appBuildDir);

        if (newFiles.length > 0) {
            console.log(`[SCAN #${scanCount}] Found ${newFiles.length} new file(s)`);
            addToBatch(newFiles);
        } else {
            if (scanCount % 60 === 0) {
                console.log(`[${new Date().toLocaleTimeString()}] Daemon heartbeat - Scan #${scanCount}`);
                console.log(`  Build directory: ${appBuildDir}`);
                console.log(`  Processed files: ${processedFiles.size}`);
                console.log(`  Pending batch: ${pendingFiles.length}`);
            }
        }
    } catch (error) {
        console.error(`[ERROR] Main loop error:`, error.message);
        console.error(error.stack);
    }
}

console.log("=== Configuration ===");
console.log("CORE_NODE_ROOT:", CORE_NODE_ROOT);
console.log("APP_NAME:", APP_NAME);
console.log("OUTPUT_DIR:", OUTPUT_DIR);
console.log("SCAN_INTERVAL:", SCAN_INTERVAL, "ms");
console.log("BATCH_SIZE:", BATCH_SIZE, "files");
console.log("BATCH_TIMEOUT:", BATCH_TIMEOUT, "ms");
console.log("");

const buildDir = getBuildDirectory();
const appBuildDir = getAppBuildDirectory();

console.log("=== Build Directory Mapping ===");
console.log("Base /www path:", getWebPath('www'));
console.log("Build directory:", buildDir);
console.log("App build directory:", appBuildDir);
console.log("");

const realUser = getRealUser();
console.log("=== User Detection ===");
console.log("Real system user:", realUser);
console.log("");

ensureDirectory(buildDir);
ensureDirectory(appBuildDir);

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o755 });
}

console.log("=== Starting Daemon Loop ===");
console.log("Scanning every", SCAN_INTERVAL, "ms");
console.log("Batch mode: Process up to", BATCH_SIZE, "files at once");
console.log("");

const intervalId = setInterval(mainLoop, SCAN_INTERVAL);

process.on('SIGINT', async () => {
    console.log("");
    console.log("=== Daemon Shutdown ===");
    console.log("Received SIGINT signal");

    clearInterval(intervalId);

    if (pendingFiles.length > 0) {
        console.log("Processing remaining", pendingFiles.length, "file(s)...");
        await processBatch();
    }

    console.log("Total scans:", scanCount);
    console.log("Total processed files:", processedFiles.size);
    console.log("Goodbye!");
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log("");
    console.log("=== Daemon Shutdown ===");
    console.log("Received SIGTERM signal");

    clearInterval(intervalId);

    if (pendingFiles.length > 0) {
        console.log("Processing remaining", pendingFiles.length, "file(s)...");
        await processBatch();
    }

    console.log("Total scans:", scanCount);
    console.log("Total processed files:", processedFiles.size);
    console.log("Goodbye!");
    process.exit(0);
});

mainLoop();
