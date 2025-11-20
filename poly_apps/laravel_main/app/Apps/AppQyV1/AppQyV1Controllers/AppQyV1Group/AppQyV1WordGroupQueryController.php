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


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\JsonResponse;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1WordGroupPublicController as DGroupAPublic;
class AppQyV1WordGroupQueryController
{
    public function isGroupNameExist($gname)
    {
        $uid = Auth::id();
        $group = AppQyV1WordGroupModel::where('gname', $gname)->where('uid', $uid)->first();
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
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Unauthorized access',
                    'supported_params' => $supported_params,
                ], 401);
            }

            $uid = Auth::id();
            $group = AppQyV1WordGroupModel::where('gid', $gid)
                ->where('uid', $user->id)
                ->first();

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
            
            return response()->json([
                'status' => 'success',
                'supported_params' => $supported_params,
                'data' => [
                    'gid' => $group->gid,
                    'did' => $personal_words["id"],
                    'gname' => $group->gname,
                    'total_words' => count($group->gwords),
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
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
                'supported_params' => $supported_params,
            ], 500);
        }
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
        try {
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

            $group = AppQyV1WordGroupModel::where('gname', $gname)
                ->where('uid', $user->id)
                ->first();

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
            return response()->json([
                'status' => 'success',
                'supported_params' => $supported_params,
                'data' => [
                    'gid' => $group->gid,
                    'uid' => $uid,
                    'did' => $personal_words["id"],
                    'gname' => $group->gname,
                    'gwords' => $group->gwords,
                    'total_words' => count($group->gwords),
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
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
                'supported_params' => $supported_params,
            ], 500);
        }
    }

    public function getGFrequency(Request $request): JsonResponse
    {
        $supported_params = ['gid', "sort_frequency"];
        $sort_frequency = $request->input(key: 'sort_frequency');
        $gid = $request->input(key: 'gid');
        $default_select = ['gid', 'gname', 'words_frequency', 'created_at', 'updated_at'];
        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->select($default_select) // specify all fields except gcontent
            ->first();
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
        $gid = $request->input(key: 'gid');
        $isGetGwords = $request->input(key: 'gwords');
        $default_select = ['gid', 'gname', 'gcontent', 'words_frequency', 'created_at', 'updated_at'];
        if ($isGetGwords) {
            $default_select[] = 'gwords';
        }
        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->select($default_select) // specify all fields except gcontent
            ->first();
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
        $gid = $request->input(key: 'gid');
        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->select(['gid', 'gname', 'gwords', 'words_frequency', 'created_at', 'updated_at']) // specify all fields except gcontent
            ->first();
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
        $supported_params = ['start', 'limit'];
        try {
            $user = Auth::user();
            DGroupAPublic::ensureDefaultGroupIfNotExist($user->id, $user->username);
            $start = $request->input(key: 'start') ?? 0;
            $limit = $request->input(key: 'limit') ?? 1000;
            if (!$user) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Unauthorized access',
                    'supported_params' => $supported_params,
                ], 401);
            }
            $groups = AppQyV1WordGroupModel::where('uid', $user->id)
                ->orderBy('created_at', 'desc')
                ->skip($start)
                ->take($limit)
                ->get()
                ->makeHidden('gcontent'); // hides gcontent in the collection

            $uid = Auth::id();
            return response()->json([
                'status' => 'success',
                'supported_params' => $supported_params,
                'data' => [
                    'uid' => $uid,
                    'total' => $groups->count(),
                    'start' => $start,
                    'limit' => $limit,
                    'groups_length' => $groups->count(),
                    'groups' => $groups->map(function ($group) {
                        if (is_string($group->gwords)) {
                            $group->gwords = StrTool::extractWords($group->gcontent);
                        }
                        return [
                            'gid' => $group->gid,
                            'gname' => $group->gname,
                            // 'gcontent' => $group->gcontent,
                            'gwords' => $group->gwords,
                            'total_words' => count($group->gwords),
                            'created_at' => $group->created_at,
                            'updated_at' => $group->updated_at,
                            'words_frequency' => $group->words_frequency,

                        ];
                    }),
                    // 'personal_words' => $personal_words,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
                'supported_params' => $supported_params,
            ], 500);
        }
    }
}

