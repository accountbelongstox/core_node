<?php

namespace App\Services\TaskProcessors;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1PhraseExtractionService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1PhraseWriter;
use App\Models\GlobalTask;
use Illuminate\Support\Facades\Log;

/**
 * Writeback of pycore phrase_extract tasks (docs_fix/DESIGN_PHRASE_PIPELINE.md §4).
 *
 * payload: {language, prompt_key, prompt, model, max_tokens, lease_id, sentences:[{n, content_id, text}]}
 * result:  {text, model?} (flat or under result.result; `answer` accepted)
 *
 * The raw answer goes through the same parser and writer as the Laravel
 * gateway path. Stored count = sentences resolved (done + none); 0 makes the
 * result-trust gate fail the task, and the batch sentences got one attempt.
 */
class PhraseExtractTaskProcessor extends AbstractTaskProcessor
{
    protected function taskTypeRoles(): array
    {
        return ['phrase_extract'];
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        $payload = is_array($task->payload) ? $task->payload : [];
        $inner = isset($result['result']) && is_array($result['result']) ? $result['result'] : $result;
        $language = strtolower((string) ($payload['language'] ?? ''));
        $sentences = $this->sentences($payload);
        $raw = $inner['text'] ?? $inner['answer'] ?? $result['text'] ?? null;
        $model = $inner['model'] ?? $payload['model'] ?? null;
        $outcome = [];

        if ($isDemoMode) {
            return 0;
        }
        if ($language === '' || $sentences === []) {
            Log::warning('[PhraseExtractTaskProcessor] payload without language or sentences', ['task_id' => $task->task_id]);
            return 0;
        }
        try {
            if (!is_string($raw) || trim($raw) === '') {
                (new AppQyV1PhraseWriter())->recordFailure($language, array_column($sentences, 'content_id'));
                Log::warning('[PhraseExtractTaskProcessor] empty answer, attempts counted', ['task_id' => $task->task_id]);
                return 0;
            }
            $outcome = app(AppQyV1PhraseExtractionService::class)->store($language, $sentences, $raw, is_string($model) ? $model : null);
        } catch (\Throwable $e) {
            Log::error('[PhraseExtractTaskProcessor] writeback failed', ['task_id' => $task->task_id, 'error' => $e->getMessage()]);
            return 0;
        }

        return (int) ($outcome['done'] ?? 0) + (int) ($outcome['none'] ?? 0);
    }

    /** @return array<int, array{n:int, content_id:string, text:string}> */
    private function sentences(array $payload): array
    {
        $out = [];

        foreach ((array) ($payload['sentences'] ?? []) as $index => $sentence) {
            if (!is_array($sentence) || !is_string($sentence['content_id'] ?? null) || $sentence['content_id'] === '') {
                continue;
            }
            $out[] = [
                'n' => isset($sentence['n']) ? (int) $sentence['n'] : $index + 1,
                'content_id' => $sentence['content_id'],
                'text' => (string) ($sentence['text'] ?? ''),
            ];
        }

        return $out;
    }
}
