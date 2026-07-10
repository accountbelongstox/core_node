<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1SentenceAudioUrl;
use App\Models\LangSentence;
use App\Providers\PathMapper;
use App\Services\MediaIngestService;
use App\Utils\FileSystemManager;
use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use Illuminate\Support\Facades\Log;

/**
 * Sentence-library audio pipeline (laravel_main side of the Books v3 unified
 * model — see poly_apps/pycore_laravel_wordflow_ui/apps/wordnew/docs/BOOKS_FEATURE_SPECIFICATION.md §6).
 *
 * The FILE on disk is the source of truth, NOT the DB:
 *   <sentence_sounds>/<language>/<content_id>.mp3
 *   sentence_sounds = PathMapper::getAppQyV1SentenceSoundsDir()
 * The per-language sentence tables ({prefix}_sentences_{lang}) store only a
 * has_audio flag + audio cache to PREVENT DUPLICATE GENERATION; the resolve
 * route reconciles them from the filesystem and never trusts them over a stat().
 *
 * Sentences are keyed by content_id (md5) within their per-language table. The
 * lease lives in the dedicated tts_locked_at / tts_locked_by columns (a local
 * worker lease is stale after LOCK_STALE_MINUTES, an assist worker after
 * ASSIST_LEASE_MINUTES). Stale leases are taken over by the next claim.
 */
class AppQyV1SentenceAudioService
{
    /** User-facing / book-reader priority bump (mirrors word-media front). */
    public const PRIORITY_FRONT = 100;

    /** Default backfill priority when no explicit bump occurred. */
    public const PRIORITY_DEFAULT = 0;

    /** A local worker's processing lease is stale after this many minutes. */
    public const LOCK_STALE_MINUTES = 10;

    /** Assist-protocol leases (assist:* workers) stay live for 60 minutes. */
    public const ASSIST_LEASE_MINUTES = AppQyV1DictionaryTTSCoordinator::ASSIST_LEASE_MINUTES;

    /** Worker-id prefix marking an assist-protocol claim (longer lease). */
    public const ASSIST_WORKER_PREFIX = AppQyV1DictionaryTTSCoordinator::ASSIST_WORKER_PREFIX;

    /**
     * Extension preference for resolving an existing on-disk audio file.
     * .mp3 is the canonical write target; the rest are accepted on read.
     */
    public const AUDIO_EXTENSIONS = ['mp3', 'aac', 'm4a', 'wav'];

    // ------------------------------------------------------------------
    // §6  Claim sentences needing audio (priority ordered)
    // ------------------------------------------------------------------

    /**
     * Claim up to $limit sentences whose audio is missing (has_audio=false) and
     * which are not currently leased, ordered by tts_priority DESC,
     * occurrence_count DESC, id ASC — across the requested language(s).
     *
     * When $language is null the claim sweeps EVERY supported per-language
     * table. When $limit <= 0 the method returns counts only (FE summary),
     * leasing nothing.
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
        $window = $isAssist ? self::ASSIST_LEASE_MINUTES : self::LOCK_STALE_MINUTES;

        $tasks = [];
        foreach ($this->languagesFor($language) as $lang) {
            if (count($tasks) >= $limit) {
                break;
            }
            $remaining = $limit - count($tasks);
            $claimed = $this->claimForLanguage($lang, $workerId, $window, $remaining);
            foreach ($claimed as $task) {
                $task['task_id'] = count($tasks);
                $tasks[] = $task;
            }
        }

        return [
            'count' => count($tasks),
            'pending' => $pending,
            'leased' => $leased,
            'lock_stale_minutes' => self::LOCK_STALE_MINUTES,
            'tasks' => $tasks,
        ];
    }

    /**
     * Claim up to $limit rows for ONE language table under a transaction +
     * row lock, taking over stale leases. Returns the built task descriptors.
     *
     * @return array<int,array<string,mixed>>
     */
    private function claimForLanguage(string $lang, string $workerId, float $window, int $limit): array
    {
        if ($limit <= 0 || !$this->tableExists($lang)) {
            return [];
        }

        $now = time();
        $cutoff = now()->subMinutes((int) ceil($window));
        $model = LangSentence::for($lang);

        return $model->getConnection()->transaction(function () use ($lang, $model, $workerId, $cutoff, $limit) {
            $rows = LangSentence::onLang($lang)
                ->where('has_audio', false)
                // Not under a LIVE lease: never locked, OR the lease is stale.
                ->where(function ($q) use ($cutoff) {
                    $q->whereNull('tts_locked_at')
                        ->orWhere('tts_locked_at', '<', $cutoff);
                })
                ->orderByDesc('tts_priority')
                ->orderByDesc('occurrence_count')
                ->orderBy('id')
                ->limit($limit)
                ->lockForUpdate()
                ->get();

            $tasks = [];
            foreach ($rows as $row) {
                $row->tts_locked_at = now();
                $row->tts_locked_by = mb_substr($workerId, 0, 100);
                $row->tts_status = 'processing';
                $row->save();

                $tasks[] = $this->buildTask($lang, $row);
            }
            return $tasks;
        }, 1);
    }

