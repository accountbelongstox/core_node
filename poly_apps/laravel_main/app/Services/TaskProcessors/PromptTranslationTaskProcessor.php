<?php

namespace App\Services\TaskProcessors;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DailySentenceService;
use App\Models\GlobalTask;
use App\Services\DeveloperHistory\DeveloperHistoryService;
use App\Services\TaskManagerService;

/**
 * Prompt Translation Task Processor.
 *
 * Write-back stage of the dev-history "assist" pipeline: a non-English prompt is
 * enqueued as a `prompt_translation` global task; pycore (or the chrome web
 * translator) pulls it, translates to English (code-filtered, sentences cleaned
 * up), produces 3 fluent variants + TTS audio, and POSTs the result here.
 *
 * Worker result shape (flat or {result:{...}} enveloped):
 *   { prompt_id, detected_language, english, cleaned,
 *     variants: [string, string, string],
 *     audio: { content_id, language:'en', relative, url } | null,
 *     code_segments?: string[] }
 *
 * On completion the result is DUAL-WRITTEN to both centers:
 *   - the AI history center (dev_tool_history/prompt_translations.json), so the
 *     DevHistory UI shows the English translation next to the prompt; and
 *   - the daily short-sentence center (AppQyV1DailySentenceService), which feeds
 *     the wordnew daily-reading view.
 */
class PromptTranslationTaskProcessor implements TaskProcessorInterface
{
    protected TaskManagerService $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    public function canProcess(GlobalTask $task): bool
    {
        return $task->task_type === 'prompt_translation';
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;

        $promptId = (string) ($task->payload['prompt_id'] ?? ($inner['prompt_id'] ?? ''));
        $english = trim((string) ($inner['english'] ?? ''));
        if ($promptId === '' || $english === '') {
            return 0;
        }
        if ($isDemoMode) {
            return 0;
        }

        $variants = array_values(array_filter(
            (array) ($inner['variants'] ?? []),
            static fn ($v) => is_string($v) && trim($v) !== ''
        ));

        $record = [
            'prompt_id' => $promptId,
            'source_lang' => (string) ($inner['detected_language'] ?? ($task->payload['source_lang'] ?? '')),
            'english' => $english,
            'cleaned' => trim((string) ($inner['cleaned'] ?? $english)),
            'variants' => $variants,
            'translated_at' => date('Y-m-d H:i:s'),
        ];

        // Daily short-sentence center FIRST: it persists the TTS bytes (if any)
        // and returns the served audio url, which we mirror into the AI history.
        $item = (new AppQyV1DailySentenceService())->ingestFromAssist(
            array_merge($record, ['audio_b64' => (string) ($inner['audio_base64'] ?? '')]),
            (string) ($task->payload['text'] ?? '')
        );
        $record['audio'] = is_array($item['audio'] ?? null) ? $item['audio'] : null;

        // AI history center (second half of the dual-write).
        (new DeveloperHistoryService())->recordPromptTranslation($promptId, $record);

        return 1;
    }

    public function getPriority(): int
    {
        return 10;
    }
}
