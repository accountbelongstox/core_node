<?php

namespace App\Services\QueueCenter\DictLane;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Models\GlobalTask;
use App\Support\QueueCenterContract;

/**
 * Dict-lane catalog — the single definition of the dictionary-backed live
 * queue lanes (docs_fix/DESIGN_QUEUE_PIPELINE.md).
 *
 * A lane is ONLY a source query over the per-language dictionary tables; its
 * "queue" is the cached, ordered result of that query. Nothing is enqueued
 * ahead of a consumer: just-in-time claim rows are materialized by
 * DictLaneQueueCenter::ensureMaterialized when a worker pulls.
 *
 * Lanes (predicates owned by AppQyV1MediaGaps):
 *   - word_audio              WORD_AUDIO (the without_audio management filter,
 *                             one global_tasks row per word)
 *   - word_translation        WORD_TRANSLATION_WORK
 *   - word_validity           WORD_VALIDITY_WORK
 *   - dictionary_explanation  WORD_TRANSLATION_WORK
 *                             (dictionary_explanation_demo shares this lane)
 *
 * Ordering for every lane mirrors the retired producers: query_count DESC,
 * id ASC.
 */
final class DictLaneCatalog
{
    public const LANE_WORD_AUDIO = 'word_audio';
    public const LANE_WORD_TRANSLATION = 'word_translation';
    public const LANE_WORD_VALIDITY = 'word_validity';
    public const LANE_DICTIONARY_EXPLANATION = 'dictionary_explanation';

    // View-only lanes: the dictionary management LISTING filters served from
    // the same cached-queue model (no claim materialization). Their filters
    // are byte-identical to AppQyV1LangDictionaryModel::managementFilter so
    // the UI totals never drift.
    public const VIEW_WITHOUT_TRANSLATION = 'view_without_translation';
    public const VIEW_VALID = 'view_valid';
    public const VIEW_INVALID = 'view_invalid';

    private const WORDS_PER_TRANSLATION_TASK = 40;
    private const WORDS_PER_DICTIONARY_TASK = 10;

    /** Management listing filter => cache lane key (without_audio IS the word_audio lane). */
    private const MANAGEMENT_FILTER_LANES = [
        'without_audio' => self::LANE_WORD_AUDIO,
        'without_translation' => self::VIEW_WITHOUT_TRANSLATION,
        'valid' => self::VIEW_VALID,
        'invalid' => self::VIEW_INVALID,
    ];

    /** task_type => lane key. */
    private const TASK_TYPE_TO_LANE = [
        self::LANE_WORD_AUDIO => self::LANE_WORD_AUDIO,
        self::LANE_WORD_TRANSLATION => self::LANE_WORD_TRANSLATION,
        self::LANE_WORD_VALIDITY => self::LANE_WORD_VALIDITY,
        self::LANE_DICTIONARY_EXPLANATION => self::LANE_DICTIONARY_EXPLANATION,
        'dictionary_explanation_demo' => self::LANE_DICTIONARY_EXPLANATION,
    ];

    /** Lane key => pile-up guard: max live claim tasks per language. */
    private const MAX_LIVE_TASKS_PER_LANGUAGE = [
        self::LANE_WORD_AUDIO => 400,
        self::LANE_WORD_TRANSLATION => 1,
        self::LANE_WORD_VALIDITY => 1,
        self::LANE_DICTIONARY_EXPLANATION => 2,
    ];

    public static function lanes(): array
    {
        return [
            self::LANE_WORD_AUDIO,
            self::LANE_WORD_TRANSLATION,
            self::LANE_WORD_VALIDITY,
            self::LANE_DICTIONARY_EXPLANATION,
        ];
    }

    /** Materializable claim lanes PLUS the view-only listing lanes. */
    public static function allCacheLanes(): array
    {
        return array_merge(self::lanes(), [
            self::VIEW_WITHOUT_TRANSLATION,
            self::VIEW_VALID,
            self::VIEW_INVALID,
        ]);
    }

    /**
     * The cache lane backing one dictionary management listing filter, or
     * null when the filter keeps the direct query path (all/with_*).
     */
    public static function laneForManagementFilter(string $filter): ?string
    {
        return self::MANAGEMENT_FILTER_LANES[$filter] ?? null;
    }

