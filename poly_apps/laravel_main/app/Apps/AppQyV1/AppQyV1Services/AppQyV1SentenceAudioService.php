<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1SentenceAudioUrl;
use App\Models\Sentence;
use App\Providers\PathMapper;
use App\Services\MediaIngestService;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Log;

/**
 * Sentence-library audio pipeline (laravel_main side of
 * development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md, §2/§3/§4.1-§4.3).
 *
 * The FILE on disk is the source of truth, NOT the DB:
 *   <sentence_sounds>/<language>/<sentence_id>.mp3
 *   sentence_sounds = PathMapper::getAppQyV1SentenceSoundsDir()
 * The sentences.has_audio + sentences.audio columns are caches only; the
 * resolve route reconciles them from the filesystem and never trusts them
 * over a stat().
 *
 * Lease model: the assist 60-minute window. The sentences table has no
 * dedicated tts_* claim columns, so the lease is parked inside the JSON
 * `metadata` cache under the `audio_lease` key (lease_at + lease_by). A claim
 * is blocked only by a LIVE lease (younger than LOCK_STALE_MINUTES for a local
 * worker, ASSIST_LEASE_MINUTES for an assist worker). Stale leases are taken
 * over by the next claim, exactly like the dictionary TTS coordinator.
 */
class AppQyV1SentenceAudioService
{
    /** A local worker's processing lease is stale after this many minutes. */
    public const LOCK_STALE_MINUTES = 10;

    /** Assist-protocol leases (assist:* workers) stay live for 60 minutes. */
    public const ASSIST_LEASE_MINUTES = AppQyV1DictionaryTTSCoordinator::ASSIST_LEASE_MINUTES;

    /** Worker-id prefix marking an assist-protocol claim (longer lease). */
    public const ASSIST_WORKER_PREFIX = AppQyV1DictionaryTTSCoordinator::ASSIST_WORKER_PREFIX;

    /** metadata key the per-sentence audio lease is parked under. */
    private const LEASE_KEY = 'audio_lease';

    /**
     * Extension preference for resolving an existing on-disk audio file.
     * .mp3 is the canonical write target; the rest are accepted on read.
     */
    public const AUDIO_EXTENSIONS = ['mp3', 'aac', 'm4a', 'wav'];

    // ------------------------------------------------------------------
    // §4.1  Claim sentences needing audio (priority ordered)
    // ------------------------------------------------------------------

    /**
     * Claim up to $limit sentences whose audio is missing (has_audio=false) and
     * which are not currently leased, ordered by priority DESC, id ASC.
     *
     * Priority source: the sentences table has NO priority column, so we derive
     * one from the existing demand signal `occurrence_count` (how many times a
     * sentence was ingested) — a user-facing sentence that recurs is generated
     * sooner than one-off backfill. The priority is surfaced in each task and
     * is NOT persisted (no schema change). Default is 0 when occurrence_count is
     * absent.
     *
     * When $limit <= 0 the method returns counts only (FE summary), leasing
     * nothing.
     *
     * @return array{count:int,pending:int,leased:int,lock_stale_minutes:int,tasks:array<int,array<string,mixed>>}
     */
    public function claim(string $workerId, ?string $language, int $limit): array
    {
        $pending = $this->pendingCount($language);
        $leased = $this->leasedCount($language);

        // Summary-only mode for the Queue Center "Sentence Audio" strip.
        if ($limit <= 0) {
            return [
                'count' => 0,
                'pending' => $pending,
                'leased' => $leased,
                'lock_stale_minutes' => self::LOCK_STALE_MINUTES,
                'tasks' => [],
            ];
        }

        $limit = min(50, $limit);
        $isAssist = str_starts_with($workerId, self::ASSIST_WORKER_PREFIX);

        $model = new Sentence();

        $tasks = $model->getConnection()->transaction(function () use ($model, $workerId, $language, $limit) {
            $query = Sentence::query()
                ->where('has_audio', false)
                ->when($language, fn ($q) => $q->where('language', $language));

            // Not currently under a LIVE lease. The lease lives in JSON metadata,
            // which is not portably filterable in SQL across PG/sqlite, so we
            // over-fetch a bounded candidate window and filter in PHP, then
            // re-check + write the lease under lockForUpdate for atomicity.
            $candidates = $query
                ->orderByDesc('occurrence_count') // priority signal (see docblock)
                ->orderBy('id')
                ->limit($limit * 4)
                ->lockForUpdate()
                ->get();

            $claimed = [];
            foreach ($candidates as $sentence) {
                if (count($claimed) >= $limit) {
                    break;
                }
                if ($this->hasLiveLease($sentence)) {
                    continue;
                }

                $this->writeLease($sentence, $workerId);

                $claimed[] = $this->buildTask(count($claimed), $sentence);
            }

            return $claimed;
        }, 1);

        return [
            'count' => count($tasks),
            'pending' => $pending,
            'leased' => $leased,
            'lock_stale_minutes' => self::LOCK_STALE_MINUTES,
            'tasks' => $tasks,
        ];
    }

