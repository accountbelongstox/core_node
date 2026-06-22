<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordTranslationWriteback;

/**
 * Word Translation Task Processor
 *
 * Write-back stage of the async word-translation pipeline.
 *
 * Flow: a `word_translation` global task is pulled by either the pycore Google
 * worker (processor_types ["remote_translation"]) or this backend's internal AI
 * self-filler. Both POST the completed result to /api/worker/tasks/result, which
 * routes through TaskManagerService::submitResult -> the processor registry ->
 * here.
 *
 * The worker result shape (per the shared contract) is:
 *   { "translations": [ {
 *       "word": string, "translation": string,
 *       "phonetic"?: string, "us_phonetic"?: string, "uk_phonetic"?: string,
 *       "image_base64"?: [{base64,mime}]|string[],  // Bing sample images (bytes)
 *       "audio_base64"?: string                      // Bing pronunciation (bytes)
 *     } ],
 *     "target_language": string, "provider": string,
 *     "invalidWords"?: [...], "regionRedirectWords"?: [...] }
 *
 * The Bing assist worker forwards the rich fields (phonetics + image_base64 +
 * audio_base64) alongside the translation; audio and images are BINARY/BASE64
 * only (the Bing media URLs are not fetchable server-side, so the chrome side
 * captures the bytes in-page). There is NO audio_url / image_url server fetch.
 *
 * For each entry this writes the translation into the canonical dictionary row
 * (tts_cache_{payload.language}, AppQyV1LangDictionaryModel) so the FE status
 * endpoint and GET /vocabulary/libraries/{id}/words both surface it. The actual
 * row mutation lives in AppQyV1WordTranslationWriteback to keep this processor
 * thin and reusable from the self-filler timer.
 */
class WordTranslationTaskProcessor implements TaskProcessorInterface
{
    protected TaskManagerService $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    public function canProcess(GlobalTask $task): bool
    {
        // word_media (chrome/remote_client) and word_audio (pycore/remote_audio)
        // are the media-on-demand twins of word_translation: every worker result
        // carries the SAME shape (translations[] with optional image_base64 /
        // audio_base64 + phonetics) and is persisted by the SAME
        // AppQyV1WordTranslationWriteback::apply (fill-missing/idempotent — it
        // fills image/audio even when a translation already exists, never
        // early-returns, so concurrent chrome+pycore completion is safe).
        return $task->app_name === 'AppQyV1'
            && in_array($task->task_type, ['word_translation', 'word_media', 'word_audio'], true);
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        // Chrome workers (e.g. the web-AI translate worker) wrap the payload in a
        // {result:{...}} envelope; pycore posts it flat. Unwrap so both forms work
        // (mirrors NotebookLmTaskProcessor / WordGeminiImageTaskProcessor).
        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;

        // Source/library language the dictionary row lives under (e.g. "en").
        $language = $task->payload['language'] ?? 'en';

        // Prefer the target language reported by the worker; fall back to the
        // value the enqueue side stored on the payload.
        $targetLanguage = $inner['target_language']
            ?? ($task->payload['target_language'] ?? 'zh');

        $provider = $inner['provider'] ?? 'unknown';
        $translations = $inner['translations'] ?? [];

        // Words the worker could not resolve (Bing returned a confirmed no-entry)
        // so they can be flagged is_valid=false and never re-queued.
        $invalidWords = $inner['invalid_words'] ?? [];

        // Words that persistently landed on a non-dict (region/redirect) page even
        // after retries. Flagged invalid with a distinct source so the enqueue
        // side stops re-queuing them (avoids the infinite region-redirect loop).
        $regionRedirectWords = $inner['region_redirect_words'] ?? [];

        if (empty($translations) && empty($invalidWords) && empty($regionRedirectWords)) {
            return 0;
        }

        // Demo-mode tasks never touch the database (mirrors DictionaryTaskProcessor).
        if ($isDemoMode) {
            return 0;
        }

        $outcome = AppQyV1WordTranslationWriteback::apply(
            $task->task_id,
            $language,
            $targetLanguage,
            $provider,
            $translations,
            $invalidWords,
            $regionRedirectWords
        );

        // Stored count for the result-trust layer: words actually persisted plus
        // words authoritatively invalidated (a confirmed no-entry / region-redirect
        // is a real, useful outcome — not an empty failure that should re-queue).
        return (int) (($outcome['processed'] ?? 0) + ($outcome['invalidated'] ?? 0));
    }

    public function getPriority(): int
    {
        return 10;
    }
}
