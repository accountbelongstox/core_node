<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SubtitleModel as Subtitle;
use App\Services\MoviePoster\MoviePosterStore;
use App\Services\TimerTasks\AppQyV1CoverGenerationTask;
use App\Models\Model;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

trait AppQyV1AssistQueueMetrics
{
    /** TTS counters in the assist-status shape. */
    public function ttsCounts(): array
    {
        $stats = $this->coordinator->statistics();
        $byStatus = $stats['by_status'] ?? [];

        return [
            'pending' => (int) ($byStatus['pending'] ?? 0),
            'processing' => (int) ($byStatus['processing'] ?? 0),
            'completed' => (int) ($byStatus['completed'] ?? 0),
            'failed' => (int) ($byStatus['failed'] ?? 0),
            'leased' => $this->coordinator->assistLeasedCount(),
        ];
    }

    /** Pending/terminal counts for word_translation global tasks (one grouped
     *  query, never per-status counts). */
    public function translationCounts(): array
    {
        $grouped = GlobalTask::filteredStatusCounts('AppQyV1', 'word_translation');

        $sumOf = static function (array $statuses) use ($grouped): int {
            $sum = 0;
            foreach ($statuses as $status) {
                if ($grouped->has($status)) {
                    $sum += (int) $grouped->get($status);
                }
            }
            return $sum;
        };

        $total = 0;
        foreach ($grouped as $value) {
            $total += (int) $value;
        }

        return [
            'pending' => $sumOf([\App\Models\GlobalTask::status('pending')]),
            'leased' => $sumOf([\App\Models\GlobalTask::status('assigned')]),
            'processing' => $sumOf([\App\Models\GlobalTask::status('processing')]),
            'completed' => $sumOf([\App\Models\GlobalTask::status('completed'), \App\Models\GlobalTask::status('completed_demo')]),
            'failed' => $sumOf([\App\Models\GlobalTask::status('failed')]),
            'total' => $total,
        ];
    }

    // ------------------------------------------------------------------
    // Queue Center overview aggregators (GET /assist/overview)
    // ------------------------------------------------------------------

    /** Max sample rows returned per overview category (display only). */
    public const OVERVIEW_SAMPLE_LIMIT = 5;

