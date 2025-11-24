#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const fsp = fs.promises;
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const fsExtra = require('fs-extra');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const ORIGINAL_CWD = process.cwd();
const PAGES_DIR = path.join(SOURCE_ROOT, 'pages');
const BACKUP_DIR = path.join(SOURCE_ROOT, '.app-backups');
const APP_MAIN_PAGES_DIR = path.join(SOURCE_ROOT, 'app_main_pages');
const ARCHITECTURE_GUIDE_PATH = 'development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md';
const INDICATOR_FILE = 'INDEX.md';
const WATCH_DEBOUNCE_MS = 2000;
const COPY_IGNORE = ['.nuxt', '.output', '.git', '.app-backups'];
const WATCH_IGNORE = [...COPY_IGNORE, 'node_modules'];

let watcherInstance = null;
const pnpmProcesses = new Map();
let debounceTimer = null;
let syncInProgress = false;
let fileCounter = { copied: 0, total: 0, current: '' };

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ Error: ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function scanAvailableApps() {
  const apps = [];
  const entries = fs.readdirSync(SOURCE_ROOT, { withFileTypes: true });
  
  entries.forEach(entry => {
    if (entry.isDirectory() && entry.name.startsWith('app_') && entry.name.endsWith('_pages')) {
      const appName = entry.name.replace(/^app_/, '').replace(/_pages$/, '');
      if (appName !== 'main') {
        apps.push(appName);
      }
    }
  });
  
  return apps.sort();
}

const SUPPORTED_APPS = scanAvailableApps();

function clearDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  entries.forEach(entry => {
    const entryPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      clearDirectory(entryPath);
      fs.rmdirSync(entryPath);
    } else {
      fs.unlinkSync(entryPath);
    }
  });
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    error(`Source directory not found: ${src}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  entries.forEach(entry => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function createIndicatorFile(targetApp, pagesDir) {
  const indicatorPath = path.join(pagesDir, INDICATOR_FILE);
  const sourceDir = targetApp === 'main' ? 'app_main_pages' : `app_${targetApp}_pages`;
  
  const content = `# Pages Directory Indicator

⚠️ **DO NOT EDIT FILES IN THIS DIRECTORY DIRECTLY**

This \`pages/\` directory is automatically managed by the multi-app architecture system.

## Current Active App

**App Name:** ${targetApp === 'main' ? 'main (app_main_pages)' : targetApp}
**Source Directory:** \`${sourceDir}/\`

## How It Works

1. The \`pages/\` directory is **recursively cleared and repopulated** when switching apps
2. All files are copied from \`${sourceDir}/\` to \`pages/\`
3. Any changes made directly to \`pages/\` will be **lost** when switching apps

## How to Modify Pages

**✅ CORRECT:** Edit files in \`${sourceDir}/\`
- Changes persist across app switches
- Source of truth for app pages

**❌ WRONG:** Edit files in \`pages/\`
- Changes will be overwritten
- Not the source of truth

## Architecture Guide

For complete architecture documentation, see:
\`${ARCHITECTURE_GUIDE_PATH}\`

## Switching Apps

To switch to a different app:
\`\`\`bash
node scripts/switch-app.js [appname]
\`\`\`

Available apps: ${SUPPORTED_APPS.join(', ')}, main
`;

  fs.writeFileSync(indicatorPath, content, 'utf8');
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function backupCurrentPages() {
  if (!fs.existsSync(PAGES_DIR)) return null;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `pages.backup.${timestamp}`);
  
  copyDirectory(PAGES_DIR, backupPath);
  info(`Backed up current pages/ to: ${backupPath}`);
  
  return backupPath;
}

function getSourcePagesDir(targetApp) {
  if (targetApp === 'main') {
    return APP_MAIN_PAGES_DIR;
  }
  return path.join(SOURCE_ROOT, `app_${targetApp}_pages`);
}

function switchPagesDirectory(targetApp) {
  const sourcePagesDir = getSourcePagesDir(targetApp);
  
  if (!fs.existsSync(sourcePagesDir)) {
    error(`Source pages directory not found: ${sourcePagesDir}`);
    if (targetApp === 'main') {
      info(`Please ensure app_main_pages directory exists`);
    } else {
      info(`Please create the directory: app_${targetApp}_pages`);
    }
    process.exit(1);
  }
  
  backupCurrentPages();
  
  if (fs.existsSync(PAGES_DIR)) {
    clearDirectory(PAGES_DIR);
  } else {
    fs.mkdirSync(PAGES_DIR, { recursive: true });
  }
  
  copyDirectory(sourcePagesDir, PAGES_DIR);
  createIndicatorFile(targetApp, PAGES_DIR);
  
  success(`Successfully switched to ${targetApp} app pages`);
}

