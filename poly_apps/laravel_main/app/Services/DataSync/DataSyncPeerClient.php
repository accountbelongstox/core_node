<?php

namespace App\Services\DataSync;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

final class DataSyncPeerClient
{
    public function normalizeAddress(string $input): string
    {
        $trimmedInput = trim($input);
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
        $port = (int) ($parts['port'] ?? DataSyncProtocol::DEFAULT_PORT);
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
        $peerSessionId = rawurlencode((string) ($session['context']['peer_session_id'] ?? ''));

        return $this->call($session, 'GET', "/sessions/{$peerSessionId}");
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
        if ($authenticated && !str_starts_with($path, '/sessions/')) {
            $peerSessionId = rawurlencode((string) ($session['context']['peer_session_id'] ?? ''));
            $path = "/sessions/{$peerSessionId}{$path}";
        }

        $url = rtrim((string) ($session['target'] ?? ''), '/') . DataSyncProtocol::API_PREFIX . $path;
        $request = Http::acceptJson()
            ->connectTimeout(5)
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
            $isStatusRequest = preg_match('#^/sessions/[^/]+$#', $path) === 1;
            if ($authenticated && !$isStatusRequest && $inspectReceiverFailure) {
                $receiver = $this->send(
                    $session,
                    'GET',
                    '/sessions/' . rawurlencode((string) ($session['context']['peer_session_id'] ?? '')),
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
