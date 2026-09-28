<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DailyReadingVirtualProgressModel;

class AppQyV1DailyReadingVirtualProgressService
{
    public const DEFAULT_BATCH_NAME = 'default';

    public function normalizeBatchName(?string $batchName): string
    {
        $normalized = trim((string) $batchName);

        return $normalized !== '' ? $normalized : self::DEFAULT_BATCH_NAME;
    }

    public function select(
        int $userId,
        string $batchName,
        string $languageCode,
        array $rows,
        int $maxReadCount,
        callable $selector,
        bool $consume,
        ?string $requestKey = null
    ): array {
        $normalizedBatchName = $this->normalizeBatchName($batchName);
        $progress = null;
        $model = null;
        $connection = null;

        if (!$consume) {
            $progress = AppQyV1DailyReadingVirtualProgressModel::findForBatch(
                $userId,
                $normalizedBatchName,
                $languageCode
            );

            return $this->buildSelection(
                $normalizedBatchName,
                $languageCode,
                $rows,
                $maxReadCount,
                $selector,
                $progress,
                false
            );
        }

        $model = new AppQyV1DailyReadingVirtualProgressModel();
        $connection = $model->getConnection();

        return $connection->transaction(function () use (
            $userId,
            $normalizedBatchName,
            $languageCode,
            $rows,
            $maxReadCount,
            $selector
            ,$requestKey
        ): array {
            AppQyV1DailyReadingVirtualProgressModel::createMissingForBatch(
                $userId,
                $normalizedBatchName,
                $languageCode
            );
            $progress = AppQyV1DailyReadingVirtualProgressModel::lockForBatch(
                $userId,
                $normalizedBatchName,
                $languageCode
            );

            $requestWordIds = trim((string) $requestKey) !== '' && $progress !== null
                ? $progress->requestWordIds(trim((string) $requestKey))
                : null;
            if ($requestWordIds !== null) {
                return $this->replaySelection(
                    $normalizedBatchName,
                    $languageCode,
                    $rows,
                    $requestWordIds,
                    $progress
                );
            }

            return $this->buildSelection(
                $normalizedBatchName,
                $languageCode,
                $rows,
                $maxReadCount,
                $selector,
                $progress,
                true,
                $requestKey
            );
        });
    }

    private function buildSelection(
        string $batchName,
        string $languageCode,
        array $rows,
        int $maxReadCount,
        callable $selector,
        ?AppQyV1DailyReadingVirtualProgressModel $progress,
        bool $consume,
        ?string $requestKey = null
    ): array {
        $countsBefore = $progress?->readCounts() ?? [];
        $projectedRows = $this->overlayReadCounts($rows, $countsBefore, $maxReadCount);
        $selectedWords = $selector($projectedRows);
        $selectedWordIds = [];
        $recordedWordCount = 0;
        $countsAfter = $countsBefore;

        if ($consume && $progress !== null) {
            foreach ($selectedWords as $word) {
                $wordId = (int) ($word['dictionary_word_id'] ?? 0);
                if ($wordId > 0) {
                    $selectedWordIds[] = $wordId;
                }
            }
            $recordedWordCount = $progress->recordReads($selectedWordIds, $requestKey);
            $countsAfter = $progress->readCounts();
        }

        return [
            'selected_words' => $selectedWords,
            'batch' => [
                'name' => $batchName,
                'language' => $languageCode,
                'consumed' => $consume,
                'idempotent_replay' => false,
                'recorded_word_count' => $recordedWordCount,
                'read_word_count_before' => count($countsBefore),
                'read_word_count_after' => count($countsAfter),
                'read_event_count_before' => array_sum($countsBefore),
                'read_event_count_after' => array_sum($countsAfter),
            ],
        ];
    }

    private function replaySelection(
        string $batchName,
        string $languageCode,
        array $rows,
        array $wordIds,
        AppQyV1DailyReadingVirtualProgressModel $progress
    ): array {
        $byId = [];
        $selectedWords = [];
        $counts = $progress->readCounts();

        foreach ($rows as $row) {
            $wordId = (int) ($row['dictionary_word_id'] ?? 0);
            if ($wordId > 0) {
                $byId[$wordId] = $row;
            }
        }
        foreach ($wordIds as $wordId) {
            if (isset($byId[(int) $wordId])) {
                $selectedWords[] = $byId[(int) $wordId];
            }
        }

        return [
            'selected_words' => $selectedWords,
            'batch' => [
                'name' => $batchName,
                'language' => $languageCode,
                'consumed' => false,
                'idempotent_replay' => true,
                'recorded_word_count' => 0,
                'read_word_count_before' => count($counts),
                'read_word_count_after' => count($counts),
                'read_event_count_before' => array_sum($counts),
                'read_event_count_after' => array_sum($counts),
            ],
        ];
    }

    private function overlayReadCounts(array $rows, array $virtualReadCounts, int $maxReadCount): array
    {
        $projectedRows = [];

        foreach ($rows as $row) {
            $wordId = (int) ($row['dictionary_word_id'] ?? 0);
            $groupReadCount = max(0, (int) ($row['group_read_count'] ?? $row['play_count'] ?? 0));
            $virtualReadCount = $wordId > 0
                ? max(0, (int) ($virtualReadCounts[(string) $wordId] ?? 0))
                : 0;
            $effectiveReadCount = $groupReadCount + $virtualReadCount;
            $row['group_read_count'] = $groupReadCount;
            $row['virtual_read_count'] = $virtualReadCount;
            $row['play_count'] = $effectiveReadCount;
            $row['played'] = $effectiveReadCount > 0;
            $row['eligible_for_new_only'] = $effectiveReadCount <= $maxReadCount;
            $projectedRows[] = $row;
        }

        return $projectedRows;
    }
}