function pathExistsSync(filePath) {
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
    if (candidate && pathExistsSync(candidate)) {
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
    mode: null,
    factoryRoot: deriveFactoryRoot(),
    platform: detectPlatformSegment(),
    simpleMode: false
  };
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg === '--help' || arg === '-h') {
      return { command: 'help' };
    }
    
    if (arg === '--current' || arg === '-c') {
      return { command: 'current' };
    }
    
    if (arg === '--list' || arg === '-l') {
      return { command: 'list' };
    }
    
    if (!arg.startsWith('--')) {
      options.apps.push(arg);
      continue;
    }
    
    switch (arg) {
      case '--mode':
        options.mode = argv[++i] || 'dev';
        break;
      case '--factory-root':
        options.factoryRoot = path.resolve(argv[++i] || deriveFactoryRoot());
        break;
      case '--platform':
        options.platform = argv[++i] || detectPlatformSegment();
        break;
      case '--app':
        if (argv[i + 1]) options.apps.push(argv[++i]);
        break;
      case '--apps': {
        const listValue = argv[++i] || '';
        const list = listValue.split(',').map(item => item.trim()).filter(Boolean);
        options.apps.push(...list);
        break;
      }
    }
  }
  
  if (options.apps.length === 0) {
    const envValue = process.env.APP_ENTRY || '';
    if (envValue) {
      options.apps = envValue.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  
  options.apps = Array.from(new Set(options.apps));
  
  if (options.apps.length === 0) {
    return { command: 'help' };
  }
  
  if (!options.mode) {
    options.simpleMode = true;
  }
  
  return { command: 'run', options };
}

function showHelp() {
  log('\n📚 Multi-App Switcher', 'bright');
  log('\nUsage:');
  log('  node scripts/switch-app.js <app>                  Switch pages only');
  log('  node scripts/switch-app.js <app> --mode dev       Switch + factory sync + dev');
  log('  node scripts/switch-app.js <app> --mode build     Switch + factory sync + build');
  log('  node scripts/switch-app.js --apps a,b --mode dev  Multi-app dev mode');
  log('  node scripts/switch-app.js --current              Show current app');
  log('  node scripts/switch-app.js --list                 List backups');
  log('  node scripts/switch-app.js --help                 Show this help');
  log('\nSupported apps:', 'yellow');
  SUPPORTED_APPS.forEach(app => log(`  • ${app}`, 'cyan'));
  log('  • main (app_main_pages)', 'cyan');
  log('\nExamples:');
  log('  node scripts/switch-app.js ittools');
  log('  node scripts/switch-app.js pymatrix --mode dev');
  log('  APP_ENTRY=admin node scripts/switch-app.js');
}

function showCurrentApp() {
  if (!fs.existsSync(PAGES_DIR)) {
    log('pages/ directory does not exist', 'yellow');
    return;
  }
  
  const indicatorPath = path.join(PAGES_DIR, INDICATOR_FILE);
  
  if (fs.existsSync(indicatorPath)) {
    const content = fs.readFileSync(indicatorPath, 'utf8');
    const match = content.match(/\*\*App Name:\*\* (.+)/);
    
    if (match) {
      info(`Current app: ${match[1]}`);
    } else {
      log('Cannot determine current app from indicator file', 'yellow');
    }
  } else {
    log('Indicator file not found', 'yellow');
  }
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    info('No backups found');
    return;
  }
  
  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
  const backups = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('pages.backup.'))
    .map(entry => entry.name)
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    info('No backups found');
    return;
  }
  
  info('Available backups:');
  backups.forEach((backup, index) => {
    log(`  ${index + 1}. ${backup}`, 'cyan');
  });
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

function clearProgressLine() {
  if (process.stdout.isTTY) {
    process.stdout.write('\r\x1b[K');
  }
}

function printProgress(message, persist = false) {
  if (process.stdout.isTTY) {
    process.stdout.write('\r\x1b[K' + message);
    if (persist) {
      process.stdout.write('\n');
    }
  } else if (persist) {
    console.log(message);
  }
}

async function countFiles(dir) {
  let count = 0;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue;
    
    if (entry.isFile()) {
      count++;
    } else if (entry.isDirectory()) {
      count += await countFiles(path.join(dir, entry.name));
    }
  }
  
  return count;
}

async function mirrorDirectory(src, dest, showProgress = true) {
  console.log(`[Sync] Mirroring ${src} -> ${dest}`);
  await fsExtra.ensureDir(dest);
  
  if (showProgress) {
    fileCounter.copied = 0;
    fileCounter.total = await countFiles(src);
    fileCounter.current = '';
    printProgress(`[Sync] Counting files... Total: ${fileCounter.total}`, true);
  }
  
  await syncSourceToDest(src, dest, showProgress, src);
  
  if (showProgress) {
    clearProgressLine();
  }
  
  await removeStaleEntries(src, dest);
  console.log('[Sync] Initial mirror complete');
}

