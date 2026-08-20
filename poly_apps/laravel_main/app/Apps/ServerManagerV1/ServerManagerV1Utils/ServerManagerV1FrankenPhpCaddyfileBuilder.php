<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Services\Relay\RelayHubKeyProvisioner;
use App\Services\Relay\RelayHubJwt;
use App\Providers\PathMapper;
use App\Support\RuntimeConfigurationStore;
use App\Support\ServiceContract;
use App\Utils\FileSystemManager;

/**
 * Single source of truth for the frankenphp-plane Caddyfile generation (one
 * site: the contract laravel_main app served by octane:frankenphp on
 * 443/h2/h3 with the built-in Mercure hub). Every caller (controllers, CLI
 * commands) renders through this builder so the plane keeps one canonical
 * server definition.
 *
 * SYNC CONTRACT (two ends, one truth): this is the Laravel end of the
 * Caddyfile template. The shell end is:
 *   scripts/shells/linux/common/frankenphp_manager.sh
 *     (fm_caddyfile_ensure / fm_caddyfile_path defaults / fm_php_ini_dir)
 *   scripts/shells/linux/debian/debian_com/laravel_runtime_frankenphp.sh
 *     (launch: octane:frankenphp --caddyfile=... --admin-port=...)
 * Any change to the global admin block, the https site block, the Mercure
 * publisher_jwt/subscriber_jwt stanza, the php_server/file_server pair, or
 * the env placeholder names MUST be applied to both ends in the same
 * change (byte-identical semantics; only the managed-by comment names its
 * owning end). Initial provisioning renders through the shell end;
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
        ?string $siteHost = null,
        ?int $httpsPort = null,
        ?int $adminPort = null,
    ): string {
        $publicDir = $laravelPublicDir ?? self::defaultPublicDir();
        $host = $siteHost ?? self::defaultSiteHost();
        $https = $httpsPort ?? ServiceContract::port('frankenphp_https');
        $admin = $adminPort ?? ServiceContract::port('frankenphp_admin');
        $backend = ServiceContract::port('laravel_api_backend');

        // Prebuilt-cert gate FIRST: the acme.sh DNS-01 certificates on disk
        // are pinned explicitly (the service-start pre-flight provisions
        // them BEFORE the server binds the HTTPS port). Mirrors the shell
        // end's fm_caddyfile_ensure gate byte-identically.
        $certDir = self::acmeCertDirForHost($host);
        $acmeTls = ($certDir !== ''
            && FileSystemManager::isFile($certDir.'/fullchain.pem')
            && FileSystemManager::isFile($certDir.'/key.pem'))
            ? "\ttls {$certDir}/fullchain.pem {$certDir}/key.pem\n\n"
            : '';

        // DNS-01 fallback stanza renders ONLY when no prebuilt cert holds
        // and all truths hold (public site host - NOT the localhost
        // fallback: certmagic rejects localhost for public certs and would
        // loop ACME retries forever; a localhost site falls back to Caddy's
        // internal CA - module embedded + token stored); token value stays
        // a {env.*} placeholder. Mirrors the shell end's gate
        // byte-identically.
        $dnspodTls = ($acmeTls === '' && $host !== 'localhost' && self::hasDnsPodModule() && self::dnspodTokenConfigured())
            ? "\ttls {\n\t\tdns dnspod {env.DNSPOD_TOKEN}\n\t}\n\n"
            : '';

        $mercureStanza = self::mercureStanza();

        // Per-domain route import, gated on file presence (caddy errors on
        // an unmatched import glob). Mirrors the shell end.
        $routesDir = dirname(self::caddyfilePath()).DIRECTORY_SEPARATOR.'routes';
        $importStanza = !self::hasRouteFiles($routesDir)
            ? ''
            : "\n# Per-domain route files (managed by fm_domain_ensure_route_file)\nimport {$routesDir}/*.caddy\n";

        return "# Managed by ServerManagerV1FrankenPhpCaddyfileBuilder (SYNC: frankenphp_manager.sh)\n"
            . "{\n"
            . "\tadmin localhost:{$admin}\n"
            . "\tauto_https disable_redirects\n"
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
            . $dnspodTls
            . $acmeTls
            . $mercureStanza
            . self::octanePhpServerStanza()
            . "}\n"
            . "\n"
            . "# Direct HTTP catch-all backend (LAN and local machine clients)\n"
            . ":{$backend} {\n"
            . "\troot * {$publicDir}\n"
            . "\tencode zstd gzip\n"
            . self::octanePhpServerStanza()
            . "}\n"
            . $importStanza;
    }

    /**
     * Mercure hub stanza - the official flat syntax of the embedded
     * mercure/caddy module (v0.24.x): literal HS256 keys from the private
     * store. Empty when the keys are not provisioned yet. Mirrors the shell
     * end's fm_mercure_stanza byte-identically.
     */
    private static function mercureStanza(): string
    {
        $publisherKey = RuntimeConfigurationStore::get(RelayHubJwt::PUBLISHER_KEY);
        $subscriberKey = RuntimeConfigurationStore::get(RelayHubJwt::SUBSCRIBER_KEY);

        if ($publisherKey === null || $subscriberKey === null
            || trim($publisherKey) === '' || trim($subscriberKey) === '') {
            return '';
        }

        return "\tmercure {\n"
            . "\t\tpublisher_jwt {$publisherKey} HS256\n"
            . "\t\tsubscriber_jwt {$subscriberKey} HS256\n"
            . "\t\tcookie_name ".ServiceContract::string('realtime.mercure_cookie')."\n"
            . "\t}\n"
            . "\n";
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
                'error' => 'Mercure hub keys are not provisioned',
            ];
        }
        $rendered = self::render();

        $dir = dirname($path);
        if (!FileSystemManager::ensureDirectoryExists($dir)) {
            return ['path' => $path, 'rendered' => false, 'canonical' => false,
                'error' => "unable to create {$dir}"];
        }

        $existing = FileSystemManager::readFile($path, false);
        if (is_string($existing) && rtrim($existing) === rtrim($rendered)) {
            if (!FileSystemManager::ensureFileMode($path, 0600)) {
                return ['path' => $path, 'rendered' => false, 'canonical' => true,
                    'error' => "unable to set private permissions on {$path}"];
            }

            return ['path' => $path, 'rendered' => false, 'canonical' => true];
        }

        if (!FileSystemManager::writePrivateFile($path, $rendered)) {
            return ['path' => $path, 'rendered' => false, 'canonical' => false,
                'error' => "unable to write {$path}"];
        }

        return ['path' => $path, 'rendered' => true, 'canonical' => true];
    }

    /**
     * Validate the Caddyfile through the binary (`frankenphp validate`).
     *
     * @return array{success: bool, output: string}
     */
    public static function validate(): array
    {
        $binary = self::binary();
        if ($binary === null) {
            return ['success' => false, 'output' => 'frankenphp binary not found'];
        }

        $result = ServerManagerV1Utils::executeCommand($binary, ['validate', '--config', self::caddyfilePath()]);

        return [
            'success' => (bool) $result['success'],
            'output' => trim(($result['output'] ?? '') . "\n" . ($result['error'] ?? '')),
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
            return ['stored' => false, 'error' => 'token value was not persisted'];
        }

        return ['stored' => true] + self::ensure();
    }

    /**
     * Contract site host (single consumer default; the shell end's
     * FRANKENPHP_SITE_HOST flows through the runtime branch).
     */
    private static function defaultSiteHost(): string
    {
        return (string) (getenv('FRANKENPHP_SITE_HOST') ?: 'localhost');
    }

    /**
     * Certificate directory (prebuilt acme.sh variant) serving the given
     * site host, keyed by the registrable apex - mirrors the shell end's
     * fm_acme_cert_dir_for_host: strip a leading "api.<region>.", where
     * the region prefix comes from the DOMAIN_API_PREFIX env when set and
     * otherwise from the 4-label heuristic ("api.si.gm15.com" ->
     * "gm15.com"). Empty string when the apex cannot be derived.
     */
    private static function acmeCertDirForHost(string $host): string
    {
        $prefix = (string) (getenv('DOMAIN_API_PREFIX') ?: '');
        $apex = '';

        if ($host === '' || $host === 'localhost') {
            return '';
        }
        if ($prefix !== '' && str_starts_with($host, "api.{$prefix}.")) {
            $apex = substr($host, strlen("api.{$prefix}."));
        } elseif (str_starts_with($host, 'api.') && substr_count($host, '.') >= 3) {
            $apex = preg_replace('/^[^.]+\.[^.]+\./', '', $host) ?? $host;
        } else {
            $apex = $host;
        }

        if ($apex === '' || strpos($apex, '.') === false) {
            return '';
        }

        return PathMapper::mapWebPath('compile_dir', 'frankenphp/certs/'.$apex);
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
