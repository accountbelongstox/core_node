<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyItemModel;
use App\Traits\ApiResponse;

class AppQyV1WordGroupWordController
{
    use ApiResponse;

    public function addWordToGroup(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'word_id', 'word_ids'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
            'word_id' => 'required_without:word_ids|integer',
            'word_ids' => 'required_without:word_id|array',
            'word_ids.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return $this->error($validator->errors()->first(), 400, [
                'supported_params' => $supported_params,
            ]);
        }

        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $gid = $request->input('gid');
        $wordId = $request->input('word_id');
        $wordIds = $request->input('word_ids', []);

        if ($wordId) {
            $wordIds = [$wordId];
        }

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        return DB::transaction(function () use ($group, $wordIds, $user, $gid) {
            $existingWordIds = AppQyV1GroupWordModel::where('group_id', $group->id)
                ->whereIn('word_id', $wordIds)
                ->pluck('word_id')
                ->toArray();

            $wordsToAdd = array_diff($wordIds, $existingWordIds);
            $skippedCount = count($existingWordIds);

            if (empty($wordsToAdd)) {
                return $this->success([
                    'gid' => $group->gid,
                    'words_added' => 0,
                    'words_skipped' => $skippedCount,
                    'total_requested' => count($wordIds),
                ], 'No new words to add');
            }

            $words = AppQyV1VocabularyItemModel::with('collection')
                ->whereIn('id', $wordsToAdd)
                ->get()
                ->mapWithKeys(function ($item) {
                    return [$item->id => (object)[
                        'id' => $item->id,
                        'word' => $item->word_content,
                        'language' => $item->collection->lang_code ?? null,
                    ]];
                });

            $existingProgressWordIds = AppQyV1UserWordProgressModel::forUser($user->id)
                ->forGroup($group->id)
                ->whereIn('word_id', $wordsToAdd)
                ->pluck('word_id')
                ->toArray();

            $now = now();
            $groupWordsData = [];
            $progressData = [];

            foreach ($wordsToAdd as $wId) {
                $word = $words->get($wId);
                if (!$word) {
                    $skippedCount++;
                    continue;
                }

                $groupWordsData[] = [
                    'group_id' => $group->id,
                    'word_id' => $wId,
                    'language_code' => $word->language,
                    'added_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                if (!in_array($wId, $existingProgressWordIds)) {
                    $progressData[] = [
                        'user_id' => $user->id,
                        'word_id' => $wId,
                        'group_id' => $group->id,
                        'language_code' => $word->language,
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
                AppQyV1GroupWordModel::insert($groupWordsData);
                $addedCount = count($groupWordsData);
            }

            if (!empty($progressData)) {
                foreach (array_chunk($progressData, 500) as $chunk) {
                    AppQyV1UserWordProgressModel::insert($chunk);
                }
            }

            return $this->success([
                'gid' => $group->gid,
                'words_added' => $addedCount,
                'words_skipped' => $skippedCount,
                'total_requested' => count($wordIds),
            ], 'Words added to group successfully');
        });
    }

    public function removeWordFromGroup(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'word_id', 'word_ids'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
            'word_id' => 'required_without:word_ids|integer',
            'word_ids' => 'required_without:word_id|array',
            'word_ids.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return $this->error($validator->errors()->first(), 400, [
                'supported_params' => $supported_params,
            ]);
        }

        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $gid = $request->input('gid');
        $wordId = $request->input('word_id');
        $wordIds = $request->input('word_ids', []);

        if ($wordId) {
            $wordIds = [$wordId];
        }

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        $removedCount = AppQyV1GroupWordModel::where('group_id', $group->id)
            ->whereIn('word_id', $wordIds)
            ->delete();

        return $this->success([
            'gid' => $group->gid,
            'words_removed' => $removedCount,
            'total_requested' => count($wordIds),
        ], 'Words removed from group successfully');
    }

    public function getGroupWords(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'page', 'per_page', 'with_progress'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'with_progress' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->error($validator->errors()->first(), 400, [
                'supported_params' => $supported_params,
            ]);
        }

        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $gid = $request->input('gid');
        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 50);
        $withProgress = $request->input('with_progress', false);

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        $offset = ($page - 1) * $perPage;

        $totalCount = $group->groupWords()->count();

        $query = AppQyV1GroupWordModel::where('group_id', $group->id)
            ->with(['word:id,word,word_index'])
            ->select(['id', 'word_id', 'language_code', 'added_at']);

        if ($withProgress) {
            $query->with(['word.userProgress' => function ($q) use ($user, $group) {
                $q->forUser($user->id)
                  ->forGroup($group->id)
                  ->select(['word_id', 'proficiency', 'read_count', 'review_count', 'last_read_at', 'next_review_at']);
            }]);
        }

        $groupWords = $query->skip($offset)
            ->take($perPage)
            ->get();

        $words = $groupWords->map(function ($gw) use ($withProgress) {
            $data = [
                'word_id' => $gw->word_id,
                'word' => $gw->word->word ?? null,
                'word_index' => $gw->word->word_index ?? null,
                'language_code' => $gw->language_code,
                'added_at' => $gw->added_at,
            ];

            if ($withProgress && $gw->word && $gw->word->userProgress->isNotEmpty()) {
                $progress = $gw->word->userProgress->first();
                $data['proficiency'] = $progress->proficiency;
                $data['read_count'] = $progress->read_count;
                $data['review_count'] = $progress->review_count;
                $data['last_read_at'] = $progress->last_read_at;
                $data['next_review_at'] = $progress->next_review_at;
            }

            return $data;
        });

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'total_words' => $totalCount,
            'page' => $page,
            'per_page' => $perPage,
            'words' => $words,
        ], 'Group words retrieved successfully');
    }
}
