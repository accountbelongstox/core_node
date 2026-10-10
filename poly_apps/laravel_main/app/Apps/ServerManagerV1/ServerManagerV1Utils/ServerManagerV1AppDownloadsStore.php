<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Providers\PathMapper;
use App\Support\ServiceContract;
use App\Utils\FileSystemManager;

/**
 * Server-side app download store (contract app_downloads): manifest
 * validation, the idempotent sha256-verified publish, keep_versions pruning,
 * the latest-file link and the free-disk guard. Shared by the source sync job
 * and the chunked upload fallback.
 */
class ServerManagerV1AppDownloadsStore
{
    private const SHA256_PATTERN = '/^[a-f0-9]{64}$/';
    private const PLATFORMS = ['android', 'windows', 'linux'];
    private const BUILD_TYPES = ['debug', 'release'];
    private const RELEASE = 'release';
    private const PART_SUFFIX = '.part';
    private const TEMP_SUFFIX = '.tmp';

    public static function directory(): string
    {
        return rtrim(PathMapper::getCoreNodeRuntimeDir(), '/\\').DIRECTORY_SEPARATOR
            .ServiceContract::string('app_downloads.dir_name');
    }

    public static function appDirectory(string $app): string
    {
        return self::directory().DIRECTORY_SEPARATOR.$app;
    }

    public static function stagingDirectory(string $app): string
    {
        return self::appDirectory($app).DIRECTORY_SEPARATOR.ServiceContract::string('app_downloads.server_sync.staging_dir');
    }

    public static function manifestPath(string $app): string
    {
        return self::appDirectory($app).DIRECTORY_SEPARATOR.ServiceContract::string('app_downloads.manifest_file');
    }

    public static function isValidApp(string $app): bool
    {
        return preg_match('/'.ServiceContract::string('app_downloads.server_sync.app_id_pattern').'/', $app) === 1;
    }

    public static function isValidFileName(string $name): bool
    {
        return preg_match('/'.ServiceContract::string('app_downloads.server_sync.file_name_pattern').'/', $name) === 1
            && !str_ends_with($name, self::PART_SUFFIX)
            && !str_ends_with($name, self::TEMP_SUFFIX)
            && $name !== ServiceContract::string('app_downloads.manifest_file');
    }

    public static function isSha256(string $value): bool
    {
        return preg_match(self::SHA256_PATTERN, $value) === 1;
    }

    /** Mirrored platforms from the contract (an optional request list can only narrow it). */
    public static function platforms(?array $requested): array
    {
        $allowed = ServiceContract::stringList('app_downloads.server_sync.platforms');

        return $requested === null || $requested === []
            ? $allowed
            : array_values(array_intersect($allowed, array_map('strval', $requested)));
    }

