<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1OctaneServiceManager;
use Illuminate\Support\Facades\Log;

class ServerManagerV1SwooleCommand extends ServerManagerV1BaseCommand
{
    protected $signature = 'servermanager:swoole
                            {action : Action to perform (start|stop|restart|status|switch-mode|list)}
                            {domain? : Domain name}
                            {--mode= : PHP mode (fpm|swoole|octane) for switch-mode action}
                            {--port= : Swoole port (default: auto-assign)}
                            {--workers= : Number of workers (default: 4)}
                            {--all : Apply to all Swoole services}';

    protected $description = 'Manage Laravel Octane/Swoole services';

    public function handle(): int
    {
        $this->initializeCommand();

        $action = $this->argument('action');
        $domain = $this->argument('domain');

        return match($action) {
            'start' => $this->startService($domain),
            'stop' => $this->stopService($domain),
            'restart' => $this->restartService($domain),
            'status' => $this->showStatus($domain),
            'switch-mode' => $this->switchMode($domain),
            'list' => $this->listServices(),
            default => $this->showHelp()
        };
    }

    private function startService(?string $domain): int
    {
        if (!$domain && !$this->option('all')) {
            $this->error('Domain is required (or use --all)');
            return 1;
        }

        if ($this->option('all')) {
            return $this->startAllServices();
        }

        $serviceInfo = ServerManagerV1DomainManager::getSwooleServiceInfo($domain);

        if (!$serviceInfo) {
            $this->error("Domain is not configured for Swoole: $domain");
            $this->line("Use: php artisan servermanager:swoole switch-mode {$domain} --mode=swoole");
            return 1;
        }

        // IMPORTANT: Check if this is a shared service (multiple domains, one directory)
        $primaryDomain = $serviceInfo['primary_domain'];
        $isShared = $primaryDomain !== $domain;

        $this->info("Starting Octane service for: $domain");
        if ($isShared) {
            $this->line("  Note: Shared service with primary domain: $primaryDomain");
        }
        $this->line("  Port: {$serviceInfo['port']}");
        $this->line("  Workers: {$serviceInfo['workers']}");
        $this->line("  Directory: {$serviceInfo['www_dir']}");

        // Check if service already exists
        $serviceStatus = ServerManagerV1OctaneServiceManager::getServiceStatus($serviceInfo['service_name']);
        if ($serviceStatus && $serviceStatus['is_active']) {
            $this->warn("Service is already running");
            $this->line("");
            $this->showServiceDetails($serviceInfo['service_name']);
            return 0;
        }

        // Use primary domain for service creation to ensure consistency
        if (ServerManagerV1OctaneServiceManager::deployOctaneService(
            $primaryDomain,
            $serviceInfo['port'],
            $serviceInfo['workers'],
            $serviceInfo['www_dir']
        )) {
            $this->success("Service started successfully");
            $this->line("");
            $this->showServiceDetails($serviceInfo['service_name']);
            return 0;
        }

        $this->error("Failed to start service");
        return 1;
    }

    private function stopService(?string $domain): int
    {
        if (!$domain) {
            $this->error('Domain is required');
            return 1;
        }

        $serviceInfo = ServerManagerV1DomainManager::getSwooleServiceInfo($domain);

        if (!$serviceInfo) {
            $this->error("Domain is not configured for Swoole: $domain");
            return 1;
        }

        $this->info("Stopping Octane service: {$serviceInfo['service_name']}");

        if (ServerManagerV1OctaneServiceManager::stopOctaneService($serviceInfo['service_name'])) {
            $this->success("Service stopped successfully");
            return 0;
        }

        $this->error("Failed to stop service");
        return 1;
    }

