<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast: a word_translation task was enqueued.
 *
 * Phase-C broadcast contract event `task.queued` on the public
 * `translation-queue` channel. Lets pycore workers learn about new work the
 * instant it is created instead of waiting for the next 5s HTTP poll. The HTTP
 * pull/claim flow stays the work transport; this is only the wake-up signal.
 *
 * Payload: { task_id, words:[str], language, target_language, priority }
 *
 * Uses ShouldBroadcastNow so the signal is sent inline (no queue worker needed)
 * — the broadcast is wrapped in best-effort try/catch at every fire point.
 */
class TranslationTaskQueuedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $taskId;
    public array $words;
    public string $language;
    public string $targetLanguage;
    public int $priority;

    public function __construct(
        string $taskId,
        array $words,
        string $language,
        string $targetLanguage,
        int $priority
    ) {
        $this->taskId = $taskId;
        $this->words = array_values($words);
        $this->language = $language;
        $this->targetLanguage = $targetLanguage;
        $this->priority = $priority;
    }

    /**
     * Public channel: pycore is a server-side consumer, so no per-user auth is
     * needed. Keep non-sensitive payloads only (see security note in docs).
     */
    public function broadcastOn(): Channel
    {
        return new Channel('translation-queue');
    }

    /**
     * Stable event name pycore matches on (not the FQCN).
     */
    public function broadcastAs(): string
    {
        return 'task.queued';
    }

    /**
     * Exact payload shape from the shared Phase-C contract.
     */
    public function broadcastWith(): array
    {
        return [
            'task_id' => $this->taskId,
            'words' => $this->words,
            'language' => $this->language,
            'target_language' => $this->targetLanguage,
            'priority' => $this->priority,
        ];
    }
}
