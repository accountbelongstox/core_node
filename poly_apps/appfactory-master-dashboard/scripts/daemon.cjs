#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getRealUser, isRoot } = require('../../../scripts/nodetools/get_real_user.js');
const { processBatchEncryption, DEFAULT_PASSWORD } = require('./_daemon_tools/build_encryptor.cjs');
const { processImageEncryption, isImageFile } = require('./_daemon_tools/image_encryptor.cjs');
const { mapWebPath } = require('../../../scripts/nodetools/gvar_common.js');
const FileWatcher = require('./_daemon_tools/file_watcher.cjs');

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

const pendingFiles = [];
let batchTimer = null;

function shouldEncryptFile(sourcePath, targetPath) {
    // Encrypt if target doesn't exist
    if (!fs.existsSync(targetPath)) {
        return true;
    }

    // Encrypt if source is newer than target (has updates)
    const sourceStat = fs.statSync(sourcePath);
    const targetStat = fs.statSync(targetPath);
    return sourceStat.mtimeMs > targetStat.mtimeMs;
}

async function scanAndSyncDirectory() {
    const appBuildDir = getAppBuildDirectory();

    console.log('[SCAN] Starting directory scan...');

    if (!fs.existsSync(appBuildDir)) {
        console.warn(`[SCAN] Build directory does not exist: ${appBuildDir}`);
        return;
    }

    // Recursively scan all files
    const allFiles = [];

    function scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                scanDir(fullPath);
            } else if (entry.isFile()) {
                // Skip .en.js files
                if (!fullPath.endsWith('.en.js')) {
                    allFiles.push(fullPath);
                }
            }
        }
    }

    scanDir(appBuildDir);

    console.log(`[SCAN] Found ${allFiles.length} source file(s)`);

    // Check each file and add to batch if needs encryption
    for (const filePath of allFiles) {
        const relativePath = path.relative(appBuildDir, filePath);
        const relativeDir = path.dirname(relativePath);
        const targetDir = relativeDir === '.' ? OUTPUT_DIR : path.join(OUTPUT_DIR, relativeDir);

        const ext = path.extname(filePath);
        const nameWithoutExt = path.basename(filePath, ext);

        // Images use .en.js, other files use .en{ext}
        const targetExt = isImageFile(filePath) ? '.en.js' : `.en${ext}`;
        const targetPath = path.join(targetDir, `${nameWithoutExt}${targetExt}`);

        if (shouldEncryptFile(filePath, targetPath)) {
            console.log(`[SCAN] Needs encryption: ${relativePath}`);
            if (!pendingFiles.includes(filePath)) {
                pendingFiles.push(filePath);
            }
        }
    }

    if (pendingFiles.length > 0) {
        console.log(`[SCAN] Queued ${pendingFiles.length} file(s) for encryption`);
        scheduleBatch();
    } else {
        console.log('[SCAN] All files are up to date');
    }
}

