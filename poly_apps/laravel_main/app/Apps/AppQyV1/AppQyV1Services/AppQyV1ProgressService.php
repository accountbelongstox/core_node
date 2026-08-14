<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Enums\AppQyV1ProgressActionEnum;
use App\Apps\AppQyV1\AppQyV1Enums\AppQyV1ProficiencyLevelEnum;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Collection;

/**
 * Progress operations on the per-(user, group) JSON progress row
 * (group_word_progress; entry legend in AppQyV1GroupWordProgressModel).
 * Every mutation is a whole-map merge persisted with ONE save.
 */
class AppQyV1ProgressService
{
    /**
     * Apply one progress action to one word and persist with a single JSON
     * write. Returns the updated entry expanded to full field names
     * (timestamps stay unix seconds).
     */
    public function updateProgress(
        int $userId,
        AppQyV1WordGroupModel $group,
        int $wordId,
        AppQyV1ProgressActionEnum $action,
        ?float $proficiency = null,
        ?bool $isCorrect = null
    ): array {
        $progressRow = AppQyV1GroupWordProgressModel::forUserGroup($userId, $group->id, $this->resolveGroupLanguageCode($group));

        if (!$progressRow->hasWord($wordId)) {
            $word = AppQyV1LangDictionaryModel::findForLanguage(
                $progressRow->languageCodeValue(),
                (int) $wordId
            );
            if (!$word) {
                Log::error('[AppQyV1ProgressService] Word not found', [
                    'word_id' => $wordId,
                    'user_id' => $userId,
                    'group_id' => $group->id,
                    'language_code' => $progressRow->languageCodeValue(),
                ]);
                return AppQyV1GroupWordProgressModel::expandEntry(AppQyV1GroupWordProgressModel::EMPTY_ENTRY);
            }
            $progressRow->putWords([$wordId], (string) now(), [$wordId => strlen((string) $word->content)]);
        }

        $map = $progressRow->getWordsMap();
        $entry = array_merge(AppQyV1GroupWordProgressModel::EMPTY_ENTRY, $map[(string) $wordId]);

        $patch = [];
        if ($action->isRead()) {
            $patch['lr'] = time();
            $patch['rc'] = ((int) $entry['rc']) + 1;
        } else {
            $patch['lv'] = time();
            $patch['vc'] = ((int) $entry['vc']) + 1;

            if ($isCorrect !== null) {
                $newProficiency = (float) $entry['pf'];
                if ($isCorrect) {
                    $newProficiency = min(100, $newProficiency + 5);
                } else {
                    $newProficiency = max(0, $newProficiency - 10);
                }
                $patch['pf'] = $newProficiency;
            }
        }

        if ($proficiency !== null) {
            $patch['pf'] = $proficiency;
        }

        $entry = $progressRow->updateWordProgress($wordId, $patch);
        $progressRow->saveRecord();

        return AppQyV1GroupWordProgressModel::expandEntry($entry);
    }

    /**
     * Batch-merge raw progress values (full overwrite per provided field)
     * with ONE JSON write for the whole batch.
     *
     * @param array<int, array{word_id:int, proficiency?:float, read_count?:int, review_count?:int, last_read_at?:int|string|null, last_review_at?:int|string|null}> $updates
     */
    public function batchUpdateProgress(
        int $userId,
        int $groupId,
        array $updates
    ): array {
        $progressRow = AppQyV1GroupWordProgressModel::forUserGroup($userId, $groupId);

        $updated = 0;
        foreach ($updates as $update) {
            $patch = [];
            if (isset($update['proficiency'])) {
                $patch['pf'] = (float) $update['proficiency'];
            }
            if (isset($update['read_count'])) {
                $patch['rc'] = (int) $update['read_count'];
            }
            if (isset($update['review_count'])) {
                $patch['vc'] = (int) $update['review_count'];
            }
            if (isset($update['last_read_at'])) {
                $patch['lr'] = $this->toUnix($update['last_read_at']);
            }
            if (isset($update['last_review_at'])) {
                $patch['lv'] = $this->toUnix($update['last_review_at']);
            }
            $progressRow->updateWordProgress((int) $update['word_id'], $patch);
            $updated++;
        }

        $progressRow->saveRecord();

        return [
            'updated' => $updated,
        ];
    }

