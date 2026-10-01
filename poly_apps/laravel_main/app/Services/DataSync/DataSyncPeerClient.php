<?php

namespace App\Services\DataSync;

use App\Services\ClientKey\ClientKeyAuthService;
use App\Support\LaravelServerIdentity;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Psr\Http\Message\RequestInterface;

final class DataSyncPeerClient
{
    private const SIGNING_CLIENT = ClientKeyAuthService::CLIENT_LARAVEL_PEER;
    private const JSON_CONTENT_TYPE = 'application/json';

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
            throw new \InvalidArgumentException(__('data_sync.peer_address_invalid'));
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? 'http'));
        $host = trim((string) ($parts['host'] ?? ''), '[]');
        // Bare hosts address the Laravel Main port directly; an explicit
        // scheme without a port means that scheme's standard port (a
        // reverse-proxied domain such as https://api.example.com).
        $port = (int) ($parts['port'] ?? ($explicitScheme
            ? ($scheme === 'https' ? 443 : 80)
            : DataSyncProtocol::defaultPort()));
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
            throw new \InvalidArgumentException(__('data_sync.peer_address_invalid'));
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
            return ['reachable' => false, 'error' => __('data_sync.peer_http_status', ['status' => $response->status()])];
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

        $requestPath = DataSyncProtocol::API_PREFIX . $path;
        $rawQuery = $method === 'GET' ? http_build_query($payload, '', '&', PHP_QUERY_RFC3986) : '';
        $body = $method === 'GET' ? '' : json_encode($payload, JSON_THROW_ON_ERROR);
        $url = rtrim((string) ($session['target'] ?? ''), '/') . $requestPath . ($rawQuery !== '' ? '?' . $rawQuery : '');
        $request = Http::acceptJson()
            ->connectTimeout(DataSyncProtocol::CONNECT_TIMEOUT_SECONDS)
            ->timeout(DataSyncProtocol::REQUEST_TIMEOUT_SECONDS)
            ->retry([250, 500], throw: false)
            ->beforeSending(static function (ClientRequest $attempt) use ($method, $requestPath, $rawQuery, $body): RequestInterface {
                $psrRequest = $attempt->toPsrRequest();
                foreach (ClientKeyAuthService::signedHeaders(
                    self::SIGNING_CLIENT,
                    LaravelServerIdentity::id(),
                    $method,
                    $requestPath,
                    $rawQuery,
                    $body,
                    $method === 'GET' ? '' : self::JSON_CONTENT_TYPE
                ) as $name => $value) {
                    $psrRequest = $psrRequest->withHeader($name, $value);
                }

                return $psrRequest;
            });

        if ($authenticated) {
            $request = $request->withHeaders([
                DataSyncProtocol::TOKEN_HEADER => (string) ($session['context']['peer_token'] ?? ''),
            ]);
        }

        try {
            $response = $method === 'GET'
                ? $request->get($url)
                : $request->withBody($body, self::JSON_CONTENT_TYPE)->send($method, $url);
        } catch (ConnectionException $exception) {
            return ['__waiting' => $exception->getMessage()];
        }

        if (in_array($response->status(), DataSyncProtocol::TRANSIENT_HTTP_STATUSES, true)) {
            return ['__waiting' => __('data_sync.peer_http_retrying', ['status' => $response->status()])];
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
                    throw new \RuntimeException((string) ($receiver['error'] ?? __('data_sync.receiver_failed')));
                }
            }

            throw new \RuntimeException(
                (string) ($response->json('message') ?? __('data_sync.peer_http_status', ['status' => $response->status()]))
            );
        }

        if (!$response->successful()) {
            throw new \RuntimeException((string) ($response->json('message') ?? __('data_sync.peer_http_status', ['status' => $response->status()])));
        }

        return (array) ($response->json('data') ?? $response->json());
    }
}
