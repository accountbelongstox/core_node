#!/usr/bin/env node

// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/**
 * Enhanced multi-app entry switcher.
 *
 * Features:
 * 1. Mirrors the Nuxt workspace into a factory build directory (per app namespace).
 * 2. Runs the classic switch-app-entry script inside the mirrored tree.
 * 3. Starts a file watcher that keeps the factory tree in sync (every ~2s).
 * 4. Launches pnpm dev/build commands from the factory tree so multiple apps can run concurrently.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const fsExtra = require('fs-extra');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const ORIGINAL_CWD = process.cwd();
const DEFAULT_FACTORY_ROOT = deriveFactoryRoot();
const DEFAULT_PLATFORM_SEGMENT = detectPlatformSegment();
const WATCH_DEBOUNCE_MS = 2000;
const COPY_IGNORE = ['.nuxt', '.output', '.git', '.app-backups'];
const WATCH_IGNORE = [...COPY_IGNORE, 'node_modules'];

let watcherInstance = null;
const pnpmProcesses = new Map();
let debounceTimer = null;
let syncInProgress = false;

function pathExists(filePath) {
    try {
        fs.accessSync(filePath);
        return true;
    } catch (err) {
        return false;
    }
}

function getBaseDataDirectory() {
    if (process.env.NUXT_FACTORY_BASE_DIR) {
        return path.resolve(process.env.NUXT_FACTORY_BASE_DIR);
    }

    const candidates = [];

    if (process.platform === 'win32') {
        candidates.push('D:/programing', 'D:/', 'C:/programing');
    } else {
        candidates.push('/mnt/d/programing', '/mnt/d', '/www');
    }

    candidates.push(path.join(os.homedir(), 'nuxt_factory'));
    candidates.push(process.cwd());

    for (const candidate of candidates) {
        if (candidate && pathExists(candidate)) {
            return path.resolve(candidate);
        }
    }

    return path.resolve(process.cwd());
}

function detectPlatformSegment() {
    switch (process.platform) {
        case 'win32':
            return 'windows';
        case 'darwin':
            return 'darwin';
        default:
            return 'linux';
    }
}

function deriveFactoryRoot() {
    const baseDir = getBaseDataDirectory();
    const platform = detectPlatformSegment();
    const buildDirName = platform === 'linux' ? '_build_dir' : '.build_dir';
    return path.join(baseDir, buildDirName, 'nuxt_factory');
}

function parseArgs() {
    const argv = process.argv.slice(2);
    const options = {
        apps: [],
        mode: 'dev',
        factoryRoot: DEFAULT_FACTORY_ROOT,
        platform: DEFAULT_PLATFORM_SEGMENT
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) {
            options.apps.push(arg);
            continue;
        }

        switch (arg) {
            case '--mode':
                options.mode = argv[++i] || 'dev';
                break;
            case '--factory-root':
                options.factoryRoot = path.resolve(argv[++i] || DEFAULT_FACTORY_ROOT);
                break;
            case '--platform':
                options.platform = argv[++i] || DEFAULT_PLATFORM_SEGMENT;
                break;
            case '--app':
                if (argv[i + 1]) {
                    options.apps.push(argv[++i]);
                }
                break;
            case '--apps': {
                const listValue = argv[++i] || '';
                const list = listValue
                    .split(',')
                    .map(item => item.trim())
                    .filter(Boolean);
                options.apps.push(...list);
                break;
            }
            default:
                break;
        }
    }

    if (options.apps.length === 0) {
        const envValue = process.env.APP_ENTRY || '';
        if (envValue) {
            options.apps = envValue
                .split(',')
                .map(item => item.trim())
                .filter(Boolean);
        }
    }

    options.apps = Array.from(new Set(options.apps));

    if (options.apps.length === 0) {
        console.error('✗ Missing app name(s). Usage: node switch-app-entry-plus.js <app> [--mode dev|build] or --apps app1,app2');
        process.exit(1);
    }

    return options;
}

function getTargetDir(factoryRoot, platform, app) {
    const segment = `_app_${app}`;
    if (platform === 'linux') {
        return path.join(factoryRoot, 'linux', segment);
    }
    return path.join(factoryRoot, segment);
}

function shouldIgnore(name) {
    return COPY_IGNORE.includes(name);
}

async function mirrorDirectory(src, dest) {
    console.log(`[Sync] Mirroring ${src} -> ${dest}`);
    await fsExtra.ensureDir(dest);
    await syncSourceToDest(src, dest);
    await removeStaleEntries(src, dest);
    console.log('[Sync] Initial mirror complete');
}


async function syncSourceToDest(src, dest) {
    const entries = await fsp.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        if (shouldIgnore(entry.name)) {
            continue;
        }

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await fsExtra.ensureDir(destPath);
            await syncSourceToDest(srcPath, destPath);
        } else if (entry.isFile()) {
            const shouldCopy = await fileNeedsCopy(srcPath, destPath);
            if (shouldCopy) {
                await fsExtra.ensureDir(path.dirname(destPath));
                await fsExtra.copy(srcPath, destPath);
                const stats = await fsp.stat(srcPath);
                await fsp.utimes(destPath, stats.atime, stats.mtime).catch(() => {});
            }
        }
    }
}

