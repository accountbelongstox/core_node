<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;

class TaskCompletedEvent
{
    use Dispatchable;

    public $taskId;
    public $result;
    public $workerId;

    public function __construct($taskId, $result, $workerId = null)
    {
        $this->taskId = $taskId;
        $this->result = $result;
        $this->workerId = $workerId;
    }
}
