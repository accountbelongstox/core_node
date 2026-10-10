<?php

namespace App\Apps\MeshSync\MeshSyncServices;

use App\Support\LaravelServerIdentity;

/**
 * Anti-entropy between Laravel servers: each round pulls the change feed of every due peer from its
 * stored cursor and applies it last-writer-wins, so records pushed to any one server reach every other
 * server (also through intermediate servers) and a server that was offline catches up when it returns.
 * Peers named in a feed are added to the registry (gossip), so the mesh is learned transitively.
 */
final class MeshSyncReplicator
{
    private const ROUTE_CHANGES = 'changes';

    public function __construct(
        private readonly MeshSyncRecordStore $store,
        private readonly MeshSyncPeerRegistry $peers,
        private readonly MeshSyncPeerClient $client,
    ) {
    }

    /** @return array{peers: int, accepted: int, failed: int} */
    public function runRound(): array
    {
        $pulledServers = [];
        $summary = ['peers' => 0, 'accepted' => 0, 'failed' => 0];
        $result = [];

        $this->peers->ensureContractSeeds();
        $this->peers->forgetStale();
        foreach ($this->peers->due(MeshSyncContract::limit('peers_per_round')) as $peer) {
            if ($peer->server_id !== null && in_array((string) $peer->server_id, $pulledServers, true)) {
                continue;
            }
            $result = $this->pull($peer);
            $summary['peers']++;
            $summary['accepted'] += $result['accepted'];
            if (!$result['ok']) {
                $summary['failed']++;
                continue;
            }
            if ($result['server_id'] !== '') {
                $pulledServers[] = $result['server_id'];
            }
        }

        return $summary;
    }

    /** @return array{ok: bool, server_id: string, accepted: int} */
    private function pull(object $peer): array
    {
        $cursor = (int) $peer->cursor;
        $accepted = 0;
        $serverId = '';
        $page = 0;
        $response = [];
        $data = [];
        $applied = [];

        while ($page < MeshSyncContract::limit('pages_per_peer_round')) {
            $response = $this->client->get((string) $peer->base_url, self::ROUTE_CHANGES, [
                'after' => $cursor,
                'limit' => MeshSyncContract::limit('changes_page'),
            ]);
            if (!$response['ok']) {
                $this->peers->markFailure($peer, $response['error']);

                return ['ok' => false, 'server_id' => '', 'accepted' => $accepted];
            }
            $data = $response['data'];
            $serverId = $response['server_id'] !== '' ? $response['server_id'] : (string) ($data['server_id'] ?? '');
            if ($serverId === LaravelServerIdentity::id()) {
                $this->peers->markSelf((int) $peer->id);

                return ['ok' => true, 'server_id' => $serverId, 'accepted' => 0];
            }
            // Another server now answers on this route, or the peer's feed restarted: read it from the start.
            if ($cursor > 0 && ($serverId !== (string) $peer->cursor_server_id || (int) ($data['latest_seq'] ?? 0) < $cursor)) {
                $cursor = 0;
                $peer->cursor_server_id = $serverId;
                continue;
            }
            $applied = $this->store->apply((array) ($data['records'] ?? []), '', $serverId, true);
            $accepted += $applied['accepted'];
            $this->peers->remember((array) ($data['peers'] ?? []), MeshSyncPeerRegistry::SOURCE_GOSSIP);
            $cursor = (int) ($data['next_after'] ?? $cursor);
            $page++;
            if (!($data['has_more'] ?? false)) {
                break;
            }
        }
        $this->peers->markSuccess((int) $peer->id, $serverId, $cursor);

        return ['ok' => true, 'server_id' => $serverId, 'accepted' => $accepted];
    }
}
