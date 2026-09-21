<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Providers;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * Path Mapper - Unified path mapping system
 * 
 * This class provides unified path mapping functionality that matches
 * the logic in gvar_common.sh map_web_path() to ensure consistency
 * between shell scripts and PHP code.
 * 
 * Canonical path mapping for application and runtime storage.
 */
class PathMapper
{
    /** Var-center keys that stay SHARED (unprefixed) across the OSes of one
     * machine: secrets and cross-OS contract/selector values. Every other key
     * is stored on disk as <OS tag>_<KEY> (see osVarTag) so Windows and Linux
     * on a dual-boot machine never overwrite each other. SYNC: pycore
     * core_node_dirs._SHARED_GVAR_KEYS / runtime_environment.sh
     * CORE_NODE_SHARED_GVAR_KEYS / CommonFunc.ps1 $script:SharedGlobalVarKeys. */
    private const SHARED_GVAR_KEYS = [
        'POSTGRES_PASSWORD',
        'MERCURE_PUBLISHER_JWT',
        'MERCURE_SUBSCRIBER_JWT',
        'DNSPOD_API_TOKEN',
        'DNSPOD_EMAIL',
        'TAILSCALE_DOMAIN_1',
        'DOMAIN_API_REGION_PREFIX',
        'DOMAIN_UI_BINDING',
        'START_WEB_SERVER',
        'WEB_SERVER_PLANE',
        'PHP_RUNTIME_PLANE',
        'SELECTED_REGION',
        'GIT_PUSH_BRANCH',
        'GIT_UPDATE_TYPE',
    ];

    /**
     * Map web path based on environment (PHP version of gvar_common.sh map_web_path)
     * 
     * Windows: Uses fixed D:\ drive for all web-related paths (matches deploy.ps1 logic)
     * Linux: Uses environment-aware path mapping (WSL, Desktop, Server)
     * 
     * @param string $pathKey The path key (wwwroot, nginxconfig, shared-data, backup, www, etc.)
     * @param string|null $subPath Optional sub-path to append
     * @return string The mapped path based on environment
     */
    public static function mapWebPath(string $pathKey, ?string $subPath = ""): string
    {
        // Detect Windows environment (matches deploy.ps1 Windows path logic)
        $isWindows = self::isWindows();
        
        // Get base path - Windows uses fixed D:\www, Linux uses environment-aware mapping
        if ($isWindows) {
            $basePath = "D:\\www";
        } else {
            // Linux: the web/data base is what the shell installer DETECTED + PERSISTED
            // (cross-language source of truth), else a full blkid/blockdev/findmnt
            // detection re-implemented in getBaseDataDirectory(). The chosen disk is
            // honored AS-IS -- NO production short-circuit and NO POSIX coercion: a
            // Windows NTFS DATA disk is SHARED with Windows. When that disk's ROOT is
            // mounted at /www, /www == D:\ and the SAME logical tree gains ONE EXTRA
            // LEVEL on Linux: D:\www == /www/www (NOT /www); on a Linux-only machine
            // /www is a plain native dir and there is NO extra level.
            // Priority: the persisted WWW_PATH central variable (single source of
            // truth, written by 3_setting_base.sh) -> live NTFS-root-mount detection
            // -> legacy data-base rule. PostgreSQL is unaffected -- its data dir
            // stays on native ext4 (pg_mount -> /var/lib/postgresql/d).
            $dataBase = self::getBaseDataDirectory();
            $wwwPathVar = self::readPersistedVar('WWW_PATH');
            if (self::isWSL()) {
                $basePath = $dataBase . '/www';
            } elseif ($wwwPathVar !== '' && is_dir($wwwPathVar)) {
                $basePath = $wwwPathVar;
            } elseif (self::wwwNtfsRootMounted()) {
                $basePath = '/www/www';
            } elseif ($dataBase === '/' || $dataBase === '/www') {
                $basePath = '/www';
            } else {
                $basePath = $dataBase . '/www';
            }
        }
        
        // Path separator based on OS
        $separator = $isWindows ? '\\' : '/';

        // Development-tooling location (node/python/go/...). Linux prefers a local
        // /opt when the root (/) filesystem has more than DEV_ROOT_MIN_FREE_GB free
        // (so it is NOT mapped onto the largest secondary disk), else the secondary
        // disk; Windows mirrors deploy.ps1 (D:\_win{ver}). Mirrors gvar_common.sh.
        [$compileBase, $devSuffix] = self::getDevCompileParts($isWindows);
        $compileDir = $compileBase . $separator . '_' . $devSuffix;

        // Map paths - structure is the same, only base path differs
        $mappedPath = match($pathKey) {
            'wwwroot' => $basePath . $separator . 'wwwroot',
            'nginxconfig' => $basePath . $separator . 'nginxconfig',
            'shared-data' => $basePath . $separator . 'shared-data',
            'backup' => $basePath . $separator . 'backup',
            'www' => $basePath,
            // Unified core_node runtime data root (see getCoreNodeRuntimeDir):
            // D:\www\core_node on Windows, /www/www/core_node on a dual-boot
            // Linux, /www/core_node on a Linux-only machine.
            'core_node_data' => self::getCoreNodeRuntimeDir(),
            // Shared download cache (HF / pip / whisper / torch models). Mirrors
            // gvar_common.sh + system_paths.py "cache": D:\www\cache on Windows,
            // /www/www/cache on a dual-boot Linux (extra level), /www/cache on a
            // Linux-only machine. NOTE: getSharedDownloadCacheDir() keeps the
            // native /var/_core_node/cache for the Linux-only case.
            'cache' => $basePath . $separator . 'cache',
            // Development tooling roots (node/python/go/...). See getDevCompileParts().
            'compile_dir' => $compileDir,
            'dev_system' => $compileDir,
            'applications_dir' => $compileDir . $separator . 'applications',
            'npm_global' => $compileDir . $separator . 'npm-global',
            'laravel_data_dir' => $basePath . $separator . 'wwwroot' . $separator . 'laravel_db',
            'app_external_data' => $basePath . $separator . 'wwwroot' . $separator . 'laravel_db' . $separator . 'external_data',
            // PostgreSQL data root on the shared web/data disk (native Windows +
            // native Linux server). Mirrors gvar_common.sh + system_paths.py
            // "postgresql". On WSL the cluster uses the ext4 image at pg_mount.
            'postgresql' => $basePath . $separator . 'wwwroot' . $separator . 'postgresql',
            'nginx' => $isWindows ? 'nginx.exe' : self::findActualPath('/etc/nginx'),
            'php' => $isWindows ? 'php.exe' : self::findActualPath('/etc/php'),
            'logs' => self::findLaravelLogPath($basePath),
            // Native ext4 loop-mount target for the PostgreSQL D-drive image (WSL
            // persistence). Mirrors gvar_common.sh + system_paths.py "pg_mount":
            // a native Linux path (off drvfs) so pg gets a postgres-owned, 0700
            // data dir. WSL-only concept; kept for parity (Windows uses sqlite).
            'pg_mount' => '/var/lib/postgresql/d',

            // Unified App Manager log namespace ROOT (scripts/app_manager/linux_sh).
            // Linux-server concept; fixed path mirrors gvar_common.sh +
            // system_paths.py. Retired predecessor: 'app_manager_logs_old'.
            'app_manager_logs' => $isWindows ? ($basePath . $separator . 'wwwroot' . $separator . 'laravel_db' . $separator . 'logs' . $separator . '_core_node') : '/opt/_core_node/logs',
            'app_manager_logs_old' => '/opt/core_node_unified_manager/logs',

            // Script paths - same structure, just normalize separators
            'scripts_dir' => str_replace('/', $separator, self::getCoreNodeDir() . '/scripts'),
            'shells_dir' => str_replace('/', $separator, self::getCoreNodeDir() . '/scripts/shells'),
            'linux_shells_dir' => str_replace('/', $separator, self::getCoreNodeDir() . '/scripts/shells/linux'),
            'debian_shells_dir' => str_replace('/', $separator, self::getCoreNodeDir() . '/scripts/shells/linux/debian'),
            'install_shells_dir' => str_replace('/', $separator, self::getCoreNodeDir() . '/scripts/shells/linux/debian/install_shells'),
            'common_shells_dir' => str_replace('/', $separator, self::getCoreNodeDir() . '/scripts/shells/linux/common'),
            'dd_helper_dir' => str_replace('/', $separator, self::getCoreNodeDir() . '/scripts/shells/linux/dd_helper'),

            // System paths - Binary commands (Windows: just command name, Linux: full path)
            'node_symlink' => $isWindows ? 'node.exe' : '/usr/local/bin/node',
            'go_symlink' => $isWindows ? 'go.exe' : '/usr/local/bin/go',
            'flutter_symlink' => $isWindows ? 'flutter.bat' : '/usr/local/bin/flutter',

            // System paths - System directories
            'systemd_dir' => $isWindows ? 'C:\\Windows\\System32' : '/etc/systemd/system',
            'systemd_bin' => $isWindows ? 'sc.exe' : '/usr/bin/systemctl',

            default => $pathKey,
        };
        
        // If sub_path is provided, concatenate it to the mapped path
        if ($subPath !== null && $subPath !== '') {
            // Remove leading slashes/backslashes from sub_path
            $subPath = ltrim($subPath, '/\\');
            // Normalize to OS-specific separator
            $subPath = str_replace(['/', '\\'], $separator, $subPath);
            $mappedPath = rtrim($mappedPath, '/\\') . $separator . $subPath;
        }
        
        return $mappedPath;
    }

