<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1ImageUrl;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Models\GlobalTask;
use App\Providers\PathMapper;
use App\Services\TaskManagerService;
use App\Services\WordAudio\WordAudioClient;
use Illuminate\Support\Facades\Log;

/**
 * Word-media on-demand resolution + assist-queue prioritization.
 *
 * Single source of truth for the "resolve a word's media, enqueue what is
 * missing, and bump it to the front" behavior shared by the resolve endpoint
 * (GET /word/{lang}/{word}/media), the smart image-serve route, and the
 * on-query prioritization hooks (words/search, words/public, vocabulary library
 * words, the resolve endpoint itself).
 *
 * FILE-FIRST: image_url / audio_url are reported only when the file is on disk.
 * When media is missing the word becomes a 'word_media' global task (pulled via
 * the existing worker channel GET /api/worker/tasks/pull -> POST
 * /api/worker/tasks/result -> AppQyV1WordTranslationWriteback::apply) AND is
 * enqueued onto the per-language image and canonical TTS queues. A query bumps
 * every layer to the front.
 *
 * PRIORITY model:
 *   - global_tasks.priority (higher = sooner): PRIORITY_FRONT on bump.
 *   - dictionary image_priority: PRIORITY_FRONT on bump; dictionary
 *     tts_priority: move-to-front ticket (MAX+1) via the boost-priority endpoint.
 */
class AppQyV1WordMediaService
{
    /** word_media global_tasks.priority used when bumping a queried word. */
    const TASK_PRIORITY_FRONT = 100;

    /** Default word_media global_tasks.priority for a backfill enqueue. */
    const TASK_PRIORITY_DEFAULT = 30;

    /** Per-repeat escalation step for a word_media/word_audio task that is
     *  already at the front and gets requested again (visible-page re-request).
     *  Lets repeated/visible requests outrank one-shot page bumps (target #2)
     *  without unbounded growth. */
    const TASK_PRIORITY_REPEAT_STEP = 5;

    /** Ceiling for the repeat-escalation ladder. Stays under the hard 1000 cap
     *  in bumpTaskPriority; pending_urgent (count of priority >= 100) semantics
     *  are unchanged since every escalated task is already >= FRONT. */
    const TASK_PRIORITY_REPEAT_CAP = 500;

    /** Max words bundled into one word_media global task. */
    const MAX_WORDS_PER_TASK = 40;

    /** Max audio variants emitted per word in the API payload. */
    const MAX_AUDIO_VARIANTS = 20;

    /**
     * Legacy metadata keys inside the translations json that are NOT target
     * translations: the top-level 'word' holds the SOURCE headword, the rest are
     * dictionary metadata. Excluded from every translation scan so the headword
     * never leaks into translations[]. Mirrors
     * AppQyV1WordGroupWordController::TRANSLATION_META_KEYS.
     */
    const TRANSLATION_META_KEYS = [
        'word',
        'word_translation',
        'plural_form',
        'synonyms',
        'synonyms_type',
        'advanced_translate',
        'advanced_translate_type',
        'phonetic_symbol',
        'voice_files',
    ];

    protected TaskManagerService $taskManager;
    protected AppQyV1WordImageQueueService $imageQueue;
    protected WordAudioClient $wordAudioClient;

    public function __construct()
    {
        $this->taskManager = app(TaskManagerService::class);
        $this->imageQueue = new AppQyV1WordImageQueueService();
        $this->wordAudioClient = new WordAudioClient();
    }

    /**
     * Resolve a word's media file-first; enqueue + prioritize on any miss.
     *
     * @param string $word           The word text.
     * @param string $language       Source/library language (name or code).
     * @param string|null $targetLang Optional target language for translation.
     * @param bool $bumpFront         True for an active query (move-to-front).
     * @param bool $enqueueMissing    False for read-only aggregate queries.
     * @return array The contract data block:
     *   { word, md5, language, image_url|null, audio_url|null,
     *     image_status, audio_status, translations:[], explanation,
     *     phonetic, us_phonetic, uk_phonetic }
     */
    public function resolve(
        string $word,
        string $language,
        ?string $targetLang = null,
        bool $bumpFront = true,
        ?string $accent = null,
        bool $tryRealPronunciation = true,
        bool $enqueueMissing = true
    ): array
    {
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $md5 = md5($word);

        $row = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);

