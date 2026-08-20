<?php

namespace App\Console\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1FrankenPhpReloadJob as ReloadJob;
use Illuminate\Console\Command;

class ServerManagerV1FrankenPhpReloadJob extends Command
{
    protected $signature = 'server-manager:frankenphp-reload-job {job_id}';
    protected $description = 'Execute a queued FrankenPHP operation outside the serving request';

    public function handle(): int
    {
        $jobId = (string) $this->argument('job_id');
        $result = ReloadJob::execute($jobId);

        $this->line(json_encode([
            'job_id' => $jobId,
            'status' => $result['status'] ?? 'failed',
            'success' => ($result['status'] ?? '') === 'completed',
        ], JSON_UNESCAPED_SLASHES));

        return self::SUCCESS;
    }
}