    /** Build the §4.1 task descriptor for one claimed sentence. */
    private function buildTask(int $taskId, Sentence $sentence): array
    {
        $language = (string) $sentence->language;
        $sentenceId = (string) $sentence->sentence_id;

        return [
            'task_id' => $taskId,
            'type' => 'sentence',
            'sentence_id' => $sentenceId,
            'content_id' => $sentence->content_id !== null ? (string) $sentence->content_id : null,
            'content' => (string) $sentence->text,
            'language' => $language,
            'audio_relative_path' => $language . '/' . $sentenceId . '.mp3',
            'priority' => $this->priorityOf($sentence),
        ];
    }

    /** Derived (non-persisted) priority: demand via occurrence_count, min 0. */
    private function priorityOf(Sentence $sentence): int
    {
        return max(0, (int) ($sentence->occurrence_count ?? 0));
    }

    // ------------------------------------------------------------------
    // §4.2  Report a generated sentence audio (validated, idempotent)
    // ------------------------------------------------------------------

    /**
     * Ingest one worker-reported sentence audio result.
     *
     * Success: validate the MP3 (>=100 bytes, ID3/frame-sync), write it to the
     * deterministic §2 path, set has_audio=true + audio="{lang}/{hash}.mp3",
     * clear the lease. Idempotent — if the file is already on disk the report is
     * acknowledged with already_done=true and the file is never clobbered.
     *
     * Failure: record the error in metadata, clear the lease so the sentence is
     * re-claimable.
     *
     * @return array{ok:bool,status:string,already_done?:bool,error?:string,http_status:int}
     */
    public function report(
        string $sentenceId,
        string $workerId,
        bool $success,
        ?string $audioBinary,
        ?string $provider,
        ?string $error
    ): array {
        $sentence = Sentence::query()->where('sentence_id', $sentenceId)->first();
        if (!$sentence) {
            return ['ok' => false, 'status' => 'not_found', 'error' => 'Sentence not found', 'http_status' => 404];
        }

        $language = (string) $sentence->language;
        $relativePath = $language . '/' . $sentenceId . '.mp3';
        $fullPath = PathMapper::getAppQyV1SentenceSoundsDir($relativePath);

        // --- Failure path: consume the lease, record the error, re-queueable ---
        if (!$success) {
            $this->recordError($sentence, $error ?: 'Worker reported failure');
            $this->clearLease($sentence);
            $sentence->save();
            return ['ok' => true, 'status' => 'failed', 'http_status' => 200];
        }

        // --- Idempotent fill-missing: a file already on disk is never clobbered ---
        clearstatcache(true, $fullPath);
        if (is_file($fullPath) && filesize($fullPath) > 0) {
            $this->reconcilePresent($sentence, $relativePath);
            $this->clearLease($sentence);
            $sentence->save();
            return ['ok' => true, 'status' => 'completed', 'already_done' => true, 'http_status' => 200];
        }

        // --- Validate the payload (never trust the wire) ---
        if ($audioBinary === null || strlen($audioBinary) < 100) {
            $this->recordError($sentence, 'Rejected: empty or undersized audio payload');
            $this->clearLease($sentence);
            $sentence->save();
            return ['ok' => false, 'status' => 'invalid', 'error' => 'Audio payload empty or too small (<100 bytes)', 'http_status' => 422];
        }
        if (!AppQyV1DictionaryTTSCoordinator::looksLikeMp3($audioBinary)) {
            $this->recordError($sentence, 'Rejected: payload is not a valid MP3');
            $this->clearLease($sentence);
            $sentence->save();
            return ['ok' => false, 'status' => 'invalid', 'error' => 'Audio payload failed MP3 validation', 'http_status' => 422];
        }

        // --- Persist to the deterministic path, re-verify on disk ---
        FileSystemManager::ensureDirectoryExists(dirname($fullPath));
        if (@file_put_contents($fullPath, $audioBinary) === false) {
            return ['ok' => false, 'status' => 'error', 'error' => 'Failed to persist audio file', 'http_status' => 500];
        }
        clearstatcache(true, $fullPath);
        if (!is_file($fullPath) || filesize($fullPath) !== strlen($audioBinary)) {
            @unlink($fullPath);
            return ['ok' => false, 'status' => 'error', 'error' => 'Persisted audio failed verification', 'http_status' => 500];
        }

        $sentence->has_audio = true;
        $sentence->audio = $relativePath;
        $this->recordProvider($sentence, $provider ?: ('worker:' . $workerId));
        $this->clearLease($sentence);
        $sentence->save();

        Log::info('[SentenceAudio] Worker result accepted', [
            'sentence_id' => $sentenceId,
            'language' => $language,
            'worker' => $workerId,
            'bytes' => strlen($audioBinary),
            'path' => $relativePath,
        ]);

        return ['ok' => true, 'status' => 'completed', 'http_status' => 200];
    }

