<?php

namespace App\Apps\MeshSync\MeshSyncServices;

use App\Http\Middleware\ServerIdentityHeader;
use App\Services\ClientKey\ClientKeyAuthService;
use App\Support\LaravelServerIdentity;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Psr\Http\Message\RequestInterface;

/** Signed (client key, client `laravel_peer`) GET of one MeshSync route on another Laravel server. */
final class MeshSyncPeerClient
{
    private const SIGNING_CLIENT = ClientKeyAuthService::CLIENT_LARAVEL_PEER;

    /** @return array{ok: bool, status: int, data: array, server_id: string, error: string} */
    public function get(string $baseUrl, string $route, array $query): array
    {
        $parts = parse_url($baseUrl);
        $origin = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
        $requestPath = MeshSyncContract::requestPath((string) ($parts['path'] ?? ''), $route);
        $rawQuery = http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        $response = null;

        try {
            $response = Http::acceptJson()
                ->connectTimeout(MeshSyncContract::limit('peer_connect_timeout_seconds'))
                ->timeout(MeshSyncContract::limit('peer_timeout_seconds'))
                ->beforeSending(static function (ClientRequest $attempt) use ($requestPath, $rawQuery): RequestInterface {
                    $psrRequest = $attempt->toPsrRequest();
                    foreach (ClientKeyAuthService::signedHeaders(
                        self::SIGNING_CLIENT,
                        LaravelServerIdentity::id(),
                        'GET',
                        $requestPath,
                        $rawQuery,
                        '',
                        ''
                    ) as $name => $value) {
                        $psrRequest = $psrRequest->withHeader($name, $value);
                    }

                    return $psrRequest;
                })
                ->get($origin.$requestPath.($rawQuery !== '' ? '?'.$rawQuery : ''));
        } catch (ConnectionException $exception) {
            return ['ok' => false, 'status' => 0, 'data' => [], 'server_id' => '', 'error' => $exception->getMessage()];
        }

        if (!$response->successful()) {
            return [
                'ok' => false,
                'status' => $response->status(),
                'data' => [],
                'server_id' => (string) $response->header(ServerIdentityHeader::header()),
                'error' => __('mesh_sync.peer_http_status', [
                    'status' => $response->status(),
                    'message' => (string) ($response->json('message') ?? ''),
                ]),
            ];
        }

        return [
            'ok' => true,
            'status' => $response->status(),
            'data' => (array) ($response->json('data') ?? []),
            'server_id' => (string) $response->header(ServerIdentityHeader::header()),
            'error' => '',
        ];
    }
}
