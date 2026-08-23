<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Services\Relay\RelayHubKeyProvisioner;
use App\Services\Relay\RelayHubJwt;
use App\Providers\PathMapper;
use App\Support\RuntimeConfigurationStore;
use App\Support\ServiceContract;
use App\Utils\FileSystemManager;

/**
 * Single source of truth for the FrankenPHP-plane Caddyfile generation. The
 * contract-owned internal TLS site is distinct from public domain routes;
 * Laravel Octane and the built-in Mercure hub share the same server plane.
 *
 * SYNC CONTRACT (two ends, one truth): this is the Laravel end of the
 * Caddyfile template. The shell end is:
 *   scripts/shells/linux/common/frankenphp_manager.sh
 *     (fm_caddyfile_ensure / fm_caddyfile_path defaults / fm_php_ini_dir)
 *   scripts/shells/linux/debian/debian_com/laravel_runtime_frankenphp.sh
 *     (launch: frankenphp run -c <canonical Caddyfile>)
 * Any change to the global admin block, the https site block, the Mercure
 * publisher_jwt/subscriber_jwt stanza, the php_server/file_server pair, or
 * the env placeholder names MUST be applied to both ends in the same
 * change with byte-identical output. Initial provisioning renders through the shell end;
 * afterwards the UI (http://127.0.0.1:13054/laravel-manager#/server)
 * manages the plane through this builder via the laravel_main API.
 */
class ServerManagerV1FrankenPhpCaddyfileBuilder
{
    private const DNS01_MODE_EMBEDDED = 'embedded';
    private const ENV_BINARY_PATH = 'FRANKENPHP_BINARY_PATH';
    private const ENV_DNS01_MODE = 'FRANKENPHP_DNS01_MODE';
    private const ENV_VARIANT = 'FRANKENPHP_VARIANT';

    /** Bootstrap probe order for an unrecorded runtime only. */
    private const BINARY_CANDIDATES = ['/usr/local/bin/frankenphp', '/usr/bin/frankenphp'];

    /**
     * The contract Caddyfile path (mirrors
     * laravel_runtime_frankenphp.sh FRANKENPHP_CADDYFILE).
     */
    public static function caddyfilePath(): string
    {
        return PathMapper::getLaravelMainDir().DIRECTORY_SEPARATOR.'storage'
            .DIRECTORY_SEPARATOR.'frankenphp'.DIRECTORY_SEPARATOR.'Caddyfile';
    }

    public static function routesDirectory(): string
    {
        return dirname(self::caddyfilePath()).DIRECTORY_SEPARATOR.'routes';
    }

    public static function routeBackupsDirectory(): string
    {
        return dirname(self::caddyfilePath()).DIRECTORY_SEPARATOR.'route-backups';
    }

    public static function acmeCertificateDirectory(string $domain): string
    {
        return ServiceContract::path('frankenphp_root_posix')
            .DIRECTORY_SEPARATOR.'certs'.DIRECTORY_SEPARATOR.strtolower($domain);
    }

    public static function renderReverseProxySite(
        array $hosts,
        string $upstream,
        string $certificateDirectory,
        string $managedBy,
    ): string {
        $httpsPort = ServiceContract::port('frankenphp_https');
        $httpPort = ServiceContract::port('frankenphp_http');
        $earlyHintsLink = ServiceContract::string('http.ui_early_hints_link');
        $httpsAddresses = [];
        $httpAddresses = [];
        $handlers = '';

        foreach ($hosts as $host) {
            $httpsAddresses[] = "https://{$host}:{$httpsPort}";
            $httpAddresses[] = "http://{$host}:{$httpPort}";
        }
        $handlers = self::renderReverseProxyHandlers($upstream, $earlyHintsLink);

        return "# managed-by: {$managedBy}\n\n"
            .implode(', ', $httpsAddresses)." {\n"
            ."\ttls {$certificateDirectory}/fullchain.pem {$certificateDirectory}/key.pem\n"
            .$handlers
            ."}\n\n"
            .implode(', ', $httpAddresses)." {\n"
            .$handlers
            ."}\n";
    }

