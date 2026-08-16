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

use App\Http\Controllers\Controller;

use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordProgressModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\JsonResponse;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1WordGroupPublicController as DGroupAPublic;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;

class AppQyV1WordGroupQueryController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     * Use AuthHelper for authentication
     * Use ApiResponse trait methods (success/error/unauthorized/forbidden)
     */

    public function isGroupNameExist($gname)
    {
        $uid = Auth::id();
        $group = AppQyV1WordGroupModel::findOwnedByName((int) $uid, $gname);
        return $group;
    }

    /**
     * Get dictionary group by GID
     *
     * @return JsonResponse
     */
    public function getGroupByGid(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'fetch_gcontent', 'sort_by', 'sort_asc', 'sort_frequency'];
        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'supported_params' => $supported_params,
            ], 400);
        }
        $gid = $request->input(key: 'gid');
        $fetch_gcontent = $request->input(key: 'fetch_gcontent');
        $sort_by = $request->input(key: 'sort_by');
        $sort_asc = $request->input(key: 'sort_asc');
        $sort_frequency = $request->input(key: 'sort_frequency');
            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Unauthorized access',
                    'supported_params' => $supported_params,
                ], 401);
            }

            $uid = Auth::id();
            $group = AppQyV1WordGroupModel::findOwnedByGid((int) $user->id, $gid);

            if (!$group) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Group not found',
                    'supported_params' => $supported_params,
                    'uid' => $uid
                ], 404);
            }

            if (is_string($group->gwords)) {
                $group->gwords = StrTool::extractWords($group->gcontent);
            }
            $personal_words = PDQBasePublic::queryPersonalDictionary(false, $sort_frequency);
            $group->gwords = ArrTool::sortNestedObject($group->gwords, $sort_by, $sort_asc);
            // Merged total: gwords JSON words + the group_word_progress
            // row's total_words cache - disjoint sources, both count.
            $groupWordsCount = $group->pivotWordsCount();

            return response()->json([
                'status' => 'success',
                'supported_params' => $supported_params,
                'data' => [
                    'gid' => $group->gid,
                    'did' => $personal_words["id"],
                    'gname' => $group->gname,
                    'total_words' => count($group->gwords) + $groupWordsCount,
                    'created_at' => $group->created_at,
                    'updated_at' => $group->updated_at,
                    'uid' => $uid,
                    'personal_lenght' => $personal_words["dictionaries_lenght"],
                    'personal_query_soft_delete' => $personal_words["query_soft_delete"],
                    'fetch_gcontent' => $fetch_gcontent,
                    'personal_words' => $personal_words["data"],
                    'words_frequency' => $group->words_frequency,
                    'gwords' => $group->gwords,
                    'gcontent' => $fetch_gcontent ? $group->gcontent : null,
                ]
            ]);
    }

    /**
     * Get dictionary group by name
     *
     * @param string $gname
     * @return JsonResponse
     */
    public function getGroupByName(Request $request): JsonResponse
    {
        $supported_params = ['gname', 'fetch_gcontent', 'sort_by', 'sort_asc', 'sort_frequency'];
            $validator = Validator::make($request->all(), [
                'gname' => 'required|string',
                'fetch_gcontent' => 'nullable|boolean'
            ]);
            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => $validator->errors()->first(),
                    'supported_params' => $supported_params,
                ], 400);
            }

            $gname = $request->input(key: 'gname');
            $fetch_gcontent = $request->input(key: 'fetch_gcontent');
            $sort_by = $request->input(key: 'sort_by');
            $sort_asc = $request->input(key: 'sort_asc');
            $sort_frequency = $request->input(key: 'sort_frequency');
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Unauthorized access',
                    'supported_params' => $supported_params,
                ], 401);
            }
            $uid = Auth::id();
            if (!$gname) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Group name is required',
                    'supported_params' => $supported_params,
                    'uid' => $uid
                ], 400);
            }

            $group = AppQyV1WordGroupModel::findOwnedByName((int) $user->id, $gname);

            if (!$group) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Group not found',
                    'supported_params' => $supported_params,
                    'uid' => $uid
                ], 404);
            }

            if (is_string($group->gwords)) {
                $group->gwords = StrTool::extractWords($group->gcontent);
            }
            $group->gwords = ArrTool::sortNestedObject($group->gwords, $sort_by, $sort_asc);
            $personal_words = PDQBasePublic::queryPersonalDictionary(false, $sort_frequency);
            // Merged total: gwords JSON words + the group_word_progress
            // row's total_words cache - disjoint sources, both count.
            $groupWordsCount = $group->pivotWordsCount();
            return response()->json([
                'status' => 'success',
                'supported_params' => $supported_params,
                'data' => [
                    'gid' => $group->gid,
                    'uid' => $uid,
                    'did' => $personal_words["id"],
                    'gname' => $group->gname,
                    'gwords' => $group->gwords,
                    'total_words' => count($group->gwords) + $groupWordsCount,
                    'created_at' => $group->created_at,
                    'updated_at' => $group->updated_at,
                    'fetch_gcontent' => $fetch_gcontent,
                    'personal_lenght' => $personal_words["dictionaries_lenght"],
                    'personal_query_soft_delete' => $personal_words["query_soft_delete"],
                    'personal_words' => $personal_words["data"],
                    'gcontent' => $fetch_gcontent ? $group->gcontent : null,
                    'words_frequency' => $group->words_frequency,
                ]
            ]);
    }

    public function getGFrequency(Request $request): JsonResponse
    {
        $supported_params = ['gid', "sort_frequency"];
        $sort_frequency = $request->input(key: 'sort_frequency');
        $gid = $request->input(key: 'gid');
        $default_select = ['gid', 'gname', 'words_frequency', 'created_at', 'updated_at'];
        $group = AppQyV1WordGroupModel::findByGid($gid, $default_select);
        if (!$group) {
            return response()->json([
                'status' => 'error',
                'code' => 404,
                'gid' => $gid,
                'message' => 'Group not found',
                'supported_params' => $supported_params,
            ], 404);
        }
        $words_frequency = $group->words_frequency;
        if ($sort_frequency == true) {
            asort($words_frequency);
        }

        return response()->json([
            'status' => 'success',
            'supported_params' => $supported_params,
            'data' => [
                'gid' => $group->gid,
                'gname' => $group->gname,
                'created_at' => $group->created_at,
                'updated_at' => $group->updated_at,
                'frequency_sort' => $sort_frequency,
                'words_frequency' => $words_frequency,
            ]
        ]);
    }

    public function getGcontent(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'gwords'];
        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'supported_params' => $supported_params,
            ], 400);
        }
        $gid = $request->input(key: 'gid');
        $isGetGwords = $request->input(key: 'gwords');
        $default_select = ['gid', 'gname', 'gcontent', 'words_frequency', 'created_at', 'updated_at'];
        if ($isGetGwords) {
            $default_select[] = 'gwords';
        }
        $group = AppQyV1WordGroupModel::findByGid($gid, $default_select);
        if (!$group) {
            return response()->json([
                'status' => 'error',
                'code' => 404,
                'gid' => $gid,
                'message' => 'Group not found',
                'supported_params' => $supported_params,
            ], 404);
        }
        return response()->json([
            'status' => 'success',
            'supported_params' => $supported_params,
            'data' => [
                'gid' => $group->gid,
                'gname' => $group->gname,
                'gwords' => $group->gwords,
                'gcontent' => $group->gcontent,
                'created_at' => $group->created_at,
                'updated_at' => $group->updated_at,
                'words_frequency' => $group->words_frequency,
            ]
        ]);
    }

    /**
     * Get dictionary group by gid
     *
     * @param string $gid
     * @return JsonResponse
     */
    public function getGwords(Request $request): JsonResponse
    {
        $supported_params = ['gid'];
        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'supported_params' => $supported_params,
            ], 400);
        }
        $gid = $request->input(key: 'gid');
        $group = AppQyV1WordGroupModel::findByGid(
            $gid,
            ['gid', 'gname', 'gwords', 'words_frequency', 'created_at', 'updated_at']
        );
        if (!$group) {
            return response()->json([
                'status' => 'error',
                'code' => 404,
                'gid' => $gid,
                'message' => 'Group not found',
                'supported_params' => $supported_params,
            ], 404);
        }
        return response()->json([
            'status' => 'success',
            'supported_params' => $supported_params,
            'data' => [
                'gid' => $group->gid,
                'gname' => $group->gname,
                'gwords' => $group->gwords,
                'words_frequency' => $group->words_frequency,
                'created_at' => $group->created_at,
                'updated_at' => $group->updated_at,
            ]
        ]);
    }

    /**
     * Get all dictionary groups for the logged-in user
     *
     * @return JsonResponse
     */
    public function getAllGroup(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $validated = $request->validate([
            'start' => 'nullable|integer|min:0',
            'limit' => 'nullable|integer|min:1|max:1000',
            'with_words' => 'nullable|boolean',
        ]);

        // Read-side shuffle-ensure hook for the Default Vocabulary Group
        // (design doc §5.3 R2): the one-time random shuffle is applied on
        // the first list request, then gated by shuffled_at forever after.
        // Wrapped so a shuffle failure never breaks the groups listing.
        $defaultGroupResult = DGroupAPublic::ensureDefaultGroupIfNotExist($user->id, $user->username);
        try {
            if (isset($defaultGroupResult['did'])) {
                $defaultProgress = AppQyV1GroupWordProgressModel::findByGroupId((int) $defaultGroupResult['did']);
                if ($defaultProgress) {
                    $defaultProgress->ensureShuffledOnce();
                }
            }
        } catch (\Throwable $e) {
            // Shuffle is best-effort; the listing must still return.
        }

        $start = $validated['start'] ?? 0;
        $limit = $validated['limit'] ?? 1000;
        $withWords = $validated['with_words'] ?? false;

        // Always merge both word stores: a group's words live in TWO
        // disjoint representations (legacy gwords JSON text + the
        // group_word_progress row's word-ID map from library attachment)
        // and the displayed total is the sum of both. total_words comes
        // from the progress row's cache - one eager-loaded row per group.
        $groups = AppQyV1WordGroupModel::pageWithProgress(
            (int) $user->id,
            $start,
            $limit,
            ['id', 'gid', 'gname', 'gwords', 'words_frequency', 'created_at', 'updated_at', 'uid', 'cover_url', 'thumbnail_url', 'cover_category', 'language', 'is_language_default']
        );

        $mappedGroups = $groups->map(function ($group) {
            $gwords = $group->gwords;
            if (is_string($gwords)) {
                $decodedGwords = json_decode($gwords, true);
                $gwords = $decodedGwords ?? [];
            }
            if (!is_array($gwords)) {
                $gwords = [];
            }

            $groupWordsCount = $group->pivotWordsCount();

            $data = [
                'gid' => $group->gid,
                'gname' => $group->gname,
                'gwords' => $gwords,
                'total_words' => count($gwords) + $groupWordsCount,
                'created_at' => $group->created_at,
                'updated_at' => $group->updated_at,
                'words_frequency' => $group->words_frequency,
                'cover_url' => $group->cover_url ?? null,
                'thumbnail_url' => $group->thumbnail_url ?? null,
                'cover_category' => $group->cover_category ?? 'custom',
                'language' => $group->language ?? 'en',
                'is_language_default' => $group->is_language_default ?? false,
            ];

            return $data;
        });

        return $this->success([
            'uid' => $user->id,
            'total' => $groups->count(),
            'start' => $start,
            'limit' => $limit,
            'groups_length' => $groups->count(),
            'groups' => $mappedGroups,
        ], 'Groups retrieved successfully');
    }
}