        $imageUrl = $row ? $this->resolveImageUrl($row) : null;
        $audioPick = $row ? $this->resolveAudioPick($row, $accent) : ['url' => null, 'accent' => null, 'fallback' => false];
        $audioUrl = $audioPick['url'];
        $audioAccent = $audioPick['accent'];
        $accentFallback = $audioPick['fallback'];

        $hasImage = $imageUrl !== null;
        $hasAudio = $audioUrl !== null;
        $mcpImageSubmitted = $row
            && $row->getAttribute('image_mcp_submitted_at') !== null;

        // Translation presence for the requested target (when one is supplied).
        $translations = $this->extractTranslations($row);
        $hasTranslation = $this->hasTranslationFor($row, $targetLang);

        // mcp-chrome submission is authoritative. A legacy image/status does not
        // suppress the search task until Chrome has submitted this word itself.
        $needsImage = $hasTranslation && !$mcpImageSubmitted;

        $needsMedia = $needsImage || !$hasAudio || !$hasTranslation;

        if ($needsMedia && $enqueueMissing) {
            // Enqueue the per-resource queues (idempotent; bump to front on query).
            $position = $bumpFront ? 'beginning' : 'end';

            if ($needsImage) {
                $this->imageQueue->add($word, $langCode, $position);
            }

            if (!$hasAudio && $tryRealPronunciation) {
                // Synchronously try REAL pronunciation sources (Free Dictionary
                // API, then Forvo) before falling back to TTS synthesis, so a
                // successful hit is already reflected in THIS response. Only
                // when it misses does the existing async TTS path below run.
                if ($this->fetchRealPronunciation($word, $langCode, $md5)) {
                    $row = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);
                    $audioUrl = $row ? $this->resolveAudioUrl($row) : null;
                    $hasAudio = $audioUrl !== null;
                }
            }

            if (!$hasAudio) {
                $this->enqueueTts($word, $langCode, $position);
            }

            // Independent lanes: mcp-chrome owns images, pycore owns Google
            // translation, and the word-audio worker owns pronunciation.
            $this->ensureWordMediaTask(
                $word,
                $md5,
                $langCode,
                $targetLang,
                $bumpFront,
                $needsImage,
                !$hasTranslation
            );

