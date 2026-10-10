<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Providers\PathMapper;
use App\Support\ServiceContract;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Queued single-flight job that mirrors one app's download manifest and files
 * from the builder (first reachable source origin) into the server's own
 * downloads tree through ServerManagerV1AppDownloadsStore::publish.
 */
class ServerManagerV1AppDownloadsSyncJob
{
    private const JOB_ID_PATTERN = '/^\d{14}-[a-f0-9]{12}$/';
    private const UNIT_PREFIX = 'ncore-app-downloads-';
    private const QUEUE_DELAY = '1s';
    private const LOCK_KEY = 'server_manager:app_downloads';
    private const LOCK_SECONDS = 30;
    private const LOCK_WAIT_SECONDS = 5;
    private const ACTIVE_STATUSES = ['pending', 'running'];
    private const PHASES = ['source', 'plan', 'download', 'publish'];
    private const CONNECT_TIMEOUT_SECONDS = 15;
    private const HTTP_OK = 200;
    private const HTTP_PARTIAL = 206;
    private const RANGE_IGNORED = 'range_ignored';

    public static function start(string $app, array $sourceBaseUrls, ?array $platforms, bool $reloadCaddy = false): array
    {
        $lock = null;
        $active = null;
        $jobId = '';
        $state = [];
        $result = [];

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
                return ($active['app'] ?? '') === $app
                    ? ['success' => true, 'already_running' => true, 'job' => $active]
                    : ['success' => false, 'error_code' => 'busy', 'job' => $active];
            }
            $jobId = date('YmdHis').'-'.bin2hex(random_bytes(6));
            $state = [
                'job_id' => $jobId,
                'app' => $app,
                'source_base_urls' => $sourceBaseUrls,
                'platforms' => ServerManagerV1AppDownloadsStore::platforms($platforms),
                'reload_caddy' => $reloadCaddy,
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

    /** The newest jobs, newest first. */
    public static function recent(int $limit): array
    {
        $jobs = [];

        foreach (array_slice(self::jobIds(), 0, $limit) as $jobId) {
            $state = self::readState($jobId);
            if ($state !== null) {
                $jobs[] = self::publicState($state);
            }
        }

        return $jobs;
    }

    public static function execute(string $jobId): array
    {
        $state = self::readState($jobId);
        $app = '';
        $source = [];
        $normalized = [];
        $manifest = [];
        $plan = [];
        $disk = [];
        $published = [];

        if ($state === null) {
            return ['status' => 'failed', 'error_code' => 'job_not_found'];
        }
        $app = (string) $state['app'];
        $state['status'] = 'running';
        $state['started_at'] = date(DATE_ATOM);
        try {
            $state = self::advance($state, 'source');
            $source = self::fetchManifest($app, (array) $state['source_base_urls']);
            $state['source_errors'] = $source['errors'];
            if ($source['manifest'] === null) {
                return self::fail($state, 'no_source_reachable');
            }
            $state['source_base_url'] = $source['base_url'];
            $normalized = ServerManagerV1AppDownloadsStore::normalizeManifest($app, $source['manifest'], (array) $state['platforms']);
            if (!isset($normalized['manifest'])) {
                $state['error_detail'] = $normalized['detail'] ?? '';

                return self::fail($state, $normalized['error']);
            }
            $manifest = $normalized['manifest'];
            if ($manifest['files'] === []) {
                return self::fail($state, 'manifest_empty');
            }

            $state = self::advance($state, 'plan');
            $plan = ServerManagerV1AppDownloadsStore::plan($app, $manifest, ServerManagerV1AppDownloadsStore::readManifest($app));
            $state['bytes_to_fetch'] = $plan['bytes'];
            $state['files_to_fetch'] = array_keys($plan['fetch']);
            if (ServerManagerV1AppDownloadsStore::isUnchanged($plan)) {
                $state['caddyfile'] = self::ensureServing((bool) ($state['reload_caddy'] ?? false));

                return self::complete($state, ['result' => 'unchanged', 'versions' => self::versions($manifest)]);
            }
            $disk = ServerManagerV1AppDownloadsStore::diskCheck($plan['bytes']);
            $state['disk'] = $disk;
            if (!$disk['ok']) {
                return self::fail($state, 'insufficient_disk');
            }

            $state = self::advance($state, 'download');
            $published = ServerManagerV1AppDownloadsStore::publish(
                $app,
                $manifest,
                $plan,
                function (array $entry, string $partPath) use (&$state): ?string {
                    $state['downloading'] = $entry['file'];
                    $state = self::advance($state, 'download');

                    return self::download((string) $state['source_base_url'], (string) $state['app'], $entry, $partPath);
                }
            );
            if (isset($published['error'])) {
                $state['error_detail'] = $published['detail'] ?? '';

                return self::fail($state, $published['error']);
            }
            unset($state['downloading']);
            $state['fetched'] = $published['fetched'];
            $state['pruned'] = $published['pruned'];
            $state['caddyfile'] = self::ensureServing((bool) ($state['reload_caddy'] ?? false));
        } catch (\Throwable $exception) {
            Log::error('App downloads sync job failed', ['job_id' => $jobId, 'message' => $exception->getMessage()]);
            $state['error_detail'] = $exception->getMessage();

            return self::fail($state, 'job_exception');
        }

        return self::complete($state, ['result' => 'synced', 'versions' => self::versions($manifest)]);
    }

    /**
     * Manifest of the first source that answers.
     *
     * @return array{manifest: ?array, base_url: ?string, errors: array}
     */
    private static function fetchManifest(string $app, array $baseUrls): array
    {
        $errors = [];
        $response = null;
        $decoded = null;

        foreach ($baseUrls as $baseUrl) {
            try {
                $response = Http::connectTimeout(self::CONNECT_TIMEOUT_SECONDS)
                    ->timeout(ServiceContract::positiveInt('app_downloads.server_sync.source_timeout_seconds'))
                    ->acceptJson()
                    ->get(self::fileUrl((string) $baseUrl, $app, ServiceContract::string('app_downloads.manifest_file')));
                $decoded = $response->successful() ? json_decode($response->body(), true) : null;
                if (is_array($decoded)) {
                    return ['manifest' => $decoded, 'base_url' => (string) $baseUrl, 'errors' => $errors];
                }
                $errors[] = $baseUrl.' -> '.($response->successful() ? 'invalid JSON' : 'HTTP '.$response->status());
            } catch (\Throwable $exception) {
                $errors[] = $baseUrl.' -> '.mb_substr($exception->getMessage(), 0, 300);
            }
        }

        return ['manifest' => null, 'base_url' => null, 'errors' => $errors];
    }

    /** Download one file into $partPath (resuming a partial file) and verify size and sha256. */
    private static function download(string $baseUrl, string $app, array $entry, string $partPath): ?string
    {
        $url = self::fileUrl($baseUrl, $app, $entry['file']);
        $offset = 0;
        $attempt = 0;
        $error = null;

        for ($attempt = 0; $attempt < 2; $attempt++) {
            clearstatcache(true, $partPath);
            $offset = FileSystemManager::isFile($partPath) ? (int) FileSystemManager::filesize($partPath) : 0;
            if ($offset > $entry['size']) {
                FileSystemManager::delete($partPath);
                $offset = 0;
            }
            if ($offset < $entry['size']) {
                $error = self::transfer($url, $partPath, $offset);
                if ($error === self::RANGE_IGNORED) {
                    FileSystemManager::delete($partPath);
                    continue;
                }
                if ($error !== null) {
                    return $error;
                }
            }
            if ((int) FileSystemManager::filesize($partPath) === $entry['size']
                && hash_equals($entry['sha256'], (string) FileSystemManager::hashFile($partPath))) {
                FileSystemManager::fixPermissions($partPath);

                return null;
            }
            FileSystemManager::delete($partPath);
        }

        return 'download_verify_failed';
    }

    private static function transfer(string $url, string $partPath, int $offset): ?string
    {
        $handle = null;
        $response = null;
        $headers = [];

        FileSystemManager::ensureDirectoryExists(dirname($partPath));
        $handle = fopen($partPath, $offset > 0 ? 'ab' : 'wb');
        if ($handle === false) {
            return 'download_failed';
        }
        if ($offset > 0) {
            $headers['Range'] = 'bytes='.$offset.'-';
        }
        try {
            $response = Http::connectTimeout(self::CONNECT_TIMEOUT_SECONDS)
                ->timeout(ServiceContract::positiveInt('app_downloads.server_sync.download_timeout_seconds'))
                ->withHeaders($headers)
                ->withOptions([
                    'sink' => $handle,
                    'on_headers' => static function ($received) use ($offset): void {
                        if (!in_array($received->getStatusCode(), [self::HTTP_OK, self::HTTP_PARTIAL], true)) {
                            throw new \RuntimeException('bad_status_'.$received->getStatusCode());
                        }
                        if ($offset > 0 && $received->getStatusCode() === self::HTTP_OK) {
                            throw new \RuntimeException(self::RANGE_IGNORED);
                        }
                    },
                ])
                ->get($url);
        } catch (\Throwable $exception) {
            fclose($handle);
            if (self::chainContains($exception, self::RANGE_IGNORED)) {
                return self::RANGE_IGNORED;
            }
            Log::warning('App downloads transfer failed', ['url' => $url, 'message' => $exception->getMessage()]);

            return 'download_failed';
        }
        fclose($handle);

        return in_array($response->status(), [self::HTTP_OK, self::HTTP_PARTIAL], true) ? null : 'download_failed';
    }

    /**
     * The downloads mount and public aliases live in the canonical Caddyfile;
     * re-render it and queue a FrankenPHP reload when it was stale or a reload was requested.
     */
    private static function ensureServing(bool $forceReload): array
    {
        $ensure = ServerManagerV1FrankenPhpCaddyfileBuilder::ensure();
        $report = [
            'rendered' => $ensure['rendered'] ?? false,
            'canonical' => $ensure['canonical'] ?? false,
        ];
        $reload = [];

        if (isset($ensure['error'])) {
            $report['error'] = (string) $ensure['error'];
        }
        if ($report['rendered'] === true || ($forceReload && $report['canonical'] === true)) {
            $reload = ServerManagerV1FrankenPhpReloadJob::queue(true);
            $report['reload_queued'] = ($reload['success'] ?? false) === true;
            $report['reload'] = $reload;
        }

        return $report;
    }

    private static function chainContains(\Throwable $exception, string $needle): bool
    {
        for ($current = $exception; $current !== null; $current = $current->getPrevious()) {
            if (str_contains($current->getMessage(), $needle)) {
                return true;
            }
        }

        return false;
    }

    private static function fileUrl(string $baseUrl, string $app, string $file): string
    {
        return rtrim($baseUrl, '/').'/'.trim(ServiceContract::string('app_downloads.url_prefix'), '/').'/'.$app.'/'.$file;
    }

    private static function versions(array $manifest): array
    {
        return array_map(static fn (array $entry): array => [
            'platform' => $entry['platform'],
            'build_type' => $entry['build_type'],
            'version' => $entry['version'],
            'version_code' => $entry['version_code'] ?? null,
            'file' => $entry['file'],
            'size' => $entry['size'],
        ], $manifest['files']);
    }

    private static function schedule(array $state): array
    {
        $jobId = (string) $state['job_id'];
        $timerUnit = self::UNIT_PREFIX.$jobId.'.timer';
        $loadState = '';

        if (!self::writeState($jobId, $state)) {
            return ['success' => false, 'error_code' => 'state_write_failed'];
        }
        ServerManagerV1Utils::executeCommand('systemd-run', [
            '--quiet',
            '--collect',
            '--no-block',
            '--on-active='.self::QUEUE_DELAY,
            '--unit='.self::UNIT_PREFIX.$jobId,
            '--working-directory='.PathMapper::getLaravelMainDir(),
            '--property=TimeoutStartSec='.ServiceContract::positiveInt('app_downloads.server_sync.job_timeout_seconds').'s',
            ServerManagerV1FrankenPhpReloadJob::phpCliBinary(),
            'artisan',
            'server-manager:app-downloads-job',
            $jobId,
        ], 15);
        $loadState = trim((string) (ServerManagerV1Utils::executeCommand('systemctl', ['show', $timerUnit, '--property', 'LoadState', '--value'], 10)['output'] ?? ''));
        if ($loadState !== 'loaded') {
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
        if (isset($state['caddyfile']['reload']['reload_job_id'])) {
            $state['caddyfile']['reload_state'] = ServerManagerV1FrankenPhpReloadJob::status((string) $state['caddyfile']['reload']['reload_job_id']);
        }

        return $state;
    }

    private static function findActive(): ?array
    {
        $state = self::latestState();
        $age = 0;

        if ($state === null || !in_array($state['status'] ?? '', self::ACTIVE_STATUSES, true)) {
            return null;
        }
        $age = time() - (int) strtotime((string) ($state['updated_at'] ?? ''));

        return $age > ServiceContract::positiveInt('app_downloads.server_sync.stale_after_seconds') ? null : self::publicState($state);
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
        $path = self::statePath($jobId);
        $content = $path === null ? false : FileSystemManager::readFile($path, false);
        $decoded = is_string($content) ? json_decode($content, true) : null;

        return is_array($decoded) ? $decoded : null;
    }

    private static function writeState(string $jobId, array $state): bool
    {
        $path = self::statePath($jobId);
        $encoded = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        if ($path === null || !FileSystemManager::ensureDirectoryExists(self::jobsDirectory(), 0700)) {
            return false;
        }

        return is_string($encoded) && FileSystemManager::writePrivateFile($path, $encoded."\n");
    }

    private static function statePath(string $jobId): ?string
    {
        return preg_match(self::JOB_ID_PATTERN, $jobId) === 1 ? self::jobsDirectory().DIRECTORY_SEPARATOR.$jobId.'.json' : null;
    }

    private static function jobsDirectory(): string
    {
        return PathMapper::getCoreNodeRuntimeDir()
            .DIRECTORY_SEPARATOR.'runtime'.DIRECTORY_SEPARATOR.'app-downloads-jobs';
    }
}