    private function restartService(?string $domain): int
    {
        if (!$domain && !$this->option('all')) {
            $this->error('Domain is required (or use --all)');
            return 1;
        }

        if ($this->option('all')) {
            return $this->restartAllServices();
        }

        $serviceInfo = ServerManagerV1DomainManager::getSwooleServiceInfo($domain);

        if (!$serviceInfo) {
            $this->error("Domain is not configured for Swoole: $domain");
            return 1;
        }

        $this->info("Restarting Octane service: {$serviceInfo['service_name']}");

        if (ServerManagerV1OctaneServiceManager::restartOctaneService($serviceInfo['service_name'])) {
            $this->success("Service restarted successfully");
            $this->line("");
            $this->showServiceDetails($serviceInfo['service_name']);
            return 0;
        }

        $this->error("Failed to restart service");
        return 1;
    }

    private function showStatus(?string $domain): int
    {
        if (!$domain && !$this->option('all')) {
            return $this->showAllStatus();
        }

        if ($this->option('all')) {
            return $this->showAllStatus();
        }

        $serviceInfo = ServerManagerV1DomainManager::getSwooleServiceInfo($domain);

        if (!$serviceInfo) {
            $this->error("Domain is not configured for Swoole: $domain");
            $this->line("");
            $this->info("Current mode: FPM");
            return 0;
        }

        $this->showServiceDetails($serviceInfo['service_name']);

        return 0;
    }

    private function switchMode(?string $domain): int
    {
        if (!$domain) {
            $this->error('Domain is required for switch-mode action');
            return 1;
        }

        $newMode = $this->option('mode');

        if (!$newMode) {
            $this->error('--mode option is required (fpm|swoole|octane)');
            return 1;
        }

        $config = ServerManagerV1DomainManager::getDomain($domain);

        if (!$config) {
            $this->error("Domain not found: $domain");
            return 1;
        }

        $oldMode = $config['php_mode'] ?? 'fpm';

        $this->info("Switching PHP mode for: $domain");
        $this->line("  From: $oldMode");
        $this->line("  To:   $newMode");
        $this->line("");

        $options = [];

        if ($newMode === 'swoole' || $newMode === 'octane') {
            if ($this->option('port')) {
                $options['swoole_port'] = (int)$this->option('port');
            }

            if ($this->option('workers')) {
                $options['swoole_workers'] = (int)$this->option('workers');
            }

            if (!isset($options['swoole_port'])) {
                $port = $config['swoole_port'] ?? null;
                if (!$port) {
                    $this->line("Auto-assigning Swoole port...");
                }
            }
        }

        if (ServerManagerV1DomainManager::switchPhpMode($domain, $newMode, $options)) {
            $this->success("Mode switched successfully");
            $this->line("");

            if ($oldMode === 'swoole' || $oldMode === 'octane') {
                $oldServiceInfo = ServerManagerV1DomainManager::getSwooleServiceInfo($domain);
                if ($oldServiceInfo) {
                    $this->line("Stopping old Swoole service...");
                    ServerManagerV1OctaneServiceManager::undeployOctaneService($domain, $config['swoole_port']);
                }
            }

            if ($newMode === 'swoole' || $newMode === 'octane') {
                $newConfig = ServerManagerV1DomainManager::getDomain($domain);
                $this->line("");
                $this->info("Swoole Configuration:");
                $this->line("  Port: {$newConfig['swoole_port']}");
                $this->line("  Workers: {$newConfig['swoole_workers']}");
                $this->line("");
                $this->line("Starting Swoole service...");

                if (ServerManagerV1OctaneServiceManager::deployOctaneService(
                    $domain,
                    $newConfig['swoole_port'],
                    $newConfig['swoole_workers'],
                    $newConfig['www_dir']
                )) {
                    $this->success("Swoole service started");
                } else {
                    $this->warn("Service creation initiated, but may need manual start");
                }
            }

            $this->line("");
            $this->line("Nginx configuration updated. Reload nginx:");
            $this->line("  sudo systemctl reload nginx");

            return 0;
        }

        $this->error("Failed to switch mode");
        return 1;
    }

