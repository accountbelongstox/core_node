<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Providers\PathMapper;
use App\Support\ServiceContract;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class ServerManagerV1CodeSyncJob
{
    private const JOB_ID_PATTERN = '/^\d{14}-[a-f0-9]{12}$/';
    private const UNIT_PREFIX = 'ncore-code-sync-';
    private const QUEUE_DELAY = '2s';
    private const LOCK_KEY = 'server_manager:code_sync';
    private const LOCK_SECONDS = 30;
    private const LOCK_WAIT_SECONDS = 5;
    private const GITSYNC_SCRIPT_RELATIVE = 'scripts/linuxenvs/gitsync.sh';
    private const WORKERS_RESTART_PATH = '/frankenphp/workers/restart';
    private const WORKERS_RESTART_TIMEOUT_SECONDS = 120;
    private const GIT_COMMAND_TIMEOUT_SECONDS = 20;
    private const MIGRATE_COMMAND_TIMEOUT_SECONDS = 600;
    private const ACTIVE_STATUSES = ['pending', 'running'];
    private const PHASES = ['git', 'migrate', 'reload'];

    public static function start(): array
    {
        $active = null;
        $jobId = '';
        $lock = null;
        $result = [];
        $state = [];

        if (PathMapper::isWindows()) {
            return ['success' => false, 'error_code' => 'unsupported_platform'];
        }

        $lock = Cache::lock(self::LOCK_KEY, self::LOCK_SECONDS);
        if (!$lock->block(self::LOCK_WAIT_SECONDS)) {
            return ['success' => false, 'error_code' => 'busy'];
        }

        try {
            $active = self::findActive();
            if ($active !== null) {
                return ['success' => true, 'already_running' => true, 'job' => $active];
            }

            $jobId = date('YmdHis').'-'.bin2hex(random_bytes(6));
            $state = [
                'job_id' => $jobId,
                'status' => 'pending',
                'phase' => 'pending',
                'created_at' => date(DATE_ATOM),
                'updated_at' => date(DATE_ATOM),
            ];
            $result = self::schedule($state);
        } finally {
            $lock->release();
        }

        return $result;
    }

    public static function status(?string $jobId): ?array
    {
        $state = $jobId === null || $jobId === '' ? self::latestState() : self::readState($jobId);

        return $state === null ? null : self::publicState($state);
    }

    public static function execute(string $jobId): array
    {
        $state = self::readState($jobId);
        $repoDir = (string) PathMapper::getCoreNodeDir();
        $gitsync = [];
        $migrate = [];
        $safety = [];
        $reload = [];
        $php = ServerManagerV1FrankenPhpReloadJob::PHP_CLI_BINARY;
        $tailLines = ServiceContract::positiveInt('code_sync.output_tail_lines');

        if ($state === null) {
            return ['status' => 'failed', 'error_code' => 'job_not_found'];
        }

        $state['status'] = 'running';
        $state['started_at'] = date(DATE_ATOM);
        $state['commit_before'] = self::head($repoDir);
        $state = self::advance($state, 'git');

        try {
            $gitsync = ServerManagerV1Utils::executeCommand('bash', [
                $repoDir.'/'.self::GITSYNC_SCRIPT_RELATIVE,
                ServiceContract::string('code_sync.skip_flag'),
                '-m',
                ServiceContract::string('code_sync.job_description'),
            ], ServiceContract::positiveInt('code_sync.job_timeout_seconds'), self::gitEnvironment());
            $state['git_output_tail'] = self::tail($gitsync['output'].$gitsync['error'], $tailLines);
            $state['commit_after'] = self::head($repoDir);
            if (!$gitsync['success']) {
                if (!self::originContainedInHead($repoDir)) {
                    return self::fail($state, 'gitsync_failed');
                }
                $state['git_push_failed'] = true;
            }

            $state = self::advance($state, 'migrate');
            $safety = ServerManagerV1Utils::executeCommand($php, ['artisan', 'migration:check-safety'], self::MIGRATE_COMMAND_TIMEOUT_SECONDS);
            if (!$safety['success']) {
                $state['migrate_output_tail'] = self::tail($safety['output'].$safety['error'], $tailLines);

                return self::fail($state, 'migration_unsafe');
            }
            $migrate = ServerManagerV1Utils::executeCommand($php, ['artisan', 'migrate', '--force'], self::MIGRATE_COMMAND_TIMEOUT_SECONDS);
            $state['migrate_output_tail'] = self::tail($migrate['output'].$migrate['error'], $tailLines);
            if (!$migrate['success']) {
                return self::fail($state, 'migrate_failed');
            }

            $state = self::advance($state, 'reload');
            $reload = self::restartWorkers();
            $state['workers_reloaded'] = $reload['success'];
            if (!$reload['success']) {
                $state['reload_detail'] = $reload['detail'];

                return self::fail($state, 'reload_failed');
            }
        } catch (\Throwable $exception) {
            $state['error_detail'] = $exception->getMessage();

            return self::fail($state, 'job_exception');
        }

        $state['status'] = 'completed';
        $state['phase'] = 'done';
        $state['finished_at'] = date(DATE_ATOM);
        $state['updated_at'] = date(DATE_ATOM);
        self::writeState($jobId, $state);

        return self::publicState($state);
    }

    private static function restartWorkers(): array
    {
        $host = ServiceContract::host('loopback');
        $port = ServiceContract::port('frankenphp_admin');
        $response = null;

        try {
            $response = Http::connectTimeout(5)
                ->timeout(self::WORKERS_RESTART_TIMEOUT_SECONDS)
                ->post("http://{$host}:{$port}".self::WORKERS_RESTART_PATH);
        } catch (\Throwable $exception) {
            return ['success' => false, 'detail' => $exception->getMessage()];
        }

        return ['success' => $response->successful(), 'detail' => 'HTTP '.$response->status()];
    }

    private static function schedule(array $state): array
    {
        $commandResult = [];
        $jobId = (string) $state['job_id'];
        $timerUnit = self::unitName($jobId).'.timer';
        $loadState = '';

        if (!self::writeState($jobId, $state)) {
            return ['success' => false, 'error_code' => 'state_write_failed'];
        }

        $commandResult = ServerManagerV1Utils::executeCommand('systemd-run', [
            '--quiet',
            '--collect',
            '--no-block',
            '--on-active='.self::QUEUE_DELAY,
            '--unit='.self::unitName($jobId),
            '--working-directory='.PathMapper::getLaravelMainDir(),
            '--property=TimeoutStartSec='.ServiceContract::positiveInt('code_sync.job_timeout_seconds').'s',
            ServerManagerV1FrankenPhpReloadJob::PHP_CLI_BINARY,
            'artisan',
            'server-manager:code-sync-job',
            $jobId,
        ], 15);
        $loadState = self::systemdProperty($timerUnit, 'LoadState');
        if ($loadState !== 'loaded') {
            $state['error_detail'] = trim((string) ($commandResult['error'] ?? ''));

            return ['success' => false, 'job_id' => $jobId, 'error_code' => 'schedule_failed', 'job' => self::fail($state, 'schedule_failed')];
        }

        return ['success' => true, 'already_running' => false, 'job' => self::publicState($state)];
    }

    private static function advance(array $state, string $phase): array
    {
        $state['phase'] = $phase;
        $state['updated_at'] = date(DATE_ATOM);
        self::writeState((string) $state['job_id'], $state);

        return $state;
    }

    private static function fail(array $state, string $errorCode): array
    {
        $state['status'] = 'failed';
        $state['error_code'] = $errorCode;
        $state['finished_at'] = date(DATE_ATOM);
        $state['updated_at'] = date(DATE_ATOM);
        self::writeState((string) $state['job_id'], $state);

        return self::publicState($state);
    }

    private static function publicState(array $state): array
    {
        $state['phases'] = self::PHASES;
        $state['server_commit'] = $state['commit_after'] ?? null;

        return $state;
    }

    private static function gitEnvironment(): array
    {
        $home = (string) getenv('HOME');
        $identity = [];

        if ($home === '' && function_exists('posix_getpwuid') && function_exists('posix_geteuid')) {
            $identity = posix_getpwuid(posix_geteuid());
            $home = is_array($identity) ? (string) ($identity['dir'] ?? '') : '';
        }

        return $home === '' ? [] : ['HOME' => $home];
    }

    private static function head(string $repoDir): ?string
    {
        $result = ServerManagerV1Utils::executeCommand('git', ['-C', $repoDir, 'rev-parse', 'HEAD'], self::GIT_COMMAND_TIMEOUT_SECONDS);

        return $result['success'] ? trim($result['output']) : null;
    }

    private static function originContainedInHead(string $repoDir): bool
    {
        $result = ServerManagerV1Utils::executeCommand('git', ['-C', $repoDir, 'merge-base', '--is-ancestor', 'origin/main', 'HEAD'], self::GIT_COMMAND_TIMEOUT_SECONDS);

        return $result['success'];
    }

    private static function tail(string $text, int $lines): string
    {
        return implode("\n", array_slice(explode("\n", trim($text)), -$lines));
    }

    private static function findActive(): ?array
    {
        $state = self::latestState();
        $age = 0;

        if ($state === null || !in_array($state['status'] ?? '', self::ACTIVE_STATUSES, true)) {
            return null;
        }
        $age = time() - (int) strtotime((string) ($state['updated_at'] ?? ''));

        return $age > ServiceContract::positiveInt('code_sync.stale_after_seconds') ? null : self::publicState($state);
    }

    private static function latestState(): ?array
    {
        $names = FileSystemManager::scandir(self::jobsDirectory());
        $jobIds = [];

        if (!is_array($names)) {
            return null;
        }
        foreach ($names as $name) {
            if (str_ends_with($name, '.json') && preg_match(self::JOB_ID_PATTERN, substr($name, 0, -5)) === 1) {
                $jobIds[] = substr($name, 0, -5);
            }
        }
        if ($jobIds === []) {
            return null;
        }
        rsort($jobIds);

        return self::readState($jobIds[0]);
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
        return PathMapper::getCoreNodeRuntimeDir()
            .DIRECTORY_SEPARATOR.'runtime'.DIRECTORY_SEPARATOR.'code-sync-jobs';
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