    /**
     * word_translation counts split by language. global_tasks pending/processing
     * (one grouped query) PLUS the dictionary has_translation=false markers per
     * supported language (the actual not-yet-translated rows that feed the queue).
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               by_language:array<string,int>,sample:array<int,array<string,mixed>>}
     */
    public function wordTranslationCounts(): array
    {
        $task = $this->globalTaskStatusCounts('word_translation', null, GlobalTask::capability('ai_translate'));
        $byLanguage = $this->dictionaryByLanguage('has_translation = false');

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['leased'],
            'total' => $task['total'],
            'by_language' => $byLanguage,
            'sample' => $this->wordTaskSample('word_translation', null, GlobalTask::capability('ai_translate')),
        ];
    }

    /**
     * word_audio (pycore lane) counts split by language. global_tasks
     * task_type='word_audio' pending/processing PLUS dictionary rows missing
     * audio (has_audio=false OR tts_status='pending') per language.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               by_language:array<string,int>,sample:array<int,array<string,mixed>>}
     */
    public function wordAudioCounts(): array
    {
        $task = $this->globalTaskStatusCounts('word_audio');
        $byLanguage = $this->dictionaryByLanguage("(has_audio = false OR tts_status = 'pending')");

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['leased'],
            'total' => $task['total'],
            'by_language' => $byLanguage,
            'sample' => $this->wordTaskSample('word_audio'),
        ];
    }

    /**
     * notebooklm (chrome Task Center lane) global_tasks counts. Pure global-task
     * category: pending/processing from task_type='notebooklm' (no dictionary
     * by-language dimension).
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               sample:array<int,array<string,mixed>>}
     */
    public function notebookLmCounts(): array
    {
        $task = $this->globalTaskStatusCounts('notebooklm');

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['leased'],
            'total' => $task['total'],
            'sample' => $this->wordTaskSample('notebooklm'),
        ];
    }

    /**
     * gemini_image (chrome Task Center lane) global_tasks counts — the alternative
     * word/cover image generator. Same global-task shape as word_image, split by
     * language where the payload carries one.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               sample:array<int,array<string,mixed>>}
     */
    public function geminiImageCounts(): array
    {
        $task = $this->globalTaskStatusCounts('gemini_image');

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['leased'],
            'total' => $task['total'],
            'sample' => $this->wordTaskSample('gemini_image'),
        ];
    }

    /**
     * gemini_chat (chrome Task Center lane, remote_gemini_text) global_tasks
     * counts — text-only Gemini completion, the sibling of gemini_image. Same
     * pure global-task shape as notebooklm (no dictionary by-language dimension).
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               sample:array<int,array<string,mixed>>}
     */
    public function geminiChatCounts(): array
    {
        $task = $this->globalTaskStatusCounts('gemini_chat');

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['leased'],
            'total' => $task['total'],
            'sample' => $this->wordTaskSample('gemini_chat'),
        ];
    }

    /**
     * chatgpt_chat (chrome Task Center lane, remote_chatgpt) global_tasks
     * counts. Completed tasks retain the answer and uploaded read-aloud path in
     * the canonical task result while the media ingest endpoint owns the file.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               sample:array<int,array<string,mixed>>}
     */
    public function chatGptCounts(): array
    {
        $task = $this->globalTaskStatusCounts('chatgpt_chat');

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['leased'],
            'total' => $task['total'],
            'sample' => $this->wordTaskSample('chatgpt_chat'),
        ];
    }

    /**
     * Grouped status counts for one AppQyV1 global_tasks task_type. One grouped
     * query; pending/processing/total in the shared assist-status shape.
     *
     * @return array{pending:int,leased:int,processing:int,total:int}
     */
    private function globalTaskStatusCounts(
        string $taskType,
        ?string $capability = null,
        ?string $excludedCapability = null
    ): array
    {
        $grouped = GlobalTask::filteredStatusCounts(
            'AppQyV1',
            $taskType,
            $capability,
            $excludedCapability
        );

        $pending = (int) ($grouped->get(GlobalTask::status('pending')) ?? 0);
        $leased = (int) ($grouped->get(GlobalTask::status('assigned')) ?? 0);
        $processing = (int) ($grouped->get(GlobalTask::status('processing')) ?? 0);

        $total = 0;
        foreach ($grouped as $value) {
            $total += (int) $value;
        }

        return [
            'pending' => $pending,
            'leased' => $leased,
            'processing' => $processing,
            'total' => $total,
        ];
    }

    public function aiTranslateCounts(): array
    {
        $task = $this->globalTaskStatusCounts('word_translation', GlobalTask::capability('ai_translate'));
        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['leased'],
            'total' => $task['total'],
            'sample' => $this->wordTaskSample('word_translation', GlobalTask::capability('ai_translate')),
        ];
    }

    public function subtitleSearchCounts(): array
    {
        $task = $this->globalTaskStatusCounts('subtitle_search');
        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['leased'],
            'total' => $task['total'],
            'sample' => $this->wordTaskSample('subtitle_search'),
        ];
    }

    /**
     * Up to OVERVIEW_SAMPLE_LIMIT sample rows for a word global-task type, flattened
     * to one display row per word: {word, language}. Best-effort; never throws.
     *
     * @return array<int,array{word:?string,language:?string}>
     */
    private function wordTaskSample(
        string $taskType,
        ?string $capability = null,
        ?string $excludedCapability = null
    ): array
    {
        $rows = GlobalTask::activePayloadSamples(
            'AppQyV1',
            $taskType,
            self::OVERVIEW_SAMPLE_LIMIT,
            $capability,
            $excludedCapability
        );

        $sample = [];
        foreach ($rows as $row) {
            $payload = is_array($row->payload) ? $row->payload : [];
            $language = $payload['language'] ?? null;
            $words = GlobalTask::displayWordsFromPayload($payload);
            $word = $words[0] ?? null;
            $sample[] = ['word' => $word, 'language' => $language];
            if (count($sample) >= self::OVERVIEW_SAMPLE_LIMIT) {
                break;
            }
        }

        return $sample;
    }

    /**
     * Count dictionary rows matching $whereSql across EVERY supported
     * per-language table, returning a {lang: count} map (langs with zero
     * matches are omitted). The whole sweep is ONE information_schema
     * round-trip plus ONE UNION ALL COUNT query via
     * AppQyV1PerLanguageMetrics — constant round-trips regardless of the
     * language count. Languages whose table is missing, or that lack any of
     * $requiredColumns (not-yet-migrated install), are skipped silently,
     * matching the contract of the old per-table try/catch loop.
     *
     * @return array<string,int>
     */
    private function dictionaryByLanguage(string $whereSql, array $requiredColumns = []): array
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $tables = [];
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $tables[$lang] = AppQyV1TableMaps::getDictionaryTableName($lang);
        }

        $tables = AppQyV1PerLanguageMetrics::filterExistingTables($connection, $tables);
        $tables = AppQyV1PerLanguageMetrics::requireColumns($connection, $tables, $requiredColumns);

        return AppQyV1PerLanguageMetrics::countByLanguage($connection, $tables, $whereSql);
    }

    /**
     * Per-language sentence-audio counts (has_audio=false) plus the live sentence
     * audio lease count, in the overview shape. Delegates the per-language sweep
     * and the lease tally to AppQyV1SentenceAudioService (file-first source of
     * truth), then adds a small sample of pending sentences for display.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               by_language:array<string,int>,sample:array<int,array<string,mixed>>}
     */
    public function sentenceCounts(): array
    {
        $service = new AppQyV1SentenceAudioService();
        $task = $this->globalTaskStatusCounts('sentence_audio');

        // Per-language pending counts in ONE information_schema + ONE UNION
        // ALL COUNT query (constant round-trips). Queue totals and ordering
        // remain owned by canonical global tasks.
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $tables = [];
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $tables[$lang] = AppQyV1TableMaps::getSentenceTableName($lang);
        }
        $byLanguage = AppQyV1PerLanguageMetrics::countByLanguage(
            $connection,
            AppQyV1PerLanguageMetrics::filterExistingTables($connection, $tables),
            'has_audio = false'
        );

        $sample = $this->wordTaskSample('sentence_audio');
        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['leased'],
            'total' => $task['total'],
            'by_language' => $byLanguage,
            'sample' => $sample,
            // Declared engine for this lane (qwen3tts-first, GPU-gated by pycore).
            'engine' => $service->sentenceEngineInfo(),
        ];
    }

    /**
     * Group assist_requests by status for one (record_type, request_type), split
     * by language. Used for the subtitle_lang + book_lang overview categories
     * (record_type 'subtitle'/'book', request_type 'add_language').
     *
     * Guarded: when the assist_requests table is absent (migration not run) the
     * method returns an all-zero shape instead of throwing — it runs inside the
     * shared overview snapshot.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               by_language:array<string,int>,by_status:array<string,int>,
     *               sample:array<int,array<string,mixed>>}
     */
    public function assistRequestGroupCounts(string $recordType, string $requestType): array
    {
        $empty = [
            'pending' => 0,
            'processing' => 0,
            'leased' => 0,
            'total' => 0,
            'by_language' => [],
            'by_status' => [],
            'sample' => [],
        ];

        if (!self::assistRequestsTableReady()) {
            return $empty;
        }

        try {
            $overview = \App\Apps\AppQyV1\AppQyV1Models\AppQyV1AssistRequestModel::groupedOverview(
                $recordType,
                $requestType,
                self::OVERVIEW_SAMPLE_LIMIT
            );
            $byStatus = $overview['by_status'];
            $byLangRaw = $overview['by_language'];

            $byLanguage = [];
            foreach ($byLangRaw as $lang => $total) {
                $key = ($lang === null || $lang === '') ? 'unknown' : (string) $lang;
                $byLanguage[$key] = (int) $total;
            }

            $statusMap = [];
            $total = 0;
            foreach ($byStatus as $status => $value) {
                $statusMap[(string) $status] = (int) $value;
                $total += (int) $value;
            }

            $sample = $overview['sample']
                ->map(static fn ($row) => [
                    'id' => (int) $row->id,
                    'source_key' => (string) $row->source_key,
                    'language' => $row->language !== null ? (string) $row->language : null,
                ])->all();

            return [
                'pending' => (int) ($statusMap[\App\Apps\AppQyV1\AppQyV1Models\AppQyV1AssistRequestModel::STATUS_PENDING] ?? 0),
                'processing' => (int) ($statusMap[\App\Apps\AppQyV1\AppQyV1Models\AppQyV1AssistRequestModel::STATUS_PROCESSING] ?? 0),
                'leased' => (int) ($statusMap[\App\Apps\AppQyV1\AppQyV1Models\AppQyV1AssistRequestModel::STATUS_CLAIMED] ?? 0),
                'total' => $total,
                'by_language' => $byLanguage,
                'by_status' => $statusMap,
                'sample' => $sample,
            ];
        } catch (\Throwable $e) {
            return $empty;
        }
    }

    /** Cached check: has the assist_requests table been created yet? */
    private static ?bool $assistRequestsTable = null;

    private static function assistRequestsTableReady(): bool
    {
        if (self::$assistRequestsTable === null) {
            try {
                self::$assistRequestsTable = \App\Apps\AppQyV1\AppQyV1Models\AppQyV1AssistRequestModel::configuredTableExists();
            } catch (\Throwable $e) {
                self::$assistRequestsTable = false;
            }
        }
        return self::$assistRequestsTable;
    }

    /**
     * Online assist/global-task workers from the Worker model: id, kind +
     * processor_types, online (heartbeat within Worker::HEARTBEAT_TIMEOUT),
     * last_seen, and the count of global tasks currently claimed by each.
     *
     * Guarded: a missing workers table (migration not run) returns an empty list.
     *
     * @return array<int,array{id:string,kind:string,processor_types:array<int,string>,
     *               online:bool,last_seen:?string,claimed:int}>
     */
    public function workers(): array
    {
        return app(\App\Services\QueueCenter\QueueWorkerPresenceService::class)->snapshot();
    }
}
