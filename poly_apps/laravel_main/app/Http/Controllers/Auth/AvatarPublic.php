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


namespace App\Http\Controllers\Auth;

use Laravolt\Avatar\Avatar;
use App\Providers\PathMapper;
use App\Services\AvatarService;

class AvatarPublic
{
    private $saveDir = "avatars";
    public static function createAvatar($user, $save = false)
    {
        $avatarDir = PathMapper::getLaravelAvatarsDir();
        if (!file_exists($avatarDir)) {
            mkdir($avatarDir, 0755, true);
        }
        if (!$user->avatar) {
            $avatarFileName = $user->id . '.png';
            $avatarFullPath = $avatarDir . '/' . $avatarFileName;
            if (!file_exists($avatarFullPath)) {
                $avatarCreator = new Avatar();
                $avatarCreator->create($user->username);
                $avatarCreator->save($avatarFullPath, 80);
            }
            $user->avatar = '/avatars/' . $avatarFileName;
        }
        if ($save) {
            $user->save();
        }
        return $user;
    }

    /**
     * Idempotent read-time repair for a user's avatar.
     *
     * Only acts when the avatar is actually broken, so it does not slow down
     * normal requests. It (re)generates a small default avatar, persists it,
     * and returns the (possibly unchanged) avatar value.
     *
     * Repaired when:
     *  - avatar is empty / "null",
     *  - the referenced local file is missing,
     *  - the on-disk file exceeds AvatarService::MAX_UPLOAD_BYTES
     *    (legacy oversized avatars, e.g. the 27 MB case).
     *
     * Remote URLs (http/https) are left untouched.
     */
    public static function backfillAvatar($user)
    {
        $avatarDir = null;
        $avatar = null;
        $needsRepair = false;
        $relative = null;
        $localPath = null;
        $avatarFileName = null;
        $avatarFullPath = null;
        $avatarCreator = null;

        if (!$user) {
            return $user;
        }

        $avatarDir = PathMapper::getLaravelAvatarsDir();
        $avatar = $user->avatar;

        if (!$avatar || $avatar === '' || $avatar === 'null') {
            $needsRepair = true;
        } else if (stripos($avatar, 'http://') === 0 || stripos($avatar, 'https://') === 0) {
            // External URL (e.g. gravatar fallback) - nothing local to check.
            $needsRepair = false;
        } else {
            // Resolve the on-disk location strictly via the canonical
            // PathMapper-backed avatars dir helper (no dirname()/ad-hoc root
            // concatenation - PATH_CONVERSION_SPECIFICATION §6). Stored values
            // are either "avatars/<app>/<file>" (strip the "avatars/" prefix)
            // or a bare/root "/avatars/<id>.png" (legacy default layout).
            $relative = ltrim($avatar, '/');
            if (strpos($relative, 'avatars/') === 0) {
                $relative = substr($relative, strlen('avatars/'));
            }
            $localPath = PathMapper::getLaravelAvatarsDir($relative);

            if (!file_exists($localPath)) {
                $needsRepair = true;
            } else if (filesize($localPath) > AvatarService::MAX_UPLOAD_BYTES) {
                $needsRepair = true;
            }
        }

        if (!$needsRepair) {
            return $user;
        }

        if (!file_exists($avatarDir)) {
            mkdir($avatarDir, 0755, true);
        }

        // Regenerate the same small Laravolt default used at registration so
        // the visual stays consistent; overwrite the per-user default file.
        $avatarFileName = $user->id . '.png';
        $avatarFullPath = $avatarDir . '/' . $avatarFileName;

        $avatarCreator = new Avatar();
        $avatarCreator->create($user->username ?? ('user' . $user->id));
        $avatarCreator->save($avatarFullPath, 80);

        $user->avatar = '/avatars/' . $avatarFileName;
        $user->save();

        return $user;
    }

}