async function fileNeedsCopy(srcPath, destPath) {
    try {
        const [srcStats, destStats] = await Promise.all([fsp.stat(srcPath), fsp.stat(destPath)]);
        if (!destStats.isFile()) {
            return true;
        }
        return srcStats.size !== destStats.size || srcStats.mtimeMs > destStats.mtimeMs + 5;
    } catch (err) {
        return true;
    }
}

async function removeStaleEntries(src, dest) {
    const destEntries = await fsp.readdir(dest, { withFileTypes: true });
    for (const entry of destEntries) {
        if (shouldIgnore(entry.name)) {
            continue;
        }

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        const existsInSrc = await fsExtra.pathExists(srcPath);
        if (!existsInSrc) {
            await fsExtra.remove(destPath);
            continue;
        }

        if (entry.isDirectory()) {
            await removeStaleEntries(srcPath, destPath);
        }
    }
}

async function runSwitchScript(targetDir, app) {
    return new Promise((resolve, reject) => {
        const cmd = process.platform === 'win32' ? 'node.exe' : 'node';
        const proc = spawn(cmd, ['scripts/switch-app-entry.js', app], {
            cwd: targetDir,
            stdio: 'inherit',
            env: { ...process.env, APP_ENTRY: app }
        });

        proc.on('exit', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`switch-app-entry.js exited with code ${code}`));
            }
        });
    });
}

async function syncAppIndexFiles(runtime) {
    const pagesDir = path.join(runtime.targetDir, 'pages');
    const appEntryFile = path.join(pagesDir, `index.${runtime.app}.vue`);
    const indexFile = path.join(pagesDir, 'index.vue');

    try {
        const exists = await fsExtra.pathExists(appEntryFile);
        if (!exists) {
            console.warn(`[EntrySync] Missing ${appEntryFile}, skipping index sync`);
            return;
        }

        await fsExtra.ensureDir(pagesDir);
        await fsExtra.copy(appEntryFile, indexFile);
        const stats = await fsp.stat(appEntryFile);
        await fsp.utimes(indexFile, stats.atime, stats.mtime).catch(() => {});
        console.log(`[EntrySync] Synced ${appEntryFile} -> ${indexFile}`);
    } catch (err) {
        console.error(`[EntrySync] Failed to sync index for ${runtime.app}: ${err.message}`);
    }
}

function shouldPathBeIgnored(srcDir, targetPath) {
    const rel = path.relative(srcDir, targetPath);
    if (!rel || rel.startsWith('..')) {
        return false;
    }
    const segments = rel.split(path.sep);
    return segments.some(segment => WATCH_IGNORE.includes(segment));
}

function detectEntryAppFromPath(changedPath, runtimes) {
    if (!changedPath) {
        return null;
    }

    let absolutePath;
    try {
        absolutePath = path.resolve(changedPath);
    } catch (err) {
        return null;
    }

    const relativePath = path.relative(SOURCE_ROOT, absolutePath);
    if (!relativePath || relativePath.startsWith('..')) {
        return null;
    }

    const normalized = relativePath.replace(/\\/g, '/');
    const match = normalized.match(/^pages\/index\.([^.]+)\.vue$/);
    if (!match) {
        return null;
    }

    const namespace = match[1];
    const isRuntimeTracked = runtimes.some(runtime => runtime.app === namespace);
    return isRuntimeTracked ? namespace : null;
}

function startWatcher(srcDir, runtimes) {
    if (watcherInstance) {
        return watcherInstance;
    }

    watcherInstance = chokidar.watch(srcDir, {
        ignored: name => shouldPathBeIgnored(srcDir, name),
        ignoreInitial: true,
        persistent: true
    });

    const pendingEntryApps = new Set();

    const scheduleSync = changedPath => {
        if (changedPath) {
            const entryApp = detectEntryAppFromPath(changedPath, runtimes);
            if (entryApp) {
                pendingEntryApps.add(entryApp);
            }
        }

        if (debounceTimer) {
            return;
        }
        debounceTimer = setTimeout(async () => {
            debounceTimer = null;
            if (syncInProgress) {
                return;
            }
            syncInProgress = true;
            try {
                console.log('[Watcher] Detected change, syncing all runtimes...');
                for (const runtime of runtimes) {
                    console.log(`[Watcher] Syncing app ${runtime.app}`);
                    await mirrorDirectory(srcDir, runtime.targetDir);
                    await runSwitchScript(runtime.targetDir, runtime.app);
                    await syncAppIndexFiles(runtime);
                }
                const entryApps = Array.from(pendingEntryApps);
                pendingEntryApps.clear();
                for (const entryApp of entryApps) {
                    console.log(`[Watcher] Updating source placeholder for ${entryApp}`);
                    await runSwitchScript(SOURCE_ROOT, entryApp);
                }
                console.log('[Watcher] Sync complete');
            } catch (err) {
                console.error('[Watcher] Sync error:', err.message);
            } finally {
                syncInProgress = false;
            }
        }, WATCH_DEBOUNCE_MS);
    };

    watcherInstance.on('all', (event, changedPath) => scheduleSync(changedPath));
    return watcherInstance;
}

