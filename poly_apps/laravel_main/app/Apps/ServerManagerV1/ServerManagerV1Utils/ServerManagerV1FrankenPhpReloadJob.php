<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Providers\PathMapper;
use App\Support\ServiceContract;
use App\Utils\FileSystemManager;

class ServerManagerV1FrankenPhpReloadJob
{
    private const JOB_ID_PATTERN = '/^\d{14}-[a-f0-9]{12}$/';
    private const PHP_CLI_BINARY = '/usr/local/bin/php-cli';
    private const QUEUE_DELAY = '2s';
    private const UNIT_PREFIX = 'ncore-frankenphp-reload-';

    public static function queue(bool $force = false, ?array $rollback = null): array
    {
        $jobId = date('YmdHis').'-'.bin2hex(random_bytes(6));
        $state = [
            'job_id' => $jobId,
            'operation' => 'reload',
            'status' => 'pending',
            'force' => $force,
            'rollback' => $rollback,
            'created_at' => date(DATE_ATOM),
            'updated_at' => date(DATE_ATOM),
        ];

        return self::schedule($state);
    }

    public static function queueServiceAction(string $action): array
    {
        $jobId = date('YmdHis').'-'.bin2hex(random_bytes(6));
        $state = [
            'job_id' => $jobId,
            'operation' => 'service',
            'action' => $action,
            'status' => 'pending',
            'created_at' => date(DATE_ATOM),
            'updated_at' => date(DATE_ATOM),
        ];

        if (!in_array($action, ['restart', 'stop'], true)) {
            return ['success' => false, 'error' => 'Unsupported deferred FrankenPHP service action.'];
        }

        return self::schedule($state);
    }

    private static function schedule(array $state): array
    {
        $commandResult = [];
        $jobId = (string) ($state['job_id'] ?? '');
        $loadState = '';
        $timerUnit = self::unitName($jobId).'.timer';

        if (!self::writeState($jobId, $state)) {
            return ['success' => false, 'error' => 'Unable to persist the FrankenPHP operation job.'];
        }

        $commandResult = ServerManagerV1Utils::executeCommand('systemd-run', [
            '--quiet',
            '--collect',
            '--no-block',
            '--on-active='.self::QUEUE_DELAY,
            '--unit='.self::unitName($jobId),
            '--working-directory='.PathMapper::getLaravelMainDir(),
            '--property=TimeoutStartSec=180s',
            self::PHP_CLI_BINARY,
            'artisan',
            'server-manager:frankenphp-reload-job',
            $jobId,
        ], 15);
        $loadState = self::systemdProperty($timerUnit, 'LoadState');
        if ($loadState !== 'loaded') {
            $state['status'] = 'failed';
            $state['error'] = trim((string) ($commandResult['error'] ?? 'Unable to schedule the FrankenPHP reload job.'));
            $state['updated_at'] = date(DATE_ATOM);
            self::writeState($jobId, $state);

            return ['success' => false, 'job_id' => $jobId, 'error' => $state['error']];
        }

        return [
            'success' => true,
            'queued' => true,
            'reloaded' => false,
            'job_id' => $jobId,
            'reload_job_id' => $jobId,
            'status' => 'pending',
        ];
    }