    public static function isDictLaneTaskType(string $taskType): bool
    {
        return isset(self::TASK_TYPE_TO_LANE[$taskType]);
    }

    public static function laneForTaskType(string $taskType): ?string
    {
        return self::TASK_TYPE_TO_LANE[$taskType] ?? null;
    }

    /**
     * Task types counted by the pile-up guard for one lane (the demo variant
     * shares the dictionary_explanation lane, exactly like the retired
     * producer counted both).
     *
     * @return array<int,string>
     */
    public static function liveCountTaskTypes(string $lane): array
    {
        if ($lane === self::LANE_DICTIONARY_EXPLANATION) {
            return ['dictionary_explanation', 'dictionary_explanation_demo'];
        }

        return [$lane];
    }

    public static function maxLiveTasksPerLanguage(string $lane): int
    {
        return self::MAX_LIVE_TASKS_PER_LANGUAGE[$lane] ?? 1;
    }

    /** Available dictionary languages (cached catalog of the dictionary service). */
    public static function languages(): array
    {
        return AppQyV1DictionaryService::scanAvailableLanguages();
    }

    /** The lane's predicate (AppQyV1MediaGaps for the gap lanes). */
    public static function lanePredicate(string $lane): string
    {
        return match ($lane) {
            self::LANE_WORD_AUDIO => AppQyV1MediaGaps::WORD_AUDIO,
            self::LANE_WORD_VALIDITY => AppQyV1MediaGaps::WORD_VALIDITY_WORK,
            self::VIEW_WITHOUT_TRANSLATION => AppQyV1MediaGaps::WORD_TRANSLATION,
            self::VIEW_VALID => 'is_valid IS NOT FALSE AND ' . AppQyV1MediaGaps::WORD_HAS_CONTENT,
            self::VIEW_INVALID => 'is_valid IS FALSE AND ' . AppQyV1MediaGaps::WORD_HAS_CONTENT,
            // word_translation / dictionary_explanation share the translation work gap.
            default => AppQyV1MediaGaps::WORD_TRANSLATION_WORK,
        };
    }

    /** The lane's WHERE scope on one language's dictionary query (base query builder). */
    public static function applyLaneFilter(\Illuminate\Database\Query\Builder $query, string $lane): \Illuminate\Database\Query\Builder
    {
        return AppQyV1MediaGaps::apply($query, self::lanePredicate($lane));
    }

    /**
     * Lane head in claim order (query_count DESC, id), served by the lane's
     * partial rank index; $offset only for the management UI page jump.
     *
     * @return array<int,array{id:int,word:string,md5:string,query_count:int}>
     */
    public static function headRows(string $lane, string $langCode, int $limit, int $offset = 0): array
    {
        return self::liteRows(
            self::laneQuery($lane, $langCode)->orderByDesc('query_count')->orderBy('id')->offset($offset)->limit($limit)
        );
    }

    /**
     * Claim head: headRows minus word_audio rows whose last attempt failed
     * (they count as failed until the failed-reset returns them to pending),
     * so a word that keeps failing never hot-loops at the head.
     *
     * @return array<int,array{id:int,word:string,md5:string,query_count:int}>
     */
    public static function claimHeadRows(string $lane, string $langCode, int $limit): array
    {
        $query = self::laneQuery($lane, $langCode);
        if ($lane === self::LANE_WORD_AUDIO) {
            $query->whereRaw(AppQyV1MediaGaps::TTS_NOT_FAILED);
        }

        return self::liteRows($query->orderByDesc('query_count')->orderBy('id')->limit($limit));
    }

    /**
     * Keyset page by id after $afterId, served by the lane's partial id index.
     *
     * @return array<int,array{id:int,word:string,md5:string,query_count:int}>
     */
    public static function rowsAfterId(string $lane, string $langCode, int $afterId, int $limit): array
    {
        return self::liteRows(self::laneQuery($lane, $langCode)->where('id', '>', $afterId)->orderBy('id')->limit($limit));
    }

    /** Row count of one lane for one language (one COUNT on the partial index). */
    public static function laneCount(string $lane, string $langCode): int
    {
        return (int) self::laneQuery($lane, $langCode)->count();
    }

