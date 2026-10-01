<?php

namespace App\CallPycoreUtils;

use App\Providers\PathMapper;
use App\Services\ClientKey\ClientKeyAuthService;
use App\Support\HttpTransfer;
use App\Support\LaravelServerIdentity;
use App\Support\PycoreRpcContract;
use App\Support\RuntimeConfigurationStore;
use App\Support\ServiceContract;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Psr\Http\Message\RequestInterface;

/**
 * The one Laravel -> pycore RPC client.
 *
 * - Routes and methods come from config/pycore_rpc_contract.json by route key.
 * - The endpoint is resolved once per cache window: the PYCORE_BASE_URL runtime
 *   override, else the loopback port, else (WSL) the Windows host, each probed
 *   with the protocol `status` route.
 * - pycore's K7 gate admits loopback callers unsigned and requires a K3
 *   client-key signature from every other peer, so non-loopback requests are signed.
 * - Every request is progress-driven (HttpTransfer): no total deadline.
 * - A 2xx answer is returned raw, exactly as pycore sent it (204 = []); any
 *   other outcome raises PycoreRpcException.
 */
final class PycoreHttpClient
{
    private const SIGNING_CLIENT = ClientKeyAuthService::CLIENT_LARAVEL_PEER;
    private const JSON_CONTENT_TYPE = 'application/json';
    private const JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR;
    private const BASE_URL_OVERRIDE_KEY = 'PYCORE_BASE_URL';
    private const STATUS_ROUTE = 'status';
    private const ENDPOINT_CACHE_KEY = 'pycore_rpc_endpoint';
    private const ENDPOINT_CACHE_SECONDS = 30;
    private const UNREACHABLE_MARKER = '';
    private const PROBE_TIMEOUT_SECONDS = 2;
    private const RESOLV_CONF = '/etc/resolv.conf';
    private const HTTP_NO_CONTENT = 204;

    /**
     * Call one contract route; returns pycore's payload raw.
     *
     * @throws PycoreRpcException
     */
    public static function call(string $routeKey, array $params = []): array
    {
        $route = PycoreRpcContract::route($routeKey);
        $baseUrl = self::baseUrl();
        $response = null;

        if ($baseUrl === null) {
            throw new PycoreRpcException(
                PycoreRpcException::UNREACHABLE,
                __('pycore.unreachable', ['candidates' => implode(', ', self::candidateBaseUrls())])
            );
        }
        try {
            $response = self::send($baseUrl, $route['method'], $route['path'], $params);
        } catch (ConnectionException|TransferException $e) {
            Cache::forget(self::ENDPOINT_CACHE_KEY);
            Log::warning('[PycoreHttpClient] transport failure', ['route' => $routeKey, 'base_url' => $baseUrl, 'error' => $e->getMessage()]);
            throw new PycoreRpcException(
                PycoreRpcException::TRANSPORT_FAILED,
                __('pycore.transport_failed', ['route' => $route['path'], 'reason' => $e->getMessage()])
            );
        }

        return self::decode($routeKey, $route['path'], $response);
    }

    /**
     * Resolved pycore base URL, or null while every candidate is unreachable
     * (both outcomes are cached for ENDPOINT_CACHE_SECONDS).
     */
    public static function baseUrl(): ?string
    {
        $cached = Cache::get(self::ENDPOINT_CACHE_KEY);

        if (is_string($cached)) {
            return $cached === self::UNREACHABLE_MARKER ? null : $cached;
        }

        return self::refresh();
    }

    /** Re-probe every candidate now and cache the outcome. */
    public static function refresh(): ?string
    {
        $resolved = null;

        foreach (self::candidateBaseUrls() as $candidate) {
            if (self::probe($candidate) !== null) {
                $resolved = $candidate;
                break;
            }
        }
        Cache::put(self::ENDPOINT_CACHE_KEY, $resolved ?? self::UNREACHABLE_MARKER, self::ENDPOINT_CACHE_SECONDS);

        return $resolved;
    }

    /**
     * Candidate base URLs, most specific first.
     *
     * @return string[]
     */
    public static function candidateBaseUrls(): array
    {
        $configured = trim((string) RuntimeConfigurationStore::get(self::BASE_URL_OVERRIDE_KEY, ''));
        $candidates = [];
        $windowsHost = null;

        if ($configured !== '') {
            return [rtrim($configured, '/')];
        }
        $candidates[] = ServiceContract::pycoreBackendUrl();
        $windowsHost = PathMapper::isWSL() ? self::wslWindowsHost() : null;
        if ($windowsHost !== null) {
            $candidates[] = ServiceContract::pycoreBackendUrl($windowsHost);
        }

        return $candidates;
    }