    // ------------------------------------------------------------------
    // §4.3  Resolve / play one sentence's audio (file-first)
    // ------------------------------------------------------------------

    /**
     * Resolve a single sentence's audio FROM THE HASH, file-first. Accepts a
     * sentence_id (sha1) or content_id (md5) hash, or text+language to hash
     * server-side. Existence is decided by stat-ing the filesystem directly —
     * the DB is read only to learn the language and to reconcile the cache.
     *
     * @return array<string,mixed> the JSON body (no http_status; always 200)
     */
    public function resolve(?string $hash, ?string $text, ?string $language): array
    {
        $sentence = $this->locate($hash, $text, $language);

        // Resolve the canonical hash + language used for the on-disk path. When
        // a row exists we trust its sentence_id + language; otherwise we fall
        // back to the request hash/language so a not-yet-ingested sentence can
        // still be probed and (re)queued. With text+language but no hash we
        // derive the canonical sentence_id so the on-disk filename is correct.
        $resolvedHash = $sentence?->sentence_id ?? $hash;
        $resolvedLang = $sentence?->language ?? $language;
        if (($resolvedHash === null || $resolvedHash === '')
            && $text !== null && $text !== ''
            && $resolvedLang !== null && $resolvedLang !== '') {
            $resolvedHash = MediaIngestService::computeSentenceId($text, (string) $resolvedLang);
        }

        if ($resolvedHash === null || $resolvedHash === '' || $resolvedLang === null || $resolvedLang === '') {
            return ['success' => false, 'exists' => false, 'error' => 'Provide hash (or text)+language', 'hash' => $resolvedHash];
        }

        // FILE-FIRST: stat the disk, honoring the extension preference order.
        $found = $this->findOnDisk((string) $resolvedLang, (string) $resolvedHash);

        if ($found !== null) {
            // Reconcile a stale cache to match the filesystem (never the reverse).
            if ($sentence && (!$sentence->has_audio || $sentence->audio !== $found['relative'])) {
                $sentence->has_audio = true;
                $sentence->audio = $found['relative'];
                $sentence->save();
            }

            return [
                'success' => true,
                'exists' => true,
                'url' => AppQyV1SentenceAudioUrl::forRelative($found['relative']),
                'hash' => (string) $resolvedHash,
                'language' => (string) $resolvedLang,
            ];
        }

        // Missing on disk: mark the cache false and signal the caller to queue.
        if ($sentence && ($sentence->has_audio || $sentence->audio !== null)) {
            $sentence->has_audio = false;
            $sentence->audio = null;
            $sentence->save();
        }

        return [
            'success' => true,
            'exists' => false,
            'queued' => true,
            'hash' => (string) $resolvedHash,
        ];
    }

    /**
     * Find an existing sentence-audio file on disk for a {language}/{hash},
     * honoring AUDIO_EXTENSIONS preference order. Returns the relative reference
     * ("{language}/{hash}.ext") and full path, or null when none exists.
     *
     * @return array{relative:string,full:string}|null
     */
    private function findOnDisk(string $language, string $hash): ?array
    {
        foreach (self::AUDIO_EXTENSIONS as $ext) {
            $relative = $language . '/' . $hash . '.' . $ext;
            $full = PathMapper::getAppQyV1SentenceSoundsDir($relative);
            clearstatcache(true, $full);
            if (is_file($full) && filesize($full) > 0) {
                return ['relative' => $relative, 'full' => $full];
            }
        }
        return null;
    }

    /**
     * Locate the sentence row for a resolve request: by sentence_id, then
     * content_id, then by hashing text+language with the library's own hash
     * formula (sentence_id = sha1(normalize(text)+'|'+language)).
     */
    private function locate(?string $hash, ?string $text, ?string $language): ?Sentence
    {
        if ($hash !== null && $hash !== '') {
            $row = Sentence::query()->where('sentence_id', $hash)->first();
            if ($row) {
                return $row;
            }
            return Sentence::query()->where('content_id', $hash)->first();
        }

        if ($text !== null && $text !== '' && $language !== null && $language !== '') {
            // Reuse the canonical shared-library key so a text lookup hashes to
            // EXACTLY the sentence_id the ingest path stored:
            //   sentence_id = sha1(normalize(text) + '|' + language).
            $sentenceId = MediaIngestService::computeSentenceId($text, $language);
            return Sentence::query()->where('sentence_id', $sentenceId)->first();
        }

        return null;
    }

