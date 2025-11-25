<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1NuxtServiceManager;

class NuxtServiceRefreshCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'nuxt:service:refresh {appname} {port} {debug=0}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Refresh or create Nuxt systemd service and sync to Nginx';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $appname = $this->argument('appname');
        $port = (int)$this->argument('port');
        $debug = (bool)$this->argument('debug');

        $this->info("===============================================================================");
        $this->info("  NUXT SERVICE REFRESH");
        $this->info("===============================================================================");
        $this->line("");
        $this->info("App      : {$appname}");
        $this->info("Port     : {$port}");
        $this->info("Mode     : " . ($debug ? 'debug' : 'production'));
        $this->line("");

        // Validate app exists
        if (!ServerManagerV1NuxtServiceManager::validateAppExists($appname)) {
            $this->error("App '{$appname}' does not exist!");
            $this->error("Expected directory: apps/app_{$appname}");
            $this->line("");

            $this->info("Available apps:");
            $availableApps = ServerManagerV1NuxtServiceManager::scanAvailableApps();
            foreach ($availableApps as $app) {
                $this->line("  - {$app}");
            }

            return 1;
        }

        $this->info("[Step 1] Validating app source...");
        $this->info("✓ App source validated: app_{$appname}_pages");
        $this->line("");

        // Create or refresh service
        $this->info("[Step 2] Creating/Refreshing systemd service...");

        $result = ServerManagerV1NuxtServiceManager::createOrRefreshService(
            $appname,
            $port,
            null, // user (will use current user)
            $debug,
            true  // auto-resolve duplicates
        );

        if (!$result['success']) {
            $this->error("Failed to create/refresh service!");
            if (isset($result['error'])) {
                $this->error("Error: " . $result['error']);
            }
            return 1;
        }

        $this->line("");
        $this->info("✓ Service operation: " . $result['action']);

        if ($result['mode_changed']) {
            $this->warn("  → Mode changed to: " . $result['mode']);
        }

        if ($result['port_changed']) {
            $this->warn("  → Port changed: {$result['old_port']} → {$result['new_port']}");
        }

        if (!empty($result['duplicates_removed'])) {
            $this->warn("  → Removed duplicate services:");
            foreach ($result['duplicates_removed'] as $dup) {
                $this->line("    - {$dup}");
            }
        }

        $this->line("");

        // Get service name and check status
        $serviceName = ServerManagerV1NuxtServiceManager::getNuxtServiceName($appname) . '.service';

        $this->info("[Step 3] Checking service status...");

        $status = ServerManagerV1NuxtServiceManager::getServiceStatus($appname);

        if ($status['exists']) {
            $this->info("✓ Service exists: {$serviceName}");
            $this->info("  State: " . ($status['active'] ? 'active' : 'inactive'));
            $this->info("  Enabled: " . ($status['enabled'] ? 'yes' : 'no'));
        } else {
            $this->warn("⚠ Service created but not yet loaded by systemd");
            $this->info("  Run: systemctl daemon-reload");
        }

        $this->line("");
        $this->info("===============================================================================");
        $this->info("  SYNC COMPLETE");
        $this->info("===============================================================================");
        $this->line("");

        $this->info("Service Details:");
        $this->line("  Name: {$serviceName}");
        $this->line("  Port: {$port}");
        $this->line("  Mode: " . ($debug ? 'debug (dev + watcher)' : 'production'));
        $this->line("");

        $this->info("Management Commands:");
        $this->line("  Start   : sudo systemctl start {$serviceName}");
        $this->line("  Stop    : sudo systemctl stop {$serviceName}");
        $this->line("  Restart : sudo systemctl restart {$serviceName}");
        $this->line("  Status  : sudo systemctl status {$serviceName}");
        $this->line("  Logs    : sudo journalctl -u {$serviceName} -f");
        $this->line("");

        $this->info("✓ Service refreshed successfully!");

        return 0;
    }
}