    /** Build the §6 task descriptor for one claimed sentence. */
    private function buildTask(string $lang, LangSentence $sentence): array
    {
        $contentId = (string) $sentence->content_id;

        return [
            'task_id' => 0,
            'type' => 'sentence',
            // content_id is the canonical key; sentence_id kept for compat.
            'content_id' => $contentId,
            'sentence_id' => $sentence->sentence_id !== null ? (string) $sentence->sentence_id : null,
            'content' => (string) $sentence->text,
            'language' => $lang,
            'audio_relative_path' => $lang . '/' . $contentId . '.mp3',
            'priority' => max(0, (int) ($sentence->tts_priority ?? 0)),
            'variants' => $this->variantsForLanguage($lang),
        ];
    }

    /**
     * TTS variant specs the pycore worker should synthesize per language.
     * English: US female (primary), UK female, US male. Others: one voice.
     *
     * @return array<int,array{key:string,accent:?string,gender:string}>
     */
    public function variantsForLanguage(string $lang): array
    {
        $lang = AppQyV1TableMaps::normalizeLangCode($lang);
        if ($lang === 'en') {
            return [
                ['key' => '', 'accent' => 'us', 'gender' => 'female'],
                ['key' => 'uk_f', 'accent' => 'uk', 'gender' => 'female'],
                ['key' => 'us_m', 'accent' => 'us', 'gender' => 'male'],
            ];
        }
        return [
            ['key' => '', 'accent' => null, 'gender' => 'female'],
        ];
    }

    // ------------------------------------------------------------------
    // §6  Report a generated sentence audio (validated, idempotent)
    // ------------------------------------------------------------------

    /**
     * Ingest one worker-reported sentence audio result, keyed by content_id +
     * language against {prefix}_sentences_{lang}.
     *
     * Success: validate the MP3, write it to the deterministic §6 path, set
     * has_audio=true + audio="{lang}/{content_id}.mp3" + tts_status=completed,
     * clear the lease. Idempotent — a file already on disk acks already_done and
     * is never clobbered.
     *
     * Failure: record the error, clear the lease so the sentence is re-claimable.
     *
     * @return array{ok:bool,status:string,already_done?:bool,error?:string,http_status:int}
     */
    public function report(
        string $contentId,
        string $language,
        string $workerId,
        bool $success,
        ?string $audioBinary,
        ?string $provider,
        ?string $error,
        ?string $variantKey = null
    ): array {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        if ($language === '' || !$this->tableExists($language)) {
            return ['ok' => false, 'status' => 'not_found', 'error' => 'Unknown or missing language', 'http_status' => 422];
        }

        $sentence = LangSentence::onLang($language)->where('content_id', $contentId)->first();
        if (!$sentence) {
            return ['ok' => false, 'status' => 'not_found', 'error' => 'Sentence not found', 'http_status' => 404];
        }

        $relativePath = $this->relativePathFor($language, $contentId, $variantKey);
        $fullPath = PathMapper::getAppQyV1SentenceSoundsDir($relativePath);

        // --- Failure path: clear the lease, record the error, re-queueable ---
        if (!$success) {
            $this->recordError($sentence, $error ?: 'Worker reported failure');
            $this->clearLease($sentence);
            $sentence->tts_status = 'failed';
            $sentence->tts_attempts = (int) $sentence->tts_attempts + 1;
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
            $sentence->tts_status = 'failed';
            $sentence->save();
            return ['ok' => false, 'status' => 'invalid', 'error' => 'Audio payload empty or too small (<100 bytes)', 'http_status' => 422];
        }
        if (!AppQyV1DictionaryTTSCoordinator::looksLikeMp3($audioBinary)) {
            $this->recordError($sentence, 'Rejected: payload is not a valid MP3');
            $this->clearLease($sentence);
            $sentence->tts_status = 'failed';
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
        if ($variantKey === null || $variantKey === '') {
            $sentence->audio = $relativePath;
        } else {
            $metadata = is_array($sentence->metadata) ? $sentence->metadata : [];
            $variants = is_array($metadata['audio_variants'] ?? null) ? $metadata['audio_variants'] : [];
            $variants[$variantKey] = $relativePath;
            $metadata['audio_variants'] = $variants;
            $sentence->metadata = $metadata;
            if (!$sentence->audio) {
                $sentence->audio = $this->relativePathFor($language, $contentId, null);
            }
        }
        $sentence->tts_status = 'completed';
        $sentence->tts_completed_at = now();
        $this->recordProvider($sentence, $provider ?: ('worker:' . $workerId));
        $this->clearLease($sentence);
        $sentence->save();

        Log::info('[SentenceAudio] Worker result accepted', [
            'content_id' => $contentId,
            'language' => $language,
            'worker' => $workerId,
            'bytes' => strlen($audioBinary),
            'path' => $relativePath,
        ]);

        return ['ok' => true, 'status' => 'completed', 'http_status' => 200];
    }

    // ------------------------------------------------------------------
    // §6  Resolve / play one sentence's audio (file-first)
    // ------------------------------------------------------------------

    /**
     * Resolve a single sentence's audio FROM THE content_id, file-first.
     * Accepts a content_id (md5) hash, or text+language to hash server-side.
     * Existence is decided by stat-ing the filesystem directly — the DB is read
     * only to reconcile the cache.
     *
     * @return array<string,mixed> the JSON body
     */
    public function resolve(?string $hash, ?string $text, ?string $language): array
    {
        $resolvedLang = ($language !== null && trim($language) !== '')
            ? AppQyV1TableMaps::normalizeLangCode($language)
            : null;

        // Derive the content_id when only text was supplied (language-agnostic).
        $resolvedHash = ($hash !== null && $hash !== '') ? $hash : null;
        if ($resolvedHash === null && $text !== null && $text !== '') {
            $resolvedHash = MediaIngestService::computeContentId($text);
        }

        if ($resolvedHash === null || $resolvedHash === '' || $resolvedLang === null || $resolvedLang === '') {
            return ['success' => false, 'exists' => false, 'error' => 'Provide hash (content_id) or text, plus language', 'hash' => $resolvedHash];
        }

        $sentence = $this->locate($resolvedHash, $resolvedLang);

        // FILE-FIRST: stat the disk, honoring the extension preference order.
        $found = $this->findOnDisk($resolvedLang, $resolvedHash);

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
                'hash' => $resolvedHash,
                'content_id' => $resolvedHash,
                'language' => $resolvedLang,
            ];
        }

