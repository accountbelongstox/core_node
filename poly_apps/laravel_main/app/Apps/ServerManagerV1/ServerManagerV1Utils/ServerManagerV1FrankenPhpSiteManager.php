<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Utils\FileSystemManager;

class ServerManagerV1FrankenPhpSiteManager
{
    private const ENABLED_SUFFIX = '.caddy';
    private const DISABLED_SUFFIX = '.caddy.disabled';
    private const MANAGED_BY = 'ServerManagerV1FrankenPhpSiteManager';

    public static function list(): array
    {
        $directory = ServerManagerV1FrankenPhpCaddyfileBuilder::routesDirectory();
        $entries = FileSystemManager::scandir($directory);
        $sites = [];

        if (!is_array($entries)) {
            return [];
        }

        sort($entries, SORT_NATURAL | SORT_FLAG_CASE);
        foreach ($entries as $entry) {
            $enabled = str_ends_with($entry, self::ENABLED_SUFFIX);
            $disabled = str_ends_with($entry, self::DISABLED_SUFFIX);
            $siteName = '';
            $path = '';

            if (!$enabled && !$disabled) {
                continue;
            }
            $siteName = substr($entry, 0, -strlen($disabled ? self::DISABLED_SUFFIX : self::ENABLED_SUFFIX));
            if (!self::validSiteName($siteName)) {
                continue;
            }
            $path = $directory.DIRECTORY_SEPARATOR.$entry;
            if (!FileSystemManager::isFile($path)) {
                continue;
            }
            $sites[] = self::describe($siteName, $path, $enabled);
        }

        return $sites;
    }

    public static function find(string $siteName): ?array
    {
        $resolved = self::resolveSite($siteName);

        if ($resolved === null) {
            return null;
        }

        return self::describe($siteName, $resolved['path'], $resolved['enabled']);
    }

    public static function create(array $input): array
    {
        $siteName = self::normalizeSiteName((string) ($input['site_name'] ?? ''));
        $content = self::contentFromInput($input);
        $enabled = filter_var($input['enabled'] ?? true, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);

        if ($siteName === null) {
            return self::failure('Invalid site name.');
        }
        if (($content['success'] ?? false) !== true) {
            return $content;
        }

        return self::save($siteName, (string) $content['content'], $enabled ?? true, true);
    }

