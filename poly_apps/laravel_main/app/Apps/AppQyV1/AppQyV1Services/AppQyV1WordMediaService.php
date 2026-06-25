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
 * enqueued onto the per-language image queue (image_* columns) + the TTS queue
 * (tts_* columns). A query bumps every layer to the FRONT.
 *
 * PRIORITY model:
 *   - global_tasks.priority (higher = sooner): PRIORITY_FRONT on bump.
 *   - dictionary image_priority / tts_priority: PRIORITY_FRONT on bump.
 */
class AppQyV1WordMediaService
{
    /** word_media global_tasks.priority used when bumping a queried word. */
    const TASK_PRIORITY_FRONT = 100;

    /** Default word_media global_tasks.priority for a backfill enqueue. */
    const TASK_PRIORITY_DEFAULT = 30;

    /** Max words bundled into one word_media global task. */
    const MAX_WORDS_PER_TASK = 40;

    protected TaskManagerService $taskManager;
    protected AppQyV1WordImageQueueService $imageQueue;

    public function __construct()
    {
        $this->taskManager = app(TaskManagerService::class);
        $this->imageQueue = new AppQyV1WordImageQueueService();
    }

    /**
     * Resolve a word's media file-first; enqueue + prioritize on any miss.
     *
     * @param string $word           The word text.
     * @param string $language       Source/library language (name or code).
     * @param string|null $targetLang Optional target language for translation.
     * @param bool $bumpFront         True for an active query (move-to-front).
     * @return array The contract data block:
     *   { word, md5, language, image_url|null, audio_url|null,
     *     image_status, audio_status, translations:[], explanation,
     *     phonetic, us_phonetic, uk_phonetic }
     */
    public function resolve(string $word, string $language, ?string $targetLang = null, bool $bumpFront = true): array
    {
        $langCode = AppQyV1DictionaryService::getLanguageCode($language);
        $md5 = md5($word);

        $row = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);

        $imageUrl = $row ? $this->resolveImageUrl($row) : null;
        $audioUrl = $row ? $this->resolveAudioUrl($row) : null;

        $hasImage = $imageUrl !== null;
        $hasAudio = $audioUrl !== null;

        // Translation presence for the requested target (when one is supplied).
        $translations = $this->extractTranslations($row);
        $hasTranslation = $this->hasTranslationFor($row, $targetLang);

        // image_status='none' = Bing was checked and has NO sample images for this
        // word (terminal verdict) — never re-queue it; 'completed' = it already has
        // them. missing-image applies ONLY to already-translated words (the
        // "缺图片是在有翻译的前提下" premise). Audio stays purely has_audio-derived
        // (pycore TTS can synthesize even when Bing has none), so we DON'T gate
        // audio on any "none" marker.
        $imageSettled = $this->imageSettled($row);
        $needsImage = $hasTranslation && !$hasImage && !$imageSettled;

        $needsMedia = $needsImage || !$hasAudio || !$hasTranslation;