async function processBatch() {
    if (pendingFiles.length === 0) {
        return;
    }

    const filesToProcess = [...pendingFiles];
    pendingFiles.length = 0;

    console.log(`[BATCH] Processing ${filesToProcess.length} file(s)`);

    const appBuildDir = getAppBuildDirectory();

    const imageFiles = [];
    const regularFiles = [];

    for (const filePath of filesToProcess) {
        if (isImageFile(filePath)) {
            imageFiles.push(filePath);
        } else {
            regularFiles.push(filePath);
        }
    }

    if (imageFiles.length > 0) {
        console.log(`[BATCH] Processing ${imageFiles.length} image file(s)`);

        // Image encryption: direct path sync
        // Source: /www/_build_dir/appfactory-master-dashboard/encrypted_assets/app_icon1.png
        // Target: /www/programing/core_node/poly_apps/appfactory-master-dashboard/encrypted_assets/app_icon1.en.js
        for (const filePath of imageFiles) {
            const relativePath = path.relative(appBuildDir, filePath);
            const relativeDir = path.dirname(relativePath);
            const targetDir = relativeDir === '.' ? OUTPUT_DIR : path.join(OUTPUT_DIR, relativeDir);

            // Calculate target file path
            const ext = path.extname(filePath);
            const nameWithoutExt = path.basename(filePath, ext);
            const targetPath = path.join(targetDir, `${nameWithoutExt}.en.js`);

            // Check if encryption is needed
            if (!shouldEncryptFile(filePath, targetPath)) {
                console.log(`[SKIP] ${relativePath} (up to date)`);
                continue;
            }

            console.log(`[ENCRYPT] ${relativePath}`);

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true, mode: 0o755 });
            }

            const result = await processImageEncryption(
                [filePath],
                targetDir,
                DEFAULT_PASSWORD
            );

            for (const outputResult of result.results) {
                if (outputResult.success) {
                    console.log(`[SUCCESS] ${relativePath} -> ${path.relative(OUTPUT_DIR, outputResult.outputPath)}`);
                } else {
                    console.error(`[FAILED] ${relativePath}: ${outputResult.error}`);
                }
            }
        }
    }

    if (regularFiles.length > 0) {
        console.log(`[BATCH] Processing ${regularFiles.length} regular file(s)`);

        for (const filePath of regularFiles) {
            const relativePath = path.relative(appBuildDir, filePath);
            const relativeDir = path.dirname(relativePath);
            const targetDir = relativeDir === '.' ? OUTPUT_DIR : path.join(OUTPUT_DIR, relativeDir);

            // Calculate target file path
            const ext = path.extname(filePath);
            const nameWithoutExt = path.basename(filePath, ext);
            const targetPath = path.join(targetDir, `${nameWithoutExt}.en${ext}`);

            // Check if encryption is needed
            if (!shouldEncryptFile(filePath, targetPath)) {
                console.log(`[SKIP] ${relativePath} (up to date)`);
                continue;
            }

            console.log(`[ENCRYPT] ${relativePath}`);

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true, mode: 0o755 });
            }

            const result = await processBatchEncryption(
                [filePath],
                targetDir,
                DEFAULT_PASSWORD
            );

            for (const outputResult of result.outputResults) {
                if (outputResult.success) {
                    console.log(`[SUCCESS] ${relativePath} -> ${path.relative(OUTPUT_DIR, outputResult.outputPath)}`);
                } else {
                    console.error(`[FAILED] ${relativePath}: ${outputResult.error}`);
                }
            }
        }
    }

    console.log(`[BATCH] Completed: ${filesToProcess.length} file(s)`);
}

function scheduleBatch() {
    if (pendingFiles.length >= BATCH_SIZE) {
        if (batchTimer) {
            clearTimeout(batchTimer);
            batchTimer = null;
        }
        processBatch();
    } else if (pendingFiles.length > 0 && !batchTimer) {
        batchTimer = setTimeout(() => {
            batchTimer = null;
            processBatch();
        }, BATCH_TIMEOUT);
    }
}

function addToBatch(files) {
    for (const file of files) {
        if (!pendingFiles.includes(file)) {
            pendingFiles.push(file);
            const relativePath = path.relative(getAppBuildDirectory(), file);
            console.log(`[QUEUE] ${relativePath} (${pendingFiles.length} in queue)`);
        }
    }

    scheduleBatch();
}

console.log("=== Configuration ===");
console.log("CORE_NODE_ROOT:", CORE_NODE_ROOT);
console.log("APP_NAME:", APP_NAME);
console.log("OUTPUT_DIR:", OUTPUT_DIR);
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

console.log("=== Starting File Watcher ===");

const fileWatcher = new FileWatcher({
    watchPath: appBuildDir,
    ignored: ['**/*.en.js', '**/node_modules/**']
});

fileWatcher.on('file:new', (filePath, stats) => {
    addToBatch([filePath]);
});

fileWatcher.on('file:modified', (filePath, stats) => {
    addToBatch([filePath]);
});

fileWatcher.on('error', (error) => {
    console.error('[ERROR] FileWatcher error:', error);
});

fileWatcher.start();

// Initial scan on startup
console.log("=== Initial Directory Scan ===");
scanAndSyncDirectory();

// Periodic scan every 5 seconds to detect missing files
const SCAN_INTERVAL = 5 * 1000; // 5 seconds
setInterval(() => {
    scanAndSyncDirectory();
}, SCAN_INTERVAL);
