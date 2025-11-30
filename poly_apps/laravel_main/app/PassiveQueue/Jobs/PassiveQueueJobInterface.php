<?php

namespace App\PassiveQueue\Jobs;

interface PassiveQueueJobInterface
{
    /**
     * Handle the queued job.
     *
     * @param array $payload
     * @return void
     */
    public function handle(array $payload): void;
}