    public static function update(string $siteName, array $input): array
    {
        $normalizedName = self::normalizeSiteName($siteName);
        $current = null;
        $content = [];
        $enabled = null;

        if ($normalizedName === null) {
            return self::failure('Invalid site name.');
        }
        $current = self::resolveSite($normalizedName);
        if ($current === null) {
            return self::failure('FrankenPHP site not found.', 404);
        }

        if (array_key_exists('site_config', $input)) {
            $content = self::normalizeRawConfig((string) $input['site_config']);
        } elseif (array_key_exists('hosts', $input) || array_key_exists('upstream', $input)) {
            $content = self::contentFromInput($input);
        } else {
            $currentContent = FileSystemManager::readFile($current['path'], false);
            $content = is_string($currentContent)
                ? ['success' => true, 'content' => $currentContent]
                : self::failure('Unable to read the FrankenPHP site configuration.');
        }
        if (($content['success'] ?? false) !== true) {
            return $content;
        }

        $enabled = array_key_exists('enabled', $input)
            ? filter_var($input['enabled'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
            : (bool) $current['enabled'];

        return self::save(
            $normalizedName,
            (string) $content['content'],
            $enabled ?? (bool) $current['enabled'],
            false
        );
    }

    public static function setEnabled(string $siteName, bool $enabled): array
    {
        return self::update($siteName, ['enabled' => $enabled]);
    }

    public static function delete(string $siteName): array
    {
        $normalizedName = self::normalizeSiteName($siteName);
        $resolved = null;
        $lockPath = ServerManagerV1FrankenPhpCaddyfileBuilder::routesDirectory().DIRECTORY_SEPARATOR.'.sites.lock';

        if ($normalizedName === null) {
            return self::failure('Invalid site name.');
        }
        $resolved = self::resolveSite($normalizedName);
        if ($resolved === null) {
            return self::failure('FrankenPHP site not found.', 404);
        }

        $locked = FileSystemManager::runWithExclusiveFileLock($lockPath, function () use ($normalizedName, $resolved): array {
            $backupPath = self::backupPath($normalizedName, 'deleted');
            $ensure = [];
            $reload = [];
            $rollback = [];

            if (!FileSystemManager::ensureDirectoryExists(dirname($backupPath), 0700)) {
                return self::failure('Unable to prepare the FrankenPHP site backup directory.');
            }
            if (!@rename($resolved['path'], $backupPath)) {
                return self::failure('Unable to move the FrankenPHP site into recoverable backup storage.');
            }

            $ensure = ServerManagerV1FrankenPhpCaddyfileBuilder::ensure();
            $rollback = self::rollbackMetadata($normalizedName, $resolved, $backupPath);
            $reload = ($ensure['canonical'] ?? false)
                ? ServerManagerV1FrankenPhpReloadJob::queue(false, $rollback)
                : self::failure((string) ($ensure['error'] ?? 'Unable to render the canonical Caddyfile.'));

            if (($reload['success'] ?? false) !== true) {
                @rename($backupPath, $resolved['path']);
                ServerManagerV1FrankenPhpCaddyfileBuilder::ensure();
                return self::failure((string) ($reload['error'] ?? 'FrankenPHP reload failed.'));
            }

            return [
                'success' => true,
                'site_name' => $normalizedName,
                'deleted' => true,
                'backup_file' => $backupPath,
                'reloaded' => false,
                'reload_queued' => true,
                'reload_job_id' => $reload['job_id'] ?? null,
            ];
        }, true);

        return ($locked['acquired'] ?? false)
            ? (array) $locked['result']
            : self::failure('FrankenPHP site configuration is busy.');
    }

    private static function save(string $siteName, string $content, bool $enabled, bool $create): array
    {
        $routesDirectory = ServerManagerV1FrankenPhpCaddyfileBuilder::routesDirectory();
        $lockPath = $routesDirectory.DIRECTORY_SEPARATOR.'.sites.lock';

        if (!FileSystemManager::ensureDirectoryExists($routesDirectory, 0700)) {
            return self::failure('Unable to prepare the FrankenPHP routes directory.');
        }

        $locked = FileSystemManager::runWithExclusiveFileLock($lockPath, function () use ($siteName, $content, $enabled, $create): array {
            $current = self::resolveSite($siteName);
            $targetPath = self::routePath($siteName, $enabled);
            $backupPath = null;
            $validation = [];
            $ensure = [];
            $reload = [];
            $rollback = [];

            if ($create && $current !== null) {
                return self::failure('FrankenPHP site already exists.', 409);
            }
            if (!$create && $current === null) {
                return self::failure('FrankenPHP site not found.', 404);
            }

            $validation = self::validateCandidate($siteName, $content);
            if (($validation['success'] ?? false) !== true) {
                return self::failure((string) ($validation['output'] ?? 'Invalid FrankenPHP site configuration.'), 422);
            }

            if ($current !== null) {
                $backupPath = self::backupPath($siteName, 'updated');
                if (!FileSystemManager::ensureDirectoryExists(dirname($backupPath), 0700)
                    || !FileSystemManager::copy($current['path'], $backupPath)) {
                    return self::failure('Unable to back up the current FrankenPHP site configuration.');
                }
            }

            if (!self::atomicWrite($targetPath, $content)) {
                return self::failure('Unable to write the FrankenPHP site configuration.');
            }
            if ($current !== null && $current['path'] !== $targetPath && FileSystemManager::isFile($current['path'])) {
                @unlink($current['path']);
            }

            $ensure = ServerManagerV1FrankenPhpCaddyfileBuilder::ensure();
            $rollback = self::rollbackMetadata($siteName, $current, $backupPath);
            $reload = ($ensure['canonical'] ?? false)
                ? ServerManagerV1FrankenPhpReloadJob::queue(false, $rollback)
                : self::failure((string) ($ensure['error'] ?? 'Unable to render the canonical Caddyfile.'));

            if (($reload['success'] ?? false) !== true) {
                self::restore($siteName, $current, $backupPath);
                ServerManagerV1FrankenPhpCaddyfileBuilder::ensure();
                return self::failure((string) ($reload['error'] ?? 'FrankenPHP reload failed.'));
            }

            return [
                'success' => true,
                'created' => $create,
                'updated' => !$create,
                'reloaded' => false,
                'reload_queued' => true,
                'reload_job_id' => $reload['job_id'] ?? null,
                'site' => self::describe($siteName, $targetPath, $enabled),
                'backup_file' => $backupPath,
            ];
        }, true);

        return ($locked['acquired'] ?? false)
            ? (array) $locked['result']
            : self::failure('FrankenPHP site configuration is busy.');
    }

    private static function validateCandidate(string $siteName, string $candidate): array
    {
        $ensure = ServerManagerV1FrankenPhpCaddyfileBuilder::ensure();
        $mainContent = false;
        $routes = [];
        $validationContent = '';
        $temporaryPath = false;
        $result = [];

        if (($ensure['canonical'] ?? false) !== true) {
            return ['success' => false, 'output' => (string) ($ensure['error'] ?? 'Unable to render the canonical Caddyfile.')];
        }
        $mainContent = FileSystemManager::readFile(ServerManagerV1FrankenPhpCaddyfileBuilder::caddyfilePath(), false);
        if (!is_string($mainContent)) {
            return ['success' => false, 'output' => 'Unable to read the canonical Caddyfile.'];
        }

        $validationContent = preg_replace('/^import\s+.*\/routes\/\*\.caddy\s*$/m', '', $mainContent) ?? $mainContent;
        $routes = FileSystemManager::scandir(ServerManagerV1FrankenPhpCaddyfileBuilder::routesDirectory());
        if (is_array($routes)) {
            sort($routes, SORT_NATURAL | SORT_FLAG_CASE);
            foreach ($routes as $entry) {
                $routeContent = false;

                if (!str_ends_with($entry, self::ENABLED_SUFFIX)
                    || $entry === $siteName.self::ENABLED_SUFFIX) {
                    continue;
                }
                $routeContent = FileSystemManager::readFile(
                    ServerManagerV1FrankenPhpCaddyfileBuilder::routesDirectory().DIRECTORY_SEPARATOR.$entry,
                    false
                );
                if (is_string($routeContent)) {
                    $validationContent .= "\n".rtrim($routeContent)."\n";
                }
            }
        }
        $validationContent .= "\n".rtrim($candidate)."\n";

        $temporaryPath = tempnam(sys_get_temp_dir(), 'ncore-caddy-site-');
        if ($temporaryPath === false || !FileSystemManager::writePrivateFile($temporaryPath, $validationContent)) {
            return ['success' => false, 'output' => 'Unable to prepare the temporary Caddyfile validation input.'];
        }

        $result = ServerManagerV1FrankenPhpCaddyfileBuilder::adaptPath($temporaryPath);
        @unlink($temporaryPath);

        return $result;
    }

    private static function contentFromInput(array $input): array
    {
        $raw = $input['site_config'] ?? null;
        $hostsInput = $input['hosts'] ?? [];
        $hosts = is_array($hostsInput)
            ? $hostsInput
            : preg_split('/[\s,]+/', (string) $hostsInput, -1, PREG_SPLIT_NO_EMPTY);
        $upstream = trim((string) ($input['upstream'] ?? ''));
        $certificateDomain = strtolower(trim((string) ($input['certificate_domain'] ?? '')));
        $normalizedHosts = [];
        $certificateDirectory = '';

        if (is_string($raw) && trim($raw) !== '') {
            return self::normalizeRawConfig($raw);
        }
        if (!is_array($hosts) || $hosts === []) {
            return self::failure('At least one hostname is required.', 422);
        }
        foreach (array_unique(array_map(static fn ($host): string => strtolower(trim((string) $host)), $hosts)) as $host) {
            if (!self::validHost($host)) {
                return self::failure("Invalid hostname: {$host}", 422);
            }
            $normalizedHosts[] = $host;
        }
        if (!self::validUpstream($upstream)) {
            return self::failure('Invalid upstream URL. Use an http or https origin without a path.', 422);
        }
        if (!self::validHost($certificateDomain)) {
            return self::failure('A valid acme.sh certificate domain is required.', 422);
        }

        $certificateDirectory = ServerManagerV1FrankenPhpCaddyfileBuilder::acmeCertificateDirectory($certificateDomain);
        if (!FileSystemManager::isFile($certificateDirectory.DIRECTORY_SEPARATOR.'fullchain.pem')
            || !FileSystemManager::isFile($certificateDirectory.DIRECTORY_SEPARATOR.'key.pem')) {
            return self::failure("acme.sh certificate is not deployed for {$certificateDomain}.", 422);
        }

        return [
            'success' => true,
            'content' => ServerManagerV1FrankenPhpCaddyfileBuilder::renderReverseProxySite(
                $normalizedHosts,
                $upstream,
                $certificateDirectory,
                self::MANAGED_BY,
            ),
        ];
    }

    private static function normalizeRawConfig(string $content): array
    {
        $normalized = str_replace(["\r\n", "\r"], "\n", trim($content));

        if ($normalized === '' || strlen($normalized) > 262144) {
            return self::failure('FrankenPHP site configuration is empty or too large.', 422);
        }

        return ['success' => true, 'content' => $normalized."\n"];
    }

    private static function describe(string $siteName, string $path, bool $enabled): array
    {
        $content = FileSystemManager::readFile($path, false);
        $hosts = [];
        $upstreams = [];
        $managedBy = 'unknown';
        $certificateDomain = null;
        $modified = FileSystemManager::filemtime($path);

        if (!is_string($content)) {
            $content = '';
        }
        if (preg_match_all('/^[ \t]*((?:https?:\/\/)?[^\r\n#{]+?)[ \t]*\{[ \t]*$/m', $content, $matches)) {
            foreach ($matches[1] as $addressList) {
                foreach (explode(',', $addressList) as $address) {
                    $host = preg_replace('/^https?:\/\//', '', trim($address));
                    $host = preg_replace('/:\d+$/', '', (string) $host);
                    if (is_string($host) && self::validHost($host)) {
                        $hosts[] = strtolower($host);
                    }
                }
            }
        }
        if (preg_match_all('/^\s*reverse_proxy(?:\s+@[^\s]+)?\s+([^\s{]+)/m', $content, $matches)) {
            $upstreams = array_values(array_unique(array_map('trim', $matches[1])));
        }
        if (preg_match('/^#\s*managed-by:\s*([^\s]+)/mi', $content, $matches)) {
            $managedBy = trim($matches[1]);
        }
        if (preg_match('#/frankenphp/certs/([^/]+)/fullchain\.pem#', $content, $matches)) {
            $certificateDomain = strtolower($matches[1]);
        }

        $hosts = array_values(array_unique($hosts));

        return [
            'site_name' => $siteName,
            'domain' => $hosts[0] ?? $siteName,
            'hosts' => $hosts,
            'upstreams' => $upstreams,
            'upstream' => $upstreams[0] ?? null,
            'certificate_domain' => $certificateDomain,
            'enabled' => $enabled,
            'managed_by' => $managedBy,
            'config_path' => $path,
            'content' => $content,
            'size' => strlen($content),
            'updated_at' => is_int($modified) ? date(DATE_ATOM, $modified) : null,
        ];
    }

    private static function resolveSite(string $siteName): ?array
    {
        $enabledPath = self::routePath($siteName, true);
        $disabledPath = self::routePath($siteName, false);

        if (FileSystemManager::isFile($enabledPath)) {
            return ['path' => $enabledPath, 'enabled' => true];
        }
        if (FileSystemManager::isFile($disabledPath)) {
            return ['path' => $disabledPath, 'enabled' => false];
        }

        return null;
    }

    private static function routePath(string $siteName, bool $enabled): string
    {
        return ServerManagerV1FrankenPhpCaddyfileBuilder::routesDirectory()
            .DIRECTORY_SEPARATOR.$siteName.($enabled ? self::ENABLED_SUFFIX : self::DISABLED_SUFFIX);
    }

    private static function backupPath(string $siteName, string $operation): string
    {
        return ServerManagerV1FrankenPhpCaddyfileBuilder::routeBackupsDirectory()
            .DIRECTORY_SEPARATOR.$siteName.'.'.$operation.'.'.date('YmdHis').'.'.bin2hex(random_bytes(4)).'.caddy';
    }

    private static function atomicWrite(string $path, string $content): bool
    {
        $temporaryPath = dirname($path).DIRECTORY_SEPARATOR.'.'.basename($path).'.'.bin2hex(random_bytes(6)).'.tmp';

        if (!FileSystemManager::writePrivateFile($temporaryPath, $content)) {
            return false;
        }
        if (@rename($temporaryPath, $path)) {
            return FileSystemManager::isFile($path);
        }
        @unlink($temporaryPath);

        return false;
    }

    private static function restore(string $siteName, ?array $current, ?string $backupPath): void
    {
        $enabledPath = self::routePath($siteName, true);
        $disabledPath = self::routePath($siteName, false);

        if (FileSystemManager::isFile($enabledPath)) {
            @unlink($enabledPath);
        }
        if (FileSystemManager::isFile($disabledPath)) {
            @unlink($disabledPath);
        }
        if ($current !== null && $backupPath !== null && FileSystemManager::isFile($backupPath)) {
            FileSystemManager::copy($backupPath, $current['path']);
        }
    }

    public static function rollbackQueuedChange(array $metadata): array
    {
        $backupPath = is_string($metadata['backup_file'] ?? null) ? $metadata['backup_file'] : null;
        $backupRoot = ServerManagerV1FrankenPhpCaddyfileBuilder::routeBackupsDirectory().DIRECTORY_SEPARATOR;
        $currentEnabled = (bool) ($metadata['current_enabled'] ?? false);
        $currentExisted = (bool) ($metadata['current_existed'] ?? false);
        $siteName = self::normalizeSiteName((string) ($metadata['site_name'] ?? ''));
        $targetPath = '';

        if ($siteName === null) {
            return self::failure('Invalid FrankenPHP rollback site name.');
        }
        if ($currentExisted && ($backupPath === null
            || !str_starts_with($backupPath, $backupRoot)
            || !FileSystemManager::isFile($backupPath))) {
            return self::failure('FrankenPHP rollback backup is unavailable.');
        }

        self::restore($siteName, $currentExisted ? [
            'path' => self::routePath($siteName, $currentEnabled),
            'enabled' => $currentEnabled,
        ] : null, $backupPath);
        $targetPath = self::routePath($siteName, $currentEnabled);

        return [
            'success' => $currentExisted
                ? FileSystemManager::isFile($targetPath)
                : !FileSystemManager::isFile(self::routePath($siteName, true))
                    && !FileSystemManager::isFile(self::routePath($siteName, false)),
            'site_name' => $siteName,
            'restored' => $currentExisted,
            'removed' => !$currentExisted,
        ];
    }

    private static function rollbackMetadata(string $siteName, ?array $current, ?string $backupPath): array
    {
        return [
            'site_name' => $siteName,
            'current_existed' => $current !== null,
            'current_enabled' => (bool) ($current['enabled'] ?? false),
            'backup_file' => $backupPath,
        ];
    }

    private static function normalizeSiteName(string $siteName): ?string
    {
        $normalized = strtolower(trim($siteName));

        return self::validSiteName($normalized) ? $normalized : null;
    }

    private static function validSiteName(string $siteName): bool
    {
        return strlen($siteName) <= 127
            && !str_contains($siteName, '..')
            && preg_match('/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/', $siteName) === 1;
    }

    private static function validHost(string $host): bool
    {
        return $host !== ''
            && filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) !== false;
    }

    private static function validUpstream(string $upstream): bool
    {
        $parts = parse_url($upstream);
        $path = '';

        if (!is_array($parts) || !in_array($parts['scheme'] ?? '', ['http', 'https'], true)) {
            return false;
        }
        if (($parts['host'] ?? '') === '' || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment'])) {
            return false;
        }
        $path = (string) ($parts['path'] ?? '');
        if ($path !== '' && $path !== '/') {
            return false;
        }
        if (isset($parts['port']) && ((int) $parts['port'] < 1 || (int) $parts['port'] > 65535)) {
            return false;
        }

        return true;
    }

    private static function failure(string $message, int $status = 500): array
    {
        return ['success' => false, 'error' => $message, 'status' => $status];
    }
}
