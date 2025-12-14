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

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Utils\StrTool;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use App\Traits\ApiResponse;

class AppQyV1WordGroupPublicController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public static $default_group_name = "Default Vocabulary Group";

    public static function isGroupNameExist($gname, $uid = null, $username = null)
    {
        $uid = Auth::id();
        if (isset($uid)) {
            $uid = $uid;
        }
        $username = Auth::user()->username;
        if (isset($username)) {
            $username = $username;
        }
        $isNewGroup = false;
        $existGroup = AppQyV1WordGroupModel::where('gname', $gname)
            ->where(function ($query) use ($uid, $username) {
                $query->where('uid', $uid)
                    ->orWhere('username', $username);
            })
            ->first();
        if (!$existGroup) {
            $isNewGroup = true;
            $existGroup = new AppQyV1WordGroupModel([
                'gid' => Str::uuid()->toString(),
                'uid' => $uid,
                'username' => $username,
                'gname' => $gname,
                'gcontent' => '',
                'gwords' => [],
                'words_frequency' => [],
            ]);
        }
        return [
            'group' => $existGroup,
            'isNewGroup' => $isNewGroup,
        ];
    }

    public static function ensureDefaultGroupIfNotExist($uid = null, $username = null)
    {
            $gname = self::$default_group_name;
            $existGroupResult = self::isGroupNameExist($gname, $uid, $username);
            $existGroup = $existGroupResult['group'];
            $did = $existGroup->id;
            $isNewGroup = $existGroupResult['isNewGroup'];
            if ($isNewGroup) {
                $existGroup->save();
            }
            return [
                'gid' => $existGroup->gid,
                'uid' => $existGroup->uid,
                'did' => $did,
                'gname' => $gname,
                'new_words' => 0,
                'created_at' => $existGroup->created_at,
                'updated_at' => $existGroup->updated_at,
                'words_frequency_count' => count($existGroup->words_frequency),
                'words_frequency' => $existGroup->words_frequency,
                'gwords_count' => StrTool::wordCount($existGroup->gwords),
                'gcontent_count' => 0,
            ];

    }
}