    /**
     * Get base data directory (PHP version of gvar_common.sh::get_base_data_directory).
     * Priority: WSL /mnt/d -> run-anchor adopt (disk the checkout lives on) -> the base
     * the shell installer DETECTED + PERSISTED (source of truth) -> full blkid/blockdev/
     * findmnt detection re-implemented here -> '/'. The dedup in mapWebPath() collapses
     * '/' and '/www' to /www, so all three languages converge.
     */
    private static function getBaseDataDirectory(): string
    {
        // Priority 1: WSL /mnt/d
        if (self::isWSL()) {
            return '/mnt/d';
        }

        // Priority 1.5: the disk where THIS checkout physically lives wins (matches sh P1.5).
        // getCoreNodeDir() -> <base>/programing/core_node ; strip to <base>.
        $coreNode = rtrim(self::getCoreNodeDir(), '/');
        $suffix = '/programing/core_node';
        if (substr($coreNode, -strlen($suffix)) === $suffix) {
            $runBase = substr($coreNode, 0, -strlen($suffix));
            if ($runBase !== '' && self::pathHostsProject($runBase)) {
                return $runBase;
            }
        }

        // Priority 2: the base the shell installer detected + persisted (source of truth).
        $persisted = self::readPersistedBase();
        if ($persisted !== null) {
            return $persisted;
        }

        // Priority 3: the shell provided no base -> full disk detection here.
        $detected = self::detectLargestDiskBase();
        if ($detected !== null) {
            return $detected;
        }

        // Fallback: root '/' (mapWebPath collapses it to /www).
        return '/';
    }

    /** Run a shell command, return trimmed stdout or '' (never throws). */
    private static function shellTrim(string $cmd): string
    {
        if (!function_exists('shell_exec')) {
            return '';
        }
        $out = @shell_exec($cmd . ' 2>/dev/null');
        return $out === null ? '' : trim((string) $out);
    }

    /** Unified core_node runtime data root (no dot-prefixed names). Single
     * PHP source of truth; mirrors pycore core_node_dirs.get_core_node_data_dir,
     * runtime_environment.sh CORE_NODE_DATA_DIR and GlobalVars.ps1 USER_DIR:
     *   Windows:              D:\www\core_node
     *   Linux NTFS dual-boot: /www/www/core_node  (== D:\www\core_node)
     *   Linux native:         /www/core_node
     * CORE_NODE_DATA_DIR (already exported) wins on every platform. */
    public static function getCoreNodeRuntimeDir(): string
    {
        $env = trim((string) getenv('CORE_NODE_DATA_DIR'));
        if ($env !== '') {
            return rtrim($env, '/\\');
        }
        if (self::isWindows()) {
            return 'D:\\www\\core_node';
        }
        return (self::wwwNtfsRootMounted() ? '/www/www' : '/www') . '/core_node';
    }

    /** Var-center directory candidates (canonical first, legacy second).
     * Mirrors pycore core_node_dirs.iter_global_var_dirs: pre-relocation
     * installs keep var files at /var/_core_node/global_var. */
    private static function globalVarDirectories(): array
    {
        return [
            self::getCoreNodeRuntimeDir() . '/global_var',
            '/var/_core_node/global_var',
        ];
    }