    public static function readManifest(string $app): ?array
    {
        $content = FileSystemManager::readFile(self::manifestPath($app), false);
        $decoded = is_string($content) ? json_decode($content, true) : null;

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * Validate a manifest and reduce it to the mirrored platforms with at most
     * keep_versions entries per (platform, build_type).
     *
     * @return array{manifest?: array, error?: string, detail?: string}
     */
    public static function normalizeManifest(string $app, mixed $raw, array $platforms): array
    {
        $maxBytes = ServiceContract::positiveInt('app_downloads.server_sync.max_file_bytes');
        $entries = [];
        $entry = [];
        $clean = [];
        $platform = '';
        $buildType = '';
        $key = '';

        if (!is_array($raw) || ($raw['app'] ?? null) !== $app || !is_array($raw['files'] ?? null)) {
            return ['error' => 'manifest_invalid', 'detail' => 'app/files'];
        }
        foreach ($raw['files'] as $entry) {
            if (!is_array($entry)) {
                return ['error' => 'manifest_entry_invalid', 'detail' => 'entry is not an object'];
            }
            $platform = strtolower((string) ($entry['platform'] ?? ''));
            if (!in_array($platform, self::PLATFORMS, true)) {
                return ['error' => 'manifest_entry_invalid', 'detail' => 'platform '.$platform];
            }
            if (!in_array($platform, $platforms, true)) {
                continue;
            }
            $buildType = strtolower((string) ($entry['build_type'] ?? ''));
            $file = (string) ($entry['file'] ?? '');
            $latest = (string) ($entry['latest'] ?? '');
            $size = $entry['size'] ?? null;
            $sha256 = strtolower((string) ($entry['sha256'] ?? ''));
            if (!in_array($buildType, self::BUILD_TYPES, true)
                || !self::isValidFileName($file)
                || !self::isValidFileName($latest)
                || !is_int($size) || $size < 1 || $size > $maxBytes
                || !self::isSha256($sha256)) {
                return ['error' => 'manifest_entry_invalid', 'detail' => $file !== '' ? $file : 'file'];
            }
            $clean = [
                'platform' => $platform,
                'build_type' => $buildType,
                'version' => (string) ($entry['version'] ?? ''),
                'file' => $file,
                'latest' => $latest,
                'size' => $size,
                'sha256' => $sha256,
            ];
            if (isset($entry['version_code'])) {
                $clean['version_code'] = (int) $entry['version_code'];
            }
            foreach (['application_id', 'signer_sha256', 'built_at'] as $key) {
                if (isset($entry[$key]) && is_string($entry[$key])) {
                    $clean[$key] = $entry[$key];
                }
            }
            $entries[$file] = $clean;
        }

        return ['manifest' => [
            'app' => $app,
            'name' => is_string($raw['name'] ?? null) ? $raw['name'] : $app,
            'files' => self::prune(array_values($entries)),
            'updated_at' => is_string($raw['updated_at'] ?? null) ? $raw['updated_at'] : date(DATE_ATOM),
        ]];
    }

    /** Release entries first, then the newest version_code / built_at. */
    public static function newerFirst(array $left, array $right): int
    {
        $leftRelease = ($left['build_type'] ?? '') === self::RELEASE ? 1 : 0;
        $rightRelease = ($right['build_type'] ?? '') === self::RELEASE ? 1 : 0;

        return [$rightRelease, (int) ($right['version_code'] ?? -1), (int) strtotime((string) ($right['built_at'] ?? '')), (string) ($right['version'] ?? '')]
            <=> [$leftRelease, (int) ($left['version_code'] ?? -1), (int) strtotime((string) ($left['built_at'] ?? '')), (string) ($left['version'] ?? '')];
    }

    /** The entry that owns each latest file name (the best-ranked entry sharing it). */
    public static function latestOwners(array $entries): array
    {
        $owners = [];

        usort($entries, [self::class, 'newerFirst']);
        foreach ($entries as $entry) {
            $owners[$entry['latest']] ??= $entry;
        }

        return $owners;
    }

    /**
     * What a manifest needs on disk: entries whose versioned file is missing
     * or different, latest names that must be re-pointed, files the previous
     * manifest referenced that no longer belong, and whether the manifest
     * content changes at all.
     */
    public static function plan(string $app, array $manifest, ?array $local): array
    {
        $appDir = self::appDirectory($app);
        $localFiles = is_array($local['files'] ?? null) ? $local['files'] : [];
        $localByFile = [];
        $localByLatest = [];
        $fetch = [];
        $relink = [];
        $keep = [];
        $stale = [];
        $bytes = 0;
        $localNormalized = [];

        foreach ($localFiles as $entry) {
            if (is_array($entry) && isset($entry['file'], $entry['latest'])) {
                $localByFile[(string) $entry['file']] = $entry;
                $localByLatest[(string) $entry['latest']] = $entry;
            }
        }
        foreach ($manifest['files'] as $entry) {
            $keep[$entry['file']] = true;
            if (!self::fileMatches($appDir.DIRECTORY_SEPARATOR.$entry['file'], $entry, $localByFile[$entry['file']] ?? null)) {
                $fetch[$entry['file']] = $entry;
                $bytes += max(0, $entry['size'] - self::partialBytes($app, $entry));
            }
        }
        foreach (self::latestOwners($manifest['files']) as $latest => $owner) {
            $keep[$latest] = true;
            if (!self::fileMatches($appDir.DIRECTORY_SEPARATOR.$latest, $owner, $localByLatest[$latest] ?? null)) {
                $relink[$latest] = $owner;
            }
        }
        foreach (array_keys($localByFile + $localByLatest) as $name) {
            if (!isset($keep[$name]) && self::isValidFileName((string) $name)) {
                $stale[] = (string) $name;
            }
        }
        $normalizedLocal = self::normalizeManifest($app, $local, self::PLATFORMS);

        return [
            'fetch' => $fetch,
            'relink' => $relink,
            'stale' => $stale,
            'bytes' => $bytes,
            'manifest_changed' => ($normalizedLocal['manifest']['files'] ?? null) !== $manifest['files'],
        ];
    }

    public static function isUnchanged(array $plan): bool
    {
        return $plan['fetch'] === [] && $plan['relink'] === [] && !$plan['manifest_changed'];
    }

    public static function partPath(string $app, array $entry): string
    {
        return self::stagingDirectory($app).DIRECTORY_SEPARATOR.$entry['file'].'.'.substr($entry['sha256'], 0, 12).self::PART_SUFFIX;
    }

    public static function stagedPath(string $app, array $entry): string
    {
        return self::stagingDirectory($app).DIRECTORY_SEPARATOR.$entry['file'];
    }

    public static function partialBytes(string $app, array $entry): int
    {
        $path = self::partPath($app, $entry);

        if (self::isStaged($app, $entry)) {
            return $entry['size'];
        }
        clearstatcache(true, $path);

        return FileSystemManager::isFile($path) ? min($entry['size'], (int) FileSystemManager::filesize($path)) : 0;
    }

    /** True when a staged copy of the entry exists with the right size and sha256. */
    public static function isStaged(string $app, array $entry): bool
    {
        $path = self::stagedPath($app, $entry);

        return FileSystemManager::isFile($path)
            && (int) FileSystemManager::filesize($path) === $entry['size']
            && hash_equals($entry['sha256'], (string) FileSystemManager::hashFile($path));
    }

    public static function freeBytes(): ?int
    {
        $directory = self::directory();
        $free = false;

        FileSystemManager::ensureDirectoryExists($directory);
        $free = @disk_free_space($directory);

        return $free === false ? null : (int) $free;
    }

    /** @return array{ok: bool, free: ?int, needed: int, margin: int} */
    public static function diskCheck(int $neededBytes): array
    {
        $margin = ServiceContract::positiveInt('app_downloads.server_sync.min_free_bytes_after');
        $free = self::freeBytes();

        return [
            'ok' => $free !== null && ($free - $neededBytes) >= $margin,
            'free' => $free,
            'needed' => $neededBytes,
            'margin' => $margin,
        ];
    }

    /**
     * Publish a validated manifest: bring every missing file in through
     * $obtain(entry, partPath) (verified bytes at partPath), rename into place,
     * re-point the latest files, then write the manifest and prune.
     *
     * @param callable(array, string): ?string $obtain error code or null
     * @return array{result?: string, fetched?: array, pruned?: array, error?: string, detail?: string}
     */
    public static function publish(string $app, array $manifest, array $plan, callable $obtain): array
    {
        $appDir = self::appDirectory($app);
        $fetched = [];
        $error = null;
        $encoded = '';
        $pruned = [];

        if (!FileSystemManager::ensureDirectoryExists($appDir) || !FileSystemManager::ensureDirectoryExists(self::stagingDirectory($app))) {
            return ['error' => 'directory_failed', 'detail' => $appDir];
        }
        foreach ($plan['fetch'] as $file => $entry) {
            if (self::isStaged($app, $entry)) {
                $error = FileSystemManager::moveFile(self::stagedPath($app, $entry), $appDir.DIRECTORY_SEPARATOR.$file) ? null : 'rename_failed';
            } else {
                $error = $obtain($entry, self::partPath($app, $entry));
                if ($error === null && !FileSystemManager::moveFile(self::partPath($app, $entry), $appDir.DIRECTORY_SEPARATOR.$file)) {
                    $error = 'rename_failed';
                }
            }
            if ($error !== null) {
                return ['error' => $error, 'detail' => $file];
            }
            $fetched[] = $file;
        }
        foreach (self::latestOwners($manifest['files']) as $latest => $owner) {
            if (!isset($plan['relink'][$latest]) && !isset($plan['fetch'][$owner['file']])) {
                continue;
            }
            $error = self::pointLatest($appDir, $owner, $latest);
            if ($error !== null) {
                return ['error' => $error, 'detail' => $latest];
            }
        }
        $encoded = json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($encoded) || !FileSystemManager::writeFileAtomic(self::manifestPath($app), $encoded."\n")) {
            return ['error' => 'manifest_write_failed', 'detail' => self::manifestPath($app)];
        }
        foreach ($plan['stale'] as $name) {
            if (FileSystemManager::delete($appDir.DIRECTORY_SEPARATOR.$name)) {
                $pruned[] = $name;
            }
        }

        return ['result' => 'synced', 'fetched' => $fetched, 'pruned' => $pruned];
    }