function startPnpmProcesses(runtimes, mode) {
    const exitPromises = [];

    for (const runtime of runtimes) {
        if (pnpmProcesses.has(runtime.app)) {
            continue;
        }

        const scriptName = mode === 'build' ? `build:${runtime.app}` : `dev:${runtime.app}`;
        const envVars = { ...process.env, APP_ENTRY: runtime.app };
        const isWindows = process.platform === 'win32';

        let command;
        let args;
        let spawnOptions;

        if (isWindows) {
            command = process.env.ComSpec || 'cmd.exe';
            args = ['/d', '/s', '/c', `pnpm ${scriptName}`];
            spawnOptions = {
                cwd: runtime.targetDir,
                stdio: 'inherit',
                windowsVerbatimArguments: true,
                env: envVars
            };
        } else {
            command = 'pnpm';
            args = [scriptName];
            spawnOptions = {
                cwd: runtime.targetDir,
                stdio: 'inherit',
                env: envVars
            };
        }

        console.log(`[PNPM][${runtime.app}] Spawning ${command} ${args.join(' ')} in ${runtime.targetDir}`);
        const proc = spawn(command, args, spawnOptions);
        pnpmProcesses.set(runtime.app, proc);

        const exitPromise = new Promise(resolve => {
            proc.on('exit', code => {
                console.log(`[PNPM][${runtime.app}] process exited with code ${code}`);
                pnpmProcesses.delete(runtime.app);
                resolve({ app: runtime.app, code });
            });
        });

        exitPromises.push(exitPromise);
    }

    return exitPromises;
}

function setupCleanup() {
    const cleanup = () => {
        console.log('[Cleanup] Shutting down watcher and pnpm processes');
        if (watcherInstance) {
            watcherInstance.close();
            watcherInstance = null;
        }
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        for (const proc of pnpmProcesses.values()) {
            try {
                proc.kill();
            } catch (err) {
                console.error('[Cleanup] Failed to kill pnpm process:', err.message);
            }
        }
        pnpmProcesses.clear();
        try {
            process.chdir(ORIGINAL_CWD);
            console.log(`[Cleanup] Restored working directory to ${ORIGINAL_CWD}`);
        } catch (err) {
            console.error('[Cleanup] Failed to restore working directory:', err.message);
        }
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

async function main() {
    const options = parseArgs();
    const runtimes = options.apps.map(app => ({
        app,
        targetDir: getTargetDir(options.factoryRoot, options.platform, app)
    }));

    console.log('=== Nuxt Factory Sync ===');
    console.log('Source Root:', SOURCE_ROOT);
    console.log('Factory Root:', options.factoryRoot);
    console.log('Platform:', options.platform);
    console.log('Target Apps:', options.apps.join(', '));

    for (const runtime of runtimes) {
        console.log(`[Prep] Preparing runtime for ${runtime.app}`);
        await mirrorDirectory(SOURCE_ROOT, runtime.targetDir);
        await runSwitchScript(runtime.targetDir, runtime.app);
        await syncAppIndexFiles(runtime);
        console.log(`[Switch+] Entry file synced for ${runtime.app}`);
    }

    if (runtimes.length === 1) {
        const singleRuntime = runtimes[0];
        try {
            process.chdir(singleRuntime.targetDir);
            console.log(`[WorkingDir] Changed current directory to ${singleRuntime.targetDir}`);
        } catch (err) {
            console.error('[WorkingDir] Failed to change directory:', err.message);
        }
    } else {
        console.log('[WorkingDir] Retaining original working directory for multi-app mode');
    }

    if (options.mode === 'dev') {
        startWatcher(SOURCE_ROOT, runtimes);
        console.log(`[Watch] File watcher initialized (2s debounce interval) for ${runtimes.length} app(s)`);
    } else {
        console.log('[Watch] Skipped file watcher initialization for build mode');
    }

    console.log(`[PNPM] Starting ${options.mode} pipelines for ${options.apps.join(', ')}`);
    const exitPromises = startPnpmProcesses(runtimes, options.mode);
    setupCleanup();

    if (options.mode === 'build') {
        const results = await Promise.all(exitPromises);
        const failed = results.filter(result => result.code !== 0);
        if (failed.length > 0) {
            console.error(`[Build] ${failed.length} pipeline(s) failed.`);
            failed.forEach(result => {
                console.error(`  - ${result.app} exited with code ${result.code}`);
            });
            process.exit(1);
        }

        console.log('[Build] All pipelines completed successfully.');
        try {
            process.chdir(ORIGINAL_CWD);
            console.log(`[Build] Restored working directory to ${ORIGINAL_CWD}`);
        } catch (err) {
            console.error('[Build] Failed to restore working directory:', err.message);
        }
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
