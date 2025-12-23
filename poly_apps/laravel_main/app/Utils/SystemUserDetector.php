<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Utils;

class SystemUserDetector
{
    private static $cachedUser = null;
    private static $cachedUid = null;
    private static $cachedGid = null;
    private static $cacheFile = null;

    public static function getActualUser(): array
    {
        if (self::$cachedUser !== null) {
            return [
                'username' => self::$cachedUser,
                'uid' => self::$cachedUid,
                'gid' => self::$cachedGid
            ];
        }

        if (self::$cacheFile === null) {
            self::$cacheFile = storage_path('app/system_user_cache.json');
        }

        if (file_exists(self::$cacheFile)) {
            $cached = @file_get_contents(self::$cacheFile);
            if ($cached !== false) {
                $data = @json_decode($cached, true);
                if ($data && isset($data['username'], $data['uid'], $data['gid'])) {
                    self::$cachedUser = $data['username'];
                    self::$cachedUid = $data['uid'];
                    self::$cachedGid = $data['gid'];
                    return $data;
                }
            }
        }

        $currentUser = posix_getpwuid(posix_geteuid());
        $currentUid = $currentUser['uid'] ?? 0;

        if ($currentUid !== 0) {
            self::$cachedUser = $currentUser['name'];
            self::$cachedUid = $currentUser['uid'];
            self::$cachedGid = $currentUser['gid'];

            self::saveCacheFile();

            return [
                'username' => self::$cachedUser,
                'uid' => self::$cachedUid,
                'gid' => self::$cachedGid
            ];
        }

        \Log::info('[SystemUserDetector] Starting desktop user detection');
        $detectedUser = self::detectDesktopUser();
        \Log::info('[SystemUserDetector] Desktop user detection completed', ['user' => $detectedUser]);

        if ($detectedUser) {
            self::$cachedUser = $detectedUser['username'];
            self::$cachedUid = $detectedUser['uid'];
            self::$cachedGid = $detectedUser['gid'];

            self::saveCacheFile();

            return $detectedUser;
        }

        self::$cachedUser = $currentUser['name'];
        self::$cachedUid = $currentUser['uid'];
        self::$cachedGid = $currentUser['gid'];

        self::saveCacheFile();

        return [
            'username' => self::$cachedUser,
            'uid' => self::$cachedUid,
            'gid' => self::$cachedGid
        ];
    }

    private static function saveCacheFile(): void
    {
        if (self::$cacheFile === null) {
            return;
        }

        $data = [
            'username' => self::$cachedUser,
            'uid' => self::$cachedUid,
            'gid' => self::$cachedGid
        ];

        @file_put_contents(self::$cacheFile, json_encode($data));
    }

    private static function isSystemdRestrictedEnvironment(): bool
    {
        if (!isset($_SERVER['INVOCATION_ID'])) {
            return false;
        }

        return true;
    }

    private static function detectDesktopUser(): ?array
    {
        $whoOutput = trim(shell_exec('who am i 2>/dev/null | awk \'{print $1}\' | head -1'));

        if (empty($whoOutput) || $whoOutput === 'root') {
            $whoOutput = trim(shell_exec('who 2>/dev/null | grep -v root | awk \'{print $1}\' | head -1'));
        }

        if (!empty($whoOutput) && $whoOutput !== 'root') {
            $userInfo = posix_getpwnam($whoOutput);
            if ($userInfo !== false) {
                return [
                    'username' => $whoOutput,
                    'uid' => $userInfo['uid'],
                    'gid' => $userInfo['gid']
                ];
            }
        }

        $homeBase = '/home';
        if (!is_dir($homeBase)) {
            return null;
        }

        $userDirs = @scandir($homeBase);
        if ($userDirs === false) {
            return null;
        }

        $latestTime = 0;
        $latestUser = null;

        foreach ($userDirs as $userDir) {
            if ($userDir === '.' || $userDir === '..') {
                continue;
            }

            $userPath = $homeBase . DIRECTORY_SEPARATOR . $userDir;

            if (!is_dir($userPath)) {
                continue;
            }

            $mtime = @filemtime($userPath);
            if ($mtime === false) {
                continue;
            }

            if ($mtime > $latestTime) {
                $latestTime = $mtime;
                $latestUser = $userDir;
            }
        }

        if ($latestUser === null) {
            return null;
        }

        $userInfo = posix_getpwnam($latestUser);
        if ($userInfo === false) {
            return null;
        }

        return [
            'username' => $latestUser,
            'uid' => $userInfo['uid'],
            'gid' => $userInfo['gid']
        ];
    }

    public static function clearCache(): void
    {
        self::$cachedUser = null;
        self::$cachedUid = null;
        self::$cachedGid = null;

        if (self::$cacheFile && file_exists(self::$cacheFile)) {
            @unlink(self::$cacheFile);
        }
    }
}
