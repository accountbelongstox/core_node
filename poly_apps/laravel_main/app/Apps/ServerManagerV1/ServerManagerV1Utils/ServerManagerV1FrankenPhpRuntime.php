<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Support\ServiceContract;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Http;

class ServerManagerV1FrankenPhpRuntime
{
    private const SERVICE_NAME = 'ncore-laravel-frankenphp.service';
    private const SERVICE_ACTIONS = ['start', 'stop', 'restart'];

    public static function status(): array
    {
        $activeState = self::serviceProperty('ActiveState');
        $subState = self::serviceProperty('SubState');
        $mainPid = self::serviceProperty('MainPID');

        return [
            'service' => self::SERVICE_NAME,
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
                'error' => 'Unsupported FrankenPHP service action.',
            ];
        }

        $commandResult = ServerManagerV1Utils::executeCommand(
            'systemctl',
            [$action, self::SERVICE_NAME],
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
                : trim((string) ($commandResult['error'] ?? 'FrankenPHP service postcondition was not reached.')),
        ];
    }

    public static function reload(bool $force = false): array
    {
        $validation = [];
        $content = false;
        $headers = [];
        $response = null;
        $probe = null;
        $url = self::adminUrl('/load');

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
            $response = Http::timeout(15)
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
            ['show', self::SERVICE_NAME, '--property', $property, '--value'],
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
}
