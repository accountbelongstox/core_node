<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\ApiResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\File;
use App\Providers\PathMapper;

/**
 * System Configuration Controller
 * Manages server configuration settings
 * Requires admin authentication
 */
class SystemConfigController extends Controller
{
    use ApiResponse;

    /**
     * Get server configuration
     * Returns readable configuration values (no sensitive data)
     */
    public function getConfig(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return $this->error('Unauthorized. Admin access required.', 403);
        }

        $config = [
            'app' => [
                'name' => config('app.name'),
                'env' => config('app.env'),
                'debug' => config('app.debug'),
                'url' => config('app.url'),
                'timezone' => config('app.timezone'),
                'locale' => config('app.locale'),
            ],
            'database' => [
                'default' => config('database.default'),
                'connections' => $this->getDatabaseConnections(),
            ],
            'cache' => [
                'default' => config('cache.default'),
                'stores' => $this->getCacheStores(),
            ],
            'session' => [
                'driver' => config('session.driver'),
                'lifetime' => config('session.lifetime'),
                'encrypt' => config('session.encrypt'),
                'expire_on_close' => config('session.expire_on_close'),
            ],
            'queue' => [
                'default' => config('queue.default'),
                'connections' => $this->getQueueConnections(),
            ],
            'mail' => [
                'default' => config('mail.default'),
                'mailers' => $this->getMailers(),
            ],
            'filesystems' => [
                'default' => config('filesystems.default'),
                'disks' => $this->getFilesystemDisks(),
            ],
            'paths' => [
                'core_node' => PathMapper::getCoreNodeDir(),
                'laravel_data' => PathMapper::getLaravelDataDir(),
                'wwwroot' => PathMapper::mapWebPath('wwwroot'),
                'storage' => storage_path(),
                'public' => public_path(),
            ],
            'server' => [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
            ],
            'sanctum' => [
                'expiration' => config('sanctum.expiration'),
                'token_prefix' => config('sanctum.token_prefix', ''),
            ],
            'logging' => [
                'default' => config('logging.default'),
                'channels' => $this->getLoggingChannels(),
            ],
        ];

        return $this->success($config, 'Server configuration retrieved successfully');
    }

    /**
     * Update server configuration
     * Only allows updating safe configuration values
     */
    public function updateConfig(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isSuperAdmin()) {
            return $this->error('Unauthorized. Super admin access required.', 403);
        }

        $validated = $request->validate([
            'app.name' => 'nullable|string|max:255',
            'app.timezone' => 'nullable|string|max:50',
            'app.locale' => 'nullable|string|max:10',
            'app.url' => 'nullable|url|max:255',
            'session.lifetime' => 'nullable|integer|min:1|max:525600',
            'session.encrypt' => 'nullable|boolean',
            'session.expire_on_close' => 'nullable|boolean',
        ]);

        $updated = [];
        foreach ($validated as $key => $value) {
            if ($value !== null) {
                Config::set($key, $value);
                $updated[$key] = $value;
            }
        }

        if (empty($updated)) {
            return $this->error('No valid configuration values provided', 400);
        }

        return $this->success(['updated' => $updated], 'Configuration updated successfully');
    }

    /**
     * Get database connections info (without sensitive data)
     */
    private function getDatabaseConnections(): array
    {
        $connections = config('database.connections', []);
        $safeConnections = [];

        foreach ($connections as $name => $config) {
            $safeConnections[$name] = [
                'driver' => $config['driver'] ?? 'unknown',
                'database' => $config['database'] ?? '',
                'host' => $config['host'] ?? '',
                'port' => $config['port'] ?? '',
                'charset' => $config['charset'] ?? '',
            ];
        }

        return $safeConnections;
    }

    /**
     * Get system environment info
     */
    public function getEnvironment(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return $this->error('Unauthorized. Admin access required.', 403);
        }

        $env = [
            'php' => [
                'version' => PHP_VERSION,
                'sapi' => php_sapi_name(),
                'memory_limit' => ini_get('memory_limit'),
                'max_execution_time' => ini_get('max_execution_time'),
                'upload_max_filesize' => ini_get('upload_max_filesize'),
                'post_max_size' => ini_get('post_max_size'),
            ],
            'laravel' => [
                'version' => app()->version(),
                'environment' => app()->environment(),
                'debug' => config('app.debug'),
            ],
            'server' => [
                'software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
                'os' => PHP_OS,
                'server_name' => $_SERVER['SERVER_NAME'] ?? 'Unknown',
            ],
        ];

        return $this->success($env, 'Environment information retrieved successfully');
    }

    /**
     * Get cache stores info (without sensitive data)
     */
    private function getCacheStores(): array
    {
        $stores = config('cache.stores', []);
        $safeStores = [];

        foreach ($stores as $name => $store) {
            $safeStores[$name] = [
                'driver' => $store['driver'] ?? 'unknown',
            ];
        }

        return $safeStores;
    }

    /**
     * Get queue connections info (without sensitive data)
     */
    private function getQueueConnections(): array
    {
        $connections = config('queue.connections', []);
        $safeConnections = [];

        foreach ($connections as $name => $config) {
            $safeConnections[$name] = [
                'driver' => $config['driver'] ?? 'unknown',
            ];
        }

        return $safeConnections;
    }

    /**
     * Get mailers info (without sensitive data)
     */
    private function getMailers(): array
    {
        $mailers = config('mail.mailers', []);
        $safeMailers = [];

        foreach ($mailers as $name => $mailer) {
            $safeMailers[$name] = [
                'transport' => $mailer['transport'] ?? 'unknown',
            ];
        }

        return $safeMailers;
    }

    /**
     * Get filesystem disks info
     */
    private function getFilesystemDisks(): array
    {
        $disks = config('filesystems.disks', []);
        $safeDisks = [];

        foreach ($disks as $name => $disk) {
            $safeDisks[$name] = [
                'driver' => $disk['driver'] ?? 'unknown',
                'root' => $disk['root'] ?? '',
            ];
        }

        return $safeDisks;
    }

    /**
     * Get logging channels info
     */
    private function getLoggingChannels(): array
    {
        $channels = config('logging.channels', []);
        $safeChannels = [];

        foreach ($channels as $name => $channel) {
            $safeChannels[$name] = [
                'driver' => $channel['driver'] ?? 'unknown',
            ];
        }

        return $safeChannels;
    }
}

