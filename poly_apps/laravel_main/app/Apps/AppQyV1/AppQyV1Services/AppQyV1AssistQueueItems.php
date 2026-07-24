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

trait AppQyV1AssistQueueItems
{
    /**
     * Paginated drill-down rows for one assist/overview category.
     *
     * GET /api/app_qy_v1/assist/overview/items
     *   ?category=word_audio&status=pending|processing|completed|failed|leased&start=0&limit=50
     *
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    public function categoryItems(string $category, ?string $status, int $start, int $limit): array
    {
        $category = strtolower(trim($category));
        if (!in_array($category, self::OVERVIEW_CATEGORY_KEYS, true)) {
            return [
                'category' => $category,
                'status' => $status,
                'total' => 0,
                'start' => $start,
                'limit' => $limit,
                'items' => [],
            ];
        }

        $limit = max(1, min(500, $limit));
        $start = max(0, $start);

        if ($category === 'word_audio') {
            return $this->categoryItemsFromWordAudio($status, $start, $limit);
        }

        if (isset(self::CATEGORY_GLOBAL_TASK_TYPE[$category])) {
            return $this->categoryItemsFromGlobalTasks(
                $category,
                self::CATEGORY_GLOBAL_TASK_TYPE[$category],
                $status,
                $start,
                $limit
            );
        }

        if ($category === 'sentence_audio') {
            return $this->categoryItemsFromSentenceAudio($status, $start, $limit);
        }
        if ($category === 'cover') {
            return $this->categoryItemsFromCovers($status, $start, $limit);
        }
        if ($category === 'poster') {
            return $this->categoryItemsFromPosters($status, $start, $limit);
        }
        if ($category === 'subtitle_lang') {
            return $this->categoryItemsFromAssistRequests('subtitle', 'add_language', $status, $start, $limit);
        }
        if ($category === 'book_lang') {
            return $this->categoryItemsFromAssistRequests('book', 'add_language', $status, $start, $limit);
        }

        return [
            'category' => $category,
            'status' => $status,
            'total' => 0,
            'start' => $start,
            'limit' => $limit,
            'items' => [],
        ];
    }

    /**
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromGlobalTasks(
        string $category,
        string $taskType,
        ?string $status,
        int $start,
        int $limit
    ): array {
        $query = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', $taskType);

        if ($status !== null && $status !== '') {
            if ($status === 'leased') {
                $query->whereIn('status', [GlobalTask::STATUS_ASSIGNED, GlobalTask::STATUS_PROCESSING])
                    ->whereNotNull('assigned_to');
            } else {
                $statuses = $this->mapOverviewStatusToGlobal($status);
                if ($statuses !== []) {
                    $query->whereIn('status', $statuses);
                }
            }
        }

        $total = (int) (clone $query)->count();

        $rows = $query
            ->orderByDesc('priority')
            ->orderByDesc('id')
            ->offset($start)
            ->limit($limit)
            ->get([
                'id', 'task_type', 'status', 'priority', 'payload',
                'assigned_to', 'retry_count', 'created_at', 'updated_at',
            ]);

        $items = [];
        foreach ($rows as $row) {
            $payload = is_array($row->payload) ? $row->payload : [];
            $content = $this->extractPayloadContent($payload);
            $items[] = [
                'id' => (int) $row->id,
                'category' => $category,
                'task_type' => (string) $row->task_type,
                'status' => $status === 'leased' ? 'leased' : (string) $row->status,
                'priority' => (int) ($row->priority ?? 0),
                'content_text' => $content,
                'language' => $payload['language'] ?? null,
                'assigned_to' => $row->assigned_to,
                'retry_count' => (int) ($row->retry_count ?? 0),
                'created_at' => $row->created_at !== null ? $row->created_at->toIso8601String() : null,
                'updated_at' => $row->updated_at !== null ? $row->updated_at->toIso8601String() : null,
            ];
        }

        return [
            'category' => $category,
            'status' => $status,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ];
    }

    /**
     * word_audio lane — dictionary tts_cache rows are the source of truth for
     * tts_priority (wordnew bumps land here). GlobalTask rows are secondary.
     *
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromWordAudio(?string $status, int $start, int $limit): array
    {
        return $this->categoryItemsFromDictionaryTts('word_audio', $status, $start, $limit);
    }

    /**
     * Dictionary-backed word TTS rows across all languages, ordered by tts_priority
     * DESC so wordnew / library bumps (100+) surface at the top.
     *
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromDictionaryTts(string $category, ?string $status, int $start, int $limit): array
    {
        $conn = \Illuminate\Support\Facades\DB::connection(
            AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1)
        );
        $allRows = [];

        foreach (AppQyV1DictionaryTTSCoordinator::supportedLanguages() as $lang) {
            $table = AppQyV1TableMaps::getDictionaryTableName($lang);
            if (!$conn->getSchemaBuilder()->hasTable($table)) {
                continue;
            }

            $query = $conn->table($table);
            if ($status === 'leased') {
                $query->where('has_audio', false)
                    ->whereNotNull('tts_locked_by');
                AppQyV1DictionaryTTSCoordinator::applyLiveLockPredicate($query);
            } elseif ($status === 'processing') {
                $query->where('has_audio', false)
                    ->where('tts_status', AppQyV1DictionaryTTSCoordinator::STATUS_PROCESSING);
                AppQyV1DictionaryTTSCoordinator::applyLiveLockPredicate($query);
            } elseif ($status === 'completed') {
                $query->where('has_audio', true);
            } elseif ($status === 'failed') {
                $query->where('has_audio', false)
                    ->where('tts_status', AppQyV1DictionaryTTSCoordinator::STATUS_FAILED);
            } else {
                // pending + default: outstanding audio work (includes reclaimable locks)
                $query->where('has_audio', false)
                    ->where('is_valid', true)
                    ->where(function ($q) {
                        $q->whereNull('tts_status')
                            ->orWhere('tts_status', AppQyV1DictionaryTTSCoordinator::STATUS_PENDING)
                            ->orWhere(function ($qq) {
                                $qq->where('tts_status', AppQyV1DictionaryTTSCoordinator::STATUS_PROCESSING);
                                AppQyV1DictionaryTTSCoordinator::applyClaimableLockPredicate($qq);
                            });
                    })
                    ->where('tts_attempts', '<', AppQyV1DictionaryTTSCoordinator::MAX_ATTEMPTS);
            }

            $rows = $query
                ->orderByDesc('tts_priority')
                ->orderByDesc('tts_requested_at')
                ->orderByDesc('id')
                ->get([
                    'id', 'content', 'md5', 'has_audio', 'tts_status', 'tts_priority',
                    'tts_locked_by', 'tts_locked_at', 'tts_attempts', 'tts_files',
                    'tts_error_message', 'tts_requested_at', 'tts_completed_at',
                ]);

            foreach ($rows as $row) {
                $rowStatus = AppQyV1DictionaryTTSCoordinator::statusOf($row);
                $lockedBy = $row->tts_locked_by ?? null;
                $isLeased = $lockedBy !== null && $rowStatus === AppQyV1DictionaryTTSCoordinator::STATUS_PROCESSING;
                $displayStatus = $isLeased ? 'leased' : $rowStatus;

                if ($status === 'leased' && !$isLeased) {
                    continue;
                }

                $item = [
                    'id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $row->id, AppQyV1DictionaryTTSCoordinator::TYPE_WORD, $lang),
                    'task_id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $row->id, AppQyV1DictionaryTTSCoordinator::TYPE_WORD, $lang),
                    'category' => $category,
                    'task_type' => AppQyV1DictionaryTTSCoordinator::TYPE_WORD,
                    'status' => $displayStatus,
                    'priority' => (int) ($row->tts_priority ?? 0),
                    'content_text' => (string) ($row->content ?? ''),
                    'language' => $lang,
                    'assigned_to' => $lockedBy,
                    'retry_count' => (int) ($row->tts_attempts ?? 0),
                    'error_message' => $row->tts_error_message ?? null,
                    'requested_at' => $row->tts_requested_at ?? null,
                    'completed_at' => $row->tts_completed_at ?? null,
                    'has_audio' => (bool) ($row->has_audio ?? false),
                ];
                $this->attachDictionaryAudioUrl($item, $row);
                $allRows[] = $item;
            }
        }

        usort($allRows, static function ($a, $b) {
            return ($b['priority'] ?? 0) <=> ($a['priority'] ?? 0);
        });

        $total = count($allRows);
        $items = array_slice($allRows, $start, $limit);

        return [
            'category' => $category,
            'status' => $status,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ];
    }

    /** @param array<string,mixed> $item */
    private function attachDictionaryAudioUrl(array &$item, object $row): void
    {
        if (!($row->has_audio ?? false)) {
            return;
        }
        $ttsFiles = $row->tts_files ?? null;
        if (is_string($ttsFiles)) {
            $ttsFiles = json_decode($ttsFiles, true);
        }
        if (!is_array($ttsFiles)) {
            return;
        }
        foreach ($ttsFiles as $ttsFile) {
            if (isset($ttsFile['path']) && is_string($ttsFile['path']) && $ttsFile['path'] !== '') {
                $item['audio_url'] = AppQyV1TtsUrl::forPath($ttsFile['path']);
                $item['audio_path'] = $ttsFile['path'];
                return;
            }
        }
    }