    /**
     * Aggregate the group's JSON map in PHP (one row read; same keys as the
     * legacy SQL aggregate).
     */
    public function getProgressStats(int $userId, int $groupId): array
    {
        $progressRow = AppQyV1GroupWordProgressModel::findForUserGroup($userId, $groupId);

        $totalWords = 0;
        $proficiencySum = 0.0;
        $totalReads = 0;
        $totalReviews = 0;
        $mastered = 0;
        $learning = 0;
        $struggling = 0;
        $due = 0;
        $nowTs = time();

        if ($progressRow) {
            foreach ($progressRow->getWordsMap() as $stored) {
                $entry = AppQyV1GroupWordProgressModel::EMPTY_ENTRY;
                if (is_array($stored)) {
                    $entry = array_merge($entry, $stored);
                }
                $totalWords++;
                $pf = (float) $entry['pf'];
                $proficiencySum += $pf;
                $totalReads += (int) $entry['rc'];
                $totalReviews += (int) $entry['vc'];
                if ($pf >= 90) {
                    $mastered++;
                } elseif ($pf >= 60) {
                    $learning++;
                } else {
                    $struggling++;
                }
                if (AppQyV1GroupWordProgressModel::entryDueForReview($entry, $nowTs)) {
                    $due++;
                }
            }
        }

        $avgProficiency = null;
        if ($totalWords > 0) {
            $avgProficiency = $proficiencySum / $totalWords;
        }

        return [
            'total_words' => $totalWords,
            'avg_proficiency' => $avgProficiency,
            'total_reads' => $totalReads,
            'total_reviews' => $totalReviews,
            'mastered_words' => $mastered,
            'learning_words' => $learning,
            'struggling_words' => $struggling,
            'due_for_review' => $due,
        ];
    }

    public function getReviewWordsPipeline(
        int $userId,
        int $groupId,
        int $limit = 20,
        ?float $proficiencyMax = null
    ): Collection {
        $progressRow = AppQyV1GroupWordProgressModel::findForUserGroup($userId, $groupId);

        if (!$progressRow) {
            return collect();
        }

        $nowTs = time();
        $candidates = [];
        foreach ($progressRow->getWordsMap() as $key => $stored) {
            $entry = AppQyV1GroupWordProgressModel::EMPTY_ENTRY;
            if (is_array($stored)) {
                $entry = array_merge($entry, $stored);
            }
            if (!AppQyV1GroupWordProgressModel::entryDueForReview($entry, $nowTs)) {
                continue;
            }
            if ($proficiencyMax !== null && (float) $entry['pf'] > $proficiencyMax) {
                continue;
            }
            $candidates[] = [(int) $key, $entry];
        }

        usort($candidates, function (array $a, array $b) {
            $pfCompare = (float) $a[1]['pf'] <=> (float) $b[1]['pf'];
            if ($pfCompare !== 0) {
                return $pfCompare;
            }
            $wtCompare = (int) $b[1]['wt'] <=> (int) $a[1]['wt'];
            if ($wtCompare !== 0) {
                return $wtCompare;
            }
            return $a[0] <=> $b[0];
        });

        $candidates = array_slice($candidates, 0, $limit);

        $candidateIds = [];
        foreach ($candidates as $candidate) {
            $candidateIds[] = $candidate[0];
        }
        // Map keys are dictionary ids: batch-resolve the word texts (one
        // whereIn per chunk via the shared resolver).
        $resolved = $progressRow->resolveDictionaryRows($candidateIds);

        $words = collect();
        foreach ($candidates as $candidate) {
            $wordId = $candidate[0];
            $entry = $candidate[1];

            $wordText = null;
            if (isset($resolved[$wordId])) {
                $wordText = $resolved[$wordId]->content;
            }

            $lastReviewAt = null;
            $daysSinceReview = null;
            if ($entry['lv'] !== null) {
                $lastReviewAt = Carbon::createFromTimestamp((int) $entry['lv']);
                $daysSinceReview = now()->diffInDays($lastReviewAt);
            }
            $nextReviewAt = null;
            if ($entry['nr'] !== null) {
                $nextReviewAt = Carbon::createFromTimestamp((int) $entry['nr']);
            }

            $words->push([
                'progress_id' => $wordId,
                'word_id' => $wordId,
                'word' => $wordText,
                'word_index' => null,
                'proficiency' => (float) $entry['pf'],
                'proficiency_level' => AppQyV1ProficiencyLevelEnum::fromProficiency((float) $entry['pf'])->label(),
                'read_count' => (int) $entry['rc'],
                'review_count' => (int) $entry['vc'],
                'last_review_at' => $lastReviewAt,
                'next_review_at' => $nextReviewAt,
                'weight' => (int) $entry['wt'],
                'days_since_review' => $daysSinceReview,
            ]);
        }

        $this->logReviewActivity($words);

        return $words;
    }

    /**
     * Normalized 2-letter language code of a group ('en' default).
     */
    protected function resolveGroupLanguageCode(AppQyV1WordGroupModel $group): string
    {
        $languageCode = null;
        if ($group->language) {
            $languageCode = AppQyV1LanguageConfigService::normalizeToCode($group->language);
        }
        if (!is_string($languageCode) || $languageCode === '') {
            $languageCode = 'en';
        }
        return $languageCode;
    }

    /** Datetime string or unix int -> unix seconds (null passthrough). */
    protected function toUnix($value): ?int
    {
        if ($value === null) {
            return null;
        }
        if (is_int($value)) {
            return $value;
        }
        $ts = strtotime((string) $value);
        if ($ts === false) {
            return null;
        }
        return $ts;
    }

    protected function logReviewActivity(Collection $words): void
    {
        if ($words->isEmpty()) {
            return;
        }

        Log::info('[AppQyV1Progress] Review words generated', [
            'count' => $words->count(),
            'avg_proficiency' => $words->avg('proficiency'),
            'priority_words' => $words->take(5)->pluck('word')->toArray(),
        ]);
    }
}
