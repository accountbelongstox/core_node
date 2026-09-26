<?php

namespace App\Services\DataSync;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

final class DataSyncPeerClient
{
    public function normalizeAddress(string $input): string
    {
        $trimmedInput = trim($input);
        $explicitScheme = preg_match('#^[a-z][a-z0-9+.-]*://#i', $trimmedInput) === 1;
        $rawIpv6 = !str_contains($trimmedInput, '://')
            && filter_var($trimmedInput, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false;
        $candidate = $rawIpv6
            ? 'http://[' . $trimmedInput . ']'
            : (str_contains($trimmedInput, '://') ? $trimmedInput : 'http://' . $trimmedInput);
        $parts = parse_url($candidate);

        if (!is_array($parts)) {
            throw new \InvalidArgumentException('The peer address is not a valid IP address or host with an optional port.');
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? 'http'));
        $host = trim((string) ($parts['host'] ?? ''), '[]');
        // Bare hosts address the Laravel Main port directly; an explicit
        // scheme without a port means that scheme's standard port (a
        // reverse-proxied domain such as https://api.example.com).
        $port = (int) ($parts['port'] ?? ($explicitScheme
            ? ($scheme === 'https' ? 443 : 80)
            : DataSyncProtocol::DEFAULT_PORT));
        $path = (string) ($parts['path'] ?? '');

        if (
            !in_array($scheme, ['http', 'https'], true)
            || $host === ''
            || $port < 1
            || $port > 65535
            || !in_array($path, ['', '/'], true)
            || isset($parts['user'])
            || isset($parts['pass'])
            || isset($parts['query'])
            || isset($parts['fragment'])
        ) {
            throw new \InvalidArgumentException('The peer address is not a valid IP address or host with an optional port.');
        }

        $normalizedHost = strtolower($host);
        $displayHost = str_contains($normalizedHost, ':') ? "[{$normalizedHost}]" : $normalizedHost;

        return "{$scheme}://{$displayHost}:{$port}";
    }

    public function status(array $session): array
    {
        return $this->call($session, 'GET', $this->sessionBasePath($session));
    }

    /**
     * Unauthenticated reachability probe against a peer's open health route.
     * Used by the dashboard probe endpoint to decide the transfer direction.
     */
    public function healthProbe(string $normalizedTarget): array
    {
        $url = rtrim($normalizedTarget, '/') . DataSyncProtocol::API_PREFIX . '/health';

        try {
            $response = Http::acceptJson()
                ->connectTimeout(DataSyncProtocol::CONNECT_TIMEOUT_SECONDS)
                ->timeout(20)
                ->get($url);
        } catch (ConnectionException $exception) {
            return ['reachable' => false, 'error' => $exception->getMessage()];
        }

        if (!$response->successful()) {
            return ['reachable' => false, 'error' => "Peer HTTP {$response->status()}"];
        }

        return [
            'reachable' => true,
            'health' => (array) ($response->json('data') ?? $response->json()),
        ];
    }

    private function sessionBasePath(array $session): string
    {
        $basePath = (string) ($session['context']['peer_base_path'] ?? '');

        return $basePath !== ''
            ? $basePath
            : '/sessions/' . rawurlencode((string) ($session['context']['peer_session_id'] ?? ''));
    }

    public function call(
        array $session,
        string $method,
        string $path,
        array $payload = [],
        bool $authenticated = true
    ): array {
        return $this->send($session, $method, $path, $payload, $authenticated, true);
    }

    private function send(
        array $session,
        string $method,
        string $path,
        array $payload,
        bool $authenticated,
        bool $inspectReceiverFailure
    ): array {
        $basePath = $this->sessionBasePath($session);
        if ($authenticated && !str_starts_with($path, $basePath)) {
            $path = $basePath . $path;
        }

        $url = rtrim((string) ($session['target'] ?? ''), '/') . DataSyncProtocol::API_PREFIX . $path;
        $request = Http::acceptJson()
            ->connectTimeout(DataSyncProtocol::CONNECT_TIMEOUT_SECONDS)
            ->timeout(DataSyncProtocol::REQUEST_TIMEOUT_SECONDS)
            ->retry([250, 500], throw: false);

        if ($authenticated) {
            $request = $request->withHeaders([
                DataSyncProtocol::TOKEN_HEADER => (string) ($session['context']['peer_token'] ?? ''),
            ]);
        }

        try {
            $response = $method === 'GET'
                ? $request->get($url, $payload)
                : $request->send($method, $url, ['json' => $payload]);
        } catch (ConnectionException $exception) {
            return ['__waiting' => $exception->getMessage()];
        }

        if (in_array($response->status(), DataSyncProtocol::TRANSIENT_HTTP_STATUSES, true)) {
            return ['__waiting' => "Peer HTTP {$response->status()}; retrying idempotently."];
        }

        if ($response->serverError()) {
            $isStatusRequest = $path === $basePath;
            if ($authenticated && !$isStatusRequest && $inspectReceiverFailure) {
                $receiver = $this->send(
                    $session,
                    'GET',
                    $basePath,
                    [],
                    true,
                    false
                );
                if (!isset($receiver['__waiting']) && ($receiver['status'] ?? null) === 'failed') {
                    throw new \RuntimeException((string) ($receiver['error'] ?? 'Receiver synchronization failed.'));
                }
            }

            throw new \RuntimeException(
                (string) ($response->json('message') ?? "Peer HTTP {$response->status()}")
            );
        }

        if (!$response->successful()) {
            throw new \RuntimeException((string) ($response->json('message') ?? "Peer HTTP {$response->status()}"));
        }

        return (array) ($response->json('data') ?? $response->json());
    }
}
