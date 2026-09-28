<?php

namespace App\Apps\AppQyV1\AppQyV1Models\Concerns;

use Illuminate\Support\Facades\Schema;

trait AppQyV1TtsQueueQueries
{
    public static function runLanguageTransaction(string $language, \Closure $callback): mixed
    {
        return self::forLanguage($language)->getConnection()->transaction($callback);
    }

    protected static function applyClaimableTtsLock(
        $query,
        $staleBefore,
        $assistStaleBefore,
        string $assistWorkerPrefix
    ): void {
        $query->where(function ($claimable) use ($staleBefore, $assistStaleBefore, $assistWorkerPrefix): void {
            $claimable->whereNull('tts_locked_at')
                ->orWhere('tts_locked_at', '<', $assistStaleBefore)
                ->orWhere(function ($stale) use ($staleBefore, $assistWorkerPrefix): void {
                    $stale->where('tts_locked_at', '<', $staleBefore)
                        ->where(function ($owner) use ($assistWorkerPrefix): void {
                            $owner->whereNull('tts_locked_by')
                                ->orWhere('tts_locked_by', 'not like', $assistWorkerPrefix . '%');
                        });
                });
        });
    }

    public static function ttsTableReady(string $language, bool $requireStatusColumn = false): bool
    {
        $model = self::forLanguage($language);
        $schema = Schema::connection($model->getConnectionName());

        return $schema->hasTable($model->getTable())
            && (!$requireStatusColumn || $schema->hasColumn($model->getTable(), 'tts_status'));
    }

    public static function recentTtsRows(string $language, int $limit)
    {
        return self::forLanguage($language)
            ->newQuery()
            ->whereNotNull('tts_status')
            ->latest('updated_at')
            ->limit($limit)
            ->get();
    }

    public static function findLanguageRow(string $language, int $rowId): ?self
    {
        return self::forLanguage($language)->newQuery()->find($rowId);
    }

    public static function reapStaleTtsLocks(
        string $language,
        string $processingStatus,
        string $pendingStatus,
        $staleBefore,
        $assistStaleBefore,
        string $assistWorkerPrefix
    ): int {
        if (!self::ttsTableReady($language, true)) {
            return 0;
        }

        $query = self::forLanguage($language)
            ->newQuery()
            ->where('tts_status', $processingStatus)
            ->whereNotNull('tts_locked_at');
        self::applyClaimableTtsLock($query, $staleBefore, $assistStaleBefore, $assistWorkerPrefix);

        return $query->update([
            'tts_status' => $pendingStatus,
            'tts_locked_at' => null,
            'tts_locked_by' => null,
        ]);
    }

    public static function resetFailedTts(
        string $language,
        string $failedStatus,
        array $attributes
    ): int {
        if (!self::ttsTableReady($language, true)) {
            return 0;
        }

        $model = self::forLanguage($language);

        // Idempotent plain reset: queue order lives on the linked GlobalTask.
        return $model->newQuery()
            ->where('tts_status', $failedStatus)
            ->where('has_audio', false)
            ->update($attributes);
    }
}
