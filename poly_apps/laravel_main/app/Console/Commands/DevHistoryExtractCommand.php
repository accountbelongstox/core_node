<?php

namespace App\Console\Commands;

use App\Services\DeveloperHistory\DeveloperHistoryService;
use Illuminate\Console\Command;

/**
 * Manually (re-)extract AI-tool prompt/session history into the data store.
 * Companion to DeveloperHistoryExtractionTask for on-demand refresh and for
 * non-Swoole deployments where the Octane timer does not run.
 */
class DevHistoryExtractCommand extends Command
{
    protected $signature = 'dev-history:extract {--force : Force re-extraction}';

    protected $description = 'Extract AI dev-tool (Claude/Codex/Gemini/Cursor) prompt & session history into the data store';

    public function handle(): int
    {
        $service = new DeveloperHistoryService();
        $result = $service->extract((bool) $this->option('force'));
        $this->info('Developer history extraction complete: ' . json_encode($result, JSON_UNESCAPED_SLASHES));
        return self::SUCCESS;
    }
}
