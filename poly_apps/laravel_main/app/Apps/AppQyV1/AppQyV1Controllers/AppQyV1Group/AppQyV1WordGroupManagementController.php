<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\JsonResponse;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1GetGroupByGidRequest;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1GetGroupByNameRequest;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1GetGroupFrequencyRequest;
use App\Traits\ApiResponse;

class AppQyV1WordGroupManagementController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */


    public function isGroupNameExist($gname)
    {
        $uid = Auth::id();
        $group = AppQyV1WordGroupModel::where('gname', $gname)->where('uid', $uid)->first();
        return $group;
    }

    /**
     * Get dictionary group by GID
     */
    public function getGroupByGid(AppQyV1GetGroupByGidRequest $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $gid = $request->input('gid');
        $uid = Auth::id();

        $cacheKey = "word_group:{$uid}:{$gid}";

        $group = Cache::remember($cacheKey, now()->addMinutes(10), function () use ($gid, $user) {
            return AppQyV1WordGroupModel::where('gid', $gid)
                ->where('uid', $user->id)
                ->first();
        });

        if (!$group) {
            return $this->groupNotFound(['uid' => $uid]);
        }

        if (is_string($group->gwords)) {
            $group->gwords = StrTool::extractWords($group->gcontent);
        }

        $personal_words = PDQBasePublic::queryPersonalDictionary(false);
        // Merged total: gwords JSON words + the group_word_progress row's
        // total_words cache (library word-ID memberships) - disjoint
        // sources, both count.
        $groupWordsCount = $group->pivotWordsCount();

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'gwords' => $group->gwords,
            'total_words' => count($group->gwords) + $groupWordsCount,
            'created_at' => $group->created_at,
            'updated_at' => $group->updated_at,
            'uid' => $uid,
            'personal_words' => $personal_words,
            'gcontent' => $group->gcontent,
            'words_frequency' => $group->words_frequency,
        ]);
    }

    /**
     * Get dictionary group by name
     */
    public function getGroupByName(AppQyV1GetGroupByNameRequest $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $gname = $request->input('gname');
        $uid = Auth::id();

        $cacheKey = "word_group_by_name:{$uid}:{$gname}";

        $group = Cache::remember($cacheKey, now()->addMinutes(10), function () use ($gname, $user) {
            return AppQyV1WordGroupModel::where('gname', $gname)
                ->where('uid', $user->id)
                ->first();
        });

        if (!$group) {
            return $this->groupNotFound(['uid' => $uid]);
        }

        if (is_string($group->gwords)) {
            $group->gwords = StrTool::extractWords($group->gcontent);
        }

        $personal_words = PDQBasePublic::queryPersonalDictionary(false);
        // Merged total: gwords JSON words + the group_word_progress row's
        // total_words cache - disjoint sources, both count.
        $groupWordsCount = $group->pivotWordsCount();

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'gwords' => $group->gwords,
            'total_words' => count($group->gwords) + $groupWordsCount,
            'created_at' => $group->created_at,
            'updated_at' => $group->updated_at,
            'uid' => $uid,
            'personal_words' => $personal_words,
            'gcontent' => $group->gcontent,
            'words_frequency' => $group->words_frequency,
        ]);
    }

    public function getGFrequency(AppQyV1GetGroupFrequencyRequest $request): JsonResponse
    {
        $sort = $request->input('sort');
        $gid = $request->input('gid');
        $default_select = ['gid', 'gname', 'words_frequency', 'created_at', 'updated_at'];

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->select($default_select)
            ->first();

        if (!$group) {
            return $this->groupNotFound(['gid' => $gid]);
        }

        $words_frequency = $group->words_frequency;
        if ($sort == true) {
            asort($words_frequency);
        }

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'words_frequency' => $words_frequency,
            'created_at' => $group->created_at,
            'updated_at' => $group->updated_at,
        ]);
    }

    public function getGcontent(Request $request): JsonResponse
    {
        $gid = $request->input('gid');
        $isGetGwords = $request->input('gwords');
        $default_select = ['gid', 'gname', 'gcontent', 'words_frequency', 'created_at', 'updated_at'];

        if ($isGetGwords) {
            $default_select[] = 'gwords';
        }

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->select($default_select)
            ->first();

        if (!$group) {
            return $this->groupNotFound(['gid' => $gid]);
        }

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'gwords' => $group->gwords,
            'gcontent' => $group->gcontent,
            'created_at' => $group->created_at,
            'updated_at' => $group->updated_at,
            'words_frequency' => $group->words_frequency,
        ]);
    }

    /**
     * Get dictionary group words by gid
     */
    public function getGwords(Request $request): JsonResponse
    {
        $gid = $request->input('gid');
        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->select(['gid', 'gname', 'gwords', 'words_frequency', 'created_at', 'updated_at'])
            ->first();

        if (!$group) {
            return $this->groupNotFound(['gid' => $gid]);
        }

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'gwords' => $group->gwords,
            'words_frequency' => $group->words_frequency,
            'created_at' => $group->created_at,
            'updated_at' => $group->updated_at,
        ]);
    }

    /**
     * Get all dictionary groups (Manager/Admin only)
     */
    public function getAllGroupByManager(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user || $user->rolelevel != 1) {
            return $this->forbidden('Unauthorized access, level: ' . ($user->rolelevel ?? 'none'));
        }

        $start = $request->input('start', 0);
        $limit = $request->input('limit', 1000);

        $groups = AppQyV1WordGroupModel::with('wordProgress:id,group_id,total_words')
            ->orderBy('created_at', 'desc')
            ->skip($start)
            ->take($limit)
            ->get()
            ->makeHidden('gcontent');

        $uid = Auth::id();

        return $this->success([
            'uid' => $uid,
            'total' => $groups->count(),
            'start' => $start,
            'limit' => $limit,
            'groups_length' => $groups->count(),
            'groups' => $groups->map(function ($group) {
                if (is_string($group->gwords)) {
                    $group->gwords = StrTool::extractWords($group->gcontent);
                }
                // Merged total: gwords JSON words + the progress row's
                // total_words cache - disjoint sources, both count.
                $groupWordsCount = $group->pivotWordsCount();
                return [
                    'gid' => $group->gid,
                    'gname' => $group->gname,
                    'gwords' => $group->gwords,
                    'total_words' => count($group->gwords) + $groupWordsCount,
                    'created_at' => $group->created_at,
                    'updated_at' => $group->updated_at,
                    'words_frequency' => $group->words_frequency,
                ];
            }),
        ]);
    }
}

