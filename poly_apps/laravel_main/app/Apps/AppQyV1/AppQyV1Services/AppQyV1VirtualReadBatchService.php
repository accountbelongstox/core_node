<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DailyReadingVirtualProgressModel as VirtualProgress;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1OrchClientTaskModel as ClientTask;

/**
 * Named virtual read batches of a user (daily reading `default`, one per
 * client orchestration `orch-<task id>`, or any batch picked from history).
 * At most MAX_BATCHES per user: when a batch is created the others are pruned -
 * batches no client task and no daily reading reference first, oldest use
 * first; only when every remaining batch is referenced, the stalest ones.
 */
final class AppQyV1VirtualReadBatchService
{
    public const MAX_BATCHES = 20;

    public const ERROR_BATCH_NOT_FOUND = 'VIRTUAL_READ_BATCH_NOT_FOUND';

    public function __construct(
        private readonly AppQyV1DailyReadingVirtualProgressService $progress,
    ) {
    }

    /** @return array{items: array<int, array<string, mixed>>, max: int} */
    public function list(int $userId): array
    {
        $referenced = $this->referencedNames($userId);
        $batches = [];

        foreach (VirtualProgress::query()->where('user_id', $userId)->get() as $row) {
            $name = (string) $row->batch_name;
            $batch = $batches[$name] ?? [
                'name' => $name,
                'languages' => [],
                'words' => 0,
                'reads' => 0,
                'last_used_at' => null,
                'referenced' => isset($referenced[$name]),
            ];
            $batch['languages'][] = (string) $row->language_code;
            $batch['words'] += (int) $row->total_words;
            $batch['reads'] += array_sum($row->readCounts());
            $used = $this->usedAt($row);
            if ($used !== null && ($batch['last_used_at'] === null || $used > $batch['last_used_at'])) {
                $batch['last_used_at'] = $used;
            }
            $batches[$name] = $batch;
        }
        $items = array_values(array_map(static function (array $batch): array {
            $batch['last_used_at'] = $batch['last_used_at']?->copy()->utc()->toIso8601ZuluString();

            return $batch;
        }, $batches));
        usort($items, static fn (array $left, array $right): int => strcmp((string) $right['last_used_at'], (string) $left['last_used_at']));

        return ['items' => $items, 'max' => self::MAX_BATCHES];
    }

    /**
     * Record one read of each played word (dictionary word ids) in the batch,
     * idempotent by request key; creating a batch prunes the others.
     *
     * @param array<int, int> $wordIds
     */
    public function recordReads(int $userId, string $batchName, string $languageCode, array $wordIds, ?string $requestKey): array
    {
        $name = $this->progress->normalizeBatchName($batchName);
        $existed = VirtualProgress::findForBatch($userId, $name, $languageCode) !== null;
        $recorded = 0;

        VirtualProgress::createMissingForBatch($userId, $name, $languageCode);
        (new VirtualProgress())->getConnection()->transaction(function () use ($userId, $name, $languageCode, $wordIds, $requestKey, &$recorded): void {
            $row = VirtualProgress::lockForBatch($userId, $name, $languageCode);
            $recorded = $row?->recordReads($wordIds, $requestKey) ?? 0;
        });
        $pruned = $existed ? [] : $this->prune($userId, $name);

        return ['batch' => $name, 'language' => $languageCode, 'recorded_word_count' => $recorded, 'pruned' => $pruned];
    }

    /** Overlay reads count as use: the batch is not the stalest. */
    public function touch(int $userId, string $batchName, string $languageCode): void
    {
        VirtualProgress::query()
            ->where('user_id', $userId)
            ->where('batch_name', $this->progress->normalizeBatchName($batchName))
            ->where('language_code', $languageCode)
            ->update(['last_used_at' => now()]);
    }

    /** @return array{error_code?: string, deleted?: int} */
    public function delete(int $userId, string $batchName): array
    {
        $deleted = VirtualProgress::query()->where('user_id', $userId)->where('batch_name', $batchName)->delete();

        return $deleted > 0 ? ['deleted' => $deleted] : ['error_code' => self::ERROR_BATCH_NOT_FOUND];
    }

    /**
     * Keep at most MAX_BATCHES batch names: unreferenced ones go first (oldest
     * use first), then referenced ones (stalest first). `$keep` is never pruned.
     *
     * @return array<int, string> the pruned batch names
     */
    public function prune(int $userId, string $keep): array
    {
        $lastUsed = [];
        foreach (VirtualProgress::query()->where('user_id', $userId)->get() as $row) {
            $name = (string) $row->batch_name;
            $used = $this->usedAt($row)?->getTimestamp() ?? 0;
            $lastUsed[$name] = max($lastUsed[$name] ?? 0, $used);
        }
        $excess = count($lastUsed) - self::MAX_BATCHES;
        if ($excess <= 0) {
            return [];
        }
        $referenced = $this->referencedNames($userId);
        $candidates = array_keys(array_filter($lastUsed, static fn (int $used, string $name): bool => $name !== $keep, ARRAY_FILTER_USE_BOTH));
        usort($candidates, static function (string $left, string $right) use ($referenced, $lastUsed): int {
            $byReference = (int) isset($referenced[$left]) <=> (int) isset($referenced[$right]);

            return $byReference !== 0 ? $byReference : $lastUsed[$left] <=> $lastUsed[$right];
        });
        $pruned = array_slice($candidates, 0, $excess);
        if ($pruned !== []) {
            VirtualProgress::query()->where('user_id', $userId)->whereIn('batch_name', $pruned)->delete();
        }

        return $pruned;
    }

    /** Batch names in use: the daily-reading default and every live client orchestration's batch. @return array<string, true> */
    private function referencedNames(int $userId): array
    {
        $names = [AppQyV1DailyReadingVirtualProgressService::DEFAULT_BATCH_NAME => true];

        foreach (ClientTask::query()->where('user_id', $userId)->whereNull('deleted_at')->pluck('config') as $config) {
            $batch = is_array($config) ? ($config['virtualBatch'] ?? null) : null;
            $mode = is_array($config) ? ($config['readState'] ?? 'virtual') : 'virtual';
            if (is_string($batch) && $batch !== '' && $mode !== 'real') {
                $names[$batch] = true;
            }
        }

        return $names;
    }

    private function usedAt(VirtualProgress $row): ?\Illuminate\Support\Carbon
    {
        return $row->last_used_at ?? $row->updated_at ?? $row->created_at;
    }
}