    /** @return array<int,string> */
    private function mapOverviewStatusToGlobal(string $status): array
    {
        return match ($status) {
            'pending' => [GlobalTask::STATUS_PENDING],
            'processing' => [GlobalTask::STATUS_ASSIGNED, GlobalTask::STATUS_PROCESSING],
            'completed' => [GlobalTask::STATUS_COMPLETED, GlobalTask::STATUS_COMPLETED_DEMO],
            'failed' => [GlobalTask::STATUS_FAILED],
            default => [],
        };
    }

    /** @param array<string,mixed> $payload */
    private function extractPayloadContent(array $payload): ?string
    {
        $words = $payload['words'] ?? null;
        if (is_array($words) && $words !== []) {
            $first = $words[0];
            if (is_array($first)) {
                $w = $first['word'] ?? $first['content'] ?? null;
                if (is_string($w) && trim($w) !== '') {
                    return trim($w);
                }
            }
            if (is_string($first) && trim($first) !== '') {
                return trim($first);
            }
        }
        foreach (['content', 'text', 'word', 'title'] as $key) {
            $candidate = $payload[$key] ?? null;
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }
        return null;
    }

    /**
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromSentenceAudio(?string $status, int $start, int $limit): array
    {
        $allRows = [];
        foreach (\App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            try {
                $model = \App\Models\LangSentence::for($lang);
                if (!$model->getConnection()->getSchemaBuilder()->hasTable($model->getTable())) {
                    continue;
                }
                $query = \App\Models\LangSentence::onLang($lang);
                if ($status === 'leased') {
                    $query->where('has_audio', false)->whereNotNull('tts_locked_by');
                } elseif ($status === 'pending' || $status === null || $status === '') {
                    $query->where('has_audio', false)->whereNull('tts_locked_by');
                } elseif ($status === 'processing') {
                    $query->where('has_audio', false)->whereNotNull('tts_locked_by');
                } elseif ($status === 'completed') {
                    $query->where('has_audio', true);
                } elseif ($status === 'failed') {
                    $query->where('tts_status', 'failed');
                } else {
                    continue;
                }
                $rows = $query
                    ->orderByDesc('tts_priority')
                    ->orderByDesc('occurrence_count')
                    ->get(['content_id', 'text', 'language', 'tts_status', 'tts_priority', 'tts_locked_by', 'tts_locked_at', 'has_audio']);
                foreach ($rows as $row) {
                    $lockedBy = $row->tts_locked_by ?? null;
                    $hasAudio = (bool) ($row->has_audio ?? false);
                    $displayStatus = $hasAudio
                        ? 'completed'
                        : ($lockedBy ? ($status === 'leased' ? 'leased' : 'processing') : 'pending');
                    $item = [
                        'id' => (string) $row->content_id,
                        'content_id' => (string) $row->content_id,
                        'category' => 'sentence_audio',
                        'task_type' => 'sentence_audio',
                        'status' => $displayStatus,
                        'priority' => (int) ($row->tts_priority ?? 0),
                        'content_text' => mb_substr((string) $row->text, 0, 200),
                        'language' => $lang,
                        'assigned_to' => $lockedBy,
                        'retry_count' => 0,
                        'has_audio' => $hasAudio,
                    ];
                    if ($hasAudio) {
                        $item['audio_url'] = AppQyV1SentenceAudioUrl::forRelative($lang . '/' . $row->content_id . '.mp3');
                    }
                    $allRows[] = $item;
                }
            } catch (\Throwable $e) {
                continue;
            }
        }

        usort($allRows, static function ($a, $b) {
            return ($b['priority'] ?? 0) <=> ($a['priority'] ?? 0);
        });

        $total = count($allRows);
        $items = array_slice($allRows, $start, $limit);

        return [
            'category' => 'sentence_audio',
            'status' => $status,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ];
    }

    /**
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromCovers(?string $status, int $start, int $limit): array
    {
        $query = AppQyV1VocabularyLibraryModel::query()->whereNotNull('cover_filename');
        if ($status === 'pending') {
            $query->whereIn('cover_status', ['pending', 'retry']);
        } elseif ($status === 'leased') {
            $query->whereNotNull('assist_claimed_at')
                ->where('assist_claimed_at', '>=', now()->subMinutes(self::LEASE_MINUTES));
        } elseif ($status === 'processing') {
            $query->where('cover_status', 'processing');
        } elseif ($status === 'completed') {
            $query->where('cover_status', 'ready');
        } elseif ($status === 'failed') {
            $query->where('cover_status', 'failed');
        }

        $total = (int) (clone $query)->count();
        $rows = $query
            ->orderByDesc('cover_priority')
            ->offset($start)
            ->limit($limit)
            ->get(['id', 'name', 'language', 'cover_status', 'cover_priority', 'assist_claimed_by', 'assist_claimed_at']);

        $items = [];
        foreach ($rows as $row) {
            $coverStatus = (string) ($row->cover_status ?? 'pending');
            $mapped = in_array($coverStatus, ['pending', 'retry'], true) ? 'pending' : $coverStatus;
            $items[] = [
                'id' => (int) $row->id,
                'category' => 'cover',
                'task_type' => 'cover',
                'status' => $status === 'leased' ? 'leased' : ($mapped === 'ready' ? 'completed' : $mapped),
                'priority' => (int) ($row->cover_priority ?? 0),
                'content_text' => (string) ($row->name ?? ''),
                'language' => $row->language ?? null,
                'assigned_to' => $row->assist_claimed_by,
                'leased_at' => $row->assist_claimed_at !== null ? $row->assist_claimed_at->toIso8601String() : null,
                'retry_count' => 0,
            ];
        }

        return [
            'category' => 'cover',
            'status' => $status,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ];
    }

    /**
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromPosters(?string $status, int $start, int $limit): array
    {
        if (!self::posterColumnsReady()) {
            return [
                'category' => 'poster',
                'status' => $status,
                'total' => 0,
                'start' => $start,
                'limit' => $limit,
                'items' => [],
            ];
        }

        $allRows = [];
        foreach ([['book', Book::class], ['subtitle', Subtitle::class]] as [$mediaType, $modelClass]) {
            $query = $modelClass::query();
            if ($status === 'pending') {
                $query->where('poster_status', 'pending');
            } elseif ($status === 'leased') {
                $query->whereNotNull('assist_claimed_at')
                    ->where('assist_claimed_at', '>=', now()->subMinutes(self::LEASE_MINUTES));
            } elseif ($status === 'failed') {
                $query->where('poster_status', 'failed');
            } elseif ($status === 'completed') {
                $query->where('poster_status', 'ready');
            }
            $rows = $query
                ->orderByRaw('poster_fetched_at IS NULL DESC')
                ->orderBy('poster_fetched_at')
                ->get(['id', 'title', 'original_name', 'poster_status', 'assist_claimed_by', 'assist_claimed_at']);
            foreach ($rows as $row) {
                $title = trim((string) $row->getAttribute('title'));
                if ($title === '') {
                    $title = trim((string) $row->getAttribute('original_name'));
                }
                $posterStatus = (string) ($row->poster_status ?? 'pending');
                $allRows[] = [
                    'id' => (int) $row->id,
                    'category' => 'poster',
                    'task_type' => 'poster',
                    'media_type' => $mediaType,
                    'status' => $status === 'leased' ? 'leased' : ($posterStatus === 'ready' ? 'completed' : $posterStatus),
                    'priority' => 0,
                    'content_text' => $title !== '' ? $title : "#{$row->id}",
                    'language' => null,
                    'assigned_to' => $row->assist_claimed_by ?? null,
                    'leased_at' => $row->assist_claimed_at !== null ? $row->assist_claimed_at->toIso8601String() : null,
                    'retry_count' => 0,
                ];
            }
        }

        $total = count($allRows);
        $items = array_slice($allRows, $start, $limit);

        return [
            'category' => 'poster',
            'status' => $status,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ];
    }

    /**
     * @return array{category:string,status:?string,total:int,start:int,limit:int,items:array<int,array<string,mixed>>}
     */
    private function categoryItemsFromAssistRequests(
        string $recordType,
        string $requestType,
        ?string $status,
        int $start,
        int $limit
    ): array
    {
        $category = $recordType === 'subtitle' ? 'subtitle_lang' : 'book_lang';
        if (!self::assistRequestsTableReady()) {
            return [
                'category' => $category,
                'status' => $status,
                'total' => 0,
                'start' => $start,
                'limit' => $limit,
                'items' => [],
            ];
        }

        $query = \App\Models\AppQyV1AssistRequest::query()
            ->where('record_type', $recordType)
            ->where('request_type', $requestType);

        if ($status !== null && $status !== '') {
            if ($status === 'leased') {
                $leaseFloor = now()->subMinutes(\App\Models\AppQyV1AssistRequest::LEASE_MINUTES);
                $query->whereNotNull('claimed_at')
                    ->where('claimed_at', '>=', $leaseFloor);
            } else {
                $mapped = match ($status) {
                    'pending' => 'pending',
                    'processing' => 'processing',
                    'completed' => 'completed',
                    'failed' => 'failed',
                    default => null,
                };
                if ($mapped !== null) {
                    $query->where('status', $mapped);
                }
            }
        }

        $total = (int) (clone $query)->count();
        $rows = $query
            ->orderByDesc('priority')
            ->orderByDesc('id')
            ->offset($start)
            ->limit($limit)
            ->get(['id', 'status', 'priority', 'language', 'record_id', 'claimed_by', 'claimed_at', 'created_at']);

        $items = [];
        foreach ($rows as $row) {
            $isLeased = $row->claimed_at !== null
                && $row->claimed_at >= now()->subMinutes(\App\Models\AppQyV1AssistRequest::LEASE_MINUTES);
            $items[] = [
                'id' => (int) $row->id,
                'category' => $category,
                'task_type' => $requestType,
                'status' => $status === 'leased' || $isLeased ? 'leased' : (string) $row->status,
                'priority' => (int) ($row->priority ?? 0),
                'content_text' => "{$recordType}#{$row->record_id}",
                'language' => $row->language ?? null,
                'assigned_to' => $row->claimed_by ?? null,
                'leased_at' => $row->claimed_at !== null ? $row->claimed_at->toIso8601String() : null,
                'retry_count' => 0,
                'created_at' => $row->created_at !== null ? $row->created_at->toIso8601String() : null,
            ];
        }

        return [
            'category' => $category,
            'status' => $status,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ];
    }
}

