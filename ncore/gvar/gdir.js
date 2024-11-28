import fs from 'fs';
import path from 'path';
import process from 'process';
import os from 'os';
import { fileURLToPath } from 'url';
import printer from '../base/printer.js';
import findBin from './libs/find_bin.js';
import {getAppName} from './libs/appname.js';
let appname = getAppName()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic directory functions
function getCwd() {
    return path.join(__dirname, '..', '..');
}

const BASEDIR = getCwd();
const CWD = BASEDIR;
const CACHE_DIR = path.join(BASEDIR, '.cache');
const LOG_DIR = path.join(CACHE_DIR, '.logs');
const LOCAL_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.local');
const PUBLIC_DIR = path.join(BASEDIR, 'public');
const APP_PUBLIC_DIR = appname ? path.join(PUBLIC_DIR, appname) : PUBLIC_DIR;

// Create essential directories
mkdir(CACHE_DIR);
mkdir(LOG_DIR);
mkdir(LOCAL_DIR);
mkdir(PUBLIC_DIR);
mkdir(APP_PUBLIC_DIR);

// Directory creation
function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}

// Drive management functions
function getSystemDrives() {
    const drives = [];
    
    if (process.platform === 'win32') {
        // Windows: Check all possible drive letters
        for (let i = 65; i <= 90; i++) { // A-Z
            const driveLetter = String.fromCharCode(i);
            const drivePath = `${driveLetter}:\\`;
            try {
                const stats = fs.statSync(drivePath);
                if (stats) {
                    const type = getDriveType(drivePath);
                    if (type !== 'REMOVABLE' && type !== 'CDROM') {
                        drives.push({
                            path: drivePath,
                            type: type,
                            size: getDriveSize(drivePath)
                        });
                    }
                }
            } catch (error) {
                // Drive letter not available
            }
        }
    } else {
        // Unix-like systems: Get mount points
        const mounts = fs.readFileSync('/proc/mounts', 'utf-8')
            .split('\n')
            .filter(line => line.startsWith('/dev/'));
            
        mounts.forEach(mount => {
            const [device, mountPoint] = mount.split(' ');
            if (!mountPoint.startsWith('/dev') && !mountPoint.startsWith('/proc')) {
                try {
                    drives.push({
                        path: mountPoint,
                        type: 'FIXED',
                        size: getDriveSize(mountPoint)
                    });
                } catch (error) {
                    // Skip if can't get drive info
                }
            }
        });
    }
    
    return drives;
}

function getDriveType(drive) {
    if (process.platform !== 'win32') return 'UNKNOWN';
    
    try {
        const stats = fs.statSync(drive);
        if ((stats.mode & 0xF000) === 0x6000) {
            return 'CDROM';
        }
        const size = getDriveSize(drive);
        return (size.total > 64 * 1024 * 1024 * 1024) ? 'FIXED' : 'REMOVABLE';
    } catch (error) {
        return 'UNKNOWN';
    }
}

function getDriveSize(drive) {
    try {
        const stats = fs.statfsSync(drive);
        return {
            total: stats.blocks * stats.bsize,
            free: stats.bfree * stats.bsize,
            used: (stats.blocks - stats.bfree) * stats.bsize
        };
    } catch (error) {
        return { total: 0, free: 0, used: 0 };
    }
}

function getMaxDrive(drives) {
    return drives.reduce((max, drive) => {
        return (!max || drive.size.total > max.size.total) ? drive : max;
    }, null);
}

// Initialize drives and maxDrive
const drives = getSystemDrives();
const maxDrive = getMaxDrive(drives);

function getSystemPaths() {
    return {
        home: os.homedir(),
        temp: os.tmpdir(),
        maxDrive: maxDrive?.path || os.homedir(),
        drives: drives.map(drive => drive.path),
        cwd: CWD,
        basedir: BASEDIR,
        cacheDir: CACHE_DIR,
        logDir: LOG_DIR,
        localDir: LOCAL_DIR
    };
}

function getMaxDrivePath() {
    return maxDrive?.path || os.homedir();
}

// Main test function
function main() {
    printer.title('Directory and Drive Information')
        .section('Basic Directories')
        .info('CWD:', CWD)
        .info('Base Dir:', BASEDIR)
        .info('Cache Dir:', CACHE_DIR)
        .info('Log Dir:', LOG_DIR)
        .info('Local Dir:', LOCAL_DIR)
        
        .section('System Paths')
        .json(getSystemPaths())
        
        .section('All Drives')
        .table(drives.map(drive => ({
            Path: drive.path,
            Type: drive.type,
            'Total (GB)': Math.round(drive.size.total / 1024 / 1024 / 1024),
            'Free (GB)': Math.round(drive.size.free / 1024 / 1024 / 1024)
        })))
        
        .section('Max Drive')
        .info('Max Drive Path:', getMaxDrivePath());
}

// Run main if this file is executed directly
const currentFileUrl = import.meta.url;
const currentFilePath = fileURLToPath(currentFileUrl);
const processFilePath = path.resolve(process.argv[1]);

if (currentFilePath === processFilePath) {
    main();
}

export {
    // Basic directory functions
    getCwd,
    mkdir,
    
    // Directory constants
    BASEDIR,
    CWD,
    CACHE_DIR,
    LOG_DIR,
    LOCAL_DIR,
    PUBLIC_DIR,
    APP_PUBLIC_DIR,
    
    // Drive management functions
    getSystemDrives,
    getDriveType,
    getDriveSize,
    getMaxDrive,
    getSystemPaths,
    getMaxDrivePath,
    
    // Drive data
    drives,
    maxDrive,
    findBin
};
