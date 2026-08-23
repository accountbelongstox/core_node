<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Providers\PathMapper;
use App\Support\ServiceContract;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Http;

class ServerManagerV1FrankenPhpRuntime
{
    private const ADMIN_LOAD_TIMEOUT_SECONDS = 120;
    private const SERVICE_NAME_LINUX = 'ncore-laravel-frankenphp.service';
    private const SERVICE_NAME_WINDOWS = 'ncore-laravel-frankenphp';
    private const SERVICE_ACTIONS = ['start', 'stop', 'restart'];

    public static function status(): array
    {
        if (PathMapper::isWindows()) {
            return self::windowsStatus();
        }

        $activeState = self::serviceProperty('ActiveState');
        $subState = self::serviceProperty('SubState');
        $mainPid = self::serviceProperty('MainPID');

        return [
            'service' => self::serviceName(),
            'active_state' => $activeState,
            'sub_state' => $subState,
            'main_pid' => ctype_digit($mainPid) ? (int) $mainPid : 0,
            'running' => $activeState === 'active' && $subState === 'running',
        ];
    }

    public static function control(string $action): array
    {
        $commandResult = [];
        $runtimeStatus = [];
        $expectedState = '';
        $matchesPostcondition = false;

        if ($action === 'reload') {
            return self::reload(true);
        }
        if (!in_array($action, self::SERVICE_ACTIONS, true)) {
            return [
                'success' => false,
                'action' => $action,
                'error' => __('runtime.frankenphp_service_action_unsupported'),
            ];
        }

        $commandResult = PathMapper::isWindows()
            ? self::windowsServiceAction($action)
            : ServerManagerV1Utils::executeCommand(
                'systemctl',
                [$action, self::serviceName()],
                30
            );
        $expectedState = $action === 'stop' ? 'inactive' : 'active';

        for ($attempt = 0; $attempt < 20; $attempt++) {
            $runtimeStatus = self::status();
            if (($runtimeStatus['active_state'] ?? '') === $expectedState) {
                break;
            }
            usleep(250000);
        }

        $matchesPostcondition = ($runtimeStatus['active_state'] ?? '') === $expectedState;

        return [
            'success' => $matchesPostcondition,
            'action' => $action,
            'status' => $runtimeStatus,
            'output' => trim((string) ($commandResult['output'] ?? '')),
            'error' => $matchesPostcondition
                ? ''
                : trim((string) ($commandResult['error'] ?? __('runtime.frankenphp_service_postcondition_failed'))),
        ];
    }

    public static function reload(bool $force = false): array
    {
        $ensure = [];
        $validation = [];
        $content = false;
        $headers = [];
        $response = null;
        $probe = null;
        $url = self::adminUrl('/load');

        $ensure = ServerManagerV1FrankenPhpCaddyfileBuilder::ensure();
        if (($ensure['canonical'] ?? false) !== true) {
            return [
                'success' => false,
                'action' => 'reload',
                'valid' => false,
                'error' => (string) ($ensure['error'] ?? 'Unable to render the canonical Caddyfile.'),
            ];
        }
        $validation = ServerManagerV1FrankenPhpCaddyfileBuilder::validate();
        if (($validation['success'] ?? false) !== true) {
            return [
                'success' => false,
                'action' => 'reload',
                'valid' => false,
                'error' => (string) ($validation['output'] ?? 'Caddyfile validation failed.'),
            ];
        }

        $content = FileSystemManager::readFile(
            ServerManagerV1FrankenPhpCaddyfileBuilder::caddyfilePath(),
            false
        );
        if (!is_string($content)) {
            return [
                'success' => false,
                'action' => 'reload',
                'valid' => true,
                'error' => 'Unable to read the canonical Caddyfile.',
            ];
        }

        $headers = $force ? ['Cache-Control' => 'must-revalidate'] : [];

        try {
            $response = Http::connectTimeout(5)
                ->timeout(self::ADMIN_LOAD_TIMEOUT_SECONDS)
                ->withHeaders($headers)
                ->withBody($content, 'text/caddyfile')
                ->post($url);
            if (!$response->successful()) {
                return [
                    'success' => false,
                    'action' => 'reload',
                    'valid' => true,
                    'http_status' => $response->status(),
                    'error' => trim($response->body()),
                ];
            }

            $probe = Http::timeout(5)->get(self::adminUrl('/config/apps/http/'));
        } catch (\Throwable $exception) {
            return [
                'success' => false,
                'action' => 'reload',
                'valid' => true,
                'error' => $exception->getMessage(),
            ];
        }

        return [
            'success' => $probe->successful(),
            'action' => 'reload',
            'valid' => true,
            'http_status' => $response->status(),
            'admin_ready' => $probe->successful(),
            'error' => $probe->successful() ? '' : 'Caddy admin postcondition probe failed.',
        ];
    }

    private static function serviceProperty(string $property): string
    {
        $result = ServerManagerV1Utils::executeCommand(
            'systemctl',
            ['show', self::serviceName(), '--property', $property, '--value'],
            10
        );

        return trim((string) ($result['output'] ?? ''));
    }

    private static function adminUrl(string $path): string
    {
        $host = ServiceContract::host('loopback');
        $port = ServiceContract::port('frankenphp_admin');

        return "http://{$host}:{$port}{$path}";
    }

    private static function serviceName(): string
    {
        return PathMapper::isWindows() ? self::SERVICE_NAME_WINDOWS : self::SERVICE_NAME_LINUX;
    }

    private static function windowsStatus(): array
    {
        $serviceName = self::serviceName();
        $quotedServiceName = json_encode($serviceName, JSON_UNESCAPED_SLASHES);
        $script = '$service = Get-CimInstance Win32_Service | Where-Object { $_.Name -eq '
            .$quotedServiceName
            .' } | Select-Object -First 1; '
            .'if ($null -eq $service) { ''{}'' } else { $service | Select-Object State, ProcessId | ConvertTo-Json -Compress }';
        $result = ServerManagerV1Utils::executeCommand(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', $script],
            15
        );
        $document = json_decode(trim((string) ($result['output'] ?? '')), true);
        $state = is_array($document) ? strtolower((string) ($document['State'] ?? '')) : 'not-found';
        $pid = is_array($document) ? (int) ($document['ProcessId'] ?? 0) : 0;

        return [
            'service' => $serviceName,
            'active_state' => $state === 'running' ? 'active' : 'inactive',
            'sub_state' => $state,
            'main_pid' => $pid,
            'running' => $state === 'running',
        ];
    }

    private static function windowsServiceAction(string $action): array
    {
        $verb = match ($action) {
            'start' => 'Start-Service',
            'stop' => 'Stop-Service',
            'restart' => 'Restart-Service',
            default => '',
        };
        $force = $action === 'start' ? '' : ' -Force';
        $script = $verb.' -Name '.json_encode(self::serviceName(), JSON_UNESCAPED_SLASHES).$force;

        return ServerManagerV1Utils::executeCommand(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', $script],
            30
        );
    }
}
