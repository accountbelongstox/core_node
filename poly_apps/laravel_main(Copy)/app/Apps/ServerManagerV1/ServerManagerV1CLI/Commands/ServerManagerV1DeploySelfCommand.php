<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use Illuminate\Support\Facades\Artisan;

class ServerManagerV1DeploySelfCommand extends ServerManagerV1BaseCommand
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'servermanager:deploy-self
                            {domain : The domain name to deploy this Laravel project}
                            {--ssl= : SSL mode (auto|true|false, default: auto)}
                            {--php-version= : PHP version (default: 8.4)}
                            {--no-reload : Do not reload nginx after deployment}
                            {--dry-run : Show what would be done without executing}';

    /**
     * The console command description.
     */
    protected $description = 'Deploy this Laravel main project as nginx website (shortcut for --type=poly)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        // PRE-REQUISITE: Fix PHP configuration before any operations
        // This ensures open_basedir restrictions are correct (matches 32_configure_php84.sh)
        $this->initializeCommand();
        $domain = $this->argument('domain');
        $ssl = $this->option('ssl') ?: 'auto';
        $phpVersion = $this->option('php-version') ?: '8.4';
        $dryRun = $this->option('dry-run');

        // Validate domain
        if (!$this->validateDomain($domain)) {
            return 1;
        }

        // Show information
        $this->info("=== Deploy Laravel Main Project ===");
        $this->info("Domain: $domain");
        $this->info("Type: poly (Laravel main project)");
        $this->info("SSL: $ssl");
        $this->info("PHP Version: $phpVersion");

        // Get Laravel main directory path
        $laravelDir = dirname(dirname(dirname(dirname(dirname(__DIR__)))));
        $publicDir = $laravelDir . '/public';

        $this->info("Project Path: $laravelDir");
        $this->info("Public Path: $publicDir");

        // Verify directory exists
        if (!is_dir($laravelDir) || !is_dir($publicDir)) {
            $this->error("Laravel main project directory or public directory not found!");
            $this->error("Expected: $laravelDir");
            return 1;
        }

        if ($dryRun) {
            $this->info("\n=== DRY RUN MODE ===");
            $this->info("Would execute: php artisan servermanager:website add $domain --type=poly --ssl=$ssl --php-version=$phpVersion");
            $this->info("This would:");
            $this->info("  1. Create nginx configuration for $domain");
            $this->info("  2. Point to: $publicDir");
            $this->info("  3. Configure PHP-FPM $phpVersion");
            $this->info("  4. Setup SSL certificate (mode: $ssl)");
            if (!$this->option('no-reload')) {
                $this->info("  5. Reload nginx service");
            }
            $this->info("=== END DRY RUN ===");
            return 0;
        }

        // Call servermanager:website add with poly type
        $this->info("\n=== Executing Website Add Command ===");
        $this->info("Running: php artisan servermanager:website add $domain --type=poly --ssl=$ssl --php-version=$phpVersion");

        $exitCode = Artisan::call('servermanager:website', [
            'action' => 'add',
            'domain' => $domain,
            '--type' => 'poly',
            '--ssl' => $ssl,
            '--php-version' => $phpVersion,
        ]);

        // Display the output from the website command
        $output = Artisan::output();
        if (!empty($output)) {
            $this->line($output);
        }

        if ($exitCode === 0) {
            $this->info("\n=== Deployment Successful ===");
            $this->info("Website deployed: $domain");
            $this->info("Document root: $publicDir");
            $this->info("PHP version: $phpVersion");
            $this->info("SSL: $ssl");

            if (!$this->option('no-reload')) {
                $this->info("\nReloading nginx...");
                $result = $this->executeCommand('sudo', ['systemctl', 'reload', 'nginx']);
                if (!$result['success']) {
                    $this->warn("Failed to reload nginx. Please reload manually: sudo systemctl reload nginx");
                }
            }

            $this->info("\nNext steps:");
            $this->info("  1. Update DNS records to point $domain to your server");
            $this->info("  2. Verify nginx configuration: sudo nginx -t");
            $this->info("  3. Check website status: php artisan servermanager:website status $domain");
            $this->info("  4. View all websites: php artisan servermanager:website list");

            return 0;
        } else {
            $this->error("\n=== Deployment Failed ===");
            $this->error("Failed to add website. Check the output above for details.");
            return 1;
        }
    }
}
