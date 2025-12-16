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

class TaskCompletedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $taskId;
    public $result;
    public $workerId;

    public function __construct($taskId, $result, $workerId = null)
    {
        $this->taskId = $taskId;
        $this->result = $result;
        $this->workerId = $workerId;
    }

    public function broadcastOn()
    {
        return new Channel('task.' . $this->taskId);
    }

    public function broadcastAs()
    {
        return 'task.completed';
    }

    public function broadcastWith()
    {
        return [
            'task_id' => $this->taskId,
            'result' => $this->result,
            'worker_id' => $this->workerId,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
