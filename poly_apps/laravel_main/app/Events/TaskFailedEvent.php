<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;

class TaskFailedEvent
{
    use Dispatchable;

    public $taskId;
    public $error;
    public $workerId;
    public $canRetry;

    public function __construct($taskId, $error, $workerId = null, $canRetry = false)
    {
        $this->taskId = $taskId;
        $this->error = $error;
        $this->workerId = $workerId;
        $this->canRetry = $canRetry;
    }
}
