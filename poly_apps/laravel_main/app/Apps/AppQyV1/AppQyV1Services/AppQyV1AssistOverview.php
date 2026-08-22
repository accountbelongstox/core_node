<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SubtitleModel as Subtitle;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

trait AppQyV1AssistOverview
{
    public const OVERVIEW_SNAPSHOT_KEY = 'appqyv1:assist:overview_snapshot:v2';
    /** Warm-published snapshot TTL; the Octane timer republishes every 20s. */
    public const OVERVIEW_STALE_TTL = 300;

    /**
     * Fast, worker-friendly cache store. Octane's in-memory table is preferred
     * because it never blocks on file locks and is shared across Swoole workers.
     * Falls back to file when Octane is not active (composer dev/dev:win/Windows).
     */
    private function overviewCacheStore()
    {
        // The octane store is backed by a Swoole table shared across all
        // workers, but only when Octane bound its shared cache table (Swoole
        // runtime). Outside Octane the store resolves to a process-local
        // array that cannot share the warm snapshot, so the file store wins.
        try {
            if (app()->bound('octane.cacheTable')) {
                return Cache::store('octane');
            }
        } catch (\Throwable) {
            // Octane cache unavailable; use file store below.
        }

        return Cache::store('file');
    }

    /**
     * Synchronously rebuild the overview snapshot and store it in the shared
     * cache. The Octane timer (AppQyV1OverviewWarmTask) calls this so HTTP
     * readers never compute the aggregates themselves; ?fresh=1 requests may
     * call it explicitly. Never route this through Cache::flexible: its
     * stale-while-revalidate refresh is a deferred callback that only runs
     * inside an HTTP request lifecycle, so inside an Octane tick it would be
     * discarded silently.
     */
    public function warmOverviewSnapshot(): array
    {
        $snapshot = $this->buildOverviewSnapshot();
        $this->putShared(self::OVERVIEW_SNAPSHOT_KEY, $snapshot, self::OVERVIEW_STALE_TTL);
        return $snapshot;
    }

