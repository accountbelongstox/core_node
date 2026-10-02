<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CodeSyncJob;
use Illuminate\Console\Command;

class ServerManagerV1CodeSyncJobCommand extends Command
{
    protected $signature = 'server-manager:code-sync-job {job_id}';
    protected $description = 'Execute a queued code sync job outside the serving request';

    public function handle(): int
    {
        $jobId = (string) $this->argument('job_id');
        $result = ServerManagerV1CodeSyncJob::execute($jobId);

        $this->line(json_encode([
            'job_id' => $jobId,
            'status' => $result['status'] ?? 'failed',
            'phase' => $result['phase'] ?? '',
        ], JSON_UNESCAPED_SLASHES));

        return ($result['status'] ?? '') === 'completed' ? self::SUCCESS : self::FAILURE;
    }
}