    private function listServices(): int
    {
        $this->info("Octane/Swoole Services:");
        $this->line("");

        // IMPORTANT: Get unique Swoole services (one per directory)
        // Multiple domains sharing the same directory will be grouped together
        $uniqueServices = ServerManagerV1DomainManager::getUniqueSwooleServices();
        $grouped = ServerManagerV1DomainManager::getDomainsGroupedByPhpMode();

        $this->line("=== Swoole/Octane Services (One Service Per Directory) ===");

        if (!empty($uniqueServices)) {
            $this->info("Unique Services: " . count($uniqueServices));
            $this->line("");

            foreach ($uniqueServices as $serviceInfo) {
                $serviceName = 'octane-' . str_replace('.', '-', $serviceInfo['primary_domain']) . '-' . $serviceInfo['port'];
                $serviceStatus = ServerManagerV1OctaneServiceManager::getServiceStatus($serviceName);
                $statusIcon = ($serviceStatus && $serviceStatus['is_active']) ? '●' : '○';
                $statusColor = ($serviceStatus && $serviceStatus['is_active']) ? 'green' : 'red';
                $timerIcon = ($serviceStatus && $serviceStatus['timer_active']) ? '⏰' : '';

                $this->line("  <fg={$statusColor}>{$statusIcon}</> {$serviceName} {$timerIcon}");
                $this->line("     Primary Domain: {$serviceInfo['primary_domain']}");
                $this->line("     Port: {$serviceInfo['port']}, Workers: {$serviceInfo['workers']}");
                $this->line("     Directory: {$serviceInfo['www_dir']}");

                if (count($serviceInfo['domains']) > 1) {
                    $this->line("     Shared by " . count($serviceInfo['domains']) . " domain(s):");
                    foreach ($serviceInfo['domains'] as $sharedDomain) {
                        $this->line("       - $sharedDomain");
                    }
                } else {
                    $this->line("     Single domain service");
                }
                $this->line("");
            }
        } else {
            $this->line("  No Swoole/Octane services configured");
            $this->line("");
        }

        if (!empty($grouped['fpm'])) {
            $this->line("=== FPM Mode ===");
            $this->info("FPM Mode ({$this->count($grouped['fpm'])} domains):");
            foreach ($grouped['fpm'] as $domainInfo) {
                $status = $domainInfo['status'] === 'active' ? '✓' : '✗';
                $this->line("  {$status} {$domainInfo['domain']}");
            }
            $this->line("");
        }

        $this->line("=== System Services Status ===");
        $services = ServerManagerV1OctaneServiceManager::getAllServicesStatus();

        if (empty($services)) {
            $this->line("  No Octane services running");
        } else {
            foreach ($services as $serviceStatus) {
                $statusIcon = $serviceStatus['is_active'] ? '●' : '○';
                $statusColor = $serviceStatus['is_active'] ? 'green' : 'red';
                $timerIcon = $serviceStatus['timer_active'] ? '⏰' : '';

                $this->line("  <fg={$statusColor}>{$statusIcon}</> {$serviceStatus['service']} {$timerIcon}");
            }
        }

        return 0;
    }

    private function showAllStatus(): int
    {
        return $this->listServices();
    }

