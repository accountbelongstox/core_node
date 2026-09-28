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
    /** Freshness window: snapshots younger than this are served as-is. */
    public const OVERVIEW_FRESH_TTL = 30;
    /** Cache retention for the last good snapshot (stale fallback window). */
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
     * cache. Called for ?fresh=1 requests and by the on-demand rebuild inside
     * serveSnapshot(). Never route this through Cache::flexible: its
     * stale-while-revalidate refresh is a deferred callback that only runs
     * inside an HTTP request lifecycle, so inside a non-HTTP tick it would be
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

    /**
     * Serve a shared snapshot, rebuilding on demand once it ages past the
     * fresh window. The warm timer is retired, so the first request past
     * OVERVIEW_FRESH_TTL rebuilds synchronously; concurrent requests keep
     * serving the last good snapshot via a short rebuild lock, and a failed
     * rebuild falls back to the stale snapshot (or the degraded shell when no
     * snapshot has ever been stored).
     */
    private function serveSnapshot(string $key, callable $builder, array $degraded): array
    {
        $cache = $this->overviewCacheStore();
        $snapshot = $cache->get($key);
        $usable = is_array($snapshot) && isset($snapshot['generated_at']);
        $age = $usable ? time() - strtotime((string) $snapshot['generated_at']) : null;

        if ($usable && $age !== null && $age >= 0 && $age < self::OVERVIEW_FRESH_TTL) {
            $snapshot['cached'] = true;
            $snapshot['stale'] = false;
            return $snapshot;
        }

        if ($cache->add($key . ':rebuild', 1, self::OVERVIEW_FRESH_TTL)) {
            try {
                $built = $builder();
                $this->putShared($key, $built, self::OVERVIEW_STALE_TTL);
                $built['cached'] = false;
                $built['stale'] = false;
                return $built;
            } catch (\Throwable $e) {
                Log::error('[Assist] on-demand snapshot rebuild failed', [
                    'key' => $key,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($usable) {
            $snapshot['cached'] = true;
            $snapshot['stale'] = true;
            return $snapshot;
        }

        return $degraded;
    }

    /**
     * Return the overview snapshot, fresh from cache when possible and
     * rebuilt on demand otherwise (see serveSnapshot).
     */
    public function overviewSnapshotFast(): array
    {
        return $this->serveSnapshot(
            self::OVERVIEW_SNAPSHOT_KEY,
            fn () => $this->buildOverviewSnapshot(),
            [
                'success' => true,
                'cached' => false,
                'stale' => true,
                'schema_version' => QueueCenterContract::schemaVersion(),
                'generated_at' => now()->toIso8601String(),
                'observed_at' => now()->toIso8601String(),
                'categories' => QueueCenterContract::normalizeCategories([], []),
                'workers' => [],
            ]
        );
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
     * Pending-work snapshot across the assist tracks. Same serving policy as
     * the overview snapshot: fresh cache hit when possible, on-demand
     * synchronous rebuild past the fresh window, degraded shell only when no
     * snapshot has ever been built; ?fresh=1 forces an explicit rebuild.
     */
    public function pendingSnapshot(bool $fresh = false): array
    {
        if ($fresh) {
            return $this->warmPendingSnapshot();
        }

        return $this->serveSnapshot(
            self::PENDING_SNAPSHOT_KEY,
            fn () => $this->buildPendingSnapshot(),
            [
                'generated_at' => now()->toIso8601String(),
                'enabled' => self::isAssistEnabled(),
                'lease_minutes' => self::LEASE_MINUTES,
                'cached' => false,
                'stale' => true,
                'cover' => ['pending' => 0, 'retry' => 0, 'processing' => 0, 'ready' => 0, 'failed' => 0, 'total' => 0, 'leased' => 0],
                'tts' => ['pending' => 0, 'processing' => 0, 'completed' => 0, 'failed' => 0, 'leased' => 0],
                'translation' => ['pending' => 0, 'leased' => 0, 'processing' => 0, 'completed' => 0, 'failed' => 0, 'total' => 0],
                'poster' => ['pending' => 0, 'ready' => 0, 'failed' => 0, 'none' => 0, 'total' => 0, 'leased' => 0],
            ]
        );
    }

    /**
     * Synchronously rebuild the pending snapshot and store it in the shared
     * cache. Called for ?fresh=1 requests; the on-demand path stores via
     * serveSnapshot instead.
     */
    public function warmPendingSnapshot(): array
    {
        $snapshot = $this->buildPendingSnapshot();
        $this->putShared(self::PENDING_SNAPSHOT_KEY, $snapshot, self::OVERVIEW_STALE_TTL);
        return $snapshot;
    }

    private function buildPendingSnapshot(): array
    {
        return [
            'generated_at' => now()->toIso8601String(),
            'enabled' => self::isAssistEnabled(),
            'lease_minutes' => self::LEASE_MINUTES,
            'cover' => $this->coverCounts(),
            'tts' => $this->ttsCounts(),
            'translation' => $this->translationCounts(),
            'poster' => $this->posterCounts(),
        ];
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
