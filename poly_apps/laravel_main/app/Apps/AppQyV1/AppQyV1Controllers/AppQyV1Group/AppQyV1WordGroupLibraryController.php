<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Requests\Group\AppQyV1AddLibraryToGroupRequest;
use App\Apps\AppQyV1\AppQyV1Requests\Group\AppQyV1RemoveLibraryFromGroupRequest;
use App\Apps\AppQyV1\AppQyV1Requests\Group\AppQyV1GetGroupLibrariesRequest;
use App\Traits\ApiResponse;

/**
 * 词组词库管理控制器
 * 重构: 使用 FormRequest 验证, 使用错误码, 消除 supported_params 重复
 */
class AppQyV1WordGroupLibraryController
{
    use ApiResponse;

    public function addLibraryToGroup(AppQyV1AddLibraryToGroupRequest $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $gid = $request->input('gid');
        $libraryId = $request->input('library_id');

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->groupNotFound();
        }

        $library = AppQyV1VocabularyLibraryModel::find($libraryId);
        if (!$library) {
            return $this->libraryNotFound();
        }

        if ($group->language && $library->language && $group->language !== $library->language) {
            return $this->languageMismatch($library->language, $group->language, [
                'error_code' => 'LANGUAGE_MISMATCH',
            ]);
        }

        $existingLink = AppQyV1GroupLibraryModel::where('group_id', $group->id)
            ->where('library_id', $libraryId)
            ->first();

        if ($existingLink) {
            return $this->libraryAlreadyAdded();
        }

        return DB::connection('appqyv1')->transaction(function () use ($group, $libraryId, $library, $user) {
            $groupLibrary = AppQyV1GroupLibraryModel::create([
                'group_id' => $group->id,
                'library_id' => $libraryId,
                'added_at' => now(),
            ]);

            $existingWordIds = AppQyV1GroupWordModel::where('group_id', $group->id)
                ->pluck('word_id')
                ->toArray();

            $existingProgressWordIds = AppQyV1UserWordProgressModel::forUser($user->id)
                ->forGroup($group->id)
                ->pluck('word_id')
                ->toArray();

            $words = DB::connection('appqyv1')
                ->table('app_qy_v1_vocabulary_words')
                ->where('library_id', $libraryId)
                ->whereNotIn('id', $existingWordIds)
                ->get(['id', 'word']);

            $now = now();
            $groupWordsData = [];
            $progressData = [];

            foreach ($words as $word) {
                $groupWordsData[] = [
                    'group_id' => $group->id,
                    'word_id' => $word->id,
                    'language_code' => $library->language,
                    'added_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                if (!in_array($word->id, $existingProgressWordIds)) {
                    $progressData[] = [
                        'user_id' => $user->id,
                        'word_id' => $word->id,
                        'group_id' => $group->id,
                        'language_code' => $library->language,
                        'weight' => strlen($word->word),
                        'proficiency' => 0,
                        'read_count' => 0,
                        'review_count' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            $addedCount = 0;
            if (!empty($groupWordsData)) {
                DB::connection('appqyv1')->table('app_qy_v1_group_words')->insert($groupWordsData);
                $addedCount = count($groupWordsData);
            }

            if (!empty($progressData)) {
                foreach (array_chunk($progressData, 500) as $chunk) {
                    DB::connection('appqyv1')->table('app_qy_v1_user_word_progress')->insert($chunk);
                }
            }

            return $this->success([
                'gid' => $group->gid,
                'library_id' => $libraryId,
                'library_name' => $library->name,
                'words_added' => $addedCount,
                'total_words_in_library' => $words->count(),
            ], 'Library added to group successfully');
        });
    }

    public function removeLibraryFromGroup(AppQyV1RemoveLibraryFromGroupRequest $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $gid = $request->input('gid');
        $libraryId = $request->input('library_id');

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->groupNotFound();
        }

        $groupLibrary = AppQyV1GroupLibraryModel::where('group_id', $group->id)
            ->where('library_id', $libraryId)
            ->first();

        if (!$groupLibrary) {
            return $this->libraryNotLinked();
        }

        $groupLibrary->delete();

        return $this->success([
            'gid' => $group->gid,
            'library_id' => $libraryId,
        ], 'Library removed from group successfully');
    }

    public function getGroupLibraries(AppQyV1GetGroupLibrariesRequest $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $gid = $request->input('gid');

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->groupNotFound();
        }

        $libraries = DB::connection('appqyv1')
            ->table('app_qy_v1_group_libraries as gl')
            ->join('app_qy_v1_vocabulary_libraries as vl', 'gl.library_id', '=', 'vl.id')
            ->where('gl.group_id', $group->id)
            ->select([
                'vl.id',
                'vl.name',
                'vl.language',
                'vl.total_words',
                'gl.added_at',
            ])
            ->get();

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'libraries_count' => $libraries->count(),
            'libraries' => $libraries,
        ], 'Group libraries retrieved successfully');
    }
}