    private static function renderReverseProxyHandlers(string $upstream, string $earlyHintsLink): string
    {
        if (trim($earlyHintsLink) === '') {
            return "\treverse_proxy {$upstream}\n";
        }

        return "\troute {\n"
            ."\t\t@early_hints header Accept *text/html*\n"
            ."\t\theader @early_hints Link \"{$earlyHintsLink}\"\n"
            ."\t\trespond @early_hints 103\n"
            ."\t\treverse_proxy {$upstream}\n"
            ."\t}\n";
    }

    /**
     * Render the canonical Caddyfile. The Mercure HS256 keys are embedded
     * as literal publisher_jwt/subscriber_jwt values (single source: the
     * private RuntimeConfigurationStore; the file is 0600) - no process
     * env and no .env anywhere. The DNSPod token stays an env placeholder.
     * Site block + direct HTTP backend block + per-domain route import
     * mirror the shell end (fm_caddyfile_ensure) byte-identically.
     */
    public static function render(
        ?string $laravelPublicDir = null,
        ?int $httpsPort = null,
        ?int $adminPort = null,
    ): string {
        $publicDir = $laravelPublicDir ?? self::defaultPublicDir();
        $host = ServiceContract::host('localhost');
        $https = $httpsPort ?? ServiceContract::port('frankenphp_https');
        $admin = $adminPort ?? ServiceContract::port('frankenphp_admin');
        $backend = ServiceContract::port('laravel_api_backend');
        $bindHost = ServiceContract::host('any');

        $mercureStanza = self::mercureStanza();

        // Per-domain route import, gated on file presence (caddy errors on
        // an unmatched import glob). Mirrors the shell end.
        $routesDir = self::routesDirectory();
        $importStanza = !self::hasRouteFiles($routesDir)
            ? ''
            : "\n# Per-domain route files (managed by fm_domain_ensure_route_file)\nimport {$routesDir}/*.caddy\n";

        return "# Managed by core_node FrankenPHP Caddyfile contract\n"
            . "{\n"
            . "\tadmin localhost:{$admin}\n"
            . "\tauto_https disable_redirects\n"
            . "\tgrace_period 10s\n"
            . "\tdefault_bind {$bindHost}\n"
            . "\tservers {$bindHost}:{$backend} {\n"
            . "\t\tprotocols h1\n"
            . "\t}\n"
            . "\tservers {$bindHost}:{$https} {\n"
            . "\t\tprotocols h1 h2 h3\n"
            . "\t}\n"
            . "\n"
            . "\tfrankenphp {\n"
            . "\t\tworker {\n"
            . "\t\t\tfile \"{$publicDir}/frankenphp-worker.php\"\n"
            . "\t\t\t{\$CADDY_SERVER_WORKER_DIRECTIVE}\n"
            . "\t\t\t{\$CADDY_SERVER_WATCH_DIRECTIVES}\n"
            . "\t\t}\n"
            . "\t}\n"
            . "}\n"
            . "\n"
            . "https://{$host}:{$https} {\n"
            . "\troot * {$publicDir}\n"
            . "\tencode zstd gzip\n"
            . "\n"
            . self::octaneHttpsStanza($backend)
            . "}\n"
            . "\n"
            . "# Direct HTTP catch-all backend (LAN and local machine clients)\n"
            . ":{$backend} {\n"
            . "\troot * {$publicDir}\n"
            . "\tencode zstd gzip\n"
            . $mercureStanza
            . self::octanePhpServerStanza()
            . "}\n"
            . $importStanza;
    }

    /**
     * The single Mercure hub lives on the direct backend site. HTTPS and
     * managed domain sites proxy the well-known path to this one instance.
     */
    private static function mercureStanza(): string
    {
        $publisherKey = RuntimeConfigurationStore::get(RelayHubJwt::PUBLISHER_KEY);
        $subscriberKey = RuntimeConfigurationStore::get(RelayHubJwt::SUBSCRIBER_KEY);
        $corsOrigins = ServiceContract::webAccessStringList('corsOrigins');

        if ($publisherKey === null
            || trim($publisherKey) === ''
            || $subscriberKey === null
            || trim($subscriberKey) === ''
        ) {
            return '';
        }

        return "\tmercure {\n"
            . "\t\ttransport ".ServiceContract::string('realtime.mercure_transport')."\n"
            . "\t\tpublisher_jwt {$publisherKey} HS256\n"
            . "\t\tsubscriber_jwt {$subscriberKey} HS256\n"
            . "\t\tcors_origins ".implode(' ', $corsOrigins)."\n"
            . "\t\tcookie_name ".ServiceContract::string('realtime.mercure_cookie')."\n"
            . "\t}\n"
            . "\n";
    }

