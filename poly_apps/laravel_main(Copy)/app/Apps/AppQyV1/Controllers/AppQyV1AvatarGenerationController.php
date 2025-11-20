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


namespace App\Apps\AppQyV1\Controllers;

use Laravolt\Avatar\Avatar;

class AppQyV1AvatarGenerationController
{
    private $saveDir = "avatars";
    public static function createAvatar($user, $save = false)
    {
        $avatarDir = public_path('avatars');
        if (!file_exists($avatarDir)) {
            mkdir($avatarDir, 0755, true);
        }
        if (!$user->avatar) {
            $avatarPath = 'avatars/' . $user->id . '.png';
            if (!file_exists($avatarPath)) {
                $avatarCreator = new Avatar();
                $avatarCreator->create($user->username);
                $avatarCreator->save(public_path($avatarPath), 80);
            }
            $user->avatar = $avatarPath;
        }
        if ($save) {
            $user->save();
        }
        return $user;
    }

}