    /** Lane rows whose last attempt failed (word_audio tts_status), else 0. */
    public static function failedCount(string $lane, string $langCode): int
    {
        return $lane === self::LANE_WORD_AUDIO
            ? (int) self::laneQuery($lane, $langCode)->whereRaw(AppQyV1MediaGaps::TTS_FAILED)->count()
            : 0;
    }

    private static function laneQuery(string $lane, string $langCode): \Illuminate\Database\Query\Builder
    {
        $model = AppQyV1LangDictionaryModel::forLanguage($langCode);

        return self::applyLaneFilter($model->getConnection()->table($model->getTable()), $lane);
    }

    /** @return array<int,array{id:int,word:string,md5:string,query_count:int}> */
    private static function liteRows(\Illuminate\Database\Query\Builder $query): array
    {
        return $query->get(['id', 'content', 'md5', 'query_count'])
            ->map(static fn ($row): array => [
                'id' => (int) $row->id,
                'word' => trim((string) $row->content),
                'md5' => (string) ($row->md5 ?? ''),
                'query_count' => (int) ($row->query_count ?? 0),
            ])
            ->all();
    }

    /**
     * Batch size of one materialized claim task (words per task), mirroring
     * the retired producers. word_audio is one task per word (returns 1).
     */
    public static function claimBatchSize(string $lane): int
    {
        if ($lane === self::LANE_WORD_TRANSLATION) {
            return self::WORDS_PER_TRANSLATION_TASK;
        }
        if ($lane === self::LANE_WORD_VALIDITY) {
            return QueueCenterContract::wordValidityBatchSize();
        }
        if ($lane === self::LANE_DICTIONARY_EXPLANATION) {
            return self::WORDS_PER_DICTIONARY_TASK;
        }

        return 1;
    }

    /**
     * Legacy producer payload + execution/timeout/priority/retry for one
     * claim task built from lite rows. Byte-compatible with the payloads the
     * deleted producers wrote, so every downstream consumer (chrome worker,
     * pycore, result write-back) is untouched.
     *
     * @param array<int,array{id:int,word:string,md5:string,query_count:int}> $rows
     * @return array{execution_type:string,payload:array,timeout_seconds:int,priority:int,max_retries:int}
     */
    public static function claimTaskSpec(string $taskType, string $langCode, array $rows): array
    {
        $lane = self::laneForTaskType($taskType) ?? $taskType;
        $timeoutSeconds = min(600, 60 + (count($rows) * 3));

        if ($lane === self::LANE_WORD_VALIDITY) {
            return [
                'execution_type' => GlobalTask::executionType('remote_validity'),
                'payload' => [
                    'words' => array_values(array_map(static fn (array $row): array => [
                        'word' => $row['word'],
                        'md5' => $row['md5'],
                    ], $rows)),
                    'language' => $langCode,
                    // One-pass validity + translation (unchanged contract).
                    'target_language' => 'zh',
                    'word_count' => count($rows),
                ],
                'timeout_seconds' => QueueCenterContract::wordValidityRequestTimeoutSeconds() + 60,
                'priority' => 0,
                'max_retries' => 3,
            ];
        }

        if ($lane === self::LANE_DICTIONARY_EXPLANATION) {
            return [
                'execution_type' => (string) QueueCenterContract::taskTypeExecution($taskType),
                'payload' => [
                    'words' => array_values(array_map(static fn (array $row): array => [
                        'word' => $row['word'],
                        'md5' => $row['md5'],
                        'query_count' => $row['query_count'],
                    ], $rows)),
                    'language' => $langCode,
                    'word_count' => count($rows),
                ],
                'timeout_seconds' => $timeoutSeconds,
                'priority' => QueueCenterContract::taskPriority('manual'),
                'max_retries' => 3,
            ];
        }

        // word_translation (word_audio is materialized through QueueCenterService
        // by DictLaneQueueCenter, never through this spec).
        return [
            'execution_type' => GlobalTask::executionType('remote_translation'),
            'payload' => [
                'words' => array_values(array_map(static fn (array $row): string => $row['word'], $rows)),
                'language' => AppQyV1DictionaryService::getLanguageCode($langCode),
                'target_language' => 'zh',
                'word_count' => count($rows),
            ],
            'timeout_seconds' => $timeoutSeconds,
            'priority' => 0,
            'max_retries' => 3,
        ];
    }
}