        if ($needsMedia) {
            // Enqueue the per-resource queues (idempotent; bump to front on query).
            $position = $bumpFront ? 'beginning' : 'end';

            if ($needsImage) {
                $this->imageQueue->add($word, $langCode, $position);
            }
            if (!$hasAudio) {
                $this->enqueueTts($word, $langCode, $position);
            }

            // Two-lane assist tasks: chrome (word_media) covers image/translation
            // gaps; pycore (word_audio) covers the audio gap.
            $needsChrome = !$hasTranslation || $needsImage;
            $this->ensureWordMediaTask(
                $word,
                $md5,
                $langCode,
                $targetLang,
                $bumpFront,
                $needsChrome,
                !$hasAudio
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

        return [
            'word' => $word,
            'md5' => $md5,
            'language' => $langCode,
            'image_url' => $imageUrl,
            'audio_url' => $audioUrl,
            'image_status' => $hasImage ? 'ready' : 'pending',
            'audio_status' => $hasAudio ? 'ready' : 'pending',
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

            $hasImage = $row ? ($this->resolveImageUrl($row) !== null) : false;
            $hasAudio = $row ? ($this->resolveAudioUrl($row) !== null) : false;
            $hasTranslation = $this->hasTranslationFor($row, $targetLanguage);

            // Honor the terminal image verdict + translated-only premise (see
            // resolve()); audio stays has_audio-derived (no "none" gate).
            $imageSettled = $this->imageSettled($row);
            $needsImage = $hasTranslation && !$hasImage && !$imageSettled;

            if (!$needsImage && $hasAudio && $hasTranslation) {
                return; // Nothing left to prioritize (image settled or present).
            }

            if ($needsImage) {
                $this->imageQueue->add($word, $langCode, 'beginning');
            }
            if (!$hasAudio) {
                $this->enqueueTts($word, $langCode, 'beginning');
            }

            // Two-lane assist tasks: chrome (word_media) for image/translation,
            // pycore (word_audio) for audio. Bump BOTH to front on a new query.
            $needsChrome = !$hasTranslation || $needsImage;
            $this->ensureWordMediaTask(
                $word,
                $md5,
                $langCode,
                $targetLanguage,
                true,
                $needsChrome,
                !$hasAudio
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
            if ($row && $this->resolveImageUrl($row) !== null) {
                return; // Image already present — idempotent no-op.
            }

            // Promote ONLY the image (word_media) lane onto remote_fast.
            $this->ensureWordMediaTask(
                $word,
                $md5,
                $langCode,
                null,   // targetLang: image gap only.
                true,   // bumpFront: triggers the interactive remote_fast/image rewrite.
                true,   // needsChrome: image lane.
                false   // needsAudio: untouched.
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
     * (when $bumpFront) raise their priority to the front. TWO LANES — created
     * independently so each worker owns its own queue:
     *
     *   - word_media  / remote_client  (CHROME Bing-assist lane): created when the
     *     word is missing IMAGE or TRANSLATION. Bing fills all three (translation
     *     + phonetics + sample images + pronunciation), so this lane covers
     *     image/translation gaps.
     *   - word_audio  / remote_audio   (PYCORE local-TTS lane): created when the
     *     word is missing AUDIO. pycore generates pronunciation audio.
     *
     * A word missing all three legitimately gets BOTH tasks (intended
     * redundancy): chrome fills everything, pycore fills audio — the write-back
     * is fill-missing / idempotent so concurrent completion is safe.
     *
     * Idempotent: a word already covered by a pending task of the same type is
     * only bumped, never duplicated.
     *
     * @param bool $needsChrome True when the word is missing image OR translation.
     * @param bool $needsAudio  True when the word is missing audio.
     */
    public function ensureWordMediaTask(
        string $word,
        string $md5,
        string $langCode,
        ?string $targetLanguage,
        bool $bumpFront,
        bool $needsChrome = true,
        bool $needsAudio = true
    ): void {
        if ($needsChrome) {
            $this->ensureWordTask(
                'word_media',
                GlobalTask::EXECUTION_REMOTE_CLIENT,
                $word,
                $md5,
                $langCode,
                $targetLanguage,
                $bumpFront
            );
        }

        if ($needsAudio) {
            $this->ensureWordTask(
                'word_audio',
                GlobalTask::EXECUTION_REMOTE_AUDIO,
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
            $words = is_array($payload) ? ($payload['words'] ?? []) : [];
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
                GlobalTask::query()
                    ->where('task_id', $ownerTaskId)
                    ->where('status', GlobalTask::STATUS_PENDING)
                    ->where('priority', '<', self::TASK_PRIORITY_FRONT)
                    ->update(['priority' => self::TASK_PRIORITY_FRONT]);
            }
            return;
        }

        // Create a fresh single-word task. The worker channel pulls it via
        // /api/worker/tasks/pull (WHERE execution_type = the worker's processor
        // type) and the result flows back through WordTranslationTaskProcessor ->
        // AppQyV1WordTranslationWriteback::apply (handles word_media + word_audio).
        $priority = $bumpFront ? self::TASK_PRIORITY_FRONT : self::TASK_PRIORITY_DEFAULT;

        $payload = [
            'words' => [['word' => $word, 'md5' => $md5]],
            'language' => $langCode,
            'word_count' => 1,
        ];
        if ($targetCode !== null) {
            $payload['target_language'] = $targetCode;
        }

        // IMAGE lane: NO worker drains the raw remote_client execution_type, so a
        // word_media task left on remote_client strands forever (backfill never
        // completes). ALWAYS route word_media onto the shared fast lane the Bing
        // chrome worker actually drains (capability=image narrows the claim to
        // chrome; pycore correctly skips it). The fast-lane claim selects purely on
        // execution_type=remote_fast + capability ordered by priority desc, so a
        // default-priority backfill is still drained — just behind front bumps.
        //
        // Keep the priority/is_fast_tier difference:
        //   - bumpFront  -> interactive=true: createTask rewrites execution_type ->
        //     remote_fast, raises priority to PRIORITY_FAST (top) and sets
        //     is_fast_tier=1.
        //   - backfill   -> interactive=false but execution_type set to remote_fast
        //     here, so it keeps its normal TASK_PRIORITY_DEFAULT priority (createTask
        //     only raises priority when interactive) on the same drained lane.
        // word_audio is intentionally UNCHANGED — audio rides the assist
        // tts_priority path and a remote_fast audio task has no write-back.
        $interactive = false;
        $capability = null;
        if ($taskType === 'word_media') {
            $capability = GlobalTask::CAPABILITY_IMAGE;
            if ($bumpFront) {
                $interactive = true;
            } else {
                // Non-interactive backfill: route onto the drained fast lane while
                // preserving the normal default priority (no PRIORITY_FAST bump).
                $executionType = GlobalTask::EXECUTION_REMOTE_FAST;
            }
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
     * Whether a row's IMAGE state is terminal — it already has images
     * (image_status='completed') or Bing was checked and has none for this word
     * (image_status='none'). Such words must never be re-queued for images. Reads
     * the column defensively so a host whose image_status migration has not run
     * yet (null) is simply "not settled" (falls back to the file-first check).
     */
    private function imageSettled(?AppQyV1LangDictionaryModel $row): bool
    {
        if (!$row) {
            return false;
        }
        $status = $row->image_status ?? null;
        return $status === 'completed' || $status === 'none';
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
        $ttsFiles = $row->tts_files;
        if (!is_array($ttsFiles) || empty($ttsFiles)) {
            return null;
        }

        $base = rtrim(PathMapper::getAppQyV1AudioBaseDir(), '/\\') . '/';
        foreach ($ttsFiles as $ttsFile) {
            if (!isset($ttsFile['path']) || !is_string($ttsFile['path'])) {
                continue;
            }
            if (is_file($base . $ttsFile['path'])) {
                return AppQyV1TtsUrl::forPath($ttsFile['path']);
            }
        }

        return null;
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

        $out = [];
        foreach ($translations as $key => $value) {
            if ($key === 'word_translation') {
                if (is_array($value)) {
                    foreach ($value as $pair) {
                        if (is_array($pair) && isset($pair[1]) && is_string($pair[1]) && $pair[1] !== '') {
                            $out[] = $pair[1];
                        }
                    }
                }
                continue;
            }
            if (is_string($value) && $value !== '') {
                $out[] = $value;
            }
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
     * Optional explanation string from word_details, or null.
     */
    private function extractExplanation($row): ?string
    {
        if (!$row) {
            return null;
        }
        $details = $row->word_details;
        if (is_array($details) && isset($details['explanation']) && is_string($details['explanation'])) {
            return $details['explanation'];
        }
        return null;
    }
}
