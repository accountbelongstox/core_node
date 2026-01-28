<?php

namespace App\Http\Common;

use App\Constants\AppKeys;
use App\Services\AvatarService;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

class CommonAvatarPublic
{
    public static function createAvatar($user, $save = false)
    {
        if (!$user) {
            return $user;
        }

        $avatarDir = PathMapper::getLaravelAvatarsDir();
        if (!file_exists($avatarDir)) {
            mkdir($avatarDir, 0755, true);
        }

        $needsAvatar = false;
        if (!$user->avatar || $user->avatar === '' || $user->avatar === 'null') {
            $needsAvatar = true;
        } else if (stripos($user->avatar, 'avatars/1.png') !== false || stripos($user->avatar, 'default') !== false) {
            $needsAvatar = true;
        }

        if ($needsAvatar) {
            $seed = $user->username;
            if (!$seed) {
                $seed = $user->email;
            }
            if (!$seed) {
                $seed = 'user' . $user->id;
            }

            Log::info('[CommonAvatarPublic] Generating avatar for user', [
                'user_id' => $user->id,
                'seed' => $seed,
            ]);

            $avatarPath = AvatarService::generateAndSave($seed, $user->id, AppKeys::APPQYV1);

            if ($avatarPath) {
                $user->avatar = $avatarPath;

                Log::info('[CommonAvatarPublic] Avatar created', [
                    'user_id' => $user->id,
                    'avatar_path' => $avatarPath,
                ]);
            } else {
                Log::error('[CommonAvatarPublic] Failed to generate avatar, using fallback', [
                    'user_id' => $user->id,
                ]);

                $gravatarHash = md5(strtolower(trim($seed)));
                $gravatarUrl = "https://www.gravatar.com/avatar/{$gravatarHash}?s=200&d=mp";
                $user->avatar = $gravatarUrl;
            }
        }

        if (empty($user->nickname)) {
            $nickname = AvatarService::generateNickname($user->username ?? $user->email ?? 'user' . $user->id);
            $user->nickname = $nickname;

            Log::info('[CommonAvatarPublic] Nickname generated', [
                'user_id' => $user->id,
                'nickname' => $nickname,
            ]);
        }

        if ($save) {
            $user->save();
        }

        return $user;
    }
}