            // Re-read the row (a queue add may have just created it) so the
            // returned md5/phonetics reflect the canonical row.
            if (!$row) {
                $row = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);
            }
        } else {
            // Even a fully-resolved word counts query interest; bump only when the
            // user is actively querying AND something might still benefit. No-op
            // here keeps a hot word cheap.
        }

        $audioFilesPayload = $row ? $this->audioVariantsForApi($row, $langCode) : [];
        return [
            'word' => $word,
            'md5' => $md5,
            'language' => $langCode,
            'image_url' => $imageUrl,
            'audio_url' => $audioUrl,
            'image_status' => $hasImage ? 'ready' : 'pending',
            'audio_status' => $hasAudio ? 'ready' : 'pending',
            'audio_accent' => $audioAccent,
            'accent_fallback' => $accentFallback,
            // audio_files is the CANONICAL key; audio_variants is kept as an
            // alias (same payload) for backward compatibility with older FEs.
            'audio_files' => $audioFilesPayload,
            'audio_variants' => $audioFilesPayload,
            'translations' => $translations,
            'explanation' => $this->extractExplanation($row),
            'phonetic' => $row ? ($row->phonetic ?? null) : null,
            'us_phonetic' => $row ? ($row->us_phonetic ?? null) : null,
            'uk_phonetic' => $row ? ($row->uk_phonetic ?? null) : null,
        ];
    }

    /**
     * On-query prioritization hook: bump a queried word's media to the front of
     * every queue layer when it lacks image OR audio OR translation. Cheap,
     * non-blocking — callers must never let a queue bump break a lookup.
     *
     * @param AppQyV1LangDictionaryModel|null $row Resolved row (may be null).
     * @param string $word Queried word.
     * @param string $language Source language (code or name).
     * @param string|null $targetLanguage Target/native language (code or name).
     */
    public function bumpQueriedWord($row, string $word, string $language, ?string $targetLanguage = null): void
    {
        $word = trim($word);
        if ($word === '') {
            return;
        }

        try {
            $langCode = AppQyV1DictionaryService::getLanguageCode($language);
            $md5 = md5($word);

            $hasAudio = $row ? ($this->resolveAudioUrl($row) !== null) : false;
            $hasTranslation = $this->hasTranslationFor($row, $targetLanguage);
            $mcpImageSubmitted = $row
                && $row->getAttribute('image_mcp_submitted_at') !== null;

            $needsImage = $hasTranslation && !$mcpImageSubmitted;

            if (!$needsImage && $hasAudio && $hasTranslation) {
                return; // Nothing left to prioritize (image settled or present).
            }

            if ($needsImage) {
                $this->imageQueue->add($word, $langCode, 'beginning');
            }
            if (!$hasAudio) {
                $this->enqueueTts($word, $langCode, 'beginning');
            }

            $this->ensureWordMediaTask(
                $word,
                $md5,
                $langCode,
                $targetLanguage,
                true,
                $needsImage,
                !$hasTranslation
            );
        } catch (\Throwable $e) {
            // Non-blocking: never let a media bump break a lookup.
            Log::warning('[AppQyV1WordMedia] query bump failed', [
                'word' => $word,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Interactive image fast-lane bump: ensure ONLY the canonical word_media
     * image task for $word is promoted onto the shared remote_fast lane
     * (capability=image, is_fast_tier) so the first idle chrome worker drains it
     * sub-second. Idempotent and no-op when the image is already on disk.
     *
     * Reuses the single canonical creator (ensureWordMediaTask -> ensureWordTask):
     * word_media + bumpFront already rewrites the task onto remote_fast with
     * capability=image, so there is no separate routing here and exactly ONE
     * word_media task per word (ensureWordTask's existing-owner branch). Audio is
     * untouched (needsAudio=false); the audio fast path stays the assist
     * tts_priority bump.
     *
     * Non-blocking: a bump must never break the caller, so the body is wrapped in
     * try/catch that swallows + logs (mirroring bumpQueriedWord).
     */
    public function ensureImageFastTask(string $word, string $language): void
    {
        $word = trim($word);
        if ($word === '') {
            return;
        }

        try {
            $langCode = AppQyV1DictionaryService::getLanguageCode($language);
            $md5 = md5($word);

            $row = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);
            $hasImage = $row && $this->resolveImageUrl($row) !== null;
            $mcpImageSubmitted = $row
                && $row->getAttribute('image_mcp_submitted_at') !== null;
            if ($hasImage && $mcpImageSubmitted) {
                return; // Image already present — idempotent no-op.
            }

            // Promote ONLY the image (word_media) lane onto remote_fast.
            $this->ensureWordMediaTask(
                $word,
                $md5,
                $langCode,
                null,   // targetLang: image gap only.
                true,   // bumpFront: triggers the interactive remote_fast/image rewrite.
                true,   // needsImage: image lane.
                false   // needsTranslation: untouched.
            );
        } catch (\Throwable $e) {
            // Non-blocking: a queue bump must never break the caller.
            Log::warning('[AppQyV1WordMedia] image fast bump failed', [
                'word' => $word,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Ensure the right assist task(s) cover a word that is missing media, then
     * (when $bumpFront) raise their priority to the front. Two task lanes are
     * independent so each worker owns its own queue:
     *
     *   - word_media / remote_fast (mcp-chrome): created for missing images.
     *   - word_translation / remote_translation (pycore): created for missing
     *     target translations and processed by the Google-first worker chain.
     * Word audio is not duplicated as a GlobalTask. Its canonical dictionary
     * row and tts_priority are owned by AppQyV1UnifiedTTSQueueService and claimed
     * only through the dedicated Pycore TTS worker endpoint.
     *
     * A word missing multiple resources gets independent tasks whose write-back
     * remains fill-missing and idempotent.
     *
     * Idempotent: a word already covered by a pending task of the same type is
     * only bumped, never duplicated.
     *
     * @param bool $needsImage True when the word needs mcp-chrome image search.
     * @param bool $needsTranslation True when the word needs pycore Google translation.
     */
    public function ensureWordMediaTask(
        string $word,
        string $md5,
        string $langCode,
        ?string $targetLanguage,
        bool $bumpFront,
        bool $needsImage = true,
        bool $needsTranslation = true
    ): void {
        if ($needsImage) {
            $this->ensureWordTask(
                'word_media',
                GlobalTask::EXECUTION_REMOTE_FAST,
                $word,
                $md5,
                $langCode,
                $targetLanguage,
                $bumpFront
            );
        }

        if ($needsTranslation) {
            $this->ensureWordTask(
                'word_translation',
                GlobalTask::EXECUTION_REMOTE_TRANSLATION,
                $word,
                $md5,
                $langCode,
                $targetLanguage,
                $bumpFront
            );
        }
    }

    /**
     * Ensure a pending global task of $taskType / $executionType covers $word,
     * creating one when none does and (when $bumpFront) raising its priority to
     * the front. Idempotent per task type: a word already owned by a pending task
     * of this type is only bumped, never duplicated. Payload is identical across
     * both lanes: { words:[{word,md5}], language, target_language? }.
     */
    private function ensureWordTask(
        string $taskType,
        string $executionType,
        string $word,
        string $md5,
        string $langCode,
        ?string $targetLanguage,
        bool $bumpFront
    ): void {
        $targetCode = null;
        if (is_string($targetLanguage) && trim($targetLanguage) !== '') {
            $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);
        }
        // Find an existing pending task of THIS type that already owns this word.
        $existing = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', $taskType)
            ->where('status', GlobalTask::STATUS_PENDING)
            ->where('payload->language', $langCode)
            ->get(['task_id', 'payload', 'priority']);

        $ownerTaskId = null;
        foreach ($existing as $task) {
            $payload = $task->payload;
            $words = is_array($payload) && is_array($payload['words'] ?? null)
                ? $payload['words']
                : [(is_array($payload) ? ($payload['content'] ?? null) : null)];
            if (!is_array($words)) {
                continue;
            }
            foreach ($words as $w) {
                $wWord = is_array($w) ? ($w['word'] ?? null) : $w;
                if ($wWord === $word) {
                    $ownerTaskId = $task->task_id;
                    break 2;
                }
            }
        }

        if ($ownerTaskId !== null) {
            if ($bumpFront) {
                // Repeat-request escalation (target #2): a fresh bump jumps to
                // FRONT (100); a REPEAT request on a task already at/above FRONT
                // escalates +STEP up to REPEAT_CAP so visible/re-requested words
                // outrank one-shot page bumps. The CASE handles both in one
                // update; pending_urgent (priority >= 100) is unaffected.
                GlobalTask::query()
                    ->where('task_id', $ownerTaskId)
                    ->where('status', GlobalTask::STATUS_PENDING)
                    ->update([
                        'priority' => \DB::raw(
                            'CASE '
                            . 'WHEN priority < ' . (int) self::TASK_PRIORITY_FRONT . ' '
                            . 'THEN ' . (int) self::TASK_PRIORITY_FRONT . ' '
                            . 'ELSE LEAST(priority + ' . (int) self::TASK_PRIORITY_REPEAT_STEP . ', '
                            . (int) self::TASK_PRIORITY_REPEAT_CAP . ') '
                            . 'END'
                        ),
                    ]);
            }
            return;
        }

        // Create a fresh single-word task. The worker channel pulls it via
        // /api/worker/tasks/pull (WHERE execution_type = the worker's processor
        // type) and the result flows back through WordTranslationTaskProcessor ->
        // AppQyV1WordTranslationWriteback::apply.
        $priority = $bumpFront ? self::TASK_PRIORITY_FRONT : self::TASK_PRIORITY_DEFAULT;

        $payload = [
            'words' => [['word' => $word, 'md5' => $md5]],
            'language' => $langCode,
            'word_count' => 1,
        ];
        if ($targetCode !== null) {
            $payload['target_language'] = $targetCode;
        }
        // IMAGE lane: word_media always uses remote_fast + capability=image, so
        // only the enabled mcp-chrome media worker can claim it. Pycore skips it.
        //
        // Keep the priority/is_fast_tier difference:
        //   - bumpFront  -> interactive=true: createTask rewrites execution_type ->
        //     remote_fast, raises priority to PRIORITY_FAST (top) and sets
        //     is_fast_tier=1.
        //   - backfill   -> interactive=false but execution_type set to remote_fast
        //     here, so it keeps its normal TASK_PRIORITY_DEFAULT priority (createTask
        //     only raises priority when interactive) on the same drained lane.
        $interactive = false;
        $capability = null;
        if ($taskType === 'word_media') {
            $capability = GlobalTask::CAPABILITY_IMAGE;
            if ($bumpFront) {
                $interactive = true;
            } else {
                // Non-interactive backfill keeps its normal default priority.
                $executionType = GlobalTask::EXECUTION_REMOTE_FAST;
            }
        } elseif ($taskType === 'word_translation') {
            $capability = GlobalTask::CAPABILITY_TRANSLATE;
            $executionType = GlobalTask::EXECUTION_REMOTE_TRANSLATION;
        }

        $this->taskManager->createTask(
            'AppQyV1',
            $taskType,
            $executionType,
            $payload,
            120,
            $priority,
            3,
            $interactive,
            $capability
        );
    }

    /**
     * Try the REAL pronunciation source chain (Free Dictionary API -> Forvo)
     * for a word missing audio, and persist a hit via the existing
     * source-agnostic coordinator. Returns true only when audio was newly
     * stored (i.e. the caller can skip the TTS fallback for this response).
     * NEVER throws — any failure is logged and treated as a miss so the
     * caller falls through to the existing TTS enqueue path.
     */
    private function fetchRealPronunciation(string $word, string $langCode, string $md5): bool
    {
        try {
            $result = $this->wordAudioClient->findPronunciation($word, $langCode);
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1WordMedia] real pronunciation lookup failed', [
                'word' => $word,
                'language' => $langCode,
                'error' => $e->getMessage(),
            ]);
            return false;
        }

        if ($result === null) {
            return false;
        }

        try {
            $coordinator = new AppQyV1DictionaryTTSCoordinator();
            return $coordinator->storeWordAudioBytes($langCode, $md5, $result['binary'], $result['provider']);
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1WordMedia] failed to store real pronunciation audio', [
                'word' => $word,
                'language' => $langCode,
                'provider' => $result['provider'] ?? null,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Enqueue a word onto the TTS queue (tts_* columns) at the given position.
     * Best-effort; failures are swallowed by callers.
     */
    private function enqueueTts(string $word, string $langCode, string $position): void
    {
        try {
            (new AppQyV1UnifiedTTSQueueService())->addTask($word, $langCode, 'word', $position);
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1WordMedia] tts enqueue failed', [
                'word' => $word,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * File-first image URL for a row, or null when no image_files entry is on
     * disk. Local relative paths get the word-image serve prefix; absolute URLs
     * pass through (AppQyV1ImageUrl).
     */
    public function resolveImageUrl(AppQyV1LangDictionaryModel $row): ?string
    {
        $imageFiles = $row->image_files;
        if (!is_array($imageFiles) || empty($imageFiles)) {
            return null;
        }

        foreach ($imageFiles as $entry) {
            // Absolute / already-served URLs are usable as-is.
            $url = AppQyV1ImageUrl::forEntry($entry);
            if ($url === null) {
                continue;
            }
            $relative = $this->localRelative($entry);
            if ($relative === null) {
                // Absolute URL — trust it (defensive legacy fallback).
                return $url;
            }
            if (is_file(PathMapper::getAppQyV1WordImagesDir($relative))) {
                return $url;
            }
        }

        return null;
    }

    /**
     * File-first audio URL for a row, or null when no tts_files entry is on disk.
     */
    public function resolveAudioUrl(AppQyV1LangDictionaryModel $row): ?string
    {
        return $this->resolveAudioPick($row, null)['url'];
    }

    /**
     * Pick the best on-disk audio URL for a row, optionally honoring accent preference.
     *
     * @return array{url:?string,accent:?string,fallback:bool}
     */
    public function resolveAudioPick(AppQyV1LangDictionaryModel $row, ?string $accent = null): array
    {
        $preferred = null;
        if (is_string($accent)) {
            $a = strtolower(trim($accent));
            if (in_array($a, ['us', 'uk'], true)) {
                $preferred = $a;
            }
        }

        $variants = AppQyV1WordAudioFiles::list($row);
        if ($preferred !== null) {
            foreach ($variants as $variant) {
                if (($variant['accent'] ?? null) === $preferred && !empty($variant['has_file']) && !empty($variant['path'])) {
                    return [
                        'url' => AppQyV1TtsUrl::forPath((string) $variant['path']),
                        'accent' => $preferred,
                        'fallback' => false,
                    ];
                }
            }
        }

        foreach ($variants as $variant) {
            if (!empty($variant['has_file']) && !empty($variant['path'])) {
                $accentTag = $variant['accent'] ?? null;
                return [
                    'url' => AppQyV1TtsUrl::forPath((string) $variant['path']),
                    'accent' => is_string($accentTag) ? $accentTag : 'unknown',
                    'fallback' => $preferred !== null && $accentTag !== $preferred,
                ];
            }
        }

        $ttsFiles = $row->tts_files;
        if (!is_array($ttsFiles) || empty($ttsFiles)) {
            return ['url' => null, 'accent' => null, 'fallback' => false];
        }

        $base = rtrim(PathMapper::getAppQyV1AudioBaseDir(), '/\\') . '/';
        foreach ($ttsFiles as $ttsFile) {
            if (!isset($ttsFile['path']) || !is_string($ttsFile['path'])) {
                continue;
            }
            if (is_file($base . $ttsFile['path'])) {
                return [
                    'url' => AppQyV1TtsUrl::forPath($ttsFile['path']),
                    'accent' => 'unknown',
                    'fallback' => $preferred !== null,
                ];
            }
        }

        return ['url' => null, 'accent' => null, 'fallback' => false];
    }

    /**
     * Canonical per-variant audio payload: ONE entry per on-disk audio file for
     * the row. Single source of truth shared by the media resolve endpoint (GET
     * /word/{lang}/{word}/media) and the group get_words payload, so the two never
     * diverge. Each entry carries the playable {url}, a display {voice} label and
     * the {lang} code, plus the richer per-variant fields. Capped at
     * MAX_AUDIO_VARIANTS.
     *
     * @return array<int,array<string,mixed>>
     */
    public function audioVariantsForApi(AppQyV1LangDictionaryModel $row, string $langCode): array
    {
        $out = [];
        foreach (AppQyV1WordAudioFiles::list($row) as $variant) {
            if (empty($variant['has_file']) || empty($variant['path'])) {
                continue;
            }
            $accent = $variant['accent'] ?? null;
            $out[] = [
                'url' => AppQyV1TtsUrl::forPath((string) $variant['path']),
                'voice' => self::voiceLabel($variant),
                'lang' => $langCode,
                'variant_key' => $variant['variant_key'] ?? '',
                'accent' => in_array($accent, ['us', 'uk'], true) ? $accent : 'unknown',
                'gender' => $variant['gender'] ?? null,
                'source' => $variant['source'] ?? null,
                'voice_type' => $variant['voice_type'] ?? null,
                'provider' => $variant['provider'] ?? null,
                'status' => 'ready',
            ];
            if (count($out) >= self::MAX_AUDIO_VARIANTS) {
                break;
            }
        }
        return $out;
    }

    /**
     * Human-friendly voice label for one audio variant, derived from its
     * accent/gender, else the variant key, else the provider, else 'default'.
     *
     * @param array<string,mixed> $variant
     */
    private static function voiceLabel(array $variant): string
    {
        $parts = [];
        $accent = $variant['accent'] ?? null;
        if ($accent === 'us') {
            $parts[] = 'US';
        } elseif ($accent === 'uk') {
            $parts[] = 'UK';
        }
        $gender = $variant['gender'] ?? null;
        if ($gender === 'f' || $gender === 'female') {
            $parts[] = 'Female';
        } elseif ($gender === 'm' || $gender === 'male') {
            $parts[] = 'Male';
        }
        if (!empty($parts)) {
            return implode(' ', $parts);
        }
        $variantKey = (string) ($variant['variant_key'] ?? '');
        if ($variantKey !== '') {
            return $variantKey;
        }
        $provider = (string) ($variant['provider'] ?? '');
        if ($provider !== '') {
            return $provider;
        }
        return 'default';
    }

    /**
     * Bare local relative path of an image_files entry, or null for an absolute
     * / already-served URL.
     */
    private function localRelative($entry): ?string
    {
        $raw = null;
        if (is_string($entry)) {
            $raw = $entry;
        } elseif (is_array($entry)) {
            if (isset($entry['path']) && is_string($entry['path'])) {
                $raw = $entry['path'];
            } elseif (isset($entry['url']) && is_string($entry['url'])) {
                $raw = $entry['url'];
            }
        }

        if (!is_string($raw) || $raw === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $raw) === 1 || str_starts_with($raw, '//') || str_starts_with($raw, '/')) {
            return null;
        }
        return ltrim($raw, '/');
    }

    /**
     * Flat list of translation strings for the row (the contract's
     * translations:[]). Reads the dictionary translations json: every scalar
     * target-language value plus the nested word_translation pairs' text.
     *
     * @return array<int, string>
     */
    private function extractTranslations($row): array
    {
        if (!$row) {
            return [];
        }
        $translations = $row->translations;
        if (!is_array($translations)) {
            return [];
        }

        $content = (string) $row->content;
        $out = [];

        // Nested word_translation pairs: pair[1] = target meaning. Drop any pair
        // whose target IS the source headword itself.
        if (isset($translations['word_translation']) && is_array($translations['word_translation'])) {
            foreach ($translations['word_translation'] as $pair) {
                if (is_array($pair) && isset($pair[1]) && is_string($pair[1]) && $pair[1] !== ''
                    && strcasecmp($pair[1], $content) !== 0) {
                    $out[] = $pair[1];
                }
            }
        }

        // Flat scalar target values, EXCLUDING the legacy metadata keys (the
        // top-level 'word' holds the source headword, never a translation) and any
        // value equal (case-insensitive) to the headword.
        foreach ($translations as $key => $value) {
            if (!is_string($value) || $value === '') {
                continue;
            }
            if (in_array($key, self::TRANSLATION_META_KEYS, true)) {
                continue;
            }
            if (strcasecmp($value, $content) === 0) {
                continue;
            }
            $out[] = $value;
        }

        return array_values(array_unique($out));
    }

    /**
     * True when the row already has a translation for $targetLanguage (or any
     * translation when no target is supplied). A null row has none.
     */
    private function hasTranslationFor($row, ?string $targetLanguage): bool
    {
        if (!$row) {
            return false;
        }
        $translations = $row->translations;
        if (!is_array($translations)) {
            return false;
        }

        if ($targetLanguage === null || trim($targetLanguage) === '') {
            // No target specified: any translation counts as present.
            return !empty($this->extractTranslations($row)) || !empty($row->has_translation);
        }

        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);
        return isset($translations[$targetCode]) && is_string($translations[$targetCode]) && $translations[$targetCode] !== '';
    }

    /**
     * Explanation string for the row. Prefers word_details.explanation; when that
     * is empty, COMPOSES one from the translations json (word_translation pairs,
     * else advanced_translate). null when truly nothing.
     * Mirrors AppQyV1WordGroupWordController::wordDefinition.
     */
    private function extractExplanation($row): ?string
    {
        if (!$row) {
            return null;
        }
        $details = $row->word_details;
        if (is_array($details) && isset($details['explanation']) && is_string($details['explanation']) && $details['explanation'] !== '') {
            return $details['explanation'];
        }
        $composed = self::composeDefinition($row);
        return $composed !== '' ? $composed : null;
    }

    /**
     * Compose a definition from the translations json when word_details has none:
     * join the word_translation pairs as "pair[0] pair[1]" with ' / ', else fall
     * back to advanced_translate. '' when nothing usable.
     * Mirrors AppQyV1WordGroupWordController::composeDefinition.
     */
    private static function composeDefinition(AppQyV1LangDictionaryModel $row): string
    {
        $translations = $row->translations;
        if (!is_array($translations)) {
            return '';
        }

        if (isset($translations['word_translation']) && is_array($translations['word_translation'])) {
            $parts = [];
            foreach ($translations['word_translation'] as $pair) {
                if (!is_array($pair)) {
                    continue;
                }
                $meaning = isset($pair[1]) && is_string($pair[1]) ? trim($pair[1]) : '';
                if ($meaning === '') {
                    continue;
                }
                $tag = isset($pair[0]) && is_string($pair[0]) ? trim($pair[0]) : '';
                $parts[] = $tag !== '' ? ($tag . ' ' . $meaning) : $meaning;
            }
            if (!empty($parts)) {
                return implode(' / ', array_values(array_unique($parts)));
            }
        }

        $advanced = $translations['advanced_translate'] ?? null;
        if (is_string($advanced) && trim($advanced) !== '') {
            return trim($advanced);
        }
        if (is_array($advanced)) {
            $parts = [];
            foreach ($advanced as $item) {
                if (is_string($item) && trim($item) !== '') {
                    $parts[] = trim($item);
                } elseif (is_array($item)) {
                    $text = isset($item[1]) && is_string($item[1]) ? trim($item[1])
                        : (isset($item[0]) && is_string($item[0]) ? trim($item[0]) : '');
                    if ($text !== '') {
                        $parts[] = $text;
                    }
                }
            }
            if (!empty($parts)) {
                return implode(' / ', array_values(array_unique($parts)));
            }
        }

        return '';
    }
}
