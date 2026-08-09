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
 * Broadcast: a word_translation task's priority changed (move-to-front / bump).
 *
 * Phase-C broadcast contract event `task.priority` on the public
 * `translation-queue` channel. Tells pycore workers to re-order their view of
 * the queue in real time. Reliable ordering still comes from the HTTP
 * pull/claim endpoint; this is a hint to react sooner.
 *
 * Payload: { task_id, priority, old_priority?, bump }
 */
class TranslationTaskPriorityEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $taskId;
    public int $priority;
    public ?int $oldPriority;

    public function __construct(string $taskId, int $priority, ?int $oldPriority = null)
    {
        $this->taskId = $taskId;
        $this->priority = $priority;
        $this->oldPriority = $oldPriority;
    }

    public function broadcastOn(): Channel
    {
        return new Channel('translation-queue');
    }

    public function broadcastAs(): string
    {
        return 'task.priority';
    }

    public function broadcastWith(): array
    {
        $payload = [
            'task_id' => $this->taskId,
            'priority' => $this->priority,
            'bump' => $this->oldPriority === null || $this->priority > $this->oldPriority
                ? 'bumped'
                : 'reprioritized',
        ];
        if ($this->oldPriority !== null) {
            $payload['old_priority'] = $this->oldPriority;
        }

        return $payload;
    }
}
