<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageStudyGroupService;
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
        if ($uid === null) {
            $uid = Auth::id();
        }
        if ($username === null) {
            $authUser = Auth::user();
            if ($authUser !== null) {
                $username = $authUser->username;
            }
        }
        $isNewGroup = false;
        $existGroupQuery = AppQyV1WordGroupModel::where('gname', $gname);
        if ($uid !== null) {
            $existGroupQuery->where('uid', $uid);
        } elseif ($username !== null) {
            $existGroupQuery->where('username', $username);
        } else {
            $existGroupQuery->whereRaw('1 = 0');
        }
        $existGroup = $existGroupQuery->first();
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
            if ($uid === null) {
                $uid = Auth::id();
            }
            $existGroup = AppQyV1LanguageStudyGroupService::createLanguageDefaultGroup((int) $uid, 'en');
            $did = $existGroup->id;
            $wordsFrequency = is_array($existGroup->words_frequency)
                ? $existGroup->words_frequency
                : [];
            return [
                'gid' => $existGroup->gid,
                'uid' => $existGroup->uid,
                'did' => $did,
                'gname' => $existGroup->gname,
                'new_words' => 0,
                'created_at' => $existGroup->created_at,
                'updated_at' => $existGroup->updated_at,
                'words_frequency_count' => count($wordsFrequency),
                'words_frequency' => $wordsFrequency,
                'gwords_count' => StrTool::wordCount($existGroup->gwords),
                'gcontent_count' => 0,
            ];

    }
}
