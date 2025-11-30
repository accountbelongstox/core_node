<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;

class ServerManagerV1AdvancedCommand extends ServerManagerV1BaseCommand
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'servermanager:advanced
                            {action : Action to perform (search|validate|backup|restore|export|import|batch-enable|batch-disable|history|grouped|templates|alias)}
                            {--type= : Filter by website type}
                            {--status= : Filter by status}
                            {--ssl= : Filter by SSL status (true|false)}
                            {--php-version= : Filter by PHP version}
                            {--search= : Search term for domain/directory}
                            {--format= : Export/import format (json|csv|nginx)}
                            {--file= : File path for import/export/restore}
                            {--merge : Merge on import/restore instead of replace}
                            {--domains=* : List of domains for batch operations}
                            {--reason= : Reason for batch disable}
                            {--limit= : Limit for history results}
                            {--source= : Source domain for alias}
                            {--target= : Target domain for alias}
                            {--redirect-code=301 : Redirect HTTP code (301|302)}
                            {--template= : Template ID to apply}';

    /**
     * The console command description.
     */
    protected $description = 'Advanced domain management operations (search, validate, backup, batch operations, etc.)';

    /**
     * Execute the console command.
     * 
     * NOTE: Each Artisan command has its own handle() method - this is Laravel's standard design.
     * There is no single "main entry point" because Laravel routes commands by their signature
     * (e.g., 'servermanager:website', 'servermanager:certificate', etc.) to the appropriate
     * command class. Each command class extends ServerManagerV1BaseCommand which provides
     * common functionality like initializeCommand() for PHP configuration fixes.
     */
    public function handle(): int
    {
        // PRE-REQUISITE: Fix PHP configuration before any operations
        // This ensures open_basedir restrictions are correct (matches 32_configure_php84.sh)
        $this->initializeCommand();
        
        $action = $this->argument('action');

        return match($action) {
            'search' => $this->searchDomains(),
            'validate' => $this->validateConfigurations(),
            'backup' => $this->backupDomains(),
            'restore' => $this->restoreDomains(),
            'export' => $this->exportDomains(),
            'import' => $this->importDomains(),
            'batch-enable' => $this->batchEnable(),
            'batch-disable' => $this->batchDisable(),
            'history' => $this->showHistory(),
            'grouped' => $this->showGrouped(),
            'templates' => $this->showTemplates(),
            'alias' => $this->addAlias(),
            default => $this->showHelp()
        };
    }

    /**
     * Search domains
     */
    private function searchDomains(): int
    {
        $criteria = [];

        if ($this->option('type')) {
            $criteria['type'] = $this->option('type');
        }
        if ($this->option('status')) {
            $criteria['status'] = $this->option('status');
        }
        if ($this->option('ssl') !== null) {
            $criteria['ssl_enabled'] = $this->option('ssl') === 'true';
        }
        if ($this->option('php-version')) {
            $criteria['php_version'] = $this->option('php-version');
        }
        if ($this->option('search')) {
            $criteria['search_term'] = $this->option('search');
        }

        $this->info("=== Domain Search ===");
        $this->line("Criteria:");
        foreach ($criteria as $key => $value) {
            $this->line("  $key: " . (is_bool($value) ? ($value ? 'true' : 'false') : $value));
        }
        $this->line("");

        $results = ServerManagerV1DomainManager::searchDomains($criteria);

        if (empty($results)) {
            $this->warn("No domains found matching criteria");
            return 0;
        }

        $this->info("Found " . count($results) . " domain(s):");
        $this->line("");

        foreach ($results as $domain => $config) {
            $sslIcon = ($config['ssl_enabled'] ?? false) ? '🔒' : '🔓';
            $statusIcon = match($config['status']) {
                'active' => '✅',
                'disabled' => '❌',
                'error' => '⚠️',
                default => '❓'
            };

            $this->line("$statusIcon $sslIcon $domain");
            $this->line("    Type: " . $config['type']);
            $this->line("    Status: " . $config['status']);
            $this->line("    PHP: " . $config['php_version']);
            $this->line("    Directory: " . $config['www_dir']);
            $this->line("");
        }

        return 0;
    }

    /**
     * Validate all configurations
     */
    private function validateConfigurations(): int
    {
        $this->info("=== Configuration Validation ===");
        $this->info("Validating all domain configurations...");
        $this->line("");

        $results = ServerManagerV1DomainManager::validateAllConfigurations();

        $this->info("Total domains: " . $results['total']);
        $this->info("Valid: " . $results['valid']);
        $this->error("Invalid: " . $results['invalid']);
        $this->warn("Warnings: " . $results['warnings']);
        $this->line("");

        if (!empty($results['issues'])) {
            $this->error("=== Issues Found ===");
            $this->line("");

            foreach ($results['issues'] as $domain => $validation) {
                if (!$validation['valid']) {
                    $this->error("❌ $domain - INVALID");
                } else {
                    $this->warn("⚠️  $domain - Has warnings");
                }

                if (!empty($validation['errors'])) {
                    $this->line("  Errors:");
                    foreach ($validation['errors'] as $error) {
                        $this->line("    - $error");
                    }
                }

                if (!empty($validation['warnings'])) {
                    $this->line("  Warnings:");
                    foreach ($validation['warnings'] as $warning) {
                        $this->line("    - $warning");
                    }
                }

                $this->line("");
            }
        } else {
            $this->info("✅ All configurations are valid!");
        }

        return $results['invalid'] > 0 ? 1 : 0;
    }

    /**
     * Backup domains
     */
    private function backupDomains(): int
    {
        $this->info("=== Backup Domains ===");

        $result = ServerManagerV1DomainManager::backupDomains();

        if ($result['success']) {
            $this->info("✅ Backup created successfully!");
            $this->line("File: " . $result['backup_file']);
            $this->line("Domains: " . $result['total_domains']);
            $this->line("Name: " . $result['backup_name']);
            return 0;
        } else {
            $this->error("❌ Backup failed: " . $result['error']);
            return 1;
        }
    }

    /**
     * Restore domains
     */
    private function restoreDomains(): int
    {
        $backupFile = $this->option('file');

        if (!$backupFile) {
            $this->error("--file option is required for restore");
            $this->line("");

            // List available backups
            $backups = ServerManagerV1DomainManager::listBackups();
            if (!empty($backups)) {
                $this->info("Available backups:");
                foreach ($backups as $backup) {
                    $this->line("  " . $backup['name']);
                    $this->line("    Date: " . $backup['date']);
                    $this->line("    Domains: " . $backup['total_domains']);
                    $this->line("    File: " . $backup['file']);
                    $this->line("");
                }
            }

            return 1;
        }

        $merge = $this->option('merge');

        $this->warn("=== Restore Domains ===");
        $this->line("File: $backupFile");
        $this->line("Mode: " . ($merge ? 'MERGE' : 'REPLACE'));
        $this->line("");

        if (!$merge) {
            $this->error("⚠️  WARNING: REPLACE mode will DELETE all existing domains!");
            if (!$this->confirm('Are you sure?', false)) {
                $this->info('Restore cancelled');
                return 0;
            }
        }

        $result = ServerManagerV1DomainManager::restoreDomains($backupFile, $merge);

        if ($result['success']) {
            $this->info("✅ Restore completed!");
            $this->line("Action: " . $result['action']);
            $this->line("Restored: " . $result['restored_domains']);
            $this->line("Total: " . $result['total_domains']);
            return 0;
        } else {
            $this->error("❌ Restore failed: " . $result['error']);
            return 1;
        }
    }

    /**
     * Export domains
     */
    private function exportDomains(): int
    {
        $format = $this->option('format') ?: 'json';

        $this->info("=== Export Domains ===");
        $this->line("Format: $format");
        $this->line("");

        $result = ServerManagerV1DomainManager::exportDomains($format);

        if ($result['success']) {
            $this->info("✅ Export completed!");
            $this->line("File: " . $result['export_file']);
            $this->line("Format: " . $result['format']);
            $this->line("Domains: " . $result['total_domains']);
            return 0;
        } else {
            $this->error("❌ Export failed: " . $result['error']);
            return 1;
        }
    }

    /**
     * Import domains
     */
    private function importDomains(): int
    {
        $importFile = $this->option('file');
        $format = $this->option('format') ?: 'json';
        $merge = $this->option('merge');

        if (!$importFile) {
            $this->error("--file option is required for import");
            return 1;
        }

        $this->warn("=== Import Domains ===");
        $this->line("File: $importFile");
        $this->line("Format: $format");
        $this->line("Mode: " . ($merge ? 'MERGE' : 'REPLACE'));
        $this->line("");

        if (!$merge) {
            $this->error("⚠️  WARNING: REPLACE mode will DELETE all existing domains!");
            if (!$this->confirm('Are you sure?', false)) {
                $this->info('Import cancelled');
                return 0;
            }
        }

        $result = ServerManagerV1DomainManager::importDomains($importFile, $format, $merge);

        if ($result['success']) {
            $this->info("✅ Import completed!");
            $this->line("Imported: " . $result['imported_domains']);
            $this->line("Total: " . $result['total_domains']);
            return 0;
        } else {
            $this->error("❌ Import failed: " . $result['error']);
            return 1;
        }
    }

    /**
     * Batch enable domains
     */
    private function batchEnable(): int
    {
        $domains = $this->option('domains');

        if (empty($domains)) {
            $this->error("--domains option is required");
            $this->line("Example: --domains=example.com --domains=test.com");
            return 1;
        }

        $this->info("=== Batch Enable Domains ===");
        $this->line("Domains: " . implode(', ', $domains));
        $this->line("");

        if (!$this->confirm('Enable these domains?', true)) {
            $this->info('Operation cancelled');
            return 0;
        }

        $results = ServerManagerV1DomainManager::batchEnableSites($domains);

        $this->info("Results:");
        $this->line("  Total: " . $results['total']);
        $this->line("  Success: " . count($results['success']));
        $this->line("  Failed: " . count($results['failed']));
        $this->line("");

        if (!empty($results['success'])) {
            $this->info("✅ Enabled:");
            foreach ($results['success'] as $domain) {
                $this->line("  - $domain");
            }
        }

        if (!empty($results['failed'])) {
            $this->error("❌ Failed:");
            foreach ($results['failed'] as $domain) {
                $this->line("  - $domain");
            }
        }

        return empty($results['failed']) ? 0 : 1;
    }

    /**
     * Batch disable domains
     */
    private function batchDisable(): int
    {
        $domains = $this->option('domains');
        $reason = $this->option('reason');

        if (empty($domains)) {
            $this->error("--domains option is required");
            $this->line("Example: --domains=example.com --domains=test.com");
            return 1;
        }

        $this->warn("=== Batch Disable Domains ===");
        $this->line("Domains: " . implode(', ', $domains));
        if ($reason) {
            $this->line("Reason: $reason");
        }
        $this->line("");

        if (!$this->confirm('Disable these domains?', false)) {
            $this->info('Operation cancelled');
            return 0;
        }

        $options = $reason ? ['reason' => $reason] : [];
        $results = ServerManagerV1DomainManager::batchDisableSites($domains, $options);

        $this->info("Results:");
        $this->line("  Total: " . $results['total']);
        $this->line("  Success: " . count($results['success']));
        $this->line("  Failed: " . count($results['failed']));
        $this->line("");

        if (!empty($results['success'])) {
            $this->info("✅ Disabled:");
            foreach ($results['success'] as $domain) {
                $this->line("  - $domain");
            }
        }

        if (!empty($results['failed'])) {
            $this->error("❌ Failed:");
            foreach ($results['failed'] as $domain) {
                $this->line("  - $domain");
            }
        }

        return empty($results['failed']) ? 0 : 1;
    }

    /**
     * Show domain history
     */
    private function showHistory(): int
    {
        $domain = $this->option('search'); // Use search as domain filter
        $limit = (int) ($this->option('limit') ?: 50);

        $this->info("=== Domain History ===");
        if ($domain) {
            $this->line("Domain: $domain");
        } else {
            $this->line("All domains");
        }
        $this->line("Limit: $limit");
        $this->line("");

        $history = ServerManagerV1DomainManager::getHistory($domain, $limit);

        if (empty($history)) {
            $this->warn("No history found");
            return 0;
        }

        foreach ($history as $entry) {
            $actionIcon = match($entry['action']) {
                'create' => '➕',
                'update' => '✏️',
                'delete' => '🗑️',
                'enable' => '✅',
                'disable' => '❌',
                default => '📝'
            };

            $this->line("$actionIcon " . $entry['timestamp'] . " - " . $entry['domain']);
            $this->line("   Action: " . $entry['action']);
            $this->line("   User: " . $entry['user']);

            if (!empty($entry['details'])) {
                $this->line("   Details: " . json_encode($entry['details'], JSON_PRETTY_PRINT));
            }

            $this->line("");
        }

        return 0;
    }

    /**
     * Show domains grouped by site
     */
    private function showGrouped(): int
    {
        $this->info("=== Domains Grouped by Site ===");
        $this->line("");

        $grouped = ServerManagerV1DomainManager::getDomainsGroupedBySite();

        foreach ($grouped as $wwwDir => $site) {
            $domainCount = count($site['domains']);
            $this->info("📁 " . $wwwDir . " (" . $site['type'] . ")");
            $this->line("   Domains: $domainCount");

            foreach ($site['domains'] as $domainInfo) {
                $sslIcon = $domainInfo['ssl_enabled'] ? '🔒' : '🔓';
                $statusIcon = $domainInfo['status'] === 'active' ? '✅' : '❌';

                $this->line("   $statusIcon $sslIcon " . $domainInfo['domain']);
            }

            $this->line("");
        }

        return 0;
    }

    /**
     * Show available templates
     */
    private function showTemplates(): int
    {
        $this->info("=== Available Site Templates ===");
        $this->line("");

        $templates = ServerManagerV1DomainManager::getTemplates();

        foreach ($templates as $id => $template) {
            $this->info("📋 $id - " . $template['name']);
            $this->line("   Description: " . $template['description']);
            $this->line("   Type: " . $template['type']);
            $this->line("   PHP: " . ($template['php_version'] ?? 'N/A'));
            $this->line("   SSL Required: " . ($template['ssl_required'] ? 'Yes' : 'No'));
            $this->line("   Features: " . implode(', ', $template['features']));
            $this->line("");
        }

        $this->line("Usage:");
        $this->line("  php artisan servermanager:advanced alias --source=example.com --target=main.example.com --template=laravel_api");
        $this->line("");

        return 0;
    }

    /**
     * Add domain alias/redirect
     */
    private function addAlias(): int
    {
        $source = $this->option('source');
        $target = $this->option('target');
        $redirectCode = (int) $this->option('redirect-code');

        if (!$source || !$target) {
            $this->error("Both --source and --target options are required");
            $this->line("Example: --source=www.example.com --target=example.com");
            return 1;
        }

        $this->info("=== Add Domain Alias ===");
        $this->line("Source: $source");
        $this->line("Target: $target");
        $this->line("Redirect: $redirectCode");
        $this->line("");

        if (!$this->confirm('Create alias?', true)) {
            $this->info('Operation cancelled');
            return 0;
        }

        if (ServerManagerV1DomainManager::addDomainAlias($source, $target, $redirectCode)) {
            $this->info("✅ Domain alias created successfully!");
            $this->line("$source -> $target ($redirectCode)");
            return 0;
        } else {
            $this->error("❌ Failed to create domain alias");
            return 1;
        }
    }

    /**
     * Show help
     */
    private function showHelp(): int
    {
        $this->info("=== ServerManager Advanced Operations ===");
        $this->line("");
        $this->line("Available actions:");
        $this->line("");

        $this->info("Search & Query:");
        $this->line("  search          Search domains by criteria");
        $this->line("  grouped         Show domains grouped by site");
        $this->line("  history         Show domain operation history");
        $this->line("");

        $this->info("Validation:");
        $this->line("  validate        Validate all domain configurations");
        $this->line("");

        $this->info("Backup & Restore:");
        $this->line("  backup          Backup all domains configuration");
        $this->line("  restore         Restore from backup");
        $this->line("");

        $this->info("Import & Export:");
        $this->line("  export          Export domains (json|csv|nginx)");
        $this->line("  import          Import domains from file");
        $this->line("");

        $this->info("Batch Operations:");
        $this->line("  batch-enable    Enable multiple domains");
        $this->line("  batch-disable   Disable multiple domains");
        $this->line("");

        $this->info("Templates & Aliases:");
        $this->line("  templates       List available site templates");
        $this->line("  alias           Create domain alias/redirect");
        $this->line("");

        $this->line("Examples:");
        $this->line("");
        $this->line("  # Search active Laravel sites");
        $this->line("  php artisan servermanager:advanced search --type=laravel --status=active");
        $this->line("");
        $this->line("  # Validate all configurations");
        $this->line("  php artisan servermanager:advanced validate");
        $this->line("");
        $this->line("  # Backup domains");
        $this->line("  php artisan servermanager:advanced backup");
        $this->line("");
        $this->line("  # Export to CSV");
        $this->line("  php artisan servermanager:advanced export --format=csv");
        $this->line("");
        $this->line("  # Batch disable");
        $this->line("  php artisan servermanager:advanced batch-disable --domains=test.com --domains=staging.com");
        $this->line("");
        $this->line("  # Add redirect");
        $this->line("  php artisan servermanager:advanced alias --source=www.example.com --target=example.com");
        $this->line("");

        return 0;
    }
}