async function syncSourceToDest(src, dest, showProgress = false, rootSrc = null) {
  if (!rootSrc) rootSrc = src;
  
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue;
    
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await fsExtra.ensureDir(destPath);
      await syncSourceToDest(srcPath, destPath, showProgress, rootSrc);
    } else if (entry.isFile()) {
      const shouldCopy = await fileNeedsCopy(srcPath, destPath);
      if (shouldCopy) {
        await fsExtra.ensureDir(path.dirname(destPath));
        
        if (showProgress) {
          fileCounter.copied++;
          const relPath = path.relative(rootSrc, srcPath);
          const stats = await fsp.stat(srcPath);
          const sizeKB = (stats.size / 1024).toFixed(1);
          const progress = `${colors.blue}[${fileCounter.copied}/${fileCounter.total}]${colors.reset} ${relPath} ${colors.cyan}(${sizeKB} KB)${colors.reset}`;
          printProgress(progress);
        }
        
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
    if (!destStats.isFile()) return true;
    return srcStats.size !== destStats.size || srcStats.mtimeMs > destStats.mtimeMs + 5;
  } catch (err) {
    return true;
  }
}

async function removeStaleEntries(src, dest) {
  const destEntries = await fsp.readdir(dest, { withFileTypes: true });
  for (const entry of destEntries) {
    if (shouldIgnore(entry.name)) continue;
    
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

async function runSwitchInTarget(targetDir, app) {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === 'win32' ? 'node.exe' : 'node';
    const scriptPath = path.join(targetDir, 'scripts', 'switch-app.js');
    const proc = spawn(cmd, [scriptPath, app], {
      cwd: targetDir,
      stdio: 'inherit',
      env: { ...process.env, APP_ENTRY: app }
    });
    
    proc.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`switch-app.js exited with code ${code}`));
      }
    });
  });
}

function shouldPathBeIgnored(srcDir, targetPath) {
  const rel = path.relative(srcDir, targetPath);
  if (!rel || rel.startsWith('..')) return false;
  const segments = rel.split(path.sep);
  return segments.some(segment => WATCH_IGNORE.includes(segment));
}

function detectEntryAppFromPath(changedPath, runtimes) {
  if (!changedPath) return null;
  
  let absolutePath;
  try {
    absolutePath = path.resolve(changedPath);
  } catch (err) {
    return null;
  }
  
  const relativePath = path.relative(SOURCE_ROOT, absolutePath);
  if (!relativePath || relativePath.startsWith('..')) return null;
  
  const normalized = relativePath.replace(/\\/g, '/');
  const match = normalized.match(/^app_([^/]+)_pages\/index\.vue$/);
  if (!match) return null;
  
  const namespace = match[1];
  const isRuntimeTracked = runtimes.some(runtime => runtime.app === namespace);
  return isRuntimeTracked ? namespace : null;
}

function startWatcher(srcDir, runtimes) {
  if (watcherInstance) return watcherInstance;
  
  watcherInstance = chokidar.watch(srcDir, {
    ignored: name => shouldPathBeIgnored(srcDir, name),
    ignoreInitial: true,
    persistent: true
  });
  
  const pendingEntryApps = new Set();
  const newFilesDetected = new Set();
  
  const scheduleSync = (event, changedPath) => {
    if (changedPath) {
      const entryApp = detectEntryAppFromPath(changedPath, runtimes);
      if (entryApp) {
        pendingEntryApps.add(entryApp);
      }
      
      if (event === 'add' || event === 'addDir') {
        const relPath = path.relative(srcDir, changedPath);
        newFilesDetected.add(relPath);
        console.log(`${colors.cyan}[Watch] New ${event === 'addDir' ? 'directory' : 'file'} detected: ${relPath}${colors.reset}`);
      }
    }
    
    if (debounceTimer) return;
    
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      if (syncInProgress) return;
      syncInProgress = true;
      
      try {
        console.log('[Watcher] Detected change, syncing all runtimes...');
        
        if (newFilesDetected.size > 0) {
          console.log(`${colors.yellow}[Watcher] Processing ${newFilesDetected.size} new file/directory entries${colors.reset}`);
        }
        
        for (const runtime of runtimes) {
          console.log(`[Watcher] Syncing app ${runtime.app}`);
          await mirrorDirectory(srcDir, runtime.targetDir, true);
          await runSwitchInTarget(runtime.targetDir, runtime.app);
        }
        
        const entryApps = Array.from(pendingEntryApps);
        pendingEntryApps.clear();
        newFilesDetected.clear();
        
        if (entryApps.length > 0) {
          console.log(`[Watcher] Detected changes in app_*_pages directories: ${entryApps.join(', ')}`);
        }
        console.log('[Watcher] Sync complete');
      } catch (err) {
        console.error('[Watcher] Sync error:', err.message);
      } finally {
        syncInProgress = false;
      }
    }, WATCH_DEBOUNCE_MS);
  };
  
  watcherInstance.on('all', (event, changedPath) => scheduleSync(event, changedPath));
  return watcherInstance;
}

