<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsEngineConfigModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsVariantSpecModel;
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
    /**
     * Global-task fast-lane priority (global_tasks.priority lane only).
     * Sentence-table bumps do NOT use this constant: tts_priority is a
     * move-to-front ticket assigned by assignFrontTicket() (MAX+1).
     */
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

    /** Per-instance memo of the sentence engine profile (one DB read per request). */
    private ?array $sentenceEngineInfoCache = null;

    // ------------------------------------------------------------------
    // §6  Claim sentences needing audio (priority ordered)
    // ------------------------------------------------------------------

    /**
     * Claim up to $limit sentences missing one or more audio variants and not
     * currently leased, ordered by tts_priority DESC, occurrence_count DESC,
     * id ASC — across the requested language(s).
     *
     * Per-variant: a row is claimable when missingVariantsForRow() finds any
     * configured variant absent on disk - including rows that already have
     * has_audio=true (e.g. duoreader_tts present but uk_f absent). The initial
     * SQL filter only narrows the candidate set; the disk-stat in
     * missingVariantsForRow() makes the final decision.
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

        // Summary-only mode for the Queue Center "Sentence Audio" strip. The
        // `engine` block surfaces the qwen3tts-first sentence profile (preference
        // only; pycore GPU-gates the actual selection).
        if ($limit <= 0) {
            return [
                'count' => 0,
                'pending' => $pending,
                'leased' => $leased,
                'lock_stale_minutes' => self::LOCK_STALE_MINUTES,
                'engine' => $this->sentenceEngineInfo(),
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
            'engine' => $this->sentenceEngineInfo(),
            'tasks' => $tasks,
        ];
    }

    /**
     * Declared sentence-audio engine profile carried on claim tasks / assist
     * requests and surfaced by the Queue Center. qwen3tts-first (GPU) with a
     * fallback chain. This is a PREFERENCE only — laravel never runs models;
     * pycore's tts_orchestrator resolves the actual engine and is GPU-gated, so
     * it falls back down the chain when qwen3tts is unavailable. Derived from the
     * DB-driven engine config so an operator-disabled qwen3tts is honored.
     *
     * @return array{profile:string,primary:string,chain:array<int,string>,gpu_gated:bool}
     */
    public function sentenceEngineInfo(): array
    {
        if ($this->sentenceEngineInfoCache === null) {
            $chain = AppQyV1TtsEngineConfigModel::sentenceEngineChain();
            $this->sentenceEngineInfoCache = [
                'profile' => AppQyV1TtsEngineConfigModel::SENTENCE_PROFILE,
                'primary' => $chain[0] ?? AppQyV1TtsEngineConfigModel::SENTENCE_PRIMARY_DEFAULT,
                'chain' => $chain,
                'gpu_gated' => true,
            ];
        }
        return $this->sentenceEngineInfoCache;
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

        $cutoff = now()->subMinutes((int) ceil($window));
        $model = LangSentence::for($lang);
        $candidateLimit = min(250, max($limit * 8, $limit));

        return $model->getConnection()->transaction(function () use ($lang, $workerId, $cutoff, $limit, $candidateLimit) {
            $rows = LangSentence::onLang($lang)
                ->where(function ($q) use ($cutoff) {
                    $q->whereNull('tts_locked_at')
                        ->orWhere('tts_locked_at', '<', $cutoff);
                })
                ->where(function ($q) {
                    // Per-variant claim: candidates are explicitly pending/failed
                    // OR any row whose variant completeness is not yet reconciled.
                    // A row with has_audio=true + tts_status='completed' may still
                    // miss a non-primary variant (e.g. duoreader_tts present, uk_f
                    // absent) - reconcilePartialRow + missingVariantsForRow make
                    // the final per-variant decision after the disk stat. Bounded
                    // by $candidateLimit; reconciled rows flip to 'pending' so the
                    // completed-branch is drained once per row.
                    $q->where('has_audio', false)
                        ->orWhereIn('tts_status', ['pending', 'failed'])
                        ->orWhere(function ($q2) {
                            $q2->where('has_audio', true)
                                ->where('tts_status', 'completed');
                        });
                })
                ->orderByDesc('tts_priority')
                ->orderByDesc('occurrence_count')
                ->orderBy('id')
                ->limit($candidateLimit)
                ->lockForUpdate()
                ->get();

            $tasks = [];
            foreach ($rows as $row) {
                if (count($tasks) >= $limit) {
                    break;
                }
                $this->reconcilePartialRow($row, $lang);
                $missing = $this->missingVariantsForRow($lang, $row);
                if ($missing === []) {
                    continue;
                }

                $row->tts_locked_at = now();
                $row->tts_locked_by = mb_substr($workerId, 0, 100);
                $row->tts_status = 'processing';
                $row->save();

                $tasks[] = $this->buildTask($lang, $row, $missing);
            }
            return $tasks;
        }, 1);
    }

    /**
     * Variant specs still missing on disk for one sentence row.
     *
     * @return array<int,array{key:string,accent:?string,gender:string}>
     */
    public function missingVariantsForRow(string $lang, LangSentence $sentence): array
    {
        $missing = [];
        foreach ($this->variantsForLanguage($lang) as $spec) {
            $key = (string) ($spec['key'] ?? '');
            if ($this->variantExistsOnDisk($lang, (string) $sentence->content_id, $key === '' ? null : $key)) {
                continue;
            }
            $missing[] = $spec;
        }
        return $missing;
    }

    /** True when any configured variant is absent on disk. */
    public function rowNeedsAudioWork(string $lang, LangSentence $sentence): bool
    {
        return $this->missingVariantsForRow($lang, $sentence) !== [];
    }

    /** Align tts_status with per-variant completeness (handles legacy completed rows). */
    private function reconcilePartialRow(LangSentence $sentence, string $lang): void
    {
        $missing = $this->missingVariantsForRow($lang, $sentence);
        if ($missing === []) {
            if ($sentence->tts_status !== 'completed') {
                $sentence->tts_status = 'completed';
                $sentence->save();
            }
            return;
        }
        if ($sentence->tts_status === 'completed') {
            $sentence->tts_status = 'pending';
            $sentence->save();
        }
    }

    /** Build the §6 task descriptor for one claimed sentence. */
    private function buildTask(string $lang, LangSentence $sentence, ?array $variants = null): array
    {
        $contentId = (string) $sentence->content_id;
        $variantList = $variants ?? $this->missingVariantsForRow($lang, $sentence);
        if ($variantList === []) {
            $variantList = $this->variantsForLanguage($lang);
        }

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
            // Engine PREFERENCE for this lane: qwen3tts-first (GPU). pycore's
            // orchestrator uses the "sentence" priority_profile and GPU-gates the
            // real choice — this label never forces the engine. Memoized so a
            // 50-task batch reads the engine config once.
            'engine_profile' => $this->sentenceEngineInfo()['profile'],
            'preferred_engine' => $this->sentenceEngineInfo()['primary'],
            // Only the MISSING variants are handed out (file-first / cache-aware):
            // a variant whose {lang}/{content_id}[_{key}].mp3 exists is never
            // re-requested, matching pycore's per-variant sentence cache.
            'variants' => $variantList,
        ];
    }

    /**
     * TTS variant specs the pycore worker should synthesize per language.
     * DB-driven via app_qy_v1_tts_variant_specs (seeded at sys:init); falls back
     * to the hardcoded spec set when the table is missing/empty. Identical return
     * shape across sentence + word audio (single read path on the model).
     *
     * @return array<int,array{key:string,accent:?string,gender:string}>
     */
    public function variantsForLanguage(string $lang): array
    {
        return AppQyV1TtsVariantSpecModel::variantsForLanguage($lang);
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
        ?string $variantKey = null,
        ?array $variantMeta = null
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

        if ($this->variantExistsOnDisk($language, $contentId, null)) {
            $sentence->has_audio = true;
        }
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
        $entryMeta = is_array($variantMeta) ? $variantMeta : [];
        AppQyV1SentenceAudioFiles::upsert($sentence, array_merge([
            'variant_key' => $variantKey ?? '',
            'path' => $relativePath,
            'has_file' => true,
            'provider' => $provider ?: ('worker:' . $workerId),
            'uploaded_at' => now()->toIso8601String(),
        ], $entryMeta));
        $this->recordProvider($sentence, $provider ?: ('worker:' . $workerId));
        $this->clearLease($sentence);
        if ($this->missingVariantsForRow($language, $sentence) === []) {
            $sentence->tts_status = 'completed';
            $sentence->tts_completed_at = now();
        } else {
            $sentence->tts_status = 'pending';
        }
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
     * Optional $variantKey resolves a specific suffixed path
     * ({lang}/{content_id}_{variant_key}.mp3); optional $accent resolves the
     * first on-disk variant whose spec matches that accent (us/uk/...), falling
     * back to the extension-preference scan when no variant matches. The
     * audio_files list is always returned for the FE accent picker.
     *
     * @return array<string,mixed> the JSON body
     */
    public function resolve(?string $hash, ?string $text, ?string $language, ?string $variantKey = null, ?string $accent = null): array
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
        $audioFilesPayload = $sentence
            ? $this->formatAudioFilesForApi($sentence)
            : [];

        $vkey = ($variantKey !== null && trim($variantKey) !== '') ? trim($variantKey) : null;
        if ($vkey !== null && $this->variantExistsOnDisk($resolvedLang, $resolvedHash, $vkey)) {
            $relative = $this->relativePathFor($resolvedLang, $resolvedHash, $vkey);
            return [
                'success' => true,
                'exists' => true,
                'url' => AppQyV1SentenceAudioUrl::forRelative($relative),
                'hash' => $resolvedHash,
                'content_id' => $resolvedHash,
                'language' => $resolvedLang,
                'variant_key' => $vkey,
                'tts_status' => $sentence?->tts_status,
                'audio_files' => $audioFilesPayload,
            ];
        }

        // Accent filter: resolve the first on-disk variant whose spec matches
        // the requested accent (us/uk/...). Falls through to the extension
        // preference scan below when no variant matches the accent.
        $accentNorm = ($accent !== null && trim($accent) !== '') ? strtolower(trim($accent)) : null;
        if ($vkey === null && $accentNorm !== null) {
            foreach ($this->variantsForLanguage($resolvedLang) as $spec) {
                $specAccent = isset($spec['accent']) ? strtolower((string) $spec['accent']) : '';
                if ($specAccent !== $accentNorm) {
                    continue;
                }
                $specKey = (string) ($spec['key'] ?? '');
                $specKeyForDisk = $specKey !== '' ? $specKey : null;
                if ($this->variantExistsOnDisk($resolvedLang, $resolvedHash, $specKeyForDisk)) {
                    $relative = $this->relativePathFor($resolvedLang, $resolvedHash, $specKeyForDisk);
                    return [
                        'success' => true,
                        'exists' => true,
                        'url' => AppQyV1SentenceAudioUrl::forRelative($relative),
                        'hash' => $resolvedHash,
                        'content_id' => $resolvedHash,
                        'language' => $resolvedLang,
                        'variant_key' => $specKey,
                        'accent' => $spec['accent'],
                        'tts_status' => $sentence?->tts_status,
                        'audio_files' => $audioFilesPayload,
                    ];
                }
            }
        }

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
                'tts_status' => $sentence?->tts_status ?? 'completed',
                'audio_files' => $audioFilesPayload,
            ];
        }

        // Missing on disk: ensure a LangSentence row exists so claim/bump can run.
        // Book-reader resolve always sends text+language; without text we cannot
        // create a row and must NOT pretend the sentence was queued.
        $textTrimmed = ($text !== null) ? trim($text) : '';
        if ($sentence === null && $textTrimmed !== '') {
            $sentence = $this->ensureSentenceRow($resolvedHash, $resolvedLang, $textTrimmed);
        }

        if ($sentence) {
            if ($sentence->has_audio || $sentence->audio !== null) {
                $sentence->has_audio = false;
                $sentence->audio = null;
                $sentence->save();
            }
            // Priority bump only — pycore tts_sentence_worker claims via tts_priority.
            // Skip GlobalTask here to avoid racing translation_worker sentence_audio.
            $this->bumpPriority($resolvedHash, $resolvedLang, false, true, $textTrimmed !== '' ? $textTrimmed : null);

            return [
                'success' => true,
                'exists' => false,
                'queued' => true,
                'hash' => $resolvedHash,
                'content_id' => $resolvedHash,
                'language' => $resolvedLang,
                'tts_status' => $sentence->tts_status,
                'audio_files' => $audioFilesPayload,
            ];
        }

        return [
            'success' => true,
            'exists' => false,
            'queued' => false,
            'error' => 'sentence_not_ingested',
            'hash' => $resolvedHash,
            'content_id' => $resolvedHash,
            'language' => $resolvedLang,
        ];
    }

    /**
     * Raise a sentence's audio priority (book-reader / manual retry) with a
     * move-to-front ticket: the row gets tts_priority = MAX(tts_priority)+1 on
     * its language table, so the newest bump sorts strictly ahead of everything
     * while the relative order of unbumped rows is preserved (see
     * assignFrontTicket). Optionally creates a deduped interactive global_task
     * so the fast lane can claim it. After the DB write succeeds, a
     * `sentence.priority` event carrying the REAL ticket is appended to the SSE
     * outbox so pycore wakes immediately ($emitEvent=false defers that to a
     * batch caller emitting ONE aggregate event instead of N singles).
     *
     * @return array{ok:bool,tts_priority?:int,task_id?:string,error?:string}
     */
    public function bumpPriority(
        string $contentId,
        string $language,
        bool $createTask = true,
        bool $interactive = true,
        ?string $text = null,
        bool $emitEvent = true
    ): array {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        if ($language === '' || !$this->tableExists($language)) {
            return ['ok' => false, 'error' => 'Unknown or missing language'];
        }
        $sentence = LangSentence::onLang($language)->where('content_id', $contentId)->first();
        if (!$sentence) {
            $textTrimmed = ($text !== null) ? trim($text) : '';
            if ($textTrimmed !== '') {
                $sentence = $this->ensureSentenceRow($contentId, $language, $textTrimmed);
            }
        }
        if (!$sentence) {
            return ['ok' => false, 'error' => 'Sentence not found'];
        }
        $this->reconcilePartialRow($sentence, $language);
        if (!$this->rowNeedsAudioWork($language, $sentence)) {
            return ['ok' => true, 'tts_priority' => (int) ($sentence->tts_priority ?? 0), 'already_done' => true];
        }

        $sentence->tts_requested_at = now();
        if ($sentence->tts_status !== 'processing') {
            $sentence->tts_status = 'pending';
        }
        $ticket = $this->assignFrontTicket($sentence, $language);

        if ($emitEvent) {
            $this->emitPriorityEvent([
                'content_id' => $contentId,
                'language' => $language,
                'priority' => $ticket,
                'text' => (string) $sentence->text,
            ]);
        }

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
                            // Engine preference carried to the sentence_audio assist
                            // worker: qwen3tts-first (GPU), pycore GPU-gated fallback.
                            'engine_profile' => $this->sentenceEngineInfo()['profile'],
                            'preferred_engine' => $this->sentenceEngineInfo()['primary'],
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
            'tts_priority' => $ticket,
            'task_id' => $taskId,
        ];
    }

    /**
     * Batch high-priority bump for the now-visible book-reader page (chapter
     * switch). Each item is {text, language}; the content_id is derived from the
     * text (MediaIngestService::computeContentId), rows are created on demand, and
     * each row gets a move-to-front ticket (MAX+1 via bumpPriority) so the next
     * pycore /sentence/claim (ordered tts_priority DESC) serves these sentences
     * first — qwen3tts-first per the engine profile. No per-item GlobalTask is
     * created (createTask=false): the priority-ordered claim already fronts them,
     * and N fast tasks would be heavy. Per-item SSE events are suppressed; ONE
     * aggregate `sentence.priority` event ({batch:true,count,languages}) is
     * emitted after the loop so a page bump of hundreds of sentences does not
     * flood the outbox.
     *
     * @param array<int,array{text?:string,language?:string}> $items
     * @return array{ok:bool,queued:int,total:int}
     */
    public function bumpPriorityBatch(array $items, bool $interactive = true): array
    {
        $queued = 0;
        $total = 0;
        // Dedup by language:content_id so a repeated sentence bumps once.
        $seen = [];
        $bumpedLanguages = [];
        foreach ($items as $item) {
            $text = isset($item['text']) ? trim((string) $item['text']) : '';
            $language = isset($item['language']) ? (string) $item['language'] : '';
            if ($text === '' || $language === '') {
                continue;
            }
            $contentId = MediaIngestService::computeContentId($text);
            $dedupKey = $language . ':' . $contentId;
            if (isset($seen[$dedupKey])) {
                continue;
            }
            $seen[$dedupKey] = true;
            $total++;
            try {
                $result = $this->bumpPriority($contentId, $language, false, $interactive, $text, false);
                if (($result['ok'] ?? false) === true && !($result['already_done'] ?? false)) {
                    $queued++;
                    $bumpedLanguages[$language] = true;
                }
            } catch (\Throwable $e) {
                Log::warning('[SentenceAudio] batch bump item failed', [
                    'language' => $language,
                    'error' => $e->getMessage(),
                ]);
            }
        }
        if ($queued > 0) {
            $this->emitPriorityEvent([
                'batch' => true,
                'count' => $queued,
                'languages' => array_keys($bumpedLanguages),
            ]);
        }
        return ['ok' => true, 'queued' => $queued, 'total' => $total];
    }

    /**
     * Move-to-front ticket: atomically raise the sentence's tts_priority to
     * MAX(tts_priority)+1 on its language table, so the newest bump sorts
     * strictly ahead of every existing row while the relative order of all
     * unbumped rows is preserved (the claim ordering needs no change). The
     * MAX read is taken FOR UPDATE inside a transaction so two concurrent
     * bumps cannot be assigned the same ticket; any attributes the caller
     * already set on $sentence (tts_requested_at / tts_status) are persisted
     * by the same save. Returns the assigned ticket.
     */
    private function assignFrontTicket(LangSentence $sentence, string $lang): int
    {
        return $sentence->getConnection()->transaction(function () use ($sentence) {
            $sentence->save();
            $table = $sentence->getTable();
            $id = $sentence->id;
            $sentence->getConnection()->statement(
                "UPDATE {$table} SET tts_priority = (SELECT m FROM (SELECT COALESCE(MAX(tts_priority), 0) + 1 AS m FROM {$table}) x) WHERE id = ?",
                [$id]
            );
            $sentence->refresh();
            return (int) $sentence->tts_priority;
        });
    }

    /**
     * Append a `sentence.priority` event to the SSE outbox. Fully best-effort:
     * any failure is swallowed so event emission can never break the bump flow.
     *
     * @param array<string,mixed> $payload
     */
    private function emitPriorityEvent(array $payload): void
    {
        try {
            AppQyV1TranslationEventModel::emit('sentence.priority', $payload);
        } catch (\Throwable $e) {
            Log::warning('[SentenceAudio] sentence.priority emit failed', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Paginated list of sentences missing audio (task-center / queue UI).
     *
     * ``summary`` gives pycore's poller enough detail to explain an empty page:
     * per-language SQL pending counts plus how many candidate rows were dropped
     * because their audio files already exist on disk (stale flags reconciled).
     *
     * @return array{total:int,page:int,per_page:int,items:array<int,array<string,mixed>>,summary:array{languages:array<string,int>,reconciled:int}}
     */
    public function listMissing(?string $language, int $page, int $perPage): array
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $items = [];
        $total = 0;
        $langTotals = [];
        $reconciled = 0;

        foreach ($this->languagesFor($language) as $lang) {
            if (!$this->tableExists($lang)) {
                continue;
            }
            $langTotal = $this->pendingCountForLanguage($lang);
            $langTotals[$lang] = $langTotal;
            $total += $langTotal;
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
            $langTotal = $this->pendingCountForLanguage($lang);
            if ($skip >= $langTotal) {
                $skip -= $langTotal;
                continue;
            }
            $rows = LangSentence::onLang($lang)
                ->where(function ($q) {
                    $q->where('has_audio', false)
                        ->orWhereIn('tts_status', ['pending', 'failed']);
                })
                ->orderByDesc('tts_priority')
                ->orderByDesc('occurrence_count')
                ->orderBy('id')
                ->skip($skip)
                ->take($remaining * 4)
                ->get(['content_id', 'text', 'language', 'tts_priority', 'tts_status', 'tts_locked_by', 'occurrence_count', 'has_audio', 'audio_files']);
            $skip = 0;
            foreach ($rows as $row) {
                if ($remaining <= 0) {
                    break;
                }
                $this->reconcilePartialRow($row, $lang);
                if (!$this->rowNeedsAudioWork($lang, $row)) {
                    $reconciled++;
                    continue;
                }
                $missing = $this->missingVariantsForRow($lang, $row);
                $items[] = [
                    'content_id' => (string) $row->content_id,
                    'text' => (string) $row->text,
                    'language' => $lang,
                    'tts_priority' => (int) ($row->tts_priority ?? 0),
                    'tts_status' => (string) ($row->tts_status ?? 'pending'),
                    'tts_locked_by' => $row->tts_locked_by,
                    'occurrence_count' => (int) ($row->occurrence_count ?? 0),
                    'missing_variants' => array_map(fn ($v) => $v['key'] ?? '', $missing),
                ];
                $remaining--;
            }
        }

        return [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'items' => $items,
            'summary' => [
                'languages' => $langTotals,
                'reconciled' => $reconciled,
            ],
        ];
    }

    /** @return array<int,array<string,mixed>> */
    private function formatAudioFilesForApi(LangSentence $sentence): array
    {
        $rows = AppQyV1SentenceAudioFiles::list($sentence);
        $out = [];
        foreach ($rows as $row) {
            $path = is_string($row['path'] ?? null) ? $row['path'] : '';
            $out[] = [
                'variant_key' => $row['variant_key'] ?? '',
                'accent' => $row['accent'] ?? null,
                'gender' => $row['gender'] ?? null,
                'source' => $row['source'] ?? null,
                'voice_type' => $row['voice_type'] ?? null,
                'provider' => $row['provider'] ?? null,
                'path' => $path,
                'has_file' => (bool) ($row['has_file'] ?? false),
                'url' => $path !== '' ? AppQyV1SentenceAudioUrl::forRelative($path) : null,
            ];
        }
        return $out;
    }

    /** Relative audio path for a content_id + optional variant suffix. */
    public function relativePathFor(string $language, string $contentId, ?string $variantKey = null): string
    {
        $suffix = ($variantKey !== null && $variantKey !== '') ? ('_' . $variantKey) : '';
        return $language . '/' . $contentId . $suffix . '.mp3';
    }

    /** True when the variant mp3 already exists on disk. */
    public function variantExistsOnDisk(string $language, string $contentId, ?string $variantKey = null): bool
    {
        $relative = $this->relativePathFor($language, $contentId, $variantKey);
        $full = PathMapper::getAppQyV1SentenceSoundsDir($relative);
        clearstatcache(true, $full);
        return is_file($full) && filesize($full) > 0;
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

    /**
     * Insert or refresh a LangSentence row for book-reader / interactive resolve.
     * Mirrors MediaIngestService::upsertLangSentence fill-missing semantics so
     * pycore tts_sentence_worker can claim the row on the next poll.
     */
    private function ensureSentenceRow(string $contentId, string $language, string $text): ?LangSentence
    {
        if (!$this->tableExists($language)) {
            return null;
        }

        $existing = LangSentence::onLang($language)->where('content_id', $contentId)->first();
        if ($existing) {
            $existing->occurrence_count = (int) ($existing->occurrence_count ?? 0) + 1;
            if ($this->isEmptyValue($existing->getAttribute('text'))) {
                $existing->text = $text;
            }
            $existing->save();
            return $existing;
        }

        $model = LangSentence::for($language);
        $model->fill([
            'content_id' => $contentId,
            'sentence_id' => MediaIngestService::computeSentenceId($text, $language),
            'corr_id' => 'reader|' . $contentId,
            'text' => $text,
            'language' => $language,
            'occurrence_count' => 1,
            'has_audio' => false,
            'tts_priority' => self::PRIORITY_DEFAULT,
            'tts_status' => 'pending',
        ]);
        $model->save();

        Log::info('[SentenceAudio] Ensured sentence row for reader resolve', [
            'content_id' => $contentId,
            'language' => $language,
        ]);

        return $model;
    }

    /** True when a stored anchor/text field is empty (fill-missing only). */
    private function isEmptyValue(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }
        if (is_string($value)) {
            return trim($value) === '';
        }
        return false;
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

    /** Sentences still needing one or more audio variants, optionally per-language. */
    public function pendingCount(?string $language = null): int
    {
        $total = 0;
        foreach ($this->languagesFor($language) as $lang) {
            if (!$this->tableExists($lang)) {
                continue;
            }
            $total += $this->pendingCountForLanguage($lang);
        }
        return $total;
    }

    private function pendingCountForLanguage(string $lang): int
    {
        return (int) LangSentence::onLang($lang)
            ->where(function ($q) {
                $q->where('has_audio', false)
                    ->orWhereIn('tts_status', ['pending', 'failed']);
            })
            ->count();
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
                ->where(function ($q) {
                    $q->where('has_audio', false)
                        ->orWhereIn('tts_status', ['pending', 'failed', 'processing']);
                })
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
