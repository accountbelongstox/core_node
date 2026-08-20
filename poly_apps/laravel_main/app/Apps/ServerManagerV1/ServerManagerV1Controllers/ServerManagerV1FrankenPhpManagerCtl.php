<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1FrankenPhpCaddyfileBuilder;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use App\Support\RuntimeConfigurationStore;
use App\Support\ServiceContract;
use App\Support\WebServerPlane;
use App\Utils\FileSystemManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ServerManagerV1FrankenPhpManagerCtl extends ServerManagerV1BaseCtl
{
    /**
     * Hint shown when the frankenphp binary is not installed on the host.
     */
    private const FRANKENPHP_INSTALL_HINT = 'frankenphp is not installed. Run: bash scripts/shells/linux/debian/install_shells/93_install_frankenphp.sh (idempotent installer)';

    // SYNC CONTRACT (two ends, one truth): this controller is the Laravel end
    // of the frankenphp web-server plane (binary + Caddyfile + plane record).
    // The shell end is:
    //   scripts/shells/linux/common/frankenphp_manager.sh (fm_* primitives)
    //   scripts/shells/linux/debian/install_shells/93_install_frankenphp.sh
    //   scripts/shells/linux/debian/debian_com/laravel_runtime_frankenphp.sh
    // Any change to probe fields, canonical Caddyfile semantics, or plane
    // adoption MUST be applied to both ends in the same change. The UI
    // (http://127.0.0.1:13054/laravel-manager#/server) talks ONLY to this
    // API; initial provisioning runs through the shell end. Octane worker
    // lifecycle (start/stop/reload) is NOT duplicated here - it lives in the
    // unified app manager (POST /api/unified/octane/*).

    /**
     * Plane + binary + Caddyfile + Mercure provisioning status. Capability
     * fields mirror the shell end (fm_verify) so both ends report the same
     * truth. Mercure secrets are never returned - only provisioning booleans.
     */
    public function statusOverview(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'frankenphp_status_overview');
        if ($validation) {
            return $validation;
        }

        $binary = ServerManagerV1FrankenPhpCaddyfileBuilder::binary();
        $installed = $binary !== null;
        $caddyfile = ServerManagerV1FrankenPhpCaddyfileBuilder::caddyfilePath();
        $caddyfileExists = FileSystemManager::isFile($caddyfile);
        $pgrepResult = ServerManagerV1Utils::executeCommand('pgrep', ['-f', 'artisan octane:frankenphp']);
        $running = trim((string) ($pgrepResult['output'] ?? '')) !== '';

        return $this->success([
            'plane' => WebServerPlane::current(),
            'plane_default' => ServiceContract::string('planes.web_server_default'),
            'installed' => $installed,
            'binary' => $binary,
            'version' => $installed ? ServerManagerV1FrankenPhpCaddyfileBuilder::version() : null,
            'embedded_php' => $installed ? ServerManagerV1FrankenPhpCaddyfileBuilder::embeddedPhpVersion() : null,
            'dnspod_module' => $installed ? ServerManagerV1FrankenPhpCaddyfileBuilder::hasDnsPodModule() : false,
            'dns01' => [
                'module' => $installed ? ServerManagerV1FrankenPhpCaddyfileBuilder::hasDnsPodModule() : false,
                'token_configured' => ServerManagerV1FrankenPhpCaddyfileBuilder::dnspodTokenConfigured(),
                'ready' => $installed
                    && ServerManagerV1FrankenPhpCaddyfileBuilder::hasDnsPodModule()
                    && ServerManagerV1FrankenPhpCaddyfileBuilder::dnspodTokenConfigured(),
            ],
            'running' => $running,
            'caddyfile' => [
                'path' => $caddyfile,
                'exists' => $caddyfileExists,
                'canonical' => $caddyfileExists && $this->caddyfileIsCanonical(),
            ],
            'mercure' => [
                'publisher_key_provisioned' => RuntimeConfigurationStore::get(\App\Services\Relay\RelayHubJwt::PUBLISHER_KEY) !== null,
                'subscriber_key_provisioned' => RuntimeConfigurationStore::get(\App\Services\Relay\RelayHubJwt::SUBSCRIBER_KEY) !== null,
                'trusted_issuers_provisioned' => RuntimeConfigurationStore::get('MERCURE_TRUSTED_ISSUERS') !== null,
                'hub_path' => '/.well-known/mercure',
            ],
            'install_hint' => $installed ? null : self::FRANKENPHP_INSTALL_HINT,
        ], 'FrankenPHP plane status retrieved successfully');
    }

    /**
     * Idempotently render the canonical Caddyfile (content-hash compare;
     * the returned content carries redacted Mercure key values). Returns
     * the effective content.
     */
    public function ensureCaddyfile(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'frankenphp_ensure_caddyfile');
        if ($validation) {
            return $validation;
        }

        if (ServerManagerV1FrankenPhpCaddyfileBuilder::binary() === null) {
            return $this->error(self::FRANKENPHP_INSTALL_HINT, ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
        }

        $report = ServerManagerV1FrankenPhpCaddyfileBuilder::ensure();
        if (($report['error'] ?? '') !== '') {
            return $this->error(
                'Caddyfile ensure failed: ' . $report['error'],
                ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
            );
        }

        Log::info('ServerManagerV1: FrankenPHP Caddyfile ensured', [
            'path' => $report['path'],
            'rendered' => $report['rendered'],
            'ip' => $request->ip(),
        ]);

        return $this->success([
            'path' => $report['path'],
            'rendered' => $report['rendered'],
            'canonical' => $report['canonical'],
            'content' => $this->readCaddyfile(),
        ], $report['rendered']
            ? 'Caddyfile rendered (canonical)'
            : 'Caddyfile already canonical');
    }

    /**
     * Return the effective Caddyfile content (read-only view for the UI).
     */
    public function caddyfile(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'frankenphp_caddyfile');
        if ($validation) {
            return $validation;
        }

        $path = ServerManagerV1FrankenPhpCaddyfileBuilder::caddyfilePath();
        if (!FileSystemManager::isFile($path)) {
            return $this->error(
                "Caddyfile not found at {$path}; call ensure first",
                ServerManagerV1Constants::RESPONSE_NOT_FOUND
            );
        }

        return $this->success([
            'path' => $path,
            'canonical' => $this->caddyfileIsCanonical(),
            'content' => $this->readCaddyfile(),
        ], 'Caddyfile retrieved');
    }

    /**
     * Validate the Caddyfile (`frankenphp validate --config ...`).
     */
    public function testConfig(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'frankenphp_test_config');
        if ($validation) {
            return $validation;
        }

        if (ServerManagerV1FrankenPhpCaddyfileBuilder::binary() === null) {
            return $this->error(self::FRANKENPHP_INSTALL_HINT, ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
        }

        $result = ServerManagerV1FrankenPhpCaddyfileBuilder::validate();

        return $this->success([
            'valid' => $result['success'],
            'output' => $result['output'],
        ], $result['success'] ? 'Caddyfile is valid' : 'Caddyfile validation failed');
    }

    /**
     * Adopt a web-server plane (record-only plane switch). Runtime adoption
     * (counterpart service disable, config provisioning, restart) stays with
     * the shell installers: 33 (nginx plane) and 93 (frankenphp plane).
     */
    public function adoptPlane(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'frankenphp_adopt_plane');
        if ($validation) {
            return $validation;
        }

        $plane = (string) $request->input('plane', '');
        if (!in_array($plane, WebServerPlane::PLANES, true)) {
            return $this->error(
                'Invalid plane. Allowed values: ' . implode(', ', WebServerPlane::PLANES),
                ServerManagerV1Constants::RESPONSE_BAD_REQUEST
            );
        }

        if (!WebServerPlane::adopt($plane)) {
            return $this->error(
                'Unable to write the WEB_SERVER_PLANE record',
                ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
            );
        }

        Log::info('ServerManagerV1: web-server plane adopted', [
            'plane' => $plane,
            'ip' => $request->ip(),
        ]);

        return $this->success([
            'plane' => WebServerPlane::current(),
            'runtime_hint' => $plane === WebServerPlane::NGINX
                ? 'Record adopted. Run 33_install_nginx.sh to provision + disable the frankenphp runtime.'
                : 'Record adopted. Run 93_install_frankenphp.sh to provision the frankenphp plane.',
        ], "Web-server plane record set to '{$plane}'");
    }

    /**
     * Store the DNSPod API token (format "id,token") in the shared
     * RuntimeConfigurationStore and re-render the canonical Caddyfile so
     * the DNS-01 tls stanza engages in the same change. The token value is
     * write-only: it is never echoed back - the status surface exposes
     * booleans only.
     */
    public function storeDnsPodToken(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'frankenphp_store_dnspod_token');
        if ($validation) {
            return $validation;
        }

        $token = trim((string) $request->input('token', ''));
        if ($token === '') {
            return $this->error(
                'token value required (format: id,token)',
                ServerManagerV1Constants::RESPONSE_BAD_REQUEST
            );
        }
        if (ServerManagerV1FrankenPhpCaddyfileBuilder::binary() === null) {
            return $this->error(self::FRANKENPHP_INSTALL_HINT, ServerManagerV1Constants::RESPONSE_BAD_REQUEST);
        }

        $report = ServerManagerV1FrankenPhpCaddyfileBuilder::storeDnsPodToken($token);
        if (($report['stored'] ?? false) !== true) {
            return $this->error(
                'DNSPod token store failed: ' . ($report['error'] ?? 'unknown'),
                ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
            );
        }

        Log::info('ServerManagerV1: DNSPod token stored, Caddyfile re-rendered', [
            'caddyfile' => $report['path'] ?? null,
            'rendered' => $report['rendered'] ?? false,
        ]);

        return $this->success([
            'stored' => true,
            'dns01' => [
                'module' => ServerManagerV1FrankenPhpCaddyfileBuilder::hasDnsPodModule(),
                'token_configured' => true,
                'ready' => ServerManagerV1FrankenPhpCaddyfileBuilder::hasDnsPodModule(),
            ],
            'caddyfile' => $report,
        ], 'DNSPod token stored; the frankenphp plane picks it up on the next restart');
    }

    private function caddyfileIsCanonical(): bool
    {
        $path = ServerManagerV1FrankenPhpCaddyfileBuilder::caddyfilePath();
        $content = FileSystemManager::readFile($path, false);
        if (!is_string($content)) {
            return false;
        }

        return rtrim($content)
            === rtrim(ServerManagerV1FrankenPhpCaddyfileBuilder::render());
    }

    /**
     * Read the Caddyfile content (null-safe). The literal Mercure JWT key
     * values are redacted: they never leave the 0600 file and the private
     * store.
     */
    private function readCaddyfile(): ?string
    {
        $path = ServerManagerV1FrankenPhpCaddyfileBuilder::caddyfilePath();
        $content = FileSystemManager::readFile($path, false);
        if (!is_string($content)) {
            return null;
        }

        return preg_replace(
            '/^(\s*(?:publisher|subscriber)_jwt\s+)\S+(\s+HS256\s*)$/m',
            '$1<redacted>$2',
            $content
        );
    }
}