    /**
     * Store a snapshot in the shared cache and VERIFY the write. The Octane
     * (Swoole-table) store silently returns false when the serialized payload
     * exceeds the configured row size, which previously made the warm path
     * fail invisibly; surface that as an error log with the payload size.
     */
    private function putShared(string $key, array $snapshot, int $ttl): void
    {
        try {
            $stored = $this->overviewCacheStore()->put($key, $snapshot, $ttl);
            if ($stored === false) {
                Log::error('[Assist] snapshot cache write rejected by store', [
                    'key' => $key,
                    'payload_bytes' => strlen(serialize($snapshot)),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('[Assist] snapshot cache write failed', [
                'key' => $key,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /** @return array<int,array{id:int,title:?string}> */
    private function coverSample(): array
    {
        try {
            return AppQyV1VocabularyLibraryModel::activeCoverSamples(self::OVERVIEW_SAMPLE_LIMIT)
                ->map(static fn ($row) => [
                    'id' => (int) $row->id,
                    'title' => $row->name !== null ? (string) $row->name : null,
                ])->all();
        } catch (\Throwable $e) {
            return [];
        }
    }

    /** @return array<int,array{id:int,title:?string}> */
    private function posterSample(): array
    {
        if (!self::posterColumnsReady()) {
            return [];
        }
        $sample = [];
        foreach ([Book::class, Subtitle::class] as $modelClass) {
            if (count($sample) >= self::OVERVIEW_SAMPLE_LIMIT) {
                break;
            }
            try {
                $rows = $modelClass::pendingPosterSample(self::OVERVIEW_SAMPLE_LIMIT - count($sample));
                foreach ($rows as $row) {
                    $title = trim((string) $row->getAttribute('title'));
                    if ($title === '') {
                        $title = trim((string) $row->getAttribute('original_name'));
                    }
                    $sample[] = [
                        'id' => (int) $row->id,
                        'title' => $title !== '' ? $title : null,
                    ];
                }
            } catch (\Throwable $e) {
                continue;
            }
        }
        return $sample;
    }

    public const PENDING_SNAPSHOT_KEY = 'appqyv1:assist:pending_snapshot';
    /** Warm-published snapshot TTL; the Octane timer republishes every 20s. */
    public const PENDING_SNAPSHOT_STALE_TTL = 300;

    /**
     * Return the overview snapshot from cache immediately. Never blocks on a
     * cold aggregate build — if the cache is empty we return a degraded shell
     * and let the Octane timer warm the real snapshot in the background.
     */
    public function overviewSnapshotFast(): array
    {
        $cache = $this->overviewCacheStore();
        $snapshot = $cache->get(self::OVERVIEW_SNAPSHOT_KEY);
        if (is_array($snapshot) && ($snapshot['success'] ?? false)) {
            $snapshot['cached'] = true;
            $snapshot['stale'] = false;
            return $snapshot;
        }

        $empty = [
            'success' => true,
            'cached' => false,
            'stale' => true,
            'schema_version' => QueueCenterContract::schemaVersion(),
            'generated_at' => now()->toIso8601String(),
            'observed_at' => now()->toIso8601String(),
            'categories' => QueueCenterContract::normalizeCategories([], []),
            'workers' => [],
        ];

        // No warm snapshot yet. The Octane timer (AppQyV1OverviewWarmTask)
        // rebuilds it every 20 seconds; this request must stay cheap, so it
        // returns the degraded shell instead of computing the aggregates.
        return $empty;
    }

    /**
     * Separate the expensive build from the caching policy so background warmers
     * and Cache::flexible can share exactly the same logic.
     */
    private function buildOverviewSnapshot(): array
    {
        $cover = $this->coverCounts();
        $poster = $this->posterCounts();
        $workers = $this->workers();
        $metricsByKey = [
            'word_translation' => $this->wordTranslationCounts(),
            'ai_translate' => $this->aiTranslateCounts(),
            'word_audio' => $this->wordAudioCounts(),
            'sentence_audio' => $this->sentenceCounts(),
            'subtitle_search' => $this->subtitleSearchCounts(),
            'subtitle_lang' => $this->assistRequestGroupCounts('subtitle', 'add_language'),
            'book_lang' => $this->assistRequestGroupCounts('book', 'add_language'),
            'cover' => [
                'pending' => max(
                    0,
                    (int) ($cover['pending'] ?? 0)
                        + (int) ($cover['retry'] ?? 0)
                        - (int) ($cover['leased'] ?? 0)
                ),
                'processing' => (int) ($cover['processing'] ?? 0),
                'leased' => (int) ($cover['leased'] ?? 0),
                'total' => (int) ($cover['total'] ?? 0),
                'sample' => $this->coverSample(),
            ],
            'poster' => [
                'pending' => max(0, (int) ($poster['pending'] ?? 0) - (int) ($poster['leased'] ?? 0)),
                'processing' => (int) ($poster['processing'] ?? 0),
                'leased' => (int) ($poster['leased'] ?? 0),
                'total' => (int) ($poster['total'] ?? 0),
                'sample' => $this->posterSample(),
            ],
            'notebooklm' => $this->notebookLmCounts(),
            'gemini_image' => $this->geminiImageCounts(),
            'gemini_chat' => $this->geminiChatCounts(),
            'chatgpt_chat' => $this->chatGptCounts(),
        ];
        $generatedAt = now()->toIso8601String();

        return [
            'success' => true,
            'cached' => true,
            'stale' => false,
            'schema_version' => QueueCenterContract::schemaVersion(),
            'generated_at' => $generatedAt,
            'observed_at' => $generatedAt,
            'categories' => QueueCenterContract::normalizeCategories($metricsByKey, $workers),
            'workers' => $workers,
        ];
    }

    /**
     * Pending-work snapshot across the assist tracks. Same contract as the
     * overview snapshot: HTTP readers get a pure cache read and a degraded
     * shell until the Octane warm timer publishes (never a synchronous
     * aggregate build on an HTTP worker); ?fresh=1 forces an explicit
     * synchronous rebuild + store.
     */
    public function pendingSnapshot(bool $fresh = false): array
    {
        if ($fresh) {
            return $this->warmPendingSnapshot();
        }

        $snapshot = $this->overviewCacheStore()->get(self::PENDING_SNAPSHOT_KEY);
        if (is_array($snapshot) && isset($snapshot['cover'])) {
            $snapshot['cached'] = true;
            $snapshot['stale'] = false;
            return $snapshot;
        }

        return [
            'generated_at' => now()->toIso8601String(),
            'enabled' => self::isAssistEnabled(),
            'lease_minutes' => self::LEASE_MINUTES,
            'cached' => false,
            'stale' => true,
            'cover' => ['pending' => 0, 'retry' => 0, 'processing' => 0, 'ready' => 0, 'failed' => 0, 'total' => 0, 'leased' => 0],
            'tts' => ['pending' => 0, 'processing' => 0, 'completed' => 0, 'failed' => 0, 'leased' => 0],
            'translation' => ['pending' => 0, 'leased' => 0, 'processing' => 0, 'completed' => 0, 'failed' => 0, 'total' => 0],
            'poster' => ['pending' => 0, 'ready' => 0, 'failed' => 0, 'none' => 0, 'total' => 0, 'leased' => 0],
        ];
    }

    /**
     * Synchronously rebuild the pending snapshot and store it in the shared
     * cache. Called by the Octane warm timer; never via Cache::flexible (its
     * deferred refresh is discarded outside the HTTP lifecycle — Octane
     * ticks included).
     */
    public function warmPendingSnapshot(): array
    {
        $snapshot = [
            'generated_at' => now()->toIso8601String(),
            'enabled' => self::isAssistEnabled(),
            'lease_minutes' => self::LEASE_MINUTES,
            'cover' => $this->coverCounts(),
            'tts' => $this->ttsCounts(),
            'translation' => $this->translationCounts(),
            'poster' => $this->posterCounts(),
        ];
        $this->putShared(self::PENDING_SNAPSHOT_KEY, $snapshot, self::PENDING_SNAPSHOT_STALE_TTL);
        return $snapshot;
    }

    public static function looksLikeImage(string $bytes): bool
    {
        if (strlen($bytes) < 12) {
            return false;
        }

        return str_starts_with($bytes, "\x89PNG\r\n\x1a\n")
            || str_starts_with($bytes, "\xFF\xD8\xFF")
            || (str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WEBP')
            || str_starts_with($bytes, 'GIF87a')
            || str_starts_with($bytes, 'GIF89a');
    }

    private function clearCoverLease(AppQyV1VocabularyLibraryModel $library): void
    {
        if ($library->assist_claimed_at !== null || $library->assist_claimed_by !== null) {
            $library->assist_claimed_at = null;
            $library->assist_claimed_by = null;
            $library->saveRecord();
        }
    }
}
