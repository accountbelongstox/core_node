<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use App\Apps\McpV1\McpV1Models\McpV1PlaceholderImageModel;
use App\Apps\McpV1\McpV1Utils\McpV1PlaceholderUtil;

class McpV1PlaceholderCleanupCommand extends Command
{
    protected $signature = 'mcpv1:placeholder-cleanup';

    protected $description = 'Cleanup placeholder images older than 1 day';

    public function handle(): int
    {
        $connection = (new McpV1PlaceholderImageModel())->getConnectionName();

        if (!McpV1PlaceholderImageModel::configuredTableExists()) {
            Log::warning('[McpV1PlaceholderCleanup] Table placeholder_images is missing; cleanup skipped', [
                'connection' => $connection,
            ]);
            $this->warn(__('mcp_v1.cleanup.table_missing', ['connection' => $connection]));

            return 0;
        }

        $this->info('Starting placeholder cleanup...');

        $deletedRecords = McpV1PlaceholderImageModel::cleanupOldImages();
        $this->info("Deleted {$deletedRecords} database records");

        $deletedFiles = McpV1PlaceholderUtil::cleanupOldFiles();
        $this->info("Deleted {$deletedFiles} orphaned files");

        $this->info('Cleanup completed successfully');

        return 0;
    }
}
