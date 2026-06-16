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
 *   { "translations": [ {"word": string, "translation": string} ],
 *     "target_language": string, "provider": string }
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
        return $task->app_name === 'AppQyV1'
            && $task->task_type === 'word_translation';
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): void
    {
        // Source/library language the dictionary row lives under (e.g. "en").
        $language = $task->payload['language'] ?? 'en';

        // Prefer the target language reported by the worker; fall back to the
        // value the enqueue side stored on the payload.
        $targetLanguage = $result['target_language']
            ?? ($task->payload['target_language'] ?? 'zh');

        $provider = $result['provider'] ?? 'unknown';
        $translations = $result['translations'] ?? [];

        // Words the worker could not resolve (Bing returned a confirmed no-entry)
        // so they can be flagged is_valid=false and never re-queued.
        $invalidWords = $result['invalid_words'] ?? [];

        // Words that persistently landed on a non-dict (region/redirect) page even
        // after retries. Flagged invalid with a distinct source so the enqueue
        // side stops re-queuing them (avoids the infinite region-redirect loop).
        $regionRedirectWords = $result['region_redirect_words'] ?? [];

        if (empty($translations) && empty($invalidWords) && empty($regionRedirectWords)) {
            return;
        }

        // Demo-mode tasks never touch the database (mirrors DictionaryTaskProcessor).
        if ($isDemoMode) {
            return;
        }

        AppQyV1WordTranslationWriteback::apply(
            $task->task_id,
            $language,
            $targetLanguage,
            $provider,
            $translations,
            $invalidWords,
            $regionRedirectWords
        );
    }

    public function getPriority(): int
    {
        return 10;
    }
}