function startPnpmProcesses(runtimes, mode) {
  const exitPromises = [];
  
  for (const runtime of runtimes) {
    if (pnpmProcesses.has(runtime.app)) continue;
    
    const envVars = { 
      ...process.env, 
      APP_ENTRY: runtime.app,
      NUXT_HOST: '0.0.0.0',
      NUXT_PORT: process.env.NUXT_PORT || '3000'
    };
    const isWindows = process.platform === 'win32';
    
    let command, args, spawnOptions;
    
    if (mode === 'build') {
      if (isWindows) {
        command = process.env.ComSpec || 'cmd.exe';
        args = ['/d', '/s', '/c', 'pnpm nuxt build'];
        spawnOptions = {
          cwd: runtime.targetDir,
          stdio: 'inherit',
          windowsVerbatimArguments: true,
          env: envVars
        };
      } else {
        command = 'pnpm';
        args = ['nuxt', 'build'];
        spawnOptions = {
          cwd: runtime.targetDir,
          stdio: 'inherit',
          env: envVars
        };
      }
    } else {
      if (isWindows) {
        command = process.env.ComSpec || 'cmd.exe';
        args = ['/d', '/s', '/c', 'pnpm nuxt dev'];
        spawnOptions = {
          cwd: runtime.targetDir,
          stdio: 'inherit',
          windowsVerbatimArguments: true,
          env: envVars
        };
      } else {
        command = 'pnpm';
        args = ['nuxt', 'dev'];
        spawnOptions = {
          cwd: runtime.targetDir,
          stdio: 'inherit',
          env: envVars
        };
      }
    }
    
    console.log(`[Nuxt][${runtime.app}] Spawning ${command} ${args.join(' ')} in ${runtime.targetDir}`);
    const proc = spawn(command, args, spawnOptions);
    pnpmProcesses.set(runtime.app, proc);
    
    const exitPromise = new Promise(resolve => {
      proc.on('exit', code => {
        console.log(`[Nuxt][${runtime.app}] process exited with code ${code}`);
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

async function runFactoryMode(options) {
  const runtimes = options.apps.map(app => ({
    app,
    targetDir: getTargetDir(options.factoryRoot, options.platform, app)
  }));
  
  console.log('=== Nuxt Factory Sync ===');
  console.log('Source Root:', SOURCE_ROOT);
  console.log('Factory Root:', options.factoryRoot);
  console.log('Platform:', options.platform);
  console.log('Target Apps:', options.apps.join(', '));
  console.log('Mode:', options.mode);
  
  for (const runtime of runtimes) {
    console.log(`[Prep] Preparing runtime for ${runtime.app}`);
    await mirrorDirectory(SOURCE_ROOT, runtime.targetDir);
    await runSwitchInTarget(runtime.targetDir, runtime.app);
    console.log(`[Switch] Pages directory synced for ${runtime.app}`);
  }
  
  if (runtimes.length === 1) {
    const singleRuntime = runtimes[0];
    try {
      process.chdir(singleRuntime.targetDir);
      console.log(`[WorkingDir] Changed current directory to ${singleRuntime.targetDir}`);
    } catch (err) {
      console.error('[WorkingDir] Failed to change directory:', err.message);
    }
  }
  
  if (options.mode === 'dev') {
    startWatcher(SOURCE_ROOT, runtimes);
    console.log(`[Watch] File watcher initialized (2s debounce) for ${runtimes.length} app(s)`);
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

async function main() {
  const parsed = parseArgs();
  
  if (parsed.command === 'help') {
    showHelp();
    return;
  }
  
  if (parsed.command === 'current') {
    showCurrentApp();
    return;
  }
  
  if (parsed.command === 'list') {
    listBackups();
    return;
  }
  
  const { options } = parsed;
  const targetApp = options.apps[0];
  
  if (!SUPPORTED_APPS.includes(targetApp) && targetApp !== 'main') {
    error(`Unsupported app: ${targetApp}`);
    info(`Supported apps: ${SUPPORTED_APPS.join(', ')}, main`);
    process.exit(1);
  }
  
  if (options.simpleMode) {
    log(`\n🚀 Switching to ${targetApp} app pages...`, 'bright');
    ensureBackupDir();
    switchPagesDirectory(targetApp);
    log(`\n🎉 Ready to start ${targetApp} app!`, 'green');
    return;
  }
  
  await runFactoryMode(options);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  switchPagesDirectory,
  scanAvailableApps,
  SUPPORTED_APPS
};