    public static function execute(string $jobId): array
    {
        $reload = [];
        $rollback = [];
        $rollbackReload = [];
        $service = [];
        $state = self::readState($jobId);

        if ($state === null) {
            return ['success' => false, 'error' => 'FrankenPHP reload job not found.'];
        }

        $state['status'] = 'running';
        $state['started_at'] = date(DATE_ATOM);
        $state['updated_at'] = date(DATE_ATOM);
        self::writeState($jobId, $state);

        try {
            if (($state['operation'] ?? 'reload') === 'service') {
                $service = ServerManagerV1FrankenPhpRuntime::control((string) ($state['action'] ?? ''));
                $state['status'] = ($service['success'] ?? false) === true ? 'completed' : 'failed';
                $state['result'] = self::safeServiceResult($service);
                if (($service['success'] ?? false) !== true) {
                    $state['error'] = (string) ($service['error'] ?? 'FrankenPHP service action failed.');
                }
            } else {
                $reload = ServerManagerV1FrankenPhpRuntime::reload((bool) ($state['force'] ?? false));
                if (($reload['success'] ?? false) === true) {
                    $state['status'] = 'completed';
                    $state['result'] = self::safeReloadResult($reload);
                } else {
                    $state['status'] = 'failed';
                    $state['error'] = (string) ($reload['error'] ?? 'FrankenPHP reload failed.');
                    if (is_array($state['rollback'] ?? null)) {
                        $rollback = ServerManagerV1FrankenPhpSiteManager::rollbackQueuedChange($state['rollback']);
                        if (($rollback['success'] ?? false) === true) {
                            $rollbackReload = ServerManagerV1FrankenPhpRuntime::reload(true);
                        }
                        $state['rolled_back'] = ($rollback['success'] ?? false) === true
                            && ($rollbackReload['success'] ?? false) === true;
                    }
                }
            }
        } catch (\Throwable $exception) {
            $state['status'] = 'failed';
            $state['error'] = $exception->getMessage();
        }

        $state['completed_at'] = date(DATE_ATOM);
        $state['updated_at'] = date(DATE_ATOM);
        self::writeState($jobId, $state);

        return self::publicState($state);
    }

    public static function status(string $jobId): ?array
    {
        $state = self::readState($jobId);

        return $state === null ? null : self::publicState($state);
    }

    private static function safeReloadResult(array $reload): array
    {
        return [
            'success' => (bool) ($reload['success'] ?? false),
            'action' => (string) ($reload['action'] ?? 'reload'),
            'valid' => (bool) ($reload['valid'] ?? false),
            'http_status' => $reload['http_status'] ?? null,
            'admin_ready' => (bool) ($reload['admin_ready'] ?? false),
        ];
    }

    private static function safeServiceResult(array $service): array
    {
        return [
            'success' => (bool) ($service['success'] ?? false),
            'action' => (string) ($service['action'] ?? ''),
            'status' => $service['status'] ?? [],
        ];
    }

    private static function publicState(array $state): array
    {
        unset($state['force'], $state['rollback']);

        return $state;
    }

    private static function readState(string $jobId): ?array
    {
        $content = false;
        $decoded = null;
        $path = self::statePath($jobId);

        if ($path === null) {
            return null;
        }
        $content = FileSystemManager::readFile($path, false);
        if (!is_string($content)) {
            return null;
        }
        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : null;
    }

    private static function writeState(string $jobId, array $state): bool
    {
        $directory = self::jobsDirectory();
        $encoded = '';
        $path = self::statePath($jobId);

        if ($path === null || !FileSystemManager::ensureDirectoryExists($directory, 0700)) {
            return false;
        }
        $encoded = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        return is_string($encoded) && FileSystemManager::writePrivateFile($path, $encoded."\n");
    }

    private static function statePath(string $jobId): ?string
    {
        if (preg_match(self::JOB_ID_PATTERN, $jobId) !== 1) {
            return null;
        }

        return self::jobsDirectory().DIRECTORY_SEPARATOR.$jobId.'.json';
    }

    private static function jobsDirectory(): string
    {
        return ServiceContract::path('core_node_data_dir_posix')
            .DIRECTORY_SEPARATOR.'runtime'.DIRECTORY_SEPARATOR.'frankenphp-reload-jobs';
    }

    private static function unitName(string $jobId): string
    {
        return self::UNIT_PREFIX.$jobId;
    }

    private static function systemdProperty(string $unit, string $property): string
    {
        $result = ServerManagerV1Utils::executeCommand(
            'systemctl',
            ['show', $unit, '--property', $property, '--value'],
            10
        );

        return trim((string) ($result['output'] ?? ''));
    }
}