    private static function prune(array $entries): array
    {
        $keepVersions = ServiceContract::positiveInt('app_downloads.keep_versions');
        $groups = [];
        $kept = [];

        foreach ($entries as $entry) {
            $groups[$entry['platform'].'|'.$entry['build_type']][] = $entry;
        }
        foreach ($groups as $group) {
            usort($group, [self::class, 'newerFirst']);
            array_push($kept, ...array_slice($group, 0, $keepVersions));
        }
        usort($kept, [self::class, 'newerFirst']);

        return $kept;
    }

    private static function fileMatches(string $path, array $expected, ?array $localEntry): bool
    {
        clearstatcache(true, $path);
        if (!FileSystemManager::isFile($path) || (int) FileSystemManager::filesize($path) !== $expected['size']) {
            return false;
        }
        if (is_array($localEntry) && strtolower((string) ($localEntry['sha256'] ?? '')) === $expected['sha256']
            && (int) ($localEntry['size'] ?? -1) === $expected['size']) {
            return true;
        }

        return hash_equals($expected['sha256'], (string) FileSystemManager::hashFile($path));
    }

    /** Atomically point $latest at the versioned file (hard link, copy when links are unsupported). */
    private static function pointLatest(string $appDir, array $owner, string $latest): ?string
    {
        $source = $appDir.DIRECTORY_SEPARATOR.$owner['file'];
        $temp = $appDir.DIRECTORY_SEPARATOR.'.'.$latest.'.'.bin2hex(random_bytes(6)).self::TEMP_SUFFIX;
        $check = [];

        if (!@link($source, $temp)) {
            $check = self::diskCheck($owner['size']);
            if (!$check['ok']) {
                return 'insufficient_disk';
            }
            if (!FileSystemManager::copy($source, $temp)) {
                FileSystemManager::delete($temp);

                return 'latest_failed';
            }
        }
        if (!FileSystemManager::moveFile($temp, $appDir.DIRECTORY_SEPARATOR.$latest)) {
            FileSystemManager::delete($temp);

            return 'latest_failed';
        }

        return null;
    }
}
