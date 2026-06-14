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
 * Broadcast: a word_translation task's results were fully written back.
 *
 * Phase-C broadcast contract event `task.completed` on the public
 * `translation-queue` channel. Signals pycore workers that this task's batch is
 * done so they can drop it from any local view. Authoritative completion is
 * still the global task status set by the HTTP result endpoint.
 *
 * Payload: { task_id, target_language, word_count }
 */
class TranslationTaskCompletedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $taskId;
    public string $targetLanguage;
    public int $wordCount;

    public function __construct(string $taskId, string $targetLanguage, int $wordCount)
    {
        $this->taskId = $taskId;
        $this->targetLanguage = $targetLanguage;
        $this->wordCount = $wordCount;
    }

    public function broadcastOn(): Channel
    {
        return new Channel('translation-queue');
    }

    public function broadcastAs(): string
    {
        return 'task.completed';
    }

    public function broadcastWith(): array
    {
        return [
            'task_id' => $this->taskId,
            'target_language' => $this->targetLanguage,
            'word_count' => $this->wordCount,
        ];
    }
}