        // Missing on disk: mark the cache false and bump priority so workers pick it up.
        if ($sentence) {
            if ($sentence->has_audio || $sentence->audio !== null) {
                $sentence->has_audio = false;
                $sentence->audio = null;
                $sentence->save();
            }
            $this->bumpPriority($resolvedHash, $resolvedLang, true, true);
        }

        return [
            'success' => true,
            'exists' => false,
            'queued' => true,
            'hash' => $resolvedHash,
            'content_id' => $resolvedHash,
            'language' => $resolvedLang,
        ];
    }

    /**
     * Raise a sentence's audio priority (book-reader / manual retry). Optionally
     * creates a deduped interactive global_task so the fast lane can claim it.
     *
     * @return array{ok:bool,tts_priority?:int,task_id?:string,error?:string}
     */
    public function bumpPriority(
        string $contentId,
        string $language,
        bool $createTask = true,
        bool $interactive = true
    ): array {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        if ($language === '' || !$this->tableExists($language)) {
            return ['ok' => false, 'error' => 'Unknown or missing language'];
        }
        $sentence = LangSentence::onLang($language)->where('content_id', $contentId)->first();
        if (!$sentence) {
            return ['ok' => false, 'error' => 'Sentence not found'];
        }
        if ($sentence->has_audio) {
            return ['ok' => true, 'tts_priority' => (int) ($sentence->tts_priority ?? 0), 'already_done' => true];
        }

        $sentence->tts_priority = self::PRIORITY_FRONT;
        $sentence->tts_requested_at = now();
        if ($sentence->tts_status !== 'processing') {
            $sentence->tts_status = 'pending';
        }
        $sentence->save();

        $taskId = null;
        if ($createTask) {
            try {
                $existing = GlobalTask::query()
                    ->where('app_name', 'AppQyV1')
                    ->where('task_type', 'sentence_audio')
                    ->whereIn('status', ['pending', 'processing'])
                    ->where('payload->content_id', $contentId)
                    ->where('payload->language', $language)
                    ->first();
                if ($existing) {
                    if ($interactive && !$existing->is_fast_tier) {
                        $existing->execution_type = GlobalTask::EXECUTION_REMOTE_FAST;
                        $existing->priority = max((int) $existing->priority, GlobalTask::PRIORITY_FAST);
                        $existing->is_fast_tier = true;
                        $existing->save();
                    }
                    $taskId = (string) $existing->task_id;
                } else {
                    /** @var TaskManagerService $taskManager */
                    $taskManager = app(TaskManagerService::class);
                    $task = $taskManager->createTask(
                        'AppQyV1',
                        'sentence_audio',
                        GlobalTask::EXECUTION_REMOTE_SENTENCE_AUDIO,
                        [
                            'content_id' => $contentId,
                            'language' => $language,
                            'content' => (string) $sentence->text,
                        ],
                        120,
                        self::PRIORITY_FRONT,
                        3,
                        $interactive,
                        GlobalTask::CAPABILITY_SENTENCE_AUDIO
                    );
                    $taskId = (string) $task->task_id;
                }
            } catch (\Throwable $e) {
                Log::warning('[SentenceAudio] bump task create failed', [
                    'content_id' => $contentId,
                    'language' => $language,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return [
            'ok' => true,
            'tts_priority' => self::PRIORITY_FRONT,
            'task_id' => $taskId,
        ];
    }

    /**
     * Paginated list of sentences missing audio (task-center / queue UI).
     *
     * @return array{total:int,page:int,per_page:int,items:array<int,array<string,mixed>>}
     */
    public function listMissing(?string $language, int $page, int $perPage): array
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $items = [];
        $total = 0;

        foreach ($this->languagesFor($language) as $lang) {
            if (!$this->tableExists($lang)) {
                continue;
            }
            $total += (int) LangSentence::onLang($lang)->where('has_audio', false)->count();
        }

        $skip = ($page - 1) * $perPage;
        $remaining = $perPage;

        foreach ($this->languagesFor($language) as $lang) {
            if ($remaining <= 0) {
                break;
            }
            if (!$this->tableExists($lang)) {
                continue;
            }
            $langTotal = (int) LangSentence::onLang($lang)->where('has_audio', false)->count();
            if ($skip >= $langTotal) {
                $skip -= $langTotal;
                continue;
            }
            $rows = LangSentence::onLang($lang)
                ->where('has_audio', false)
                ->orderByDesc('tts_priority')
                ->orderByDesc('occurrence_count')
                ->orderBy('id')
                ->skip($skip)
                ->take($remaining)
                ->get(['content_id', 'text', 'language', 'tts_priority', 'tts_status', 'tts_locked_by', 'occurrence_count']);
            $skip = 0;
            foreach ($rows as $row) {
                $items[] = [
                    'content_id' => (string) $row->content_id,
                    'text' => (string) $row->text,
                    'language' => $lang,
                    'tts_priority' => (int) ($row->tts_priority ?? 0),
                    'tts_status' => (string) ($row->tts_status ?? 'pending'),
                    'tts_locked_by' => $row->tts_locked_by,
                    'occurrence_count' => (int) ($row->occurrence_count ?? 0),
                ];
                $remaining--;
            }
        }

        return [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'items' => $items,
        ];
    }

    /** Relative audio path for a content_id + optional variant suffix. */
    public function relativePathFor(string $language, string $contentId, ?string $variantKey = null): string
    {
        $suffix = ($variantKey !== null && $variantKey !== '') ? ('_' . $variantKey) : '';
        return $language . '/' . $contentId . $suffix . '.mp3';
    }

    /**
     * Find an existing sentence-audio file on disk for a {language}/{content_id},
     * honoring AUDIO_EXTENSIONS preference order. Returns the relative reference
     * ("{language}/{content_id}.ext") and full path, or null when none exists.
     *
     * @return array{relative:string,full:string}|null
     */
    private function findOnDisk(string $language, string $contentId): ?array
    {
        foreach (self::AUDIO_EXTENSIONS as $ext) {
            $relative = $language . '/' . $contentId . '.' . $ext;
            $full = PathMapper::getAppQyV1SentenceSoundsDir($relative);
            clearstatcache(true, $full);
            if (is_file($full) && filesize($full) > 0) {
                return ['relative' => $relative, 'full' => $full];
            }
        }
        return null;
    }

    /**
     * Locate the sentence row for a resolve request by content_id in the
     * per-language table. Returns null when the language table is absent or the
     * row has not yet been ingested (a not-yet-ingested sentence can still be
     * probed file-first).
     */
    private function locate(string $contentId, string $language): ?LangSentence
    {
        if (!$this->tableExists($language)) {
            return null;
        }
        return LangSentence::onLang($language)->where('content_id', $contentId)->first();
    }

    /** Reconcile the cache for a sentence whose file is confirmed present. */
    private function reconcilePresent(LangSentence $sentence, string $relativePath): void
    {
        if (!$sentence->has_audio || $sentence->audio !== $relativePath) {
            $sentence->has_audio = true;
            $sentence->audio = $relativePath;
        }
        $sentence->tts_status = 'completed';
        if ($sentence->tts_completed_at === null) {
            $sentence->tts_completed_at = now();
        }
    }

    // ------------------------------------------------------------------
    // Counts (FE summary) + lease bookkeeping (tts_* columns)
    // ------------------------------------------------------------------

    /** Sentences still needing audio (has_audio=false), optionally per-language. */
    public function pendingCount(?string $language = null): int
    {
        $total = 0;
        foreach ($this->languagesFor($language) as $lang) {
            if (!$this->tableExists($lang)) {
                continue;
            }
            $total += (int) LangSentence::onLang($lang)->where('has_audio', false)->count();
        }
        return $total;
    }

    /**
     * Sentences currently under a LIVE audio lease (tts_locked_at younger than
     * the worker's window), optionally per-language.
     */
    public function leasedCount(?string $language = null): int
    {
        $localCutoff = now()->subMinutes((int) ceil(self::LOCK_STALE_MINUTES));
        $assistCutoff = now()->subMinutes((int) ceil(self::ASSIST_LEASE_MINUTES));

        $total = 0;
        foreach ($this->languagesFor($language) as $lang) {
            if (!$this->tableExists($lang)) {
                continue;
            }
            // A lease is live when: an assist owner locked it after assistCutoff,
            // OR any owner locked it after the (stricter) local cutoff.
            $total += (int) LangSentence::onLang($lang)
                ->where('has_audio', false)
                ->whereNotNull('tts_locked_at')
                ->where(function ($q) use ($localCutoff, $assistCutoff) {
                    $q->where('tts_locked_at', '>=', $localCutoff)
                        ->orWhere(function ($q2) use ($assistCutoff) {
                            $q2->where('tts_locked_at', '>=', $assistCutoff)
                                ->where('tts_locked_by', 'like', self::ASSIST_WORKER_PREFIX . '%');
                        });
                })
                ->count();
        }
        return $total;
    }

    /** Drop the lease columns (in-memory; caller saves). */
    private function clearLease(LangSentence $sentence): void
    {
        $sentence->tts_locked_at = null;
        $sentence->tts_locked_by = null;
    }

    /** Stamp the last error into metadata + tts_error (in-memory; caller saves). */
    private function recordError(LangSentence $sentence, string $error): void
    {
        $sentence->tts_error = mb_substr($error, 0, 2000);
        $metadata = is_array($sentence->metadata) ? $sentence->metadata : [];
        $metadata['audio_error'] = mb_substr($error, 0, 2000);
        $metadata['audio_error_at'] = now()->toIso8601String();
        $sentence->metadata = $metadata;
    }

    /** Stamp the generating provider into metadata (in-memory; caller saves). */
    private function recordProvider(LangSentence $sentence, string $provider): void
    {
        $sentence->tts_error = null;
        $metadata = is_array($sentence->metadata) ? $sentence->metadata : [];
        $metadata['audio_provider'] = mb_substr($provider, 0, 100);
        $metadata['audio_generated_at'] = now()->toIso8601String();
        unset($metadata['audio_error'], $metadata['audio_error_at']);
        $sentence->metadata = $metadata;
    }

    /** Absolute on-disk path for a "{language}/{content_id}.ext" relative reference. */
    public function fullPathFor(string $relativePath): string
    {
        return PathMapper::getAppQyV1SentenceSoundsDir($relativePath);
    }

    // ------------------------------------------------------------------
    // Per-language table helpers
    // ------------------------------------------------------------------

    /**
     * The language codes to operate on: a single requested language, or every
     * supported language when null/empty.
     *
     * @return array<int,string>
     */
    private function languagesFor(?string $language): array
    {
        if ($language !== null && trim($language) !== '') {
            return [AppQyV1TableMaps::normalizeLangCode($language)];
        }
        return AppQyV1TableMaps::getSupportedLanguages();
    }

    /** Whether the per-language sentence table for $lang exists. */
    private function tableExists(string $lang): bool
    {
        static $cache = [];
        $lang = AppQyV1TableMaps::normalizeLangCode($lang);
        if (array_key_exists($lang, $cache)) {
            return $cache[$lang];
        }
        $model = LangSentence::for($lang);
        $exists = $model->getConnection()
            ->getSchemaBuilder()
            ->hasTable($model->getTable());
        $cache[$lang] = $exists;
        return $exists;
    }
}
