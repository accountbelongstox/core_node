<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Enums\AppQyV1ProgressActionEnum;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

class AppQyV1ProgressService
{
    public function updateProgress(
        int $userId,
        AppQyV1WordGroupModel $group,
        int $wordId,
        AppQyV1ProgressActionEnum $action,
        ?float $proficiency = null,
        ?bool $isCorrect = null
    ): AppQyV1UserWordProgressModel {
        $progress = AppQyV1UserWordProgressModel::forUser($userId)
            ->forGroup($group->id)
            ->where('word_id', $wordId)
            ->first();

        if (!$progress) {
            $progress = $this->createProgressRecord($userId, $group->id, $wordId);
        }

        $this->applyProgressUpdate($progress, $action, $proficiency, $isCorrect);

        $progress->save();

        return $progress;
    }

    public function batchUpdateProgress(
        int $userId,
        int $groupId,
        array $updates
    ): array {
        $progressRecords = collect($updates)->map(function ($update) use ($userId, $groupId) {
            return [
                'user_id' => $userId,
                'word_id' => $update['word_id'],
                'group_id' => $groupId,
                'proficiency' => $update['proficiency'] ?? 0,
                'read_count' => $update['read_count'] ?? 0,
                'review_count' => $update['review_count'] ?? 0,
                'last_read_at' => $update['last_read_at'] ?? null,
                'last_review_at' => $update['last_review_at'] ?? null,
                'updated_at' => now(),
            ];
        })->toArray();

        DB::connection('appqyv1')->table('app_qy_v1_user_word_progress')->upsert(
            $progressRecords,
            ['user_id', 'word_id', 'group_id'],
            ['proficiency', 'read_count', 'review_count', 'last_read_at', 'last_review_at', 'updated_at']
        );

        return [
            'updated' => count($progressRecords),
        ];
    }

    public function getProgressStats(int $userId, int $groupId): array
    {
        return DB::connection('appqyv1')
            ->table('app_qy_v1_user_word_progress')
            ->where('user_id', $userId)
            ->where('group_id', $groupId)
            ->select([
                DB::raw('COUNT(*) as total_words'),
                DB::raw('AVG(proficiency) as avg_proficiency'),
                DB::raw('SUM(read_count) as total_reads'),
                DB::raw('SUM(review_count) as total_reviews'),
                DB::raw('SUM(CASE WHEN proficiency >= 90 THEN 1 ELSE 0 END) as mastered_words'),
                DB::raw('SUM(CASE WHEN proficiency >= 60 AND proficiency < 90 THEN 1 ELSE 0 END) as learning_words'),
                DB::raw('SUM(CASE WHEN proficiency < 60 THEN 1 ELSE 0 END) as struggling_words'),
                DB::raw('SUM(CASE WHEN next_review_at IS NULL OR next_review_at <= NOW() THEN 1 ELSE 0 END) as due_for_review'),
            ])
            ->first();
    }

    public function getReviewWordsPipeline(
        int $userId,
        int $groupId,
        int $limit = 20,
        ?float $proficiencyMax = null
    ): Collection {
        return AppQyV1UserWordProgressModel::forUser($userId)
            ->forGroup($groupId)
            ->dueForReview()
            ->when($proficiencyMax, fn($q) => $q->byProficiency(null, $proficiencyMax))
            ->with(['word:id,word,word_index'])
            ->orderBy('proficiency', 'asc')
            ->orderBy('weight', 'desc')
            ->limit($limit)
            ->get()
            ->pipe(function (Collection $progress) {
                return $progress->map(function ($item) {
                    return [
                        'progress_id' => $item->id,
                        'word_id' => $item->word_id,
                        'word' => $item->word->word ?? null,
                        'word_index' => $item->word->word_index ?? null,
                        'proficiency' => $item->proficiency,
                        'proficiency_level' => $item->proficiency_level->label(),
                        'read_count' => $item->read_count,
                        'review_count' => $item->review_count,
                        'last_review_at' => $item->last_review_at,
                        'next_review_at' => $item->next_review_at,
                        'weight' => $item->weight,
                        'days_since_review' => $item->last_review_at ?
                            now()->diffInDays($item->last_review_at) : null,
                    ];
                });
            })
            ->tap(function (Collection $words) {
                $this->logReviewActivity($words);
            });
    }

    protected function createProgressRecord(int $userId, int $groupId, int $wordId): AppQyV1UserWordProgressModel
    {
        $word = DB::connection('appqyv1')
            ->table('app_qy_v1_vocabulary_words')
            ->where('id', $wordId)
            ->first();

        if (!$word) {
            throw new \Exception('Word not found');
        }

        $library = DB::connection('appqyv1')
            ->table('app_qy_v1_vocabulary_libraries')
            ->where('id', $word->library_id)
            ->first();

        return AppQyV1UserWordProgressModel::create([
            'user_id' => $userId,
            'word_id' => $wordId,
            'group_id' => $groupId,
            'language_code' => $library ? $library->language : null,
            'weight' => strlen($word->word),
        ]);
    }

    protected function applyProgressUpdate(
        AppQyV1UserWordProgressModel $progress,
        AppQyV1ProgressActionEnum $action,
        ?float $proficiency,
        ?bool $isCorrect
    ): void {
        if ($action->isRead()) {
            if ($progress->first_read_at === null) {
                $progress->first_read_at = now();
            }
            $progress->last_read_at = now();
            $progress->read_count += 1;
        } else {
            $progress->last_review_at = now();
            $progress->review_count += 1;

            if ($isCorrect !== null) {
                $progress->updateProficiency($isCorrect);
            }
        }

        if ($proficiency !== null) {
            $progress->proficiency = $proficiency;
        }
    }

    protected function logReviewActivity(Collection $words): void
    {
        if ($words->isEmpty()) {
            return;
        }

        \Log::info('[AppQyV1Progress] Review words generated', [
            'count' => $words->count(),
            'avg_proficiency' => $words->avg('proficiency'),
            'priority_words' => $words->take(5)->pluck('word')->toArray(),
        ]);
    }
}
