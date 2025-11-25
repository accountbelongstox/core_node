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

    public static function getActualUser(): array
    {
        if (self::$cachedUser !== null) {
            return [
                'username' => self::$cachedUser,
                'uid' => self::$cachedUid,
                'gid' => self::$cachedGid
            ];
        }

        $currentUser = null;
        $currentUid = null;

        $currentUser = posix_getpwuid(posix_geteuid());
        $currentUid = $currentUser['uid'] ?? 0;

        if ($currentUid !== 0) {
            self::$cachedUser = $currentUser['name'];
            self::$cachedUid = $currentUser['uid'];
            self::$cachedGid = $currentUser['gid'];

            return [
                'username' => self::$cachedUser,
                'uid' => self::$cachedUid,
                'gid' => self::$cachedGid
            ];
        }

        $detectedUser = self::detectDesktopUser();

        if ($detectedUser) {
            self::$cachedUser = $detectedUser['username'];
            self::$cachedUid = $detectedUser['uid'];
            self::$cachedGid = $detectedUser['gid'];

            return $detectedUser;
        }

        self::$cachedUser = $currentUser['name'];
        self::$cachedUid = $currentUser['uid'];
        self::$cachedGid = $currentUser['gid'];

        return [
            'username' => self::$cachedUser,
            'uid' => self::$cachedUid,
            'gid' => self::$cachedGid
        ];
    }

    private static function detectDesktopUser(): ?array
    {
        $homeBase = '/home';
        $users = [];
        $latestTime = 0;
        $latestUser = null;

        if (!is_dir($homeBase) || !is_readable($homeBase)) {
            return null;
        }

        $userDirs = scandir($homeBase);

        foreach ($userDirs as $userDir) {
            if ($userDir === '.' || $userDir === '..') {
                continue;
            }

            $userPath = $homeBase . DIRECTORY_SEPARATOR . $userDir;

            if (!is_dir($userPath) || !is_readable($userPath)) {
                continue;
            }

            $subDirs = @scandir($userPath);
            if ($subDirs === false) {
                continue;
            }

            foreach ($subDirs as $subDir) {
                if ($subDir === '.' || $subDir === '..') {
                    continue;
                }

                $subPath = $userPath . DIRECTORY_SEPARATOR . $subDir;

                if (!is_dir($subPath)) {
                    continue;
                }

                $mtime = @filemtime($subPath);
                if ($mtime === false) {
                    continue;
                }

                if ($mtime > $latestTime) {
                    $latestTime = $mtime;
                    $latestUser = $userDir;
                }
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
    }
}
