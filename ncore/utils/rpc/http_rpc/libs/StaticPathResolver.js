const os = require('os');
const path = require('path');
const fs = require('fs');
const logger = require('#@logger');
const globalDir = require('#@global_dir');

class StaticPathResolver {
    constructor() {
        this.platform = os.platform();
        this.isWindows = this.platform === 'win32';
        this.isLinux = this.platform === 'linux';
        this.isWSL = this.detectWSL();
        this.hasDesktop = this.detectDesktopEnvironment();
        this.isProduction = !this.hasDesktop && !this.isWSL && this.isLinux;
    }

    detectWSL() {
        if (!this.isLinux) return false;

        try {
            if (fs.existsSync('/mnt/c/Users')) return true;

            const procVersion = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
            return procVersion.includes('microsoft') || procVersion.includes('wsl');
        } catch (error) {
            return false;
        }
    }

    detectDesktopEnvironment() {
        if (this.isWindows) return true;

        if (!this.isLinux) return false;

        if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) return true;

        if (process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION) return true;

        const desktopDirs = ['/usr/share/xsessions', '/usr/share/wayland-sessions'];
        return desktopDirs.some(dir => fs.existsSync(dir));
    }

    getBaseDataDirectory() {
        if (this.isWSL) {
            const dDrive = '/mnt/d';
            if (fs.existsSync(dDrive)) {
                return dDrive;
            }
            return '/mnt/c';
        }

        if (this.isWindows) {
            const drives = ['D:', 'E:', 'F:', 'C:'];
            for (const drive of drives) {
                const drivePath = path.join(drive, path.sep);
                if (fs.existsSync(drivePath)) {
                    return drive;
                }
            }
            return 'C:';
        }

        if (this.isLinux) {
            // NTFS-aware web base from the single JS definition (globaldir.js), desktop or headless
            return globalDir.WWW_BASE;
        }

        return process.cwd();
    }

    getCoreNodeProjectRoot() {
        return globalDir.rootdir;
    }

    resolveStaticPath(pathKey, subPath = '') {
        const baseDir = this.getBaseDataDirectory();
        let resolvedPath = '';

        switch (pathKey) {
            case 'wwwroot':
            case 'static':
            case 'uploads':
            case 'assets':
            case 'shared-data':
                resolvedPath = this.isLinux && !this.isWSL
                    ? globalDir.mapWebPath(pathKey)
                    : path.join(baseDir, 'www', pathKey);
                break;

            case 'public':
                const projectRoot = this.getCoreNodeProjectRoot();
                resolvedPath = path.join(projectRoot, 'public');
                break;

            default:
                resolvedPath = pathKey;
                break;
        }

        if (subPath) {
            resolvedPath = path.join(resolvedPath, subPath);
        }

        return path.normalize(resolvedPath);
    }

    ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            try {
                fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
                logger.debug(`Created directory: ${dirPath}`);
                return true;
            } catch (error) {
                logger.error(`Failed to create directory ${dirPath}:`, error);
                return false;
            }
        }
        return true;
    }

    getDefaultStaticPaths() {
        const paths = {};

        if (this.isWSL) {
            const baseDir = this.getBaseDataDirectory();
            paths['/static'] = [
                this.resolveStaticPath('static'),
                this.resolveStaticPath('wwwroot'),
                path.join(baseDir, 'www', 'public')
            ];
            paths['/assets'] = [this.resolveStaticPath('assets')];
            paths['/uploads'] = [this.resolveStaticPath('uploads')];
        } else if (this.isWindows) {
            const baseDir = this.getBaseDataDirectory();
            paths['/static'] = [
                path.join(baseDir, 'www', 'static'),
                path.join(baseDir, 'www', 'wwwroot')
            ];
            paths['/assets'] = [path.join(baseDir, 'www', 'assets')];
            paths['/uploads'] = [path.join(baseDir, 'www', 'uploads')];
        } else {
            paths['/static'] = [
                this.resolveStaticPath('static'),
                this.resolveStaticPath('wwwroot')
            ];
            paths['/assets'] = [this.resolveStaticPath('assets')];
            paths['/uploads'] = [this.resolveStaticPath('uploads')];
        }

        return paths;
    }

    getEnvironmentInfo() {
        return {
            platform: this.platform,
            isWindows: this.isWindows,
            isLinux: this.isLinux,
            isWSL: this.isWSL,
            hasDesktop: this.hasDesktop,
            isProduction: this.isProduction,
            baseDir: this.getBaseDataDirectory(),
            projectRoot: this.getCoreNodeProjectRoot()
        };
    }

    logEnvironmentInfo() {
        const info = this.getEnvironmentInfo();
        logger.info('Static Path Resolver Environment:');
        logger.info(`  Platform: ${info.platform}`);
        logger.info(`  Windows: ${info.isWindows}`);
        logger.info(`  Linux: ${info.isLinux}`);
        logger.info(`  WSL: ${info.isWSL}`);
        logger.info(`  Desktop: ${info.hasDesktop}`);
        logger.info(`  Production: ${info.isProduction}`);
        logger.info(`  Base Directory: ${info.baseDir}`);
        logger.info(`  Project Root: ${info.projectRoot}`);
    }
}

const defaultResolver = new StaticPathResolver();

module.exports = {
    StaticPathResolver,
    defaultResolver,
    resolveStaticPath: (pathKey, subPath) => defaultResolver.resolveStaticPath(pathKey, subPath),
    getDefaultStaticPaths: () => defaultResolver.getDefaultStaticPaths(),
    ensureDirectory: (dirPath) => defaultResolver.ensureDirectory(dirPath),
    getEnvironmentInfo: () => defaultResolver.getEnvironmentInfo(),
    logEnvironmentInfo: () => defaultResolver.logEnvironmentInfo()
};
