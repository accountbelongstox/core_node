<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Providers\PathMapper;
use App\Support\ServiceContract;
use App\Utils\FileSystemManager;

class ServerManagerV1AcmeShCertificateManager
{
    private const TIMER_UNIT = 'ncore-acme-cert.timer';
    private const HOME_ARGUMENTS = ['--home', 'home', '--config-home', 'home/.acme.sh'];

    public static function status(): array
    {
        $binary = self::binary();
        $version = null;
        $timerActive = self::systemdProperty(self::TIMER_UNIT, 'ActiveState');
        $timerEnabled = self::systemdEnabled(self::TIMER_UNIT);
        $versionResult = [];

        if ($binary !== null) {
            $versionResult = ServerManagerV1Utils::executeCommand($binary, ['--version'], 15);
            if (preg_match('/v?\d{8}|v?\d+\.\d+\.\d+/', (string) ($versionResult['output'] ?? ''), $matches)) {
                $version = $matches[0];
            }
        }

        return [
            'manager' => 'acme.sh',
            'installed' => $binary !== null,
            'path' => $binary,
            'version' => $version,
            'timer' => [
                'unit' => self::TIMER_UNIT,
                'active' => $timerActive === 'active',
                'enabled' => $timerEnabled === 'enabled',
            ],
            'certificate_directory' => self::certificateRoot(),
        ];
    }

    public static function install(): array
    {
        $script = self::installerScript();
        $commandResult = ServerManagerV1Utils::executeCommand(
            'bash',
            ['-c', 'source "$1"; acme_sh_ensure_install; acme_sh_service_ensure', 'ncore-acme-install', $script],
            600
        );
        $status = self::status();

        return [
            'success' => ($status['installed'] ?? false) === true
                && (($status['timer']['active'] ?? false) === true),
            'status' => $status,
            'output' => trim((string) ($commandResult['output'] ?? '')),
            'error' => ($status['installed'] ?? false) === true
                ? ''
                : trim((string) ($commandResult['error'] ?? 'acme.sh installation postcondition failed.')),
        ];
    }

    public static function list(): array
    {
        $root = self::certificateRoot();
        $entries = FileSystemManager::scandir($root);
        $certificates = [];

        if (!is_array($entries)) {
            return [];
        }

        sort($entries, SORT_NATURAL | SORT_FLAG_CASE);
        foreach ($entries as $entry) {
            $certificate = null;

            if (!self::validDomain($entry)) {
                continue;
            }
            $certificate = self::certificate($entry);
            if ($certificate !== null) {
                $certificates[] = $certificate;
            }
        }

        return $certificates;
    }

    public static function certificate(string $domain): ?array
    {
        $normalizedDomain = strtolower(trim($domain));
        $directory = '';
        $certificatePath = '';
        $keyPath = '';
        $result = [];
        $output = '';
        $notBefore = null;
        $notAfter = null;
        $expiryTimestamp = false;
        $daysUntilExpiry = 0;
        $domains = [];
        $issuer = null;

        if (!self::validDomain($normalizedDomain)) {
            return null;
        }
        $directory = ServerManagerV1FrankenPhpCaddyfileBuilder::acmeCertificateDirectory($normalizedDomain);
        $certificatePath = $directory.DIRECTORY_SEPARATOR.'fullchain.pem';
        $keyPath = $directory.DIRECTORY_SEPARATOR.'key.pem';
        if (!FileSystemManager::isFile($certificatePath) || !FileSystemManager::isFile($keyPath)) {
            return null;
        }

        $result = ServerManagerV1Utils::executeCommand('openssl', [
            'x509', '-in', $certificatePath, '-noout', '-issuer', '-startdate', '-enddate', '-ext', 'subjectAltName',
        ], 15);
        $output = (string) ($result['output'] ?? '');
        if (preg_match('/^notBefore=(.+)$/mi', $output, $matches)) {
            $notBefore = trim($matches[1]);
        }
        if (preg_match('/^notAfter=(.+)$/mi', $output, $matches)) {
            $notAfter = trim($matches[1]);
        }
        if (preg_match('/^issuer=(.+)$/mi', $output, $matches)) {
            $issuer = trim($matches[1]);
        }
        if (preg_match_all('/DNS:([^,\s]+)/', $output, $matches)) {
            $domains = array_values(array_unique(array_map('strtolower', $matches[1])));
        }

        $expiryTimestamp = is_string($notAfter) ? strtotime($notAfter) : false;
        $daysUntilExpiry = is_int($expiryTimestamp)
            ? (int) floor(($expiryTimestamp - time()) / 86400)
            : 0;

        return [
            'name' => $normalizedDomain,
            'domain' => $normalizedDomain,
            'domains' => $domains,
            'issuer' => $issuer,
            'valid_from' => is_string($notBefore) && strtotime($notBefore) !== false
                ? date(DATE_ATOM, (int) strtotime($notBefore))
                : null,
            'expiry_date' => is_int($expiryTimestamp) ? date(DATE_ATOM, $expiryTimestamp) : null,
            'days_until_expiry' => $daysUntilExpiry,
            'status' => $daysUntilExpiry <= 0 ? 'critical' : ($daysUntilExpiry <= 30 ? 'warning' : 'ok'),
            'valid' => $daysUntilExpiry > 0 && $domains !== [],
            'certificate_path' => $certificatePath,
            'private_key_path' => $keyPath,
            'source' => 'acme.sh',
            'manager' => 'acme.sh',
        ];
    }

