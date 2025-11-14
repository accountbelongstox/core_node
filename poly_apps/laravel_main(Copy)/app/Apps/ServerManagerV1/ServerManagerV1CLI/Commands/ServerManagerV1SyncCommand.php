<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use Illuminate\Console\Command;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
use App\Apps\ServerManagerV1\ServerManagerV1Config\ServerManagerV1PathConfig;

/**
 * ServerManagerV1 Sync Command
 * 
 * This command synchronizes nginx configurations with the domain database,
 * cleaning up orphaned configurations and regenerating all active ones.
 * 
 * AI DEVELOPERS: Use this command to fix configuration inconsistencies
 * and ensure all nginx configs match the domain database state.
 */
class ServerManagerV1SyncCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'servermanager:sync
                            {--dry-run : Show what would be done without making changes}
                            {--status : Show current sync status only}
                            {--from-nginx : Sync FROM nginx TO database (import nginx configs)}
                            {--to-nginx : Sync FROM database TO nginx (regenerate nginx configs)}
                            {--merge : When syncing from nginx, merge with existing data (default: true)}
                            {--overwrite : When syncing from nginx, overwrite existing domains}';

    /**
     * The console command description.
     */
    protected $description = 'Synchronize nginx configurations with domain database (bidirectional)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('ServerManagerV1 Configuration Sync');
        $this->info('===================================');

        // Show current status
        if ($this->option('status')) {
            $this->showSyncStatus();
            return 0;
        }

        // Determine sync direction
        $fromNginx = $this->option('from-nginx');
        $toNginx = $this->option('to-nginx');

        if (!$fromNginx && !$toNginx) {
            $toNginx = true;
        }

        if ($fromNginx && $toNginx) {
            $this->error('Cannot use both --from-nginx and --to-nginx at the same time');
            return 1;
        }

        if ($this->option('dry-run')) {
            $this->info('DRY RUN MODE - No changes will be made');
            $this->info('');
        }

        $this->showSyncStatus();
        $this->info('');

        if ($fromNginx) {
            return $this->syncFromNginx();
        } else {
            return $this->syncToNginx();
        }
    }

    /**
     * Sync from nginx to database
     */
    private function syncFromNginx(): int
    {
        $this->info('Sync Direction: NGINX → DATABASE');
        $this->info('Importing nginx configurations into domain database');
        $this->info('');

        if (!$this->option('dry-run')) {
            if (!$this->confirm('This will import nginx configurations into the database. Continue?')) {
                $this->info('Operation cancelled.');
                return 0;
            }
        }

        $options = [
            'merge' => $this->option('merge') !== false,
            'overwrite' => $this->option('overwrite') ?? false,
            'dry_run' => $this->option('dry-run') ?? false
        ];

        $this->info('Starting import from nginx...');
        $results = ServerManagerV1DomainManager::syncFromNginx($options);

        $this->displayImportResults($results);

        return 0;
    }

    /**
     * Sync from database to nginx
     */
    private function syncToNginx(): int
    {
        $this->info('Sync Direction: DATABASE → NGINX');
        $this->info('Regenerating nginx configurations from domain database');
        $this->info('');

        if (!$this->option('dry-run')) {
            if (!$this->confirm('Do you want to proceed with synchronization?')) {
                $this->info('Synchronization cancelled.');
                return 0;
            }

            $this->info('Starting nginx configuration regeneration...');
            $results = ServerManagerV1DomainManager::syncAllNginxConfigurations();

            $this->displaySyncResults($results);

            $this->warn('');
            $this->warn('IMPORTANT: Reload nginx to load the new configurations:');
            $this->warn('   sudo systemctl reload nginx');
            $this->warn('   sudo systemctl status nginx');
        } else {
            $this->info('Dry run completed. Use --no-dry-run to execute changes.');
        }

        return 0;
    }

    /**
     * Show current synchronization status
     */
    private function showSyncStatus(): void
    {
        $this->info('Current Sync Status:');
        $this->info('-------------------');

        $status = ServerManagerV1DomainManager::getNginxSyncStatus();

        $this->info("Domains in database: {$status['domains_in_db']}");
        $this->info("Active domains: {$status['active_domains']}");
        $this->info("Nginx-enabled domains: {$status['nginx_enabled_domains']}");
        $this->info("Config files exist: {$status['config_files_exist']}");
        $this->info("Enabled links exist: {$status['enabled_links_exist']}");

        if (!empty($status['orphaned_configs'])) {
            $this->warn('');
            $this->warn('Orphaned configurations (will be removed):');
            foreach ($status['orphaned_configs'] as $config) {
                $this->warn("  - $config");
            }
        }

        if (!empty($status['missing_configs'])) {
            $this->warn('');
            $this->warn('Missing configurations (will be created):');
            foreach ($status['missing_configs'] as $domain) {
                $this->warn("  - $domain");
            }
        }

        if (empty($status['orphaned_configs']) && empty($status['missing_configs'])) {
            $this->info('');
            $this->info('✅ All configurations are in sync!');
        }
    }

    /**
     * Display synchronization results
     */
    private function displaySyncResults(array $results): void
    {
        $this->info('');
        $this->info('Synchronization Results:');
        $this->info('=======================');

        if (!empty($results['cleaned_files'])) {
            $this->info('Cleaned files:');
            foreach ($results['cleaned_files'] as $file) {
                $this->info("  ✓ Removed: " . basename($file));
            }
        }

        if (!empty($results['generated_configs'])) {
            $this->info('');
            $this->info('Generated configurations:');
            foreach ($results['generated_configs'] as $domain) {
                $this->info("  ✓ Generated: $domain");
            }
        }

        if (!empty($results['errors'])) {
            $this->error('');
            $this->error('Errors encountered:');
            foreach ($results['errors'] as $error) {
                $this->error("  ✗ $error");
            }
        }

        $cleanedCount = count($results['cleaned_files']);
        $generatedCount = count($results['generated_configs']);
        $errorCount = count($results['errors']);

        $this->info('');
        $this->info("Summary: {$cleanedCount} files cleaned, {$generatedCount} configs generated, {$errorCount} errors");

        if ($errorCount === 0) {
            $this->info('Synchronization completed successfully!');
        } else {
            $this->warn('Synchronization completed with errors. Check the logs for details.');
        }
    }

    /**
     * Display import results
     */
    private function displayImportResults(array $results): void
    {
        $this->info('');
        $this->info('Import Results:');
        $this->info('==============');

        $this->info("Scanned files: {$results['scanned_files']}");

        if (!empty($results['imported_domains'])) {
            $this->info('');
            $this->info('Imported domains:');
            foreach ($results['imported_domains'] as $domain) {
                $this->info("  ✓ Imported: $domain");
            }
        }

        if (!empty($results['updated_domains'])) {
            $this->info('');
            $this->info('Updated domains:');
            foreach ($results['updated_domains'] as $domain) {
                $this->info("  ✓ Updated: $domain");
            }
        }

        if (!empty($results['skipped_domains'])) {
            $this->warn('');
            $this->warn('Skipped domains:');
            foreach ($results['skipped_domains'] as $skipped) {
                $this->warn("  ⊘ {$skipped['domain']}: {$skipped['reason']}");
            }
        }

        if (!empty($results['errors'])) {
            $this->error('');
            $this->error('Errors encountered:');
            foreach ($results['errors'] as $error) {
                $this->error("  ✗ $error");
            }
        }

        $importedCount = count($results['imported_domains']);
        $updatedCount = count($results['updated_domains']);
        $skippedCount = count($results['skipped_domains']);
        $errorCount = count($results['errors']);

        $this->info('');
        $this->info("Summary: {$importedCount} imported, {$updatedCount} updated, {$skippedCount} skipped, {$errorCount} errors");

        if ($errorCount === 0) {
            $this->info('Import completed successfully!');
        } else {
            $this->warn('Import completed with errors. Check the logs for details.');
        }
    }
}