    /** OS tag for per-OS var-center keys: DEBIAN_13, UBUNTU_26, WIN10, WIN11.
     * Linux parses /etc/os-release (ID + VERSION_ID major, mirroring
     * dd_helper/system_functions.sh CURRENT_SYSTEM); Windows derives
     * WIN10/WIN11 from the kernel build number (>= 22000 is Windows 11).
     * SYNC: pycore core_node_dirs.get_os_var_tag / runtime_environment.sh
     * OS_VAR_TAG / CommonFunc.ps1 Get-OsVarTag. */
    private static function osVarTag(): string
    {
        static $tag = null;
        if ($tag !== null) {
            return $tag;
        }
        $tag = 'UNKNOWN';
        if (self::isWindows()) {
            $version = (string) php_uname('v');
            if (preg_match('/build\s+(\d+)/i', $version, $m) || preg_match('/^(\d+)/', trim($version), $m)) {
                $tag = ((int) $m[1] >= 22000) ? 'WIN11' : 'WIN10';
            } else {
                $tag = 'WIN10';
            }
            return $tag;
        }
        $osId = '';
        $version = '0';
        $lines = @file('/etc/os-release', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (is_array($lines)) {
            foreach ($lines as $line) {
                if (strpos($line, 'ID=') === 0) {
                    $osId = strtoupper(trim(explode('=', $line, 2)[1], " \t\"'"));
                } elseif (strpos($line, 'VERSION_ID=') === 0) {
                    $version = explode('.', trim(explode('=', $line, 2)[1], " \t\"'"))[0];
                }
            }
        }
        if ($osId !== '') {
            $tag = $osId . '_' . ($version !== '' ? $version : '0');
        }
        return $tag;
    }

    /** Candidate on-disk names for a var-center key, first match wins: the
     * OS-tagged name, then the bare name (pre-tagging values and unmigrated
     * machines). Shared keys are always bare. */
    private static function persistedVarReadNames(string $key): array
    {
        $normalized = strtoupper((string) preg_replace('/[^A-Za-z0-9_]/', '', $key));
        if (in_array($normalized, self::SHARED_GVAR_KEYS, true)) {
            return [$normalized];
        }
        return [self::osVarTag() . '_' . $normalized, $normalized];
    }

    /** First line of a var-center file ('' when absent/unreadable). Mirrors
     * system_paths.py::_read_persisted_var; the canonical store lives at
     * <core_node_data_dir>/global_var/<KEY> (written by sh set_var/
     * set_env_and_var), with the legacy /var/_core_node/global_var as
     * read-fallback so pre-migration installs keep working. */
    private static function readPersistedVar(string $key): string
    {
        foreach (self::globalVarDirectories() as $dir) {
            foreach (self::persistedVarReadNames($key) as $name) {
                $file = $dir . '/' . $name;
                if (!is_file($file) || !is_readable($file)) {
                    continue;
                }
                $val = (string) @file_get_contents($file);
                return trim((string) strtok($val, "\r\n"));
            }
        }
        return '';
    }

    /** True when /www is the ROOT of a mounted NTFS/data disk (the Windows D:\
     * root on a dual-boot machine, bound there by 3_setting_base.sh). Then the
     * SAME logical tree gains ONE EXTRA LEVEL on Linux:
     *   Windows D:\www == Linux /www/www  (NOT /www).
     * On a Linux-only machine /www is a plain native dir (same device as /) and
     * there is NO extra level. SINGLE Laravel definition; the shell twin lives
     * ONCE in runtime_environment.sh (CORE_NODE_WWW_BASE) and the pycore twin
     * in core_node_dirs.www_data_root_mounted (system_paths.py delegates). */
    private static function wwwNtfsRootMounted(): bool
    {
        if (!is_dir('/www/www')) {
            return false;
        }
        $srcWww = (string) strtok(self::shellTrim('findmnt -n -o SOURCE --target /www'), "\r\n");
        $srcRoot = (string) strtok(self::shellTrim('findmnt -n -o SOURCE --target /'), "\r\n");
        return $srcWww !== '' && $srcRoot !== '' && $srcWww !== $srcRoot;
    }

    /** Cross-OS shared model cache when /www is the mounted NTFS/data disk
     * root: Windows D:\www\cache == Linux /www/www/cache. Windows downloads
     * every model into D:\www\cache (SharedCacheEnv.ps1), so reusing the same
     * tree means each model downloads ONCE for both OSes. Model weights are
     * device-agnostic -- the same tree serves GPU (CUDA) and CPU runs on
     * unchanged hardware. Returns null on Linux-only machines (native cache). */
    private static function linuxCrossOsCacheDir(): ?string
    {
        $wwwPathVar = self::readPersistedVar('WWW_PATH');
        $candidate = null;
        if ($wwwPathVar !== '' && $wwwPathVar !== '/www' && is_dir($wwwPathVar)) {
            $candidate = rtrim($wwwPathVar, '/') . '/cache';
        } elseif (self::wwwNtfsRootMounted()) {
            $candidate = '/www/www/cache';
        }
        if ($candidate === null) {
            return null;
        }
        self::ensureDirectory($candidate);
        return is_dir($candidate) && is_writable($candidate) ? $candidate : null;
    }

    /** True when base/programing/core_node is a real checkout (.git or package.json). */
    private static function pathHostsProject(string $base): bool
    {
        $proj = rtrim($base, '/') . '/programing/core_node';
        return is_dir($proj) && (file_exists($proj . '/.git') || is_file($proj . '/package.json'));
    }

    /** True when $path is a real mountpoint on a device different from root's device. */
    private static function isRealDistinctMount(string $path): bool
    {
        if (!is_dir($path)) {
            return false;
        }
        $src = self::shellTrim('findmnt -n -o SOURCE --target ' . escapeshellarg($path));
        $rootSrc = self::shellTrim('findmnt -n -o SOURCE --target /');
        return $src !== '' && $src !== $rootSrc;
    }

    /** The base the shell installer detected + persisted (cross-language source of truth). */
    private static function readPersistedBase(): ?string
    {
        $val = self::readPersistedVar('BASE_DATA_DIR');
        if ($val === '') {
            return null;
        }
        // Mirrors gvar_storage_common.sh Priority 2: re-validate the persisted base
        // against the CURRENT free-space policy on every run, so a stale cache left
        // by an older script version cannot override it.
        if (self::pathHostsProject($val)) {
            return $val;
        }
        if ($val === '/www' || $val === '/mnt/d') {
            return $val;
        }
        if (self::isRealDistinctMount($val)) {
            $diskFree = @disk_free_space($val);
            $rootFree = @disk_free_space('/');
            $diskFree = ($diskFree === false) ? 0.0 : (float) $diskFree;
            $rootFree = ($rootFree === false) ? 0.0 : (float) $rootFree;
            return $diskFree > $rootFree ? $val : '/www';
        }
        return null;
    }

    /** Largest device whose TYPE is ntfs ($wantNtfs) or a POSIX data fs; ranked by raw bytes. */
    private static function largestDeviceOfType(bool $wantNtfs): array
    {
        $bestSize = 0;
        $bestDev = '';
        $blk = self::shellTrim('blkid');
        if ($blk === '') {
            return [0, ''];
        }
        $dataTypes = ['ext2', 'ext3', 'ext4', 'xfs', 'btrfs'];
        foreach (preg_split('/\r?\n/', $blk) as $line) {
            if ($line === '') {
                continue;
            }
            $dev = (string) strtok($line, ':');
            $low = strtolower($line);
            if ($wantNtfs) {
                if (strpos($low, 'type="ntfs"') === false) {
                    continue;
                }
            } else {
                $isData = false;
                foreach ($dataTypes as $t) {
                    if (strpos($low, 'type="' . $t . '"') !== false) {
                        $isData = true;
                        break;
                    }
                }
                if (!$isData) {
                    continue;
                }
                $tgt = self::shellTrim('findmnt -n -o TARGET --source ' . escapeshellarg($dev));
                if (in_array($tgt, ['/', '/boot', '/boot/efi'], true)) {
                    continue;
                }
            }
            $size = (int) self::shellTrim('blockdev --getsize64 ' . escapeshellarg($dev));
            if ($size > $bestSize) {
                $bestSize = $size;
                $bestDev = $dev;
            }
        }
        return [$bestSize, $bestDev];
    }

    /**
     * Free-space-aware disk detection (used only when the shell provided no base).
     * Mirrors gvar_common.sh Priority 3: candidates are the largest NTFS and largest
     * POSIX data devices, each resolved to its current mount; the root filesystem
     * wins (as /www) when '/' has at least as much AVAILABLE space as the best
     * candidate -- ties included. Only a disk with strictly more free space is used.
     * Unmeasurable paths count as 0.
     */
    private static function detectLargestDiskBase(): ?string
    {
        [, $nDev] = self::largestDeviceOfType(true);
        [, $dDev] = self::largestDeviceOfType(false);
        $bestPath = '';
        $bestFree = 0.0;
        foreach ([$nDev, $dDev] as $dev) {
            if ($dev === '') {
                continue;
            }
            $tgt = (string) strtok(self::shellTrim('findmnt -n -o TARGET --source ' . escapeshellarg($dev)), "\r\n");
            if ($tgt === '' || !is_dir($tgt)) {
                continue;
            }
            $free = @disk_free_space($tgt);
            $free = ($free === false) ? 0.0 : (float) $free;
            if ($free > $bestFree) {
                $bestFree = $free;
                $bestPath = $tgt;
            }
        }
        if ($bestPath === '') {
            return null;
        }
        $rootFree = @disk_free_space('/');
        $rootFree = ($rootFree === false) ? 0.0 : (float) $rootFree;
        return $rootFree >= $bestFree ? '/www' : $bestPath;
    }

    /**
     * True when the filesystem backing $path supports POSIX ownership/permissions
     * (ext2/3/4, xfs, btrfs, zfs, ...). The web DATA root REQUIRES this (PostgreSQL needs a
     * postgres-owned 0700 data dir, Laravel chown/chmods storage); NTFS/exFAT/FUSE
     * cannot, so they fall back to /www. Mirrors gvar_common.sh _fs_is_posix_capable()
     * and system_paths.py _fs_is_posix_capable(): walk up to the nearest existing
     * ancestor, then resolve fstype via the longest matching mountpoint in /proc/mounts.
     */
    private static function fsIsPosixCapable(string $path): bool
    {
        $posixFs = ['ext2', 'ext3', 'ext4', 'xfs', 'btrfs', 'zfs', 'reiserfs', 'jfs', 'f2fs', 'overlay'];
        $p = $path;
        while ($p !== '' && $p !== '/' && !file_exists($p)) {
            $p = dirname($p);
        }
        if ($p === '') {
            return false;
        }
        $target = realpath($p);
        if ($target === false) {
            $target = $p;
        }
        $mounts = @file('/proc/mounts', FILE_IGNORE_NEW_LINES);
        if ($mounts === false) {
            return false;
        }
        $bestMp = '';
        $bestFs = '';
        foreach ($mounts as $line) {
            $parts = preg_split('/\s+/', trim($line));
            if ($parts === false || count($parts) < 3) {
                continue;
            }
            $mountPoint = $parts[1];
            $fstype = $parts[2];
            if (($target === $mountPoint || strpos($target, rtrim($mountPoint, '/') . '/') === 0)
                && strlen($mountPoint) >= strlen($bestMp)) {
                $bestMp = $mountPoint;
                $bestFs = $fstype;
            }
        }
        return in_array($bestFs, $posixFs, true);
    }

    /**
     * Detect system name + major version (mirrors gvar_common.sh SYSTEM_NAME /
     * SYSTEM_VERSION). Reads /etc/os-release ID / VERSION_ID, e.g. ['kali','2026'],
     * ['ubuntu','24'], ['debian','13']. Falls back to php_uname when unavailable.
     *
     * @return array{0:string,1:string} [name, majorVersion]
     */
    private static function getSystemNameVersion(): array
    {
        $name = '';
        $version = '';

        if (is_readable('/etc/os-release')) {
            $lines = @file('/etc/os-release', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            foreach ($lines as $line) {
                if ($name === '' && str_starts_with($line, 'ID=')) {
                    $name = strtolower(trim(substr($line, 3), " \t\"'"));
                } elseif ($version === '' && str_starts_with($line, 'VERSION_ID=')) {
                    $version = trim(substr($line, 11), " \t\"'");
                }
            }
        }

        if ($name === '') {
            $name = strtolower(php_uname('s'));
        }
        // Keep only the major version component (24.04 -> 24, 2026.1 -> 2026)
        if ($version !== '' && str_contains($version, '.')) {
            $version = explode('.', $version)[0];
        }

        return [$name, $version];
    }

    /**
     * Check whether the root (/) filesystem has more than $minGb free space.
     * Mirrors gvar_common.sh::root_has_sufficient_free_space with the project
     * threshold supplied by the caller.
     */
    private static function rootHasSufficientFreeSpace(int $minGb = 50): bool
    {
        $free = @disk_free_space('/');
        if ($free === false) {
            return false;
        }
        return $free > $minGb * (1024 ** 3);
    }

    /**
     * Compute the development-tooling base directory and its naming suffix.
     * Mirrors gvar_common.sh get_dev_compile_base() + the compile_dir naming.
     *
     * Linux: '/opt' when root (/) has sufficient free space (non-WSL),
     *        else the largest secondary disk (getBaseDataDirectory()).
     * Windows: 'D:' with a win{ver} suffix (mirrors deploy.ps1 / system_paths.py).
     *
     * @return array{0:string,1:string} [base, suffix] e.g. ['/opt','kali_2026']
     */
    private static function getDevCompileParts(bool $isWindows): array
    {
        if ($isWindows) {
            $release = strtolower(php_uname('r'));
            if (str_contains($release, '11')) {
                $suffix = 'win11';
            } elseif (str_contains($release, '10')) {
                $suffix = 'win10';
            } else {
                $suffix = 'win' . $release;
            }
            return ['D:', $suffix];
        }

        [$sysName, $sysVersion] = self::getSystemNameVersion();
        $suffix = $sysVersion !== '' ? "{$sysName}_{$sysVersion}" : $sysName;

        // WSL keeps its Windows-backed /mnt/d design (root / is the ephemeral vhdx).
        // STICKY /opt: if the /opt dev dir already exists keep using it regardless
        // of current root free space; otherwise select /opt when root (/) has more
        // than DEV_ROOT_MIN_FREE_GB free. Once /opt is chosen, never switch away.
        if (!self::isWSL() && (is_dir('/opt/_' . $suffix) || self::rootHasSufficientFreeSpace())) {
            return ['/opt', $suffix];
        }

        return [self::getBaseDataDirectory(), $suffix];
    }

    /**
     * Check if running on Windows
     * Detects Windows by checking PHP_OS and DIRECTORY_SEPARATOR
     */
    public static function isWindows(): bool
    {
        return str_starts_with(PHP_OS, 'WIN') || DIRECTORY_SEPARATOR === '\\';
    }

    /**
     * Check if running in WSL environment
     * Detects WSL by checking for /mnt/c/Users directory
     */
    public static function isWSL(): bool
    {
        // If Windows, not WSL
        if (self::isWindows()) {
            return false;
        }
        
        // Primary check: /mnt/c/Users directory exists (Windows user directory in WSL)
        if (is_dir('/mnt/c/Users')) {
            return true;
        }
        
        // Check for WSL indicators in /proc/version
        if (file_exists('/proc/version')) {
            $version = file_get_contents('/proc/version');
            if (stripos($version, 'microsoft') !== false || stripos($version, 'wsl') !== false) {
                return true;
            }
        }
        
        // Check for WSL environment variable
        if (getenv('WSL_DISTRO_NAME') !== false) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if running in production environment
     * Production = not WSL and not desktop environment
     */
    public static function isProduction(): bool
    {
        // If WSL, not production
        if (self::isWSL()) {
            return false;
        }
        
        // Check for desktop environment
        if (self::hasDesktopEnvironment()) {
            return false;
        }
        
        // Not WSL and not desktop = production
        return true;
    }

    private static $hasDesktopEnvironmentCached = null;

    /**
     * Check if system has desktop environment
     */
    public static function hasDesktopEnvironment(): bool
    {
        if (self::$hasDesktopEnvironmentCached !== null) {
            return self::$hasDesktopEnvironmentCached;
        }

        if (isset($_SERVER['INVOCATION_ID'])) {
            self::$hasDesktopEnvironmentCached = false;
            return false;
        }

        if (getenv('DISPLAY') && getenv('DISPLAY') !== ':0') {
            self::$hasDesktopEnvironmentCached = true;
            return true;
        }

        if (getenv('WAYLAND_DISPLAY')) {
            self::$hasDesktopEnvironmentCached = true;
            return true;
        }

        if (getenv('XDG_CURRENT_DESKTOP') || getenv('DESKTOP_SESSION')) {
            self::$hasDesktopEnvironmentCached = true;
            return true;
        }

        self::$hasDesktopEnvironmentCached = false;
        return false;
    }

    /**
     * Find actual path for system directories (nginx, php)
     * Returns the path if it exists, otherwise returns the default
     */
    private static function findActualPath(string $defaultPath): string
    {
        if (is_dir($defaultPath)) {
            return $defaultPath;
        }
        
        // Try common alternative locations
        $alternatives = [
            '/usr/local/nginx/conf',
            '/opt/nginx/conf',
            '/usr/local/etc/nginx',
        ];
        
        foreach ($alternatives as $alt) {
            if (is_dir($alt)) {
                return $alt;
            }
        }
        
        return $defaultPath;
    }

    /**
     * Find Laravel log path
     * Maps to laravel_data_dir/logs (laravel_db/logs)
     */
    private static function findLaravelLogPath(string $basePath): string
    {
        // Use proper path separator based on OS
        $separator = self::isWindows() ? '\\' : '/';
        $laravelDataDir = rtrim($basePath, '/\\') . $separator . 'wwwroot' . $separator . 'laravel_db';
        $logPath = $laravelDataDir . $separator . 'logs';

        self::ensureDirectory($logPath);
        
        // If still doesn't exist, fallback (Windows: shared D:\.tmp, Linux: /var/log)
        if (!is_dir($logPath)) {
            return self::isWindows() ? self::getBaseTempDir() : '/var/log';
        }
        
        return $logPath;
    }

    // ==========================================
    // Database Path Helper Methods
    // ==========================================

    /**
     * Get www root directory
     */
    public static function getWwwRoot(?string $subPath = ""): string
    {
        return self::mapWebPath('wwwroot', $subPath);
    }

    /**
     * Base temp directory (no external-storage config overlay).
     *
     * Windows: D:\.tmp (mirrors pycore pygvar TMP_DIR / GlobalVars.ps1) so temp
     * media and scratch files never land on the C: %TEMP% dir; falls back to
     * sys_get_temp_dir() only when D: is unavailable. Linux: sys_get_temp_dir().
     */
    private static function getBaseTempDir(): string
    {
        if (self::isWindows() && is_dir('D:\\')) {
            $base = 'D:\\.tmp';
            self::ensureDirectory($base);
            return $base;
        }
        return sys_get_temp_dir();
    }

    /**
     * Get Laravel public path
     */
    public static function getLaravelPublicPath(?string $subPath = ""): string
    {
        return self::mapWebPath('laravel_data_dir', $subPath);
    }

    /**
     * Get Laravel database directory
     */
    public static function getLaravelDatabaseDir(?string $subPath = ""): string
    {
        return self::mapWebPath('laravel_data_dir', $subPath);
    }

    /**
     * Get Laravel data directory (alias for getLaravelDatabaseDir)
     */
    public static function getLaravelDataDir(?string $subPath = ""): string
    {
        return self::getLaravelDatabaseDir($subPath);
    }

    /**
     * Get Laravel sessions directory (within laravel_db)
     */
    public static function getLaravelSessionsDir(?string $subPath = ""): string
    {
        $basePath = self::getLaravelDatabaseDir() . '/sessions';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    /**
     * Get Laravel tmp directory (within laravel_db)
     */
    public static function getLaravelTmpDir(?string $subPath = ""): string
    {
        $basePath = self::getLaravelDatabaseDir() . '/tmp';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    public static function getLaravelAvatarsDir(?string $subPath = ""): string
    {
        $basePath = self::getLaravelDatabaseDir() . '/avatars';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    public static function getLaravelUploadsDir(?string $subPath = ""): string
    {
        $basePath = self::getLaravelDatabaseDir() . '/uploads';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    /**
     * Get TTS data directory (used by EdgeTTSService)
     * Returns: getLaravelDataDir() . '/tts_data'
     */
    public static function getTTSDataDir(?string $subPath = ""): string
    {
        $basePath = self::getLaravelDataDir() . '/tts_data';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    /**
     * Get TTS audio directory (used by EdgeTTSService)
     * Returns: getTTSDataDir() . '/audio'
     */
    public static function getTTSAudioDir(?string $subPath = ""): string
    {
        $basePath = self::getTTSDataDir() . '/audio';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    /**
     * Get AppQyV1 external data root directory
     * Based on config('AppQyV1.paths.external_data_root')
     */
    public static function getAppQyV1ExternalDataRoot(?string $subPath = ""): string
    {
        // Backward-compatible explicit override: a path pinned via
        // DICT_EXTERNAL_DATA_PATH / AppQyV1.paths.external_data_root is honored
        // verbatim so hosts that already fixed a location keep working.
        $configured = config('AppQyV1.paths.external_data_root');
        $default = storage_path('app/external_data');
        if ($configured !== null && $configured !== '' && $configured !== $default) {
            $basePath = $configured;
            if ($subPath !== null && $subPath !== '') {
                $subPath = ltrim($subPath, '/');
                $basePath = rtrim($basePath, '/') . '/' . $subPath;
            }
            return $basePath;
        }

        // Default: route through the canonical cross-OS path map so the same
        // logical location resolves correctly under WSL / Windows / Ubuntu and
        // is identical for the sys:init CLI process and the Octane HTTP worker.
        return self::mapWebPath('app_external_data', $subPath);
    }

    /**
     * Canonical AppQyV1 word/sentence-TTS audio base directory.
     *
     * Single source of truth for where the edge-tts pipeline (EdgeTTSService)
     * and the Bing-assist audio write-back store generated
     * audio AND where the serve route /api/app_qy_v1/ai_tools/tts/audio/{...}
     * reads it back — write target == serve base (no split-brain). Files live at
     *   <laravel_db>/static/app_qy_v1/audio/{lang}/{type}/{file}
     * with the relative path "{lang}/{type}/{file}" (stored in tts_files[].path)
     * UNCHANGED — only the physical base moved from tts_data/audio into the
     * unified static tree so laravel_db copies cleanly as a deployment data dir.
     */
    public static function getAppQyV1AudioBaseDir(?string $subPath = ""): string
    {
        $relative = 'app_qy_v1/audio';
        if ($subPath !== null && $subPath !== '') {
            $relative = $relative . '/' . ltrim($subPath, '/');
        }
        return self::getLaravelStaticDir($relative);
    }

    /**
     * Get AppQyV1 audio directory (word sounds)
     * Based on config('AppQyV1.paths.audio_directory')
     *
     * Canonical location is now the unified static audio base
     * (getAppQyV1AudioBaseDir()) under the word_sounds namespace, so the
     * write-back target equals the serve base. A pinned config override is still
     * honored verbatim for hosts that fixed a location.
     */
    public static function getAppQyV1AudioDir(?string $subPath = ""): string
    {
        $configured = config('AppQyV1.paths.audio_directory');
        $default = storage_path('app/external_data/audio/word_sounds');
        if ($configured !== null && $configured !== '' && $configured !== $default) {
            $basePath = $configured;
            if ($subPath !== null && $subPath !== '') {
                $subPath = ltrim($subPath, '/');
                $basePath = rtrim($basePath, '/') . '/' . $subPath;
            }
            return $basePath;
        }

        // Unified static tree: static/app_qy_v1/audio/word_sounds/...
        $relative = 'word_sounds';
        if ($subPath !== null && $subPath !== '') {
            $relative = $relative . '/' . ltrim($subPath, '/');
        }
        return self::getAppQyV1AudioBaseDir($relative);
    }

    /**
     * Get AppQyV1 sentence sounds directory
     * Based on config('AppQyV1.paths.sentence_sounds')
     *
     * Canonical location is now the unified static audio base
     * (getAppQyV1AudioBaseDir()) under the sentence_sounds namespace, so the
     * sentence-library write target equals the serve base. A pinned config
     * override is still honored verbatim.
     */
    public static function getAppQyV1SentenceSoundsDir(?string $subPath = ""): string
    {
        $configured = config('AppQyV1.paths.sentence_sounds');
        $default = storage_path('app/external_data/audio/sentence_sounds');
        if ($configured !== null && $configured !== '' && $configured !== $default) {
            $basePath = $configured;
            if ($subPath !== null && $subPath !== '') {
                $subPath = ltrim($subPath, '/');
                $basePath = rtrim($basePath, '/') . '/' . $subPath;
            }
            return $basePath;
        }

        // Unified static tree: static/app_qy_v1/audio/sentence_sounds/...
        $relative = 'sentence_sounds';
        if ($subPath !== null && $subPath !== '') {
            $relative = $relative . '/' . ltrim($subPath, '/');
        }
        return self::getAppQyV1AudioBaseDir($relative);
    }

    /**
     * Get AppQyV1 word-images directory (Bing-assist sample images stored as
     * local files from base64 bytes; the Bing image URLs are not server-fetchable).
     * Mirrors getAppQyV1AudioDir(): config override, else the unified
     * mapWebPath-backed external data root under image/word_images. Files live
     * under a "{lang}/word/{md5}.{ext}" namespace.
     */
    public static function getAppQyV1WordImagesDir(?string $subPath = ""): string
    {
        $configured = config('AppQyV1.paths.word_images_directory');
        $default = storage_path('app/external_data/image/word_images');
        if ($configured !== null && $configured !== '' && $configured !== $default) {
            $basePath = $configured;
            if ($subPath !== null && $subPath !== '') {
                $subPath = ltrim($subPath, '/');
                $basePath = rtrim($basePath, '/') . '/' . $subPath;
            }
            return $basePath;
        }

        // Canonical location: the UNIFIED static tree under laravel_db/static so
        // laravel_db copies cleanly as a deployment data dir (no scatter across
        // external_data / tts_data). Served as /static/app_qy_v1/word_images/...
        // Files: static/app_qy_v1/word_images/{lang}/word/{md5}.{ext}.
        $relative = 'app_qy_v1/word_images';
        if ($subPath !== null && $subPath !== '') {
            $relative = $relative . '/' . ltrim($subPath, '/');
        }
        return self::getLaravelStaticDir($relative);
    }

    /**
     * Get all AppQyV1 audio directories
     * Returns only the actual dictionary audio directories (word sounds and sentence sounds)
     * These directories contain language namespaces underneath
     */
    public static function getAppQyV1AllAudioDirs(): array
    {
        return [
            self::getAppQyV1AudioDir(),           // Word sounds directory (contains language namespaces)
            self::getAppQyV1SentenceSoundsDir(),  // Sentence sounds directory (contains language namespaces)
        ];
    }

    public static function getLaravelStaticDir(?string $subPath = ""): string
    {
        $basePath = self::getLaravelDatabaseDir() . '/static';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    public static function getLaravelCacheDir(?string $subPath = ""): string
    {
        $basePath = self::getLaravelDatabaseDir() . '/cache';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    public static function getLaravelLogsDir(?string $subPath = ""): string
    {
        $basePath = self::getLaravelDatabaseDir() . '/logs';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    /**
     * Get default database path
     */
    public static function getDefaultDatabasePath(string $databaseName = 'database.sqlite', ?string $subPath = ""): string
    {
        $laravelDatabaseDir = self::getLaravelDatabaseDir();
        $defaultDatabasePath = $laravelDatabaseDir;

        if (!file_exists($defaultDatabasePath)) {
            // Race-safe (Octane workers / DrvFs): suppress + re-check so a
            // concurrent create doesn't promote a "File exists" warning to a 500.
            @mkdir($defaultDatabasePath, 0755, true);
        }

        // Use proper path separator based on OS
        $separator = self::isWindows() ? '\\' : '/';
        $fullPath = rtrim($defaultDatabasePath, '/\\') . $separator . $databaseName;

        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/\\');
            $subPath = str_replace(['/', '\\'], $separator, $subPath);
            $fullPath = rtrim($fullPath, '/\\') . $separator . $subPath;
        }

        return $fullPath;
    }

    // ==========================================
    // Web Path Helper Methods
    // ==========================================

    /**
     * Get nginx config directory
     */
    public static function getNginxConfig(?string $subPath = ""): string
    {
        return self::mapWebPath('nginxconfig', $subPath);
    }

    /**
     * Get SSL certificate directory
     */
    public static function getSSLDir(?string $subPath = ""): string
    {
        $basePath = self::mapWebPath('nginxconfig', 'ssl');
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    /**
     * Get sites-available directory
     */
    public static function getSitesAvailable(?string $subPath = ""): string
    {
        $basePath = self::mapWebPath('nginxconfig', 'sites-available');
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    /**
     * Get sites-enabled directory
     */
    public static function getSitesEnabled(?string $subPath = ""): string
    {
        $basePath = self::mapWebPath('nginxconfig', 'sites-enabled');
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    /**
     * Get shared data directory
     */
    public static function getSharedData(?string $subPath = ""): string
    {
        return self::mapWebPath('shared-data', $subPath);
    }

    /**
     * Get backup directory
     */
    public static function getBackupDir(?string $subPath = ""): string
    {
        return self::mapWebPath('backup', $subPath);
    }

    // ==========================================
    // External Storage Helper Methods
    // ==========================================

    /**
     * Get the current operating system
     */
    public static function getOS(): string
    {
        $os = PHP_OS;
        
        if (str_starts_with($os, 'WIN')) {
            return 'windows';
        } else {
            return 'linux';
        }
    }

    /**
     * Get external storage path for a specific type
     */
    public static function getExternalStoragePath(string $type, ?string $subPath = ""): string
    {
        $os = self::getOS();
        $config = config("storage.external.{$type}");

        if (!$config || !isset($config[$os])) {
            // Fallback to mapped paths
            $basePath = match($type) {
                'upload' => self::mapWebPath('wwwroot', 'laravel_main/uploads'),
                'static' => self::mapWebPath('wwwroot', 'laravel_main/static'),
                'backup' => self::mapWebPath('backup'),
                'cache' => self::mapWebPath('wwwroot', 'laravel_main/cache'),
                'updates' => self::mapWebPath('wwwroot', 'laravel_main/updates'),
                'logs' => self::mapWebPath('logs'),
                'temp' => self::getBaseTempDir(),
                default => throw new \InvalidArgumentException("External storage path not configured for type '{$type}' on OS '{$os}'")
            };
        } else {
            $basePath = $config[$os];

            // Auto-create directory if enabled
            if (config('storage.auto_create', true)) {
                self::ensureDirectoryExists($basePath);
            }
        }

        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }

        return $basePath;
    }

    /**
     * Get upload directory path
     */
    public static function getUploadPath(?string $subPath = ""): string
    {
        return self::getExternalStoragePath('upload', $subPath);
    }

    /**
     * Get static files directory path
     */
    public static function getStaticPath(?string $subPath = ""): string
    {
        return self::getExternalStoragePath('static', $subPath);
    }

    /**
     * Get backup directory path (external storage)
     */
    public static function getExternalBackupPath(?string $subPath = ""): string
    {
        return self::getExternalStoragePath('backup', $subPath);
    }

    /**
     * Get cache directory path
     */
    public static function getCachePath(?string $subPath = ""): string
    {
        return self::getExternalStoragePath('cache', $subPath);
    }

    /**
     * Get updates directory path
     */
    public static function getUpdatesPath(?string $subPath = ""): string
    {
        return self::getExternalStoragePath('updates', $subPath);
    }

    /**
     * Get logs directory path (external storage)
     */
    public static function getExternalLogsPath(?string $subPath = ""): string
    {
        return self::getExternalStoragePath('logs', $subPath);
    }

    /**
     * Get temp directory path
     */
    public static function getTempPath(?string $subPath = ""): string
    {
        return self::getExternalStoragePath('temp', $subPath);
    }

    /**
     * Ensure directory exists and is writable
     */
    public static function ensureDirectoryExists(string $path): bool
    {
        try {
            if (!File::exists($path)) {
                $permissions = config('storage.permissions.directory', 0755);
                File::makeDirectory($path, $permissions, true);
                Log::info("Created directory: {$path}");
            }
            
            if (!is_writable($path)) {
                Log::warning("Directory is not writable: {$path}");
                return false;
            }
            
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to create directory: {$path}", [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Get full path for a file within external storage
     */
    public static function getFullPath(string $type, string $subPath = ''): string
    {
        $basePath = self::getExternalStoragePath($type);
        
        if (empty($subPath)) {
            return $basePath;
        }
        
        return $basePath . DIRECTORY_SEPARATOR . trim($subPath, '/\\');
    }

    /**
     * Get relative path from external storage base
     */
    public static function getRelativePath(string $type, string $fullPath): string
    {
        $basePath = self::getExternalStoragePath($type);
        return trim(str_replace([$basePath, '\\'], ['', '/'], $fullPath), '/');
    }

    /**
     * Check if a path is within external storage
     */
    public static function isWithinExternalStorage(string $type, string $path): bool
    {
        $basePath = self::getExternalStoragePath($type);
        $realPath = realpath($path);
        $realBasePath = realpath($basePath);
        
        if (!$realPath || !$realBasePath) {
            return false;
        }
        
        return str_starts_with($realPath, $realBasePath);
    }

    /**
     * Get all external storage paths
     */
    public static function getAllExternalStoragePaths(): array
    {
        return [
            'upload' => self::getUploadPath(),
            'static' => self::getStaticPath(),
            'backup' => self::getExternalBackupPath(),
            'cache' => self::getCachePath(),
            'updates' => self::getUpdatesPath(),
            'logs' => self::getExternalLogsPath(),
            'temp' => self::getTempPath(),
        ];
    }

    /**
     * Validate all external storage paths
     */
    public static function validateExternalStoragePaths(): array
    {
        $results = [];
        $paths = self::getAllExternalStoragePaths();
        
        foreach ($paths as $type => $path) {
            $results[$type] = [
                'path' => $path,
                'exists' => File::exists($path),
                'writable' => is_writable($path),
                'valid' => File::exists($path) && is_writable($path),
            ];
        }
        
        return $results;
    }

    // ==========================================
    // Utility Methods
    // ==========================================

    /**
     * Validate that a path exists and is writable
     */
    public static function validatePath(string $path): array
    {
        $result = [
            'exists' => false,
            'isDirectory' => false,
            'isWritable' => false,
            'isReadable' => false,
            'error' => null
        ];

        if (file_exists($path)) {
            $result['exists'] = true;

            if (is_dir($path)) {
                $result['isDirectory'] = true;
                $result['isWritable'] = is_writable($path);
                $result['isReadable'] = is_readable($path);
            } else {
                $result['error'] = 'Path exists but is not a directory';
            }
        } else {
            $result['error'] = 'Path does not exist';
        }

        return $result;
    }

    /**
     * Ensure a directory exists with proper permissions
     */
    public static function ensureDirectory(string $path, int $permissions = 0755): bool
    {
        if (!is_dir($path)) {
            // Race-safe under Octane (many workers) + WSL DrvFs: mkdir() can fail
            // with "File exists" when ANOTHER worker created the dir between the
            // is_dir() check and this call. Suppress the warning (otherwise
            // Laravel's HandleExceptions promotes it to a 500) and treat
            // "failed BUT it now exists" as success — only a genuinely-missing dir
            // is an error.
            if (!@mkdir($path, $permissions, true) && !is_dir($path)) {
                return false;
            }
        }

        // Try to set permissions (may fail in WSL)
        @chmod($path, $permissions);

        return is_dir($path);
    }

    /**
     * Get path diagnostics for debugging
     */
    public static function getDiagnostics(): array
    {
        return [
            'environment' => [
                'isWsl' => self::isWSL(),
                'isProduction' => self::isProduction(),
                'hasDesktop' => self::hasDesktopEnvironment(),
                'osFamily' => PHP_OS_FAMILY,
                'baseDataDir' => self::getBaseDataDirectory(),
            ],
            'paths' => [
                'wwwroot' => self::getWwwRoot(),
                'nginxconfig' => self::getNginxConfig(),
                'ssl' => self::getSSLDir(),
                'sites_available' => self::getSitesAvailable(),
                'sites_enabled' => self::getSitesEnabled(),
                'shared_data' => self::getSharedData(),
                'backup' => self::getBackupDir(),
                'laravel_data_dir' => self::getLaravelDatabaseDir(),
                'logs' => self::mapWebPath('logs'),
                'core_node_dir' => self::getCoreNodeDir(),
            ],
            'validation' => [
                'wwwroot' => self::validatePath(self::getWwwRoot()),
                'nginxconfig' => self::validatePath(self::getNginxConfig()),
                'ssl' => self::validatePath(self::getSSLDir()),
                'sites_available' => self::validatePath(self::getSitesAvailable()),
            ],
            'external_storage' => self::getAllExternalStoragePaths(),
        ];
    }

    // ==========================================
    // Core Node Directory Methods
    // ==========================================

    /**
     * Get core_node directory path
     * Uses absolute path based on current file location
     *
     * @return string|null The path to core_node directory
     */
    public static function getCoreNodeDir(): ?string
    {
        static $cachedPath = null;

        if ($cachedPath !== null) {
            return $cachedPath;
        }

        // Start from PathMapper file location
        // PathMapper is at: core_node/poly_apps/laravel_main/app/Providers/PathMapper.php
        // Need to go up 4 levels: Providers -> app -> laravel_main -> poly_apps -> core_node
        $currentFile = __FILE__;
        $currentDir = dirname($currentFile);

        // Go up 4 levels to reach core_node
        $coreNodeDir = $currentDir;
        for ($i = 0; $i < 4; $i++) {
            $coreNodeDir = dirname($coreNodeDir);
        }

        $cachedPath = $coreNodeDir;
        return $cachedPath;
    }

    /**
     * Get a path under the shared pycore local-data root (D:\www\cache\pycore on Windows).
     *
     * Mirrors pycore system_paths.get_local_data_dir(). Callers MUST namespace their
     * subtree (e.g. "appqyv1/books/<id>") so apps never collide.
     *
     * @param string|null $subPath Namespaced sub-path under pycore (e.g. "appqyv1/books").
     * @return string Absolute path under the shared pycore dir (dir ensured).
     */
    public static function getCoreNodeDataDir(?string $subPath = ""): string
    {
        $base = 'pycore';
        if ($subPath !== null && $subPath !== "") {
            $base = $base . DIRECTORY_SEPARATOR . ltrim(str_replace(['\\', '/'], DIRECTORY_SEPARATOR, $subPath), DIRECTORY_SEPARATOR);
        }
        return self::getSharedDownloadCacheDir($base);
    }

    /**
     * Get the shared download cache dir (mirror of pycore system_paths.get_shared_download_cache_dir).
     *
     * Windows: D:\www\cache ; Linux dual-boot (/www = NTFS disk root): /www/www/cache
     * (the SAME tree, ONE EXTRA LEVEL) ; Linux-only: /var/_core_node/cache.
     * This is the SAME physical location pycore resolves, so PHP + Python land on identical paths.
     * Respects the CORE_NODE_CACHE_DIR env var when already exported.
     *
     * @param string|null $subPath Namespaced sub-path under the cache root (e.g. "pycore/.ai_state").
     * @return string Absolute path under the shared cache dir (dir ensured).
     */
    public static function getSharedDownloadCacheDir(?string $subPath = ""): string
    {
        $envVal = getenv('CORE_NODE_CACHE_DIR');
        if ($envVal !== false && trim($envVal) !== '') {
            $base = rtrim(trim($envVal), '/\\');
        } elseif (self::isWindows()) {
            $base = 'D:\\www\\cache';
        } else {
            $base = self::linuxCrossOsCacheDir() ?? '/var/_core_node/cache';
        }
        $full = $base;
        if ($subPath !== null && $subPath !== '') {
            $full = rtrim($base, '/\\') . DIRECTORY_SEPARATOR . ltrim(str_replace(['\\', '/'], DIRECTORY_SEPARATOR, $subPath), DIRECTORY_SEPARATOR);
        }
        self::ensureDirectory($full);
        return $full;
    }

    /**
     * Get Laravel main directory path
     * Uses relative positioning from PathMapper file location
     * 
     * PathMapper is at: core_node/poly_apps/laravel_main/app/Providers/PathMapper.php
     * Laravel main is at: core_node/poly_apps/laravel_main
     * Need to go up 2 levels: Providers -> app -> laravel_main
     * 
     * @return string The path to laravel_main directory
     */
    public static function getLaravelMainDir(): string
    {
        static $cachedPath = null;
        
        if ($cachedPath !== null) {
            return $cachedPath;
        }
        
        // Start from PathMapper file location
        // PathMapper is at: core_node/poly_apps/laravel_main/app/Providers/PathMapper.php
        // Need to go up 2 levels: Providers -> app -> laravel_main
        $currentFile = __FILE__;
        $currentDir = dirname($currentFile);
        
        // Go up 2 levels to reach laravel_main
        $laravelMainDir = $currentDir;
        for ($i = 0; $i < 2; $i++) {
            $laravelMainDir = dirname($laravelMainDir);
        }
        
        $cachedPath = $laravelMainDir;
        return $cachedPath;
    }
    
    /**
     * Get Laravel main public directory path
     * Uses getLaravelMainDir() for relative positioning
     *
     * @return string The path to laravel_main/public directory
     */
    public static function getLaravelMainPublicDir(): string
    {
        return self::getLaravelMainDir() . '/public';
    }

    // ==========================================
    // Script Directory Methods
    // ==========================================

    /**
     * Get scripts directory
     */
    public static function getScriptsDir(?string $subPath = ""): string
    {
        return self::mapWebPath('scripts_dir', $subPath);
    }

    /**
     * Get shells directory
     */
    public static function getShellsDir(?string $subPath = ""): string
    {
        return self::mapWebPath('shells_dir', $subPath);
    }

    /**
     * Get Linux shells directory
     */
    public static function getLinuxShellsDir(?string $subPath = ""): string
    {
        return self::mapWebPath('linux_shells_dir', $subPath);
    }

    /**
     * Get Debian shells directory
     */
    public static function getDebianShellsDir(?string $subPath = ""): string
    {
        return self::mapWebPath('debian_shells_dir', $subPath);
    }

    /**
     * Get install shells directory
     */
    public static function getInstallShellsDir(?string $subPath = ""): string
    {
        return self::mapWebPath('install_shells_dir', $subPath);
    }

    /**
     * Get common shells directory
     */
    public static function getCommonShellsDir(?string $subPath = ""): string
    {
        return self::mapWebPath('common_shells_dir', $subPath);
    }

    /**
     * Get dd helper directory
     */
    public static function getDdHelperDir(?string $subPath = ""): string
    {
        return self::mapWebPath('dd_helper_dir', $subPath);
    }

    /**
     * Get node installation script path
     */
    public static function getNodeInstallScript(?string $subPath = ""): string
    {
        $basePath = self::getInstallShellsDir() . '/17_install_node_toolchain_26.sh';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    /**
     * Get Go installation script path
     */
    public static function getGoInstallScript(?string $subPath = ""): string
    {
        $basePath = self::getInstallShellsDir() . '/91_install_golang22.sh';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    /**
     * Get Flutter installation script path
     */
    public static function getFlutterInstallScript(?string $subPath = ""): string
    {
        $basePath = self::getInstallShellsDir() . '/59_install_flutter.sh';
        if ($subPath !== null && $subPath !== '') {
            $subPath = ltrim($subPath, '/');
            $basePath = rtrim($basePath, '/') . '/' . $subPath;
        }
        return $basePath;
    }

    // ==========================================
    // Binary Path Detection Methods
    // ==========================================

    /**
     * Get Node binary path
     * Follows the installation script pattern from 17_install_node_toolchain_26.sh
     *
     * Priority:
     * 1. Symlink at /usr/local/bin/node (created by installation script)
     * 2. which node command
     * 3. Fallback to symlink path
     *
     * @return string Path to node binary
     */
    public static function getNodeBinaryPath(): string
    {
        $symlinkPath = self::mapWebPath('node_symlink');
        if (file_exists($symlinkPath)) {
            return $symlinkPath;
        }

        $result = \Illuminate\Support\Facades\Process::run('which node');
        if ($result->successful()) {
            $nodePath = trim($result->output());
            if (!empty($nodePath) && file_exists($nodePath)) {
                return $nodePath;
            }
        }

        return $symlinkPath;
    }

    /**
     * Get Go binary path
     * Follows the installation script pattern from 91_install_golang22.sh
     *
     * Priority:
     * 1. Symlink at /usr/local/bin/go (created by installation script)
     * 2. $COMPILE_DIR/go/bin/go (GO_DIR from installation script)
     * 3. which go command
     * 4. Fallback to symlink path
     *
     * @return string Path to go binary
     */
    public static function getGoBinaryPath(): string
    {
        $symlinkPath = self::mapWebPath('go_symlink');
        if (file_exists($symlinkPath)) {
            return $symlinkPath;
        }

        $compileDir = self::mapWebPath('compile_dir');
        $goBin = "$compileDir/go/bin/go";
        if (file_exists($goBin)) {
            return $goBin;
        }

        $result = \Illuminate\Support\Facades\Process::run('which go');
        if ($result->successful()) {
            $goPath = trim($result->output());
            if (!empty($goPath) && file_exists($goPath)) {
                return $goPath;
            }
        }

        return $symlinkPath;
    }

    /**
     * Get Flutter binary path
     * Follows the installation script pattern from 59_install_flutter.sh
     *
     * Priority:
     * 1. Symlink at /usr/local/bin/flutter (created by installation script)
     * 2. Snap installation at /snap/bin/flutter
     * 3. which flutter command
     * 4. Fallback to symlink path
     *
     * @return string Path to flutter binary
     */
    public static function getFlutterBinaryPath(): string
    {
        $symlinkPath = self::mapWebPath('flutter_symlink');
        if (file_exists($symlinkPath)) {
            return $symlinkPath;
        }

        $snapPath = '/snap/bin/flutter';
        if (file_exists($snapPath)) {
            return $snapPath;
        }

        $result = \Illuminate\Support\Facades\Process::run('which flutter');
        if ($result->successful()) {
            $flutterPath = trim($result->output());
            if (!empty($flutterPath) && file_exists($flutterPath)) {
                return $flutterPath;
            }
        }

        return $symlinkPath;
    }

    /**
     * Get PHP binary path
     * Follows PHP installation patterns
     *
     * Priority:
     * 1. /usr/local/bin/php (most common for compiled PHP)
     * 2. /usr/bin/php (system package manager installation)
     * 3. which php command
     * 4. Fallback to /usr/local/bin/php
     *
     * @return string Path to php binary
     */
    public static function getPhpBinaryPath(): string
    {
        $commonPaths = [
            '/usr/local/bin/php',
            '/usr/bin/php',
        ];

        foreach ($commonPaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                return $path;
            }
        }

        $result = \Illuminate\Support\Facades\Process::run('which php');
        if ($result->successful()) {
            $phpPath = trim($result->output());
            if (!empty($phpPath) && file_exists($phpPath)) {
                return $phpPath;
            }
        }

        return '/usr/local/bin/php';
    }

    /**
     * Get nginx binary path
     *
     * Priority:
     * 1. /usr/sbin/nginx (standard Debian/Ubuntu location)
     * 2. /usr/bin/nginx (alternative location)
     * 3. /usr/local/bin/nginx (custom installation)
     * 4. which nginx command
     * 5. Fallback to 'nginx' (let system PATH resolve)
     *
     * @return string Path to nginx binary
     */
    public static function getNginxBinaryPath(): string
    {
        $possiblePaths = [
            '/usr/sbin/nginx',
            '/usr/bin/nginx',
            '/usr/local/bin/nginx',
        ];

        foreach ($possiblePaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                return $path;
            }
        }

        $result = \Illuminate\Support\Facades\Process::run('which nginx');
        if ($result->successful()) {
            $nginxPath = trim($result->output());
            if (!empty($nginxPath) && file_exists($nginxPath)) {
                return $nginxPath;
            }
        }

        return 'nginx';
    }

    /**
     * Get pnpm binary path
     *
     * Priority:
     * 1. Check all installed Node.js versions for pnpm
     * 2. /usr/local/bin/pnpm (symlink)
     * 3. which pnpm command
     * 4. Fallback to 'pnpm' (let system PATH resolve)
     *
     * @return string Path to pnpm binary
     */
    public static function getPnpmBinaryPath(): string
    {
        $compileDir = self::mapWebPath('compile_dir');
        $nodeDir = "$compileDir/node";

        // Check all installed Node.js versions for pnpm
        if (is_dir($nodeDir)) {
            $versions = ['node-v22.21.0', 'node-v24.11.1', 'node-v22.*', 'node-v24.*'];
            foreach ($versions as $versionPattern) {
                // If it's a glob pattern
                if (str_contains($versionPattern, '*')) {
                    $matches = glob("$nodeDir/$versionPattern", GLOB_ONLYDIR);
                    foreach ($matches as $versionDir) {
                        $pnpmPath = "$versionDir/bin/pnpm";
                        if (file_exists($pnpmPath) && is_executable($pnpmPath)) {
                            return $pnpmPath;
                        }
                    }
                } else {
                    $pnpmPath = "$nodeDir/$versionPattern/bin/pnpm";
                    if (file_exists($pnpmPath) && is_executable($pnpmPath)) {
                        return $pnpmPath;
                    }
                }
            }
        }

        // Check symlink
        $symlinkPath = '/usr/local/bin/pnpm';
        if (file_exists($symlinkPath) && is_executable($symlinkPath)) {
            return $symlinkPath;
        }

        // Try which command
        $result = \Illuminate\Support\Facades\Process::run('which pnpm');
        if ($result->successful()) {
            $pnpmPath = trim($result->output());
            if (!empty($pnpmPath) && file_exists($pnpmPath)) {
                return $pnpmPath;
            }
        }

        // Fallback
        return 'pnpm';
    }

    /**
     * Get pdftk binary path
     *
     * Priority:
     * 1. /usr/bin/pdftk (system package manager installation)
     * 2. /usr/local/bin/pdftk (compiled installation)
     * 3. which pdftk command
     * 4. Fallback to null if not found
     *
     * @return string|null Path to pdftk binary or null if not found
     */
    public static function getPdftkBinaryPath(): ?string
    {
        $commonPaths = [
            '/usr/bin/pdftk',
            '/usr/local/bin/pdftk',
        ];

        foreach ($commonPaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                return $path;
            }
        }

        $result = \Illuminate\Support\Facades\Process::run('which pdftk');
        if ($result->successful()) {
            $pdftkPath = trim($result->output());
            if (!empty($pdftkPath) && file_exists($pdftkPath)) {
                return $pdftkPath;
            }
        }

        return null;
    }

    /**
     * Get Ghostscript binary path
     *
     * Priority:
     * 1. /usr/bin/gs (system package manager installation)
     * 2. /usr/local/bin/gs (compiled installation)
     * 3. which gs command
     * 4. Fallback to null if not found
     *
     * @return string|null Path to gs binary or null if not found
     */
    public static function getGhostscriptBinaryPath(): ?string
    {
        $commonPaths = [
            '/usr/bin/gs',
            '/usr/local/bin/gs',
        ];

        foreach ($commonPaths as $path) {
            if (file_exists($path) && is_executable($path)) {
                return $path;
            }
        }

        $result = \Illuminate\Support\Facades\Process::run('which gs');
        if ($result->successful()) {
            $gsPath = trim($result->output());
            if (!empty($gsPath) && file_exists($gsPath)) {
                return $gsPath;
            }
        }

        return null;
    }
}
