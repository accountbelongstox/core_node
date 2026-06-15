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

class TaskProgressEvent
{
    use Dispatchable;

    public $taskId;
    public $progress;
    public $status;
    public $message;

    public function __construct($taskId, $progress, $status, $message = null)
    {
        $this->taskId = $taskId;
        $this->progress = $progress;
        $this->status = $status;
        $this->message = $message;
    }
}