    /** Reconcile the cache for a sentence whose file is confirmed present. */
    private function reconcilePresent(Sentence $sentence, string $relativePath): void
    {
        if (!$sentence->has_audio || $sentence->audio !== $relativePath) {
            $sentence->has_audio = true;
            $sentence->audio = $relativePath;
        }
    }

    // ------------------------------------------------------------------
    // Counts (FE summary) + lease bookkeeping (JSON metadata)
    // ------------------------------------------------------------------

    /** Sentences still needing audio (has_audio=false), optionally per-language. */
    public function pendingCount(?string $language = null): int
    {
        return (int) Sentence::query()
            ->where('has_audio', false)
            ->when($language, fn ($q) => $q->where('language', $language))
            ->count();
    }

    /**
     * Sentences currently under a LIVE audio lease. The lease lives in JSON
     * metadata, so this scans the has_audio=false set in PHP — bounded and
     * cheap relative to the pending set; only ever called for FE summaries.
     */
    public function leasedCount(?string $language = null): int
    {
        $count = 0;
        Sentence::query()
            ->where('has_audio', false)
            ->when($language, fn ($q) => $q->where('language', $language))
            ->select(['id', 'metadata'])
            ->chunkById(500, function ($rows) use (&$count) {
                foreach ($rows as $row) {
                    if ($this->hasLiveLease($row)) {
                        $count++;
                    }
                }
            });
        return $count;
    }

    /** Whether $sentence holds a lease that still blocks a new claim. */
    private function hasLiveLease(Sentence $sentence): bool
    {
        $lease = $this->readLease($sentence);
        if ($lease === null) {
            return false;
        }

        $leaseAt = $lease['lease_at'] ?? null;
        $leaseBy = (string) ($lease['lease_by'] ?? '');
        if (!is_numeric($leaseAt)) {
            return false;
        }

        $ageMinutes = (time() - (int) $leaseAt) / 60.0;
        $window = str_starts_with($leaseBy, self::ASSIST_WORKER_PREFIX)
            ? self::ASSIST_LEASE_MINUTES
            : self::LOCK_STALE_MINUTES;

        return $ageMinutes < $window;
    }

    /** @return array{lease_at:int,lease_by:string}|null */
    private function readLease(Sentence $sentence): ?array
    {
        $metadata = $sentence->metadata;
        if (!is_array($metadata) || !isset($metadata[self::LEASE_KEY]) || !is_array($metadata[self::LEASE_KEY])) {
            return null;
        }
        return $metadata[self::LEASE_KEY];
    }

    /** Write/refresh the lease into JSON metadata and persist. */
    private function writeLease(Sentence $sentence, string $workerId): void
    {
        $metadata = is_array($sentence->metadata) ? $sentence->metadata : [];
        $metadata[self::LEASE_KEY] = [
            'lease_at' => time(),
            'lease_by' => mb_substr($workerId, 0, 64),
        ];
        $sentence->metadata = $metadata;
        $sentence->save();
    }

    /** Drop the lease from JSON metadata (in-memory; caller saves). */
    private function clearLease(Sentence $sentence): void
    {
        $metadata = is_array($sentence->metadata) ? $sentence->metadata : [];
        if (isset($metadata[self::LEASE_KEY])) {
            unset($metadata[self::LEASE_KEY]);
            $sentence->metadata = $metadata;
        }
    }

    /** Stamp the last error into metadata (in-memory; caller saves). */
    private function recordError(Sentence $sentence, string $error): void
    {
        $metadata = is_array($sentence->metadata) ? $sentence->metadata : [];
        $metadata['audio_error'] = mb_substr($error, 0, 2000);
        $metadata['audio_error_at'] = now()->toIso8601String();
        $sentence->metadata = $metadata;
    }

    /** Stamp the generating provider into metadata (in-memory; caller saves). */
    private function recordProvider(Sentence $sentence, string $provider): void
    {
        $metadata = is_array($sentence->metadata) ? $sentence->metadata : [];
        $metadata['audio_provider'] = mb_substr($provider, 0, 100);
        $metadata['audio_generated_at'] = now()->toIso8601String();
        unset($metadata['audio_error'], $metadata['audio_error_at']);
        $sentence->metadata = $metadata;
    }

    /** Absolute on-disk path for a "{language}/{hash}.ext" relative reference. */
    public function fullPathFor(string $relativePath): string
    {
        return PathMapper::getAppQyV1SentenceSoundsDir($relativePath);
    }
}