    private static function octaneHttpsStanza(int $backendPort): string
    {
        return "\troute {\n"
            . "\t\t@mercure path /.well-known/mercure*\n"
            . "\t\treverse_proxy @mercure http://".ServiceContract::host('loopback').":{$backendPort}\n"
            . "\t\tphp_server {\n"
            . "\t\t\tindex frankenphp-worker.php\n"
            . "\t\t\ttry_files {path} frankenphp-worker.php\n"
            . "\t\t\trequest_body_timeout ".ServiceContract::string('php_runtime.request_body_timeout')."\n"
            . "\t\t\tresolve_root_symlink\n"
            . "\t\t}\n"
            . "\t}\n";
    }

    /**
     * Idempotently ensure the Caddyfile matches the canonical render
     * (content-hash compare; write + 0600 only on drift). Returns a report
     * mirroring fm_caddyfile_ensure's contract.
     *
     * @return array{path: string, rendered: bool, canonical: bool, error?: string}
     */
    public static function ensure(): array
    {
        $path = self::caddyfilePath();
        RelayHubKeyProvisioner::ensure();
        if (!RelayHubKeyProvisioner::provisioned()) {
            return [
                'path' => $path,
                'rendered' => false,
                'canonical' => false,
                'error' => __('relay.mercure_keys_missing'),
            ];
        }
        $rendered = self::render();

        $dir = dirname($path);
        if (!FileSystemManager::ensureDirectoryExists($dir)) {
            return ['path' => $path, 'rendered' => false, 'canonical' => false,
                'error' => __('relay.private_file_directory_failed', ['path' => $dir])];
        }

        $existing = FileSystemManager::readFile($path, false);
        if (is_string($existing) && rtrim($existing) === rtrim($rendered)) {
            if (!FileSystemManager::ensureFileMode($path, 0600)) {
                return ['path' => $path, 'rendered' => false, 'canonical' => true,
                    'error' => __('relay.private_file_mode_failed', ['path' => $path])];
            }

            return ['path' => $path, 'rendered' => false, 'canonical' => true];
        }

        if (!FileSystemManager::writePrivateFile($path, $rendered)) {
            return ['path' => $path, 'rendered' => false, 'canonical' => false,
                'error' => __('relay.private_file_write_failed', ['path' => $path])];
        }

        return ['path' => $path, 'rendered' => true, 'canonical' => true];
    }

    /** @return array{success: bool, output: string} */
    public static function validate(): array
    {
        return self::adaptPath(self::caddyfilePath());
    }

    /**
     * Adapt without provisioning runtime modules. Full provisioning is
     * performed atomically by the Caddy admin /load endpoint. This avoids
     * opening the live Mercure Bolt database from a second process.
     *
     * @return array{success: bool, output: string}
     */
    public static function adaptPath(string $path): array
    {
        $binary = self::binary();
        $configuration = null;
        $error = '';
        $result = [];

        if ($binary === null) {
            return ['success' => false, 'output' => 'frankenphp binary not found'];
        }

        $result = ServerManagerV1Utils::executeCommand(
            $binary,
            ['adapt', '--config', $path, '--adapter', 'caddyfile']
        );
        $configuration = json_decode((string) ($result['output'] ?? ''), true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($configuration)) {
            return [
                'success' => true,
                'output' => 'Caddyfile adapted successfully; runtime provisioning is verified by the atomic admin reload.',
            ];
        }

        $error = trim((string) ($result['error'] ?? ''));

        return [
            'success' => false,
            'output' => $error !== '' ? $error : 'Caddyfile adaptation failed.',
        ];
    }

