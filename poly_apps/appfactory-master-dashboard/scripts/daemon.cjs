#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getRealUser, isRoot } = require('../../../scripts/nodetools/get_real_user.js');
const { processBatchEncryption, DEFAULT_PASSWORD } = require('./_daemon_tools/build_encryptor.cjs');
const { mapWebPath } = require('../../../scripts/nodetools/gvar_common.js');

console.log("=== Build Factory Daemon Service (Node.js) ===");
console.log("Started at:", new Date().toISOString());
console.log("Script directory:", __dirname);
console.log("");

// Configuration
const CORE_NODE_ROOT = path.resolve(__dirname, '../../..');

// APP_NAME is the parent directory name of the scripts directory
// e.g., for poly_apps/appfactory-master-dashboard/scripts/daemon.cjs
// APP_NAME will be 'appfactory-master-dashboard'
const APP_NAME = path.basename(path.resolve(__dirname, '..'));

const OUTPUT_DIR = path.join(CORE_NODE_ROOT, 'poly_apps', APP_NAME);

const SCAN_INTERVAL = 1000;

const BATCH_SIZE = 10;
const BATCH_TIMEOUT = 5000;

// Use mapWebPath from gvar_common.js module
function getWebPath(pathKey) {
    // Map 'build_dir' to www/_build_dir
    if (pathKey === 'build_dir') {
        const wwwPath = mapWebPath('www');
        return path.join(wwwPath, '_build_dir');
    }
    // Use mapWebPath for other keys
    return mapWebPath(pathKey);
}

function getBuildDirectory() {
    return getWebPath('build_dir');
}

function getAppBuildDirectory() {
    const buildDir = getBuildDirectory();
    return path.join(buildDir, APP_NAME);
}

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        console.log(`[CREATE] Directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });

        const user = getRealUser();
        if (isRoot() && user !== 'root') {
            try {
                execSync(`chown -R ${user}:${user} "${dirPath}"`, { stdio: 'ignore' });
                execSync(`chmod -R 755 "${dirPath}"`, { stdio: 'ignore' });
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
console.log("Running as root:", isRoot());
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

// Note: Signal handlers removed - systemd will handle service termination
// The daemon will run continuously until stopped by systemd

mainLoop();
