<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyItemModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class AppQyV1WordGroupService
{
    public function addLibraryToGroup(
        AppQyV1WordGroupModel $group,
        int $libraryId,
        int $userId
    ): array {
        return DB::transaction(function () use ($group, $libraryId, $userId) {
            $library = AppQyV1VocabularyLibraryModel::findOrFail($libraryId);

            $groupLibrary = AppQyV1GroupLibraryModel::create([
                'group_id' => $group->id,
                'library_id' => $libraryId,
                'added_at' => now(),
            ]);

            $result = $this->addWordsFromLibrary($group, $library, $userId);

            $this->clearGroupCache($group->gid, $userId);

            return [
                'group_library' => $groupLibrary,
                'words_added' => $result['words_added'],
                'total_words' => $result['total_words'],
            ];
        });
    }

    public function addWordsToGroup(
        AppQyV1WordGroupModel $group,
        array $wordIds,
        int $userId
    ): array {
        return DB::transaction(function () use ($group, $wordIds, $userId) {
            $existingWordIds = AppQyV1GroupWordModel::where('group_id', $group->id)
                ->whereIn('word_id', $wordIds)
                ->pluck('word_id')
                ->toArray();

            $wordsToAdd = array_diff($wordIds, $existingWordIds);
            $skippedCount = count($existingWordIds);

            if (empty($wordsToAdd)) {
                return [
                    'words_added' => 0,
                    'words_skipped' => $skippedCount,
                    'total_requested' => count($wordIds),
                ];
            }

            $words = AppQyV1VocabularyItemModel::with('collection')
                ->whereIn('id', $wordsToAdd)
                ->get()
                ->map(function ($item) {
                    return (object)[
                        'id' => $item->id,
                        'word' => $item->word_content,
                        'language' => $item->collection->lang_code ?? null,
                    ];
                })
                ->keyBy('id');

            $result = $this->bulkInsertGroupWords($group, $words, $userId);

            $this->clearGroupCache($group->gid, $userId);

            return [
                'words_added' => $result['words_added'],
                'words_skipped' => $skippedCount + $result['words_skipped'],
                'total_requested' => count($wordIds),
            ];
        });
    }

    protected function addWordsFromLibrary(
        AppQyV1WordGroupModel $group,
        AppQyV1VocabularyLibraryModel $library,
        int $userId
    ): array {
        $existingWordIds = AppQyV1GroupWordModel::where('group_id', $group->id)
            ->pluck('word_id')
            ->toArray();

        $words = AppQyV1VocabularyItemModel::where('collection_id', $library->id)
            ->whereNotIn('id', $existingWordIds)
            ->get()
            ->map(function ($item) {
                return (object)[
                    'id' => $item->id,
                    'word' => $item->word_content,
                ];
            });

        $result = $this->bulkInsertGroupWords($group, $words, $userId, $library->language);

        return [
            'words_added' => $result['words_added'],
            'total_words' => $words->count(),
        ];
    }

    protected function bulkInsertGroupWords(
        AppQyV1WordGroupModel $group,
        $words,
        int $userId,
        ?string $languageCode = null
    ): array {
        $existingProgressWordIds = AppQyV1UserWordProgressModel::forUser($userId)
            ->forGroup($group->id)
            ->pluck('word_id')
            ->toArray();

        $now = now();
        $groupWordsData = [];
        $progressData = [];
        $skippedCount = 0;

        foreach ($words as $word) {
            if (!$word) {
                $skippedCount++;
                continue;
            }

            $lang = $languageCode ?? ($word->language ?? null);

            $groupWordsData[] = [
                'group_id' => $group->id,
                'word_id' => $word->id,
                'language_code' => $lang,
                'added_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (!in_array($word->id, $existingProgressWordIds)) {
                $progressData[] = [
                    'user_id' => $userId,
                    'word_id' => $word->id,
                    'group_id' => $group->id,
                    'language_code' => $lang,
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

        return [
            'words_added' => $addedCount,
            'words_skipped' => $skippedCount,
        ];
    }

    public function getGroupWithCache(string $gid, int $userId): ?AppQyV1WordGroupModel
    {
        $cacheKey = "word_group:{$userId}:{$gid}";

        return Cache::remember($cacheKey, now()->addMinutes(10), function () use ($gid, $userId) {
            return AppQyV1WordGroupModel::forUser($userId)
                ->byGid($gid)
                ->first();
        });
    }

    public function clearGroupCache(string $gid, int $userId): void
    {
        Cache::forget("word_group:{$userId}:{$gid}");
        Cache::forget("user_groups:{$userId}");
    }

    public function getUserGroupsWithCache(int $userId, int $start = 0, int $limit = 1000)
    {
        $cacheKey = "user_groups:{$userId}:{$start}:{$limit}";

        return Cache::remember($cacheKey, now()->addMinutes(5), function () use ($userId, $start, $limit) {
            return AppQyV1WordGroupModel::forUser($userId)
                ->select(['id', 'gid', 'gname', 'gwords', 'words_frequency', 'created_at', 'updated_at', 'uid'])
                ->withCount('groupWords')
                ->orderBy('created_at', 'desc')
                ->skip($start)
                ->take($limit)
                ->get();
        });
    }
}
