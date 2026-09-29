<?php

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