    public static function ensure(string $domain): array
    {
        $normalizedDomain = strtolower(trim($domain));
        $commandResult = [];
        $certificate = null;
        $reload = [];

        if (!self::validDomain($normalizedDomain)) {
            return self::failure('Invalid certificate domain.', 422);
        }

        $commandResult = ServerManagerV1Utils::executeCommand(
            'bash',
            [
                '-c',
                'source "$1"; acme_sh_ensure_install; acme_sh_ensure_certificate "$2" "$3"; acme_sh_service_ensure',
                'ncore-acme-ensure',
                self::installerScript(),
                $normalizedDomain,
                self::reloadCommand(),
            ],
            900
        );
        $certificate = self::certificate($normalizedDomain);
        if (($certificate['valid'] ?? false) !== true) {
            return self::failure(
                trim((string) ($commandResult['error'] ?? 'acme.sh certificate postcondition failed.')),
                500,
                trim((string) ($commandResult['output'] ?? ''))
            );
        }

        $reload = ServerManagerV1FrankenPhpReloadJob::queue(true);

        return [
            'success' => ($reload['success'] ?? false) === true,
            'certificate' => $certificate,
            'reloaded' => false,
            'reload_queued' => ($reload['success'] ?? false) === true,
            'reload_job_id' => $reload['job_id'] ?? null,
            'output' => trim((string) ($commandResult['output'] ?? '')),
            'error' => ($reload['success'] ?? false) === true
                ? ''
                : (string) ($reload['error'] ?? 'FrankenPHP certificate reload failed.'),
        ];
    }

    public static function renew(?string $domain = null): array
    {
        $binary = self::binary();
        $normalizedDomain = $domain !== null ? strtolower(trim($domain)) : null;
        $arguments = [];
        $commandResult = [];
        $certificates = [];
        $allValid = false;
        $reload = [];

        if ($binary === null) {
            return self::failure('acme.sh is not installed.', 404);
        }
        if ($normalizedDomain !== null && !self::validDomain($normalizedDomain)) {
            return self::failure('Invalid certificate domain.', 422);
        }

        $arguments = self::homeArguments();
        if ($normalizedDomain === null) {
            $arguments[] = '--cron';
        } else {
            array_push($arguments, '--renew', '-d', $normalizedDomain, '--ecc');
        }
        $commandResult = ServerManagerV1Utils::executeCommand($binary, $arguments, 900);

        $certificates = $normalizedDomain === null
            ? self::list()
            : array_values(array_filter([self::certificate($normalizedDomain)]));
        $allValid = $certificates !== [];
        foreach ($certificates as $certificate) {
            if (($certificate['valid'] ?? false) !== true) {
                $allValid = false;
                break;
            }
        }
        if (!$allValid) {
            return self::failure(
                trim((string) ($commandResult['error'] ?? 'acme.sh renewal postcondition failed.')),
                500,
                trim((string) ($commandResult['output'] ?? ''))
            );
        }

        $reload = ServerManagerV1FrankenPhpReloadJob::queue(true);

        return [
            'success' => ($reload['success'] ?? false) === true,
            'domain' => $normalizedDomain,
            'certificates' => $certificates,
            'renewed' => count($certificates),
            'reloaded' => false,
            'reload_queued' => ($reload['success'] ?? false) === true,
            'reload_job_id' => $reload['job_id'] ?? null,
            'output' => trim((string) ($commandResult['output'] ?? '')),
            'error' => ($reload['success'] ?? false) === true
                ? ''
                : (string) ($reload['error'] ?? 'FrankenPHP certificate reload failed.'),
        ];
    }

    private static function binary(): ?string
    {
        $candidates = [
            '/usr/local/bin/acme.sh',
            self::acmeRoot().DIRECTORY_SEPARATOR.'home'.DIRECTORY_SEPARATOR.'acme.sh',
        ];

        foreach ($candidates as $candidate) {
            if (is_executable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private static function homeArguments(): array
    {
        $root = self::acmeRoot();

        return [
            self::HOME_ARGUMENTS[0], $root.DIRECTORY_SEPARATOR.self::HOME_ARGUMENTS[1],
            self::HOME_ARGUMENTS[2], $root.DIRECTORY_SEPARATOR.self::HOME_ARGUMENTS[3],
        ];
    }

    private static function acmeRoot(): string
    {
        return ServiceContract::path('frankenphp_root_posix').DIRECTORY_SEPARATOR.'acme.sh';
    }

    private static function certificateRoot(): string
    {
        return ServiceContract::path('frankenphp_root_posix').DIRECTORY_SEPARATOR.'certs';
    }

    private static function installerScript(): string
    {
        return PathMapper::getCoreNodeDir()
            .DIRECTORY_SEPARATOR.'scripts'.DIRECTORY_SEPARATOR.'shells'.DIRECTORY_SEPARATOR.'linux'
            .DIRECTORY_SEPARATOR.'common'.DIRECTORY_SEPARATOR.'frankenphp_acme_sh_install.sh';
    }

    private static function reloadCommand(): string
    {
        $caddyfile = escapeshellarg(ServerManagerV1FrankenPhpCaddyfileBuilder::caddyfilePath());
        $host = ServiceContract::host('loopback');
        $port = ServiceContract::port('frankenphp_admin');

        return "/usr/bin/curl --silent --show-error --fail-with-body --max-time 15 --request POST --header 'Content-Type: text/caddyfile' --data-binary @{$caddyfile} http://{$host}:{$port}/load";
    }

    private static function validDomain(string $domain): bool
    {
        return $domain !== ''
            && filter_var($domain, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) !== false;
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

    private static function systemdEnabled(string $unit): string
    {
        $result = ServerManagerV1Utils::executeCommand('systemctl', ['is-enabled', $unit], 10);

        return trim((string) ($result['output'] ?? ''));
    }

    private static function failure(string $message, int $status = 500, string $output = ''): array
    {
        return ['success' => false, 'error' => $message, 'status' => $status, 'output' => $output];
    }
}
