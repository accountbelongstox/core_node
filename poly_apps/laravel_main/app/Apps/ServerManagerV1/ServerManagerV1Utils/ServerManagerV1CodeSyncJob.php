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
    // The system command `dd.sh gitsync` (same entry as every host); the POST
    // endpoints only queue this job for remote/AI callers.
    private const GITSYNC_SCRIPT_RELATIVE = 'dd.sh';
    private const GITSYNC_COMMAND = 'gitsync';
    private const WORKERS_RESTART_PATH = '/frankenphp/workers/restart';
    private const WORKERS_RESTART_TIMEOUT_SECONDS = 120;
    private const WORKERS_RESTART_ATTEMPTS = 3;
    private const WORKERS_RESTART_RETRY_DELAY_SECONDS = 3;
    private const ADMIN_READY_PATH = '/config/apps/http/';
    private const ADMIN_READY_WAIT_SECONDS = 30;
    private const GIT_COMMAND_TIMEOUT_SECONDS = 20;
    private const MIGRATE_COMMAND_TIMEOUT_SECONDS = 600;
    private const ACTIVE_STATUSES = ['pending', 'running'];
    private const PHASES = ['check', 'ai_fix', 'git', 'migrate', 'reload', 'sys_init'];
    private const KIND_MANUAL = 'manual';
    private const KIND_SCHEDULED = 'scheduled';
    private const KIND_AI_FIX = 'ai_fix';
    private const KIND_SYS_INIT = 'sys_init';
    private const COMMIT_FORMAT = '%H%x1f%cI%x1f%s';
    private const FIELD_SEPARATOR = "\x1f";
    private const ORIGIN_REF = 'origin/main';

    public static function start(string $kind = self::KIND_MANUAL, array $extra = []): array
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
            $state = $extra + [
                'job_id' => $jobId,
                'kind' => $kind,
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

    /** Starts the single-flight job in AI-fix mode (ServerManagerV1CodeSyncAiFix, then the normal sync). */
    public static function startAiFix(string $prompt): array
    {
        return self::start(self::KIND_AI_FIX, ['prompt' => $prompt]);
    }

    /** Starts the single-flight job that only runs `php artisan sys:init` (no git, no reload). */
    public static function startSysInit(): array
    {
        return self::start(self::KIND_SYS_INIT);
    }

    public static function status(?string $jobId): ?array
    {
        $state = $jobId === null || $jobId === '' ? self::latestState() : self::readState($jobId);

        return $state === null ? null : self::publicState($state);
    }

    public static function history(int $limit): array
    {
        $ahead = 0;
        $behind = 0;
        $counts = self::git(['rev-list', '--left-right', '--count', 'HEAD...'.self::ORIGIN_REF]);
        $jobs = [];
        $logLines = self::commitLog(ServiceContract::positiveInt('code_sync.history_log_commits'));

        if ($counts['success'] && preg_match('/^(\d+)\s+(\d+)/', trim($counts['output']), $matches) === 1) {
            $ahead = (int) $matches[1];
            $behind = (int) $matches[2];
        }
        foreach (array_slice(self::jobIds(), 0, $limit) as $jobId) {
            $state = self::readState($jobId);
            if ($state !== null) {
                $jobs[] = self::publicState($state);
            }
        }

        return [
            'head' => self::commitInfo('HEAD'),
            'origin_main' => self::commitInfo(self::ORIGIN_REF),
            'ahead' => $ahead,
            'behind' => $behind,
            'commits' => $logLines,
            'jobs' => $jobs,
        ];
    }

    public static function git(array $arguments, ?int $timeout = null): array
    {
        return ServerManagerV1Utils::executeCommand(
            'git',
            array_merge(['-C', (string) PathMapper::getCoreNodeDir()], $arguments),
            $timeout ?? self::GIT_COMMAND_TIMEOUT_SECONDS,
            self::gitEnvironment()
        );
    }

    public static function execute(string $jobId): array
    {
        $state = self::readState($jobId);
        $repoDir = (string) PathMapper::getCoreNodeDir();
        $gitsync = [];
        $migrate = [];
        $safety = [];
        $reload = [];
        $php = ServerManagerV1FrankenPhpReloadJob::phpCliBinary();
        $kind = (string) ($state['kind'] ?? self::KIND_MANUAL);
        $fetch = [];
        $tailLines = ServiceContract::positiveInt('code_sync.output_tail_lines');

        if ($state === null) {
            return ['status' => 'failed', 'error_code' => 'job_not_found'];
        }

        $state['status'] = 'running';
        $state['started_at'] = date(DATE_ATOM);
        $state['commit_before'] = self::head($repoDir);

        try {
            if ($kind === self::KIND_SYS_INIT) {
                return self::runSysInit(self::advance($state, 'sys_init'), $php, $tailLines);
            }
            if ($kind === self::KIND_AI_FIX) {
                $state = self::advance($state, 'ai_fix');
                $state['ai_fix'] = ServerManagerV1CodeSyncAiFix::resolve((string) $state['job_id'], (string) ($state['prompt'] ?? ''));
                if ($state['ai_fix']['result'] === 'failed') {
                    return self::fail($state, 'ai_fix_failed');
                }
                if ($state['ai_fix']['result'] === 'nothing_to_fix') {
                    $state['commit_after'] = $state['commit_before'];

                    return self::complete($state, ['result' => 'nothing_to_fix']);
                }
            }
            if ($kind === self::KIND_SCHEDULED) {
                $state = self::advance($state, 'check');
                $fetch = self::git(['fetch', 'origin', 'main'], ServiceContract::positiveInt('code_sync.git_fetch_timeout_seconds'));
                if (!$fetch['success']) {
                    $state['git_output_tail'] = self::tail($fetch['output'].$fetch['error'], $tailLines);

                    return self::fail($state, 'fetch_failed');
                }
                if (self::isUpToDate()) {
                    $state['commit_after'] = $state['commit_before'];
                    $state['commits'] = self::commitLog(ServiceContract::positiveInt('code_sync.history_log_commits'));

                    return self::complete($state, ['result' => 'up_to_date']);
                }
            }
            $state = self::advance($state, 'git');
            $gitsync = ServerManagerV1Utils::executeCommand('bash', [
                $repoDir.'/'.self::GITSYNC_SCRIPT_RELATIVE,
                self::GITSYNC_COMMAND,
                ServiceContract::string('code_sync.skip_flag'),
                '-m',
                ServiceContract::string('code_sync.job_description'),
            ], ServiceContract::positiveInt('code_sync.job_timeout_seconds'), self::gitEnvironment());
            $state['git_output_tail'] = self::tail($gitsync['output'].$gitsync['error'], $tailLines);
            $state['commit_after'] = self::head($repoDir);
            $state['commits'] = self::commitLog(ServiceContract::positiveInt('code_sync.history_log_commits'));
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
            if (!self::workersNeedRestart($state['commit_before'], $state['commit_after'] ?? null)) {
                $state['workers_reloaded'] = false;
                $state['reload_skipped'] = true;
            } else {
                $reload = self::restartWorkers();
                $state['workers_reloaded'] = $reload['success'];
                if (!$reload['success']) {
                    $state['reload_detail'] = $reload['detail'];

                    return self::fail($state, 'reload_failed');
                }
            }
        } catch (\Throwable $exception) {
            $state['error_detail'] = $exception->getMessage();

            return self::fail($state, 'job_exception');
        }

        return self::complete($state, ['result' => 'synced']);
    }

    private static function runSysInit(array $state, string $php, int $tailLines): array
    {
        $init = ServerManagerV1Utils::executeCommand(
            $php,
            ['artisan', 'sys:init', '--no-interaction'],
            ServiceContract::positiveInt('code_sync.sys_init_timeout_seconds')
        );

        $state['sys_init_output_tail'] = self::tail($init['output'].$init['error'], $tailLines);
        $state['commit_after'] = $state['commit_before'];

        return $init['success'] ? self::complete($state, ['result' => 'initialized']) : self::fail($state, 'sys_init_failed');
    }

    private static function complete(array $state, array $extra): array
    {
        $state = $extra + $state;
        $state['status'] = 'completed';
        $state['phase'] = 'done';
        $state['finished_at'] = date(DATE_ATOM);
        $state['updated_at'] = date(DATE_ATOM);
        self::writeState((string) $state['job_id'], $state);

        return self::publicState($state);
    }

    private static function isUpToDate(): bool
    {
        $behind = self::git(['rev-list', '--count', 'HEAD..'.self::ORIGIN_REF]);
        $ahead = self::git(['rev-list', '--count', self::ORIGIN_REF.'..HEAD']);
        $dirty = self::git(['status', '--porcelain']);

        return $behind['success'] && $ahead['success'] && $dirty['success']
            && trim($behind['output']) === '0' && trim($ahead['output']) === '0' && trim($dirty['output']) === '';
    }

    private static function commitInfo(string $revision): ?array
    {
        $result = self::git(['log', '-1', '--pretty=format:'.self::COMMIT_FORMAT, $revision]);

        return $result['success'] ? self::parseCommit(trim($result['output'])) : null;
    }

    private static function commitLog(int $count): array
    {
        $result = self::git(['log', '-n', (string) $count, '--pretty=format:'.self::COMMIT_FORMAT]);
        $commits = [];

        if (!$result['success']) {
            return [];
        }
        foreach (explode("\n", trim($result['output'])) as $line) {
            $commit = self::parseCommit($line);
            if ($commit !== null) {
                $commits[] = $commit;
            }
        }

        return $commits;
    }

    private static function parseCommit(string $line): ?array
    {
        $parts = explode(self::FIELD_SEPARATOR, $line, 3);

        return count($parts) === 3 ? ['commit' => $parts[0], 'date' => $parts[1], 'subject' => $parts[2]] : null;
    }

    /**
     * A worker restart re-enters FrankenPHP's thread reboot path, which can crash the
     * whole process (php/frankenphp#2568, exit 139), so restart only when the pulled
     * commits change laravel_main (code_sync.reload_paths). Fails safe to true.
     */
    private static function workersNeedRestart(?string $before, ?string $after): bool
    {
        $pathspecs = [];
        $result = [];

        if ($before === null || $after === null) {
            return true;
        }
        if ($before === $after) {
            return false;
        }
        $pathspecs = array_merge(
            ServiceContract::stringList('code_sync.reload_paths'),
            array_map(
                static fn (string $path): string => ':(exclude)'.$path,
                ServiceContract::stringList('code_sync.reload_excluded_paths'),
            ),
        );
        $result = self::git(array_merge(['diff', '--name-only', $before, $after, '--'], $pathspecs));

        return !$result['success'] || trim((string) $result['output']) !== '';
    }

    private static function restartWorkers(): array
    {
        $host = ServiceContract::host('loopback');
        $port = ServiceContract::port('frankenphp_admin');
        $base = "http://{$host}:{$port}";
        $attempt = 0;
        $detail = '';
        $response = null;

        for ($attempt = 1; $attempt <= self::WORKERS_RESTART_ATTEMPTS; $attempt++) {
            try {
                $response = Http::connectTimeout(5)
                    ->timeout(self::WORKERS_RESTART_TIMEOUT_SECONDS)
                    ->post($base.self::WORKERS_RESTART_PATH);
                if ($response->successful()) {
                    return ['success' => true, 'detail' => 'HTTP '.$response->status().' attempt '.$attempt];
                }
                $detail = 'HTTP '.$response->status();
            } catch (\Throwable $exception) {
                $detail = $exception->getMessage();
            }

            if ($attempt < self::WORKERS_RESTART_ATTEMPTS) {
                sleep(self::WORKERS_RESTART_RETRY_DELAY_SECONDS);
                self::waitForAdmin($base);
            }
        }

        return ['success' => false, 'detail' => $detail.' (after '.self::WORKERS_RESTART_ATTEMPTS.' attempts)'];
    }

    private static function waitForAdmin(string $base): bool
    {
        $deadline = time() + self::ADMIN_READY_WAIT_SECONDS;

        do {
            try {
                if (Http::connectTimeout(2)->timeout(5)->get($base.self::ADMIN_READY_PATH)->successful()) {
                    return true;
                }
            } catch (\Throwable $exception) {
            }
            sleep(1);
        } while (time() < $deadline);

        return false;
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
            ServerManagerV1FrankenPhpReloadJob::phpCliBinary(),
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
        $result = ServerManagerV1Utils::executeCommand('git', ['-C', $repoDir, 'rev-parse', 'HEAD'], self::GIT_COMMAND_TIMEOUT_SECONDS, self::gitEnvironment());

        return $result['success'] ? trim($result['output']) : null;
    }

    private static function originContainedInHead(string $repoDir): bool
    {
        $result = ServerManagerV1Utils::executeCommand('git', ['-C', $repoDir, 'merge-base', '--is-ancestor', 'origin/main', 'HEAD'], self::GIT_COMMAND_TIMEOUT_SECONDS, self::gitEnvironment());

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
        $jobIds = self::jobIds();

        return $jobIds === [] ? null : self::readState($jobIds[0]);
    }

    private static function jobIds(): array
    {
        $names = FileSystemManager::scandir(self::jobsDirectory());
        $jobIds = [];

        if (!is_array($names)) {
            return [];
        }
        foreach ($names as $name) {
            if (str_ends_with($name, '.json') && preg_match(self::JOB_ID_PATTERN, substr($name, 0, -5)) === 1) {
                $jobIds[] = substr($name, 0, -5);
            }
        }
        rsort($jobIds);

        return $jobIds;
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
