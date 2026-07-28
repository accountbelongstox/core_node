<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1SentenceAudioUrl;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Models\Book;
use App\Models\GlobalTask;
use App\Models\Subtitle;
use App\Services\MoviePoster\MoviePosterStore;
use App\Services\TimerTasks\AppQyV1CoverGenerationTask;
use Illuminate\Database\Eloquent\Model;
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
        $grouped = \App\Models\GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_translation')
            ->groupBy('status')
            ->select('status', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
            ->pluck('total', 'status');

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
        $byLanguage = $this->dictionaryByLanguage(static function ($query) {
            $query->where('has_translation', false);
        });

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
     * word_media counts split by language. global_tasks
     * task_type='word_media' pending/processing PLUS translated dictionary rows
     * that have not received an mcp-chrome image submission per language.
     *
     * @return array{pending:int,processing:int,leased:int,total:int,
     *               by_language:array<string,int>,sample:array<int,array<string,mixed>>}
     */
    public function wordImageCounts(): array
    {
        $task = $this->globalTaskStatusCounts('word_media');
        $byLanguage = $this->dictionaryByLanguage(static function ($query) {
            $query->where('has_translation', true)
                ->where('is_valid', true)
                ->whereNull('image_mcp_submitted_at');
        });

        return [
            'pending' => $task['pending'],
            'processing' => $task['processing'],
            'leased' => $task['leased'],
            'total' => $task['total'],
            'by_language' => $byLanguage,
            'sample' => $this->wordTaskSample('word_media'),
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
        $byLanguage = $this->dictionaryByLanguage(static function ($query) {
            $query->where(function ($q) {
                $q->where('has_audio', false)
                    ->orWhere('tts_status', 'pending');
            });
        });

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
        $query = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', $taskType);
        if ($capability !== null) {
            $query->where('capability', $capability);
        }
        if ($excludedCapability !== null) {
            $query->where(function ($builder) use ($excludedCapability) {
                $builder->whereNull('capability')->orWhere('capability', '!=', $excludedCapability);
            });
        }
        $grouped = $query
            ->groupBy('status')
            ->select('status', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
            ->pluck('total', 'status');

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
        $query = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', $taskType)
            ->whereIn('status', [GlobalTask::status('pending'), GlobalTask::status('assigned'), GlobalTask::status('processing')])
            ->orderByDesc('priority');
        if ($capability !== null) {
            $query->where('capability', $capability);
        }
        if ($excludedCapability !== null) {
            $query->where(function ($builder) use ($excludedCapability) {
                $builder->whereNull('capability')->orWhere('capability', '!=', $excludedCapability);
            });
        }
        $rows = $query
            ->limit(self::OVERVIEW_SAMPLE_LIMIT)
            ->get(['payload']);

        $sample = [];
        foreach ($rows as $row) {
            $payload = is_array($row->payload) ? $row->payload : [];
            $language = $payload['language'] ?? null;
            $words = $payload['words'] ?? [];
            $first = is_array($words) ? ($words[0] ?? null) : null;
            $word = is_array($first) ? ($first['word'] ?? null) : (is_string($first) ? $first : null);
            if ($word === null || $word === '') {
                foreach (['content', 'text', 'word'] as $key) {
                    $candidate = $payload[$key] ?? null;
                    if (is_string($candidate) && trim($candidate) !== '') {
                        $word = trim($candidate);
                        break;
                    }
                }
            }
            $sample[] = ['word' => $word, 'language' => $language];
            if (count($sample) >= self::OVERVIEW_SAMPLE_LIMIT) {
                break;
            }
        }

        return $sample;
    }

    /**
     * Count dictionary rows matching $filter across EVERY supported per-language
     * table, returning a {lang: count} map (langs with zero matches are omitted).
     * One COUNT query per existing table; missing tables are skipped silently.
     *
     * @param callable(\Illuminate\Database\Eloquent\Builder):void $filter
     * @return array<string,int>
     */
    private function dictionaryByLanguage(callable $filter): array
    {
        $byLanguage = [];
        foreach (\App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            try {
                $model = AppQyV1LangDictionaryModel::forLanguage($lang);
                if (!$model->getConnection()->getSchemaBuilder()->hasTable($model->getTable())) {
                    continue;
                }
                $query = $model->newQuery();
                $filter($query);
                $count = (int) $query->count();
                if ($count > 0) {
                    $byLanguage[$lang] = $count;
                }
            } catch (\Throwable $e) {
                // Missing column / table on a not-yet-migrated language: skip it.
                continue;
            }
        }
        return $byLanguage;
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
        $byLanguage = [];
        $sample = [];

        foreach (\App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            try {
                $model = \App\Models\LangSentence::for($lang);
                if (!$model->getConnection()->getSchemaBuilder()->hasTable($model->getTable())) {
                    continue;
                }
                $count = (int) \App\Models\LangSentence::onLang($lang)->where('has_audio', false)->count();
                if ($count > 0) {
                    $byLanguage[$lang] = $count;
                }
                // Collect a few sample rows until the display limit is reached.
                if (count($sample) < self::OVERVIEW_SAMPLE_LIMIT && $count > 0) {
                    $rows = \App\Models\LangSentence::onLang($lang)
                        ->where('has_audio', false)
                        ->orderByDesc('tts_priority')
                        ->orderByDesc('occurrence_count')
                        ->limit(self::OVERVIEW_SAMPLE_LIMIT - count($sample))
                        ->get(['content_id', 'text']);
                    foreach ($rows as $row) {
                        $sample[] = [
                            'source_key' => (string) $row->content_id,
                            'title' => mb_substr((string) $row->text, 0, 80),
                            'language' => $lang,
                        ];
                    }
                }
            } catch (\Throwable $e) {
                continue;
            }
        }

        $population = array_sum($byLanguage);
        $leased = $service->leasedCount(null);

        return [
            'pending' => max(0, $population - $leased),
            'processing' => 0,
            'leased' => $leased,
            'total' => $population,
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
            $base = fn () => \App\Models\AppQyV1AssistRequest::query()
                ->where('record_type', $recordType)
                ->where('request_type', $requestType);

            // Per-status counts (one grouped query).
            $byStatus = $base()
                ->groupBy('status')
                ->select('status', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
                ->pluck('total', 'status');

            // Per-language counts (one grouped query).
            $byLangRaw = $base()
                ->groupBy('language')
                ->select('language', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
                ->pluck('total', 'language');

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

            $sample = $base()
                ->whereIn('status', [
                    \App\Models\AppQyV1AssistRequest::STATUS_PENDING,
                    \App\Models\AppQyV1AssistRequest::STATUS_CLAIMED,
                    \App\Models\AppQyV1AssistRequest::STATUS_PROCESSING,
                ])
                ->orderByDesc('priority')
                ->orderBy('id')
                ->limit(self::OVERVIEW_SAMPLE_LIMIT)
                ->get(['id', 'source_key', 'language'])
                ->map(static fn ($row) => [
                    'id' => (int) $row->id,
                    'source_key' => (string) $row->source_key,
                    'language' => $row->language !== null ? (string) $row->language : null,
                ])->all();

            return [
                'pending' => (int) ($statusMap[\App\Models\AppQyV1AssistRequest::STATUS_PENDING] ?? 0),
                'processing' => (int) ($statusMap[\App\Models\AppQyV1AssistRequest::STATUS_PROCESSING] ?? 0),
                'leased' => (int) ($statusMap[\App\Models\AppQyV1AssistRequest::STATUS_CLAIMED] ?? 0),
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
                $model = new \App\Models\AppQyV1AssistRequest();
                self::$assistRequestsTable = $model->getConnection()
                    ->getSchemaBuilder()
                    ->hasTable($model->getTable());
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
        try {
            $model = new \App\Models\Worker();
            if (!$model->getConnection()->getSchemaBuilder()->hasTable($model->getTable())) {
                return [];
            }
        } catch (\Throwable $e) {
            return [];
        }

        try {
            $rows = \App\Models\Worker::query()
                ->orderByDesc('last_heartbeat_at')
                ->limit(100)
                ->get(['worker_id', 'worker_name', 'processor_types', 'status', 'last_heartbeat_at']);

            // One grouped query for claimed (assigned/processing) global tasks per
            // worker, instead of a COUNT per worker row.
            $claimedByWorker = GlobalTask::query()
                ->whereIn('status', [GlobalTask::status('assigned'), GlobalTask::status('processing')])
                ->whereNotNull('assigned_to')
                ->groupBy('assigned_to')
                ->select('assigned_to', \Illuminate\Support\Facades\DB::raw('count(*) as total'))
                ->pluck('total', 'assigned_to');

            $heartbeatFloor = now()->subSeconds(\App\Models\Worker::HEARTBEAT_TIMEOUT);

            $out = [];
            foreach ($rows as $row) {
                $types = is_array($row->processor_types) ? array_values($row->processor_types) : [];
                $online = $row->last_heartbeat_at !== null && $row->last_heartbeat_at >= $heartbeatFloor;
                // Normalize kind to a canonical token the Queue Center FE matches
                // EXACTLY ('chrome' -> ChromeIcon, 'pycore' -> CpuIcon). Workers
                // register descriptive names (chrome-bing-assist / pycore-translation-*)
                // so we map them down; the full original name stays on 'name'.
                $name = (string) ($row->worker_name ?? '');
                $nameLower = strtolower($name);
                if (str_contains($nameLower, 'chrome')) {
                    $kind = 'chrome';
                } elseif (str_contains($nameLower, 'pycore') || in_array(GlobalTask::executionType('remote_audio'), $types, true)) {
                    $kind = 'pycore';
                } else {
                    $kind = $types[0] ?? 'worker';
                }
                $out[] = [
                    'id' => (string) $row->worker_id,
                    'kind' => $kind,
                    'name' => $name,
                    'processor_types' => $types,
                    'online' => $online,
                    'last_seen' => $row->last_heartbeat_at !== null ? $row->last_heartbeat_at->toIso8601String() : null,
                    'claimed' => (int) ($claimedByWorker->get($row->worker_id) ?? 0),
                ];
            }
            return $out;
        } catch (\Throwable $e) {
            return [];
        }
    }
}