    /** pycore's protocol status from one base URL; null when it does not answer. */
    public static function probe(string $baseUrl): ?array
    {
        $route = PycoreRpcContract::protocolRoute(self::STATUS_ROUTE);
        $response = null;
        $payload = null;

        try {
            $response = self::send($baseUrl, $route['method'], $route['path'], [], self::PROBE_TIMEOUT_SECONDS);
        } catch (ConnectionException|TransferException) {
            return null;
        }
        $payload = $response->successful() ? $response->json() : null;

        return is_array($payload) && ($payload['is_http_service'] ?? false) === true ? $payload : null;
    }

    public static function diagnostics(): array
    {
        $cached = Cache::get(self::ENDPOINT_CACHE_KEY);
        $candidates = [];

        foreach (self::candidateBaseUrls() as $candidate) {
            $candidates[] = [
                'url' => $candidate,
                'signed' => !self::isLoopback($candidate),
                'status' => self::probe($candidate),
            ];
        }

        return [
            'is_wsl' => PathMapper::isWSL(),
            'cached_base_url' => is_string($cached) && $cached !== self::UNREACHABLE_MARKER ? $cached : null,
            'cache_seconds' => self::ENDPOINT_CACHE_SECONDS,
            'candidates' => $candidates,
        ];
    }

    private static function send(string $baseUrl, string $method, string $path, array $params, ?int $timeout = null): Response
    {
        $rawQuery = $method === 'GET' ? http_build_query($params, '', '&', PHP_QUERY_RFC3986) : '';
        $body = $method === 'GET' ? '' : json_encode($params === [] ? new \stdClass() : $params, self::JSON_FLAGS);
        $url = rtrim($baseUrl, '/').$path.($rawQuery !== '' ? '?'.$rawQuery : '');
        $request = $timeout === null
            ? HttpTransfer::request()
            : Http::connectTimeout($timeout)->timeout($timeout);

        $request = $request->acceptJson();
        if (!self::isLoopback($baseUrl)) {
            $request = $request->beforeSending(static function (ClientRequest $attempt) use ($method, $path, $rawQuery, $body): RequestInterface {
                $psrRequest = $attempt->toPsrRequest();
                foreach (ClientKeyAuthService::signedHeaders(
                    self::SIGNING_CLIENT,
                    LaravelServerIdentity::id(),
                    $method,
                    $path,
                    $rawQuery,
                    $body,
                    $method === 'GET' ? '' : self::JSON_CONTENT_TYPE
                ) as $name => $value) {
                    $psrRequest = $psrRequest->withHeader($name, $value);
                }

                return $psrRequest;
            });
        }

        return $method === 'GET'
            ? $request->get($url)
            : $request->withBody(Utils::streamFor($body), self::JSON_CONTENT_TYPE)->send($method, $url);
    }

    /**
     * @throws PycoreRpcException
     */
    private static function decode(string $routeKey, string $path, Response $response): array
    {
        $payload = $response->status() === self::HTTP_NO_CONTENT ? [] : $response->json();
        $error = null;

        if ($response->successful() && is_array($payload)) {
            return $payload;
        }
        if ($response->successful()) {
            throw new PycoreRpcException(
                PycoreRpcException::INVALID_RESPONSE,
                __('pycore.invalid_response', ['route' => $path, 'status' => $response->status()]),
                $response->status()
            );
        }
        $error = is_array($payload) && is_array($payload['error'] ?? null) ? $payload['error'] : [];
        Log::error('[PycoreHttpClient] rpc call failed', ['route' => $routeKey, 'status' => $response->status(), 'error' => $error]);

        throw new PycoreRpcException(
            (string) ($error['code'] ?? PycoreRpcException::INVALID_RESPONSE),
            __('pycore.http_error', [
                'route' => $path,
                'status' => $response->status(),
                'reason' => (string) ($error['message'] ?? $response->reason()),
            ]),
            $response->status(),
            is_array($payload) ? $payload : null
        );
    }

    private static function isLoopback(string $baseUrl): bool
    {
        $host = strtolower(trim((string) parse_url($baseUrl, PHP_URL_HOST), '[]'));
        $loopback = array_map(
            static fn (string $name): string => strtolower(ServiceContract::host($name)),
            ServiceContract::stringList('client_key_auth.local_rpc.loopback_hosts')
        );

        return in_array($host, $loopback, true);
    }

    /** The Windows host as seen from WSL2 NAT networking: the resolv.conf nameserver. */
    private static function wslWindowsHost(): ?string
    {
        $content = is_readable(self::RESOLV_CONF) ? file_get_contents(self::RESOLV_CONF) : false;
        $match = [];

        if ($content === false || !preg_match('/^\s*nameserver\s+(\S+)\s*$/m', $content, $match)) {
            return null;
        }

        return filter_var($match[1], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false ? $match[1] : null;
    }

    private function __construct()
    {
    }
}
