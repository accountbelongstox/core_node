
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
