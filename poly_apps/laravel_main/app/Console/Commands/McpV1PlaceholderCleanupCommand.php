<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Apps\McpV1\McpV1Models\McpV1PlaceholderImageModel;
use App\Apps\McpV1\McpV1Utils\McpV1PlaceholderUtil;

class McpV1PlaceholderCleanupCommand extends Command
{
    protected $signature = 'mcpv1:placeholder-cleanup';

    protected $description = 'Cleanup placeholder images older than 1 day';

    public function handle(): int
    {
        $this->info('Starting placeholder cleanup...');

        $deletedRecords = McpV1PlaceholderImageModel::cleanupOldImages();
        $this->info("Deleted {$deletedRecords} database records");

        $deletedFiles = McpV1PlaceholderUtil::cleanupOldFiles();
        $this->info("Deleted {$deletedFiles} orphaned files");

        $this->info('Cleanup completed successfully');

        return 0;
    }
}
