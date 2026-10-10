<?php

namespace App\Apps\MeshSync\MeshSyncControllers;

use App\Apps\MeshSync\MeshSyncApiInfo;
use App\Apps\MeshSync\MeshSyncExceptions\MeshSyncException;
use App\Apps\MeshSync\MeshSyncServices\MeshSyncContract;
use App\Apps\MeshSync\MeshSyncServices\MeshSyncPeerRegistry;
use App\Apps\MeshSync\MeshSyncServices\MeshSyncRecordStore;
use App\Http\Controllers\Controller;
use App\Services\ClientKey\ClientKeyAuthService;
use App\Support\LaravelServerIdentity;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class MeshSyncCtl extends Controller
{
    use ApiResponse;

    private const HTTP_UNPROCESSABLE = 422;
    private const STREAM_SEPARATOR = ',';

    public function __construct(
        private readonly MeshSyncRecordStore $store,
        private readonly MeshSyncPeerRegistry $peers,
    ) {
    }

    public function info(): JsonResponse
    {
        return $this->success(array_merge(MeshSyncApiInfo::getApiInfo(), [
            'server_id' => LaravelServerIdentity::id(),
            'latest_seq' => $this->store->latestSeq(),
            'records' => $this->store->count(),
            'peers' => count($this->peers->all()),
        ]));
    }

    /** Ingest from a machine (pycore) or a peer server pushing; optional `peers` announces other servers' routes. */
    public function records(Request $request): JsonResponse
    {
        $records = $request->input('records');
        $announced = $request->input('peers');
        $machineId = (string) $request->attributes->get(ClientKeyAuthService::ATTRIBUTE_MACHINE_ID, '');
        $fromPeer = $request->attributes->get(ClientKeyAuthService::ATTRIBUTE_CLIENT) === ClientKeyAuthService::CLIENT_LARAVEL_PEER;
        $result = [];

        if (!is_array($records) || !array_is_list($records) || count($records) > MeshSyncContract::limit('ingest_records')) {
            throw new MeshSyncException('records_invalid', self::HTTP_UNPROCESSABLE, ['max' => MeshSyncContract::limit('ingest_records')]);
        }
        $result = $this->store->apply($records, $machineId, $machineId, $fromPeer);
        if (is_array($announced)) {
            $this->peers->remember($announced, MeshSyncPeerRegistry::SOURCE_ANNOUNCED);
        }

        return $this->success(array_merge($result, [
            'server_id' => LaravelServerIdentity::id(),
            'latest_seq' => $this->store->latestSeq(),
        ]));
    }

    /** Change feed pulled by peer servers: records after a seq cursor, plus the peers this server reaches. */
    public function changes(Request $request): JsonResponse
    {
        $after = max(0, (int) $request->query('after', '0'));
        $limit = min(max(1, (int) $request->query('limit', (string) MeshSyncContract::limit('changes_page'))), MeshSyncContract::limit('changes_page'));

        return $this->success(array_merge($this->store->changes($after, $limit), [
            'server_id' => LaravelServerIdentity::id(),
            'peers' => $this->peers->gossip(),
        ]));
    }

    public function search(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        $streams = array_values(array_filter(
            explode(self::STREAM_SEPARATOR, (string) $request->query('streams', '')),
            static fn (string $stream): bool => MeshSyncContract::validStream($stream)
        ));
        $limit = min(max(1, (int) $request->query('limit', (string) MeshSyncContract::limit('search_results'))), MeshSyncContract::limit('search_results'));

        if ($query === '' || mb_strlen($query) > MeshSyncContract::limit('query_chars')) {
            throw new MeshSyncException('query_invalid', self::HTTP_UNPROCESSABLE, ['max' => MeshSyncContract::limit('query_chars')]);
        }

        return $this->success([
            'server_id' => LaravelServerIdentity::id(),
            'query' => $query,
            'records' => $this->store->search($query, $streams, $limit),
        ]);
    }

    public function peers(): JsonResponse
    {
        return $this->success([
            'server_id' => LaravelServerIdentity::id(),
            'peers' => $this->peers->all(),
        ]);
    }
}