    /**
     * Resolve the exact binary selected by the shell variant policy. A
     * recorded runtime fails closed when its payload is missing; candidate
     * probing is limited to processes without a variant contract.
     */
    public static function binary(): ?string
    {
        $selectedBinary = getenv(self::ENV_BINARY_PATH);
        if ($selectedBinary !== false && $selectedBinary !== '') {
            return is_executable($selectedBinary) ? $selectedBinary : null;
        }
        if (getenv(self::ENV_VARIANT) !== false) {
            return null;
        }

        foreach (self::BINARY_CANDIDATES as $candidate) {
            if (is_executable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Embedded PHP version ("8.5") via `frankenphp php-cli`; null when the
     * binary or the probe is unavailable (mirrors fm_php_version).
     */
    public static function embeddedPhpVersion(): ?string
    {
        $binary = self::binary();
        if ($binary === null) {
            return null;
        }

        $result = ServerManagerV1Utils::executeCommand($binary, [
            'php-cli', '-r', 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;',
        ]);
        $version = trim((string) ($result['output'] ?? ''));

        return preg_match('/^\d+\.\d+$/', $version) === 1 ? $version : null;
    }

    /**
     * Binary version string (mirrors fm_version).
     */
    public static function version(): ?string
    {
        $binary = self::binary();
        if ($binary === null) {
            return null;
        }

        $result = ServerManagerV1Utils::executeCommand($binary, ['version']);
        $version = trim((string) ($result['output'] ?? ''));

        return $version === '' ? null : $version;
    }

    /**
     * True when the dnspod module is embedded in the binary (mirrors
     * fm_has_module).
     */
    public static function hasDnsPodModule(): bool
    {
        $dns01Mode = getenv(self::ENV_DNS01_MODE);
        if ($dns01Mode !== false && $dns01Mode !== self::DNS01_MODE_EMBEDDED) {
            return false;
        }

        $binary = self::binary();
        if ($binary === null) {
            return false;
        }

        $result = ServerManagerV1Utils::executeCommand($binary, ['list-modules']);

        return strpos(($result['output'] ?? '') . ($result['error'] ?? ''), 'dns.providers.dnspod') !== false;
    }

    /**
     * True when the DNSPod API token is stored in the shared
     * RuntimeConfigurationStore (boolean surface only - the value never
     * leaves the store; mirrors fm_dnspod_token_value truth).
     */
    public static function dnspodTokenConfigured(): bool
    {
        $token = RuntimeConfigurationStore::get('DNSPOD_TOKEN');

        return $token !== null && trim($token) !== '';
    }

    /**
     * Store the DNSPod API token (format "id,token") and re-render the
     * canonical Caddyfile so the tls stanza engages in the same change.
     * Canonical write surface for the token (the shell end reads it).
     */
    public static function storeDnsPodToken(string $token): array
    {
        $stored = null;

        if (trim($token) === '') {
            return ['stored' => false, 'error' => 'token value required (format: id,token)'];
        }
        RuntimeConfigurationStore::put('DNSPOD_TOKEN', trim($token));
        $stored = RuntimeConfigurationStore::get('DNSPOD_TOKEN');
        if (!is_string($stored) || !hash_equals(trim($token), $stored)) {
            return ['stored' => false, 'error' => __('relay.runtime_value_write_failed')];
        }

        return ['stored' => true] + self::ensure();
    }

    /**
     * Contract Laravel public dir - the laravel_main checkout this app runs
     * from (base_path is <checkout>/poly_apps/laravel_main).
     */
    private static function defaultPublicDir(): string
    {
        return PathMapper::getLaravelMainDir().DIRECTORY_SEPARATOR.'public';
    }

    private static function octanePhpServerStanza(): string
    {
        return "\tphp_server {\n"
            . "\t\tindex frankenphp-worker.php\n"
            . "\t\ttry_files {path} frankenphp-worker.php\n"
            . "\t\trequest_body_timeout ".ServiceContract::string('php_runtime.request_body_timeout')."\n"
            . "\t\tresolve_root_symlink\n"
            . "\t}\n";
    }

    private static function hasRouteFiles(string $routesDir): bool
    {
        $entries = FileSystemManager::scandir($routesDir);
        if (!is_array($entries)) {
            return false;
        }

        foreach ($entries as $entry) {
            if (str_ends_with($entry, '.caddy')
                && FileSystemManager::isFile($routesDir.DIRECTORY_SEPARATOR.$entry)) {
                return true;
            }
        }

        return false;
    }
}
