<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands;

use Illuminate\Console\Command;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1DomainManager;

/**
 * ServerManagerV1 Nginx Inspect Command
 *
 * Provides standalone nginx configuration inspection without modifying database
 *
 * AI DEVELOPERS: Use this command to inspect nginx configurations and
 * understand the current nginx setup without making any changes
 */
class ServerManagerV1NginxInspectCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'servermanager:nginx-inspect
                            {domain? : Specific domain to inspect}
                            {--summary : Show summary only}
                            {--detailed : Show detailed information}
                            {--json : Output in JSON format}
                            {--type= : Filter by type (html, laravel, poly)}
                            {--ssl : Show only SSL-enabled sites}
                            {--no-ssl : Show only non-SSL sites}
                            {--enabled : Show only enabled sites}
                            {--disabled : Show only disabled sites}';

    /**
     * The console command description.
     */
    protected $description = 'Inspect nginx configurations without modifying database';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $domain = $this->argument('domain');

        if ($domain) {
            return $this->inspectSpecificDomain($domain);
        }

        return $this->inspectAllDomains();
    }

    /**
     * Inspect specific domain
     */
    private function inspectSpecificDomain(string $domain): int
    {
        $info = ServerManagerV1DomainManager::collectNginxInfo();

        $found = null;
        foreach ($info['configurations'] as $config) {
            if ($config['domain'] === $domain) {
                $found = $config;
                break;
            }
        }

        if (!$found) {
            $this->error("Domain not found in nginx configurations: $domain");
            return 1;
        }

        if ($this->option('json')) {
            $this->line(json_encode($found, JSON_PRETTY_PRINT));
            return 0;
        }

        $this->info("Nginx Configuration Details: $domain");
        $this->info(str_repeat('=', 60));
        $this->table(
            ['Property', 'Value'],
            [
                ['Domain', $found['domain']],
                ['Server Names', implode(', ', $found['server_names'])],
                ['Document Root', $found['root']],
                ['Type', $found['type']],
                ['SSL Enabled', $found['ssl_enabled'] ? 'Yes' : 'No'],
                ['PHP Version', $found['php_version'] ?? 'N/A'],
                ['Enabled', $found['enabled'] ? 'Yes' : 'No'],
                ['Listen Ports', implode(', ', $found['listen_ports'])],
                ['Config File', $found['config_file']],
                ['File Size', number_format($found['file_size']) . ' bytes'],
                ['Modified', $found['modified_time']]
            ]
        );

        return 0;
    }

    /**
     * Inspect all domains
     */
    private function inspectAllDomains(): int
    {
        $info = ServerManagerV1DomainManager::collectNginxInfo();

        if (isset($info['error'])) {
            $this->error($info['error']);
            return 1;
        }

        if ($this->option('json')) {
            $this->line(json_encode($info, JSON_PRETTY_PRINT));
            return 0;
        }

        $this->info('Nginx Configuration Inspector');
        $this->info(str_repeat('=', 60));
        $this->info("Config Directory: {$info['nginx_config_dir']}");
        $this->info("Enabled Directory: {$info['nginx_enabled_dir']}");
        $this->info("Total Configurations: {$info['total_configs']}");
        $this->info("Enabled Sites: {$info['enabled_configs']}");
        $this->info('');

        if ($this->option('summary')) {
            $this->displaySummary($info);
            return 0;
        }

        $this->displayConfigurations($info);

        if ($this->option('detailed')) {
            $this->info('');
            $this->displaySummary($info);
        }

        return 0;
    }

    /**
     * Display summary information
     */
    private function displaySummary(array $info): void
    {
        $this->info('Summary by Type:');
        $this->info(str_repeat('-', 40));
        foreach ($info['summary']['by_type'] as $type => $count) {
            $this->info("  $type: $count");
        }

        $this->info('');
        $this->info('Summary by SSL:');
        $this->info(str_repeat('-', 40));
        $this->info("  SSL Enabled: {$info['summary']['by_ssl']['enabled']}");
        $this->info("  SSL Disabled: {$info['summary']['by_ssl']['disabled']}");

        if (!empty($info['summary']['by_php_version'])) {
            $this->info('');
            $this->info('Summary by PHP Version:');
            $this->info(str_repeat('-', 40));
            foreach ($info['summary']['by_php_version'] as $version => $count) {
                $this->info("  PHP $version: $count");
            }
        }
    }

    /**
     * Display configurations list
     */
    private function displayConfigurations(array $info): void
    {
        $configs = $info['configurations'];

        $typeFilter = $this->option('type');
        $sslFilter = $this->option('ssl');
        $noSslFilter = $this->option('no-ssl');
        $enabledFilter = $this->option('enabled');
        $disabledFilter = $this->option('disabled');

        if ($typeFilter || $sslFilter || $noSslFilter || $enabledFilter || $disabledFilter) {
            $configs = array_filter($configs, function ($config) use ($typeFilter, $sslFilter, $noSslFilter, $enabledFilter, $disabledFilter) {
                if ($typeFilter && $config['type'] !== $typeFilter) {
                    return false;
                }
                if ($sslFilter && !$config['ssl_enabled']) {
                    return false;
                }
                if ($noSslFilter && $config['ssl_enabled']) {
                    return false;
                }
                if ($enabledFilter && !$config['enabled']) {
                    return false;
                }
                if ($disabledFilter && $config['enabled']) {
                    return false;
                }
                return true;
            });
        }

        if (empty($configs)) {
            $this->warn('No configurations match the specified filters.');
            return;
        }

        $this->info('Configurations:');
        $this->info(str_repeat('-', 60));

        $tableData = [];
        foreach ($configs as $config) {
            $tableData[] = [
                $config['domain'],
                $config['type'],
                $config['ssl_enabled'] ? 'SSL' : 'HTTP',
                $config['php_version'] ?? 'N/A',
                $config['enabled'] ? 'Enabled' : 'Disabled',
                substr($config['root'], 0, 40) . (strlen($config['root']) > 40 ? '...' : '')
            ];
        }

        $this->table(
            ['Domain', 'Type', 'Protocol', 'PHP', 'Status', 'Root'],
            $tableData
        );

        $this->info('');
        $this->info("Total: " . count($tableData) . " configuration(s)");
    }
}
