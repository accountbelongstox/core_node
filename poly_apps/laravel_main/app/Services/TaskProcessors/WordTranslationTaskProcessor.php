<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordTranslationWriteback;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;

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
class WordTranslationTaskProcessor extends AbstractTaskProcessor
{
    protected TaskManagerService $taskManager;

    // Granular reception summary of the LAST processResult() call, surfaced to
    // the worker (via TaskProcessorRegistry::process -> submitResult $outcome ->
    // the HTTP response) so it can log exactly what the backend stored:
    // { saved, invalid, audio_saved, images_saved }.
    protected ?array $lastOutcome = null;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    /** Granular write-back summary of the last processResult() (or null). */
    public function lastWritebackOutcome(): ?array
    {
        return $this->lastOutcome;
    }

    protected function taskTypeRoles(): array
    {
        // word_media (chrome/remote_fast) and word_audio (pycore/remote_audio)
        // are the media-on-demand twins of word_translation: every worker result
        // carries the SAME shape (translations[] with optional image_base64 /
        // audio_base64 + phonetics) and is persisted by the SAME
        // AppQyV1WordTranslationWriteback::apply (fill-missing/idempotent — it
        // fills image/audio even when a translation already exists, never
        // early-returns, so concurrent chrome+pycore completion is safe).
        return ['word_translation', 'word_media', 'word_audio'];
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        $this->lastOutcome = null;

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
        // so they can be flagged is_valid=false and never re-queued. Accept BOTH
        // snake_case and the camelCase documented in this file's header — a worker
        // following the documented shape must not be silently dropped (was a bug
        // that zeroed stored_count and tripped the result-trust downgrade).
        $invalidWords = $inner['invalid_words'] ?? $inner['invalidWords'] ?? [];

        // Words that persistently landed on a non-dict (region/redirect) page even
        // after retries. Flagged invalid with a distinct source so the enqueue
        // side stops re-queuing them (avoids the infinite region-redirect loop).
        $regionRedirectWords = $inner['region_redirect_words'] ?? $inner['regionRedirectWords'] ?? [];

        if (empty($translations) && empty($invalidWords) && empty($regionRedirectWords)) {
            $this->lastOutcome = ['saved' => 0, 'invalid' => 0, 'audio_saved' => 0, 'images_saved' => 0];
            return 0;
        }

        // Demo-mode tasks never touch the database (mirrors DictionaryTaskProcessor).
        if ($isDemoMode) {
            $this->lastOutcome = ['saved' => 0, 'invalid' => 0, 'audio_saved' => 0, 'images_saved' => 0];
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

        // Granular reception summary the worker logs as "backend reception":
        // saved = translations persisted, invalid = words flagged is_valid=false,
        // audio_saved / images_saved = binaries written to disk.
        $this->lastOutcome = [
            'saved' => (int) ($outcome['processed'] ?? 0),
            'invalid' => (int) ($outcome['invalidated'] ?? 0),
            'audio_saved' => (int) ($outcome['audio_saved'] ?? 0),
            'images_saved' => (int) ($outcome['images_saved'] ?? 0),
        ];

        if ($task->task_type === 'word_audio') {
            $langCode = AppQyV1DictionaryService::getLanguageCode($language);
            $audioReady = 0;
            foreach ($translations as $item) {
                $word = is_array($item) ? trim((string) ($item['word'] ?? '')) : '';
                $md5 = is_array($item) ? trim((string) ($item['md5'] ?? '')) : '';
                if ($md5 === '' && $word !== '') {
                    $md5 = md5($word);
                }
                if ($md5 === '') {
                    continue;
                }
                $entry = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);
                if ($entry && !empty($entry->has_audio)) {
                    $audioReady++;
                }
            }
            return $audioReady;
        }

        // Stored count for the result-trust layer: words actually persisted plus
        // words authoritatively invalidated (a confirmed no-entry / region-redirect
        // is a real, useful outcome — not an empty failure that should re-queue).
        return (int) (($outcome['processed'] ?? 0) + ($outcome['invalidated'] ?? 0));
    }

}