    private function startAllServices(): int
    {
        $this->info("Starting all Swoole/Octane services...");
        $this->line("");

        // IMPORTANT: Only start unique services (one per directory)
        // Multiple domains sharing the same directory share one service
        $uniqueServices = ServerManagerV1DomainManager::getUniqueSwooleServices();
        $successCount = 0;
        $failCount = 0;

        if (empty($uniqueServices)) {
            $this->warn("No Swoole/Octane services configured");
            return 0;
        }

        foreach ($uniqueServices as $serviceInfo) {
            $primaryDomain = $serviceInfo['primary_domain'];
            $serviceName = 'octane-' . str_replace('.', '-', $primaryDomain) . '-' . $serviceInfo['port'];

            $this->line("Starting: $serviceName");
            $this->line("  Primary Domain: $primaryDomain");
            $this->line("  Port: {$serviceInfo['port']}");

            if (count($serviceInfo['domains']) > 1) {
                $this->line("  Shared by " . count($serviceInfo['domains']) . " domain(s)");
            }

            // Check if already running
            $serviceStatus = ServerManagerV1OctaneServiceManager::getServiceStatus($serviceName);
            if ($serviceStatus && $serviceStatus['is_active']) {
                $this->line("  ⚠ Already running");
                $successCount++;
                continue;
            }

            // Start the service using primary domain
            if (ServerManagerV1OctaneServiceManager::deployOctaneService(
                $primaryDomain,
                $serviceInfo['port'],
                $serviceInfo['workers'],
                $serviceInfo['www_dir']
            )) {
                $this->line("  ✓ Success");
                $successCount++;
            } else {
                $this->line("  ✗ Failed");
                $failCount++;
            }
        }

        $this->line("");
        $this->info("Summary: {$successCount} started, {$failCount} failed");

        return $failCount > 0 ? 1 : 0;
    }

    private function restartAllServices(): int
    {
        $this->info("Restarting all Octane services...");
        $this->line("");

        $results = ServerManagerV1OctaneServiceManager::restartAllOctaneServices();

        $this->info("Summary:");
        $this->line("  Success: {$results['success_count']}");
        if ($results['fail_count'] > 0) {
            $this->error("  Failed: {$results['fail_count']}");
        }

        return $results['fail_count'] > 0 ? 1 : 0;
    }

    private function showServiceDetails(string $serviceName): void
    {
        $status = ServerManagerV1OctaneServiceManager::getServiceStatus($serviceName);

        $this->info("Service Details:");
        $this->line("");
        $this->line($status['service_status']);

        if ($status['timer_active']) {
            $this->line("");
            $this->info("Auto-restart Timer:");
            $this->line($status['timer_status']);
        }
    }

    private function count(array $items): int
    {
        return count($items);
    }

    private function showHelp(): int
    {
        $this->line("");
        $this->info("Laravel Octane/Swoole Service Manager");
        $this->line("");
        $this->line("Usage:");
        $this->line("  php artisan servermanager:swoole <action> [domain] [options]");
        $this->line("");
        $this->line("Actions:");
        $this->line("  start <domain>         Start Swoole service for domain");
        $this->line("  start --all            Start all Swoole services");
        $this->line("  stop <domain>          Stop Swoole service for domain");
        $this->line("  restart <domain>       Restart Swoole service");
        $this->line("  restart --all          Restart all Swoole services");
        $this->line("  status [domain]        Show service status (all if no domain)");
        $this->line("  switch-mode <domain>   Switch PHP mode (requires --mode)");
        $this->line("  list                   List all Swoole services");
        $this->line("");
        $this->line("Options:");
        $this->line("  --mode=<mode>          PHP mode: fpm, swoole, octane");
        $this->line("  --port=<port>          Swoole port (default: auto-assign)");
        $this->line("  --workers=<n>          Number of workers (default: 4)");
        $this->line("  --all                  Apply to all services");
        $this->line("");
        $this->line("Examples:");
        $this->line("  # Switch domain to Swoole mode");
        $this->line("  php artisan servermanager:swoole switch-mode api.example.com --mode=swoole");
        $this->line("");
        $this->line("  # Start Swoole service");
        $this->line("  php artisan servermanager:swoole start api.example.com");
        $this->line("");
        $this->line("  # Switch back to FPM");
        $this->line("  php artisan servermanager:swoole switch-mode api.example.com --mode=fpm");
        $this->line("");
        $this->line("  # Restart all services");
        $this->line("  php artisan servermanager:swoole restart --all");
        $this->line("");

        return 0;
    }
}
