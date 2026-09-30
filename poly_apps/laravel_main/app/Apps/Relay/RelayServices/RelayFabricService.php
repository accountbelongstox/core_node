<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayGvar\RelayConstants;
use App\Apps\Relay\RelayModels\RelayPairingModel;
use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use App\Models\User;
use App\Services\Realtime\MercurePublisher;
use App\Services\Relay\RelayHubJwt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Relay Fabric V3 control plane: grants, frame admission, device presence,
 * telemetry and the ledger. Frames travel over the hub; nothing here opens a
 * PostgreSQL transaction on the request path.
 */
final class RelayFabricService
{
    public const LEDGER_TABLE = 'global_relay_fabric_ledger';
    private const LANE_FAST = 'fast';

    private static bool $ledgerReady = false;
    private static float $ledgerReadyUntil = 0.0;

    public function __construct(
        private readonly RelayPairingService $pairings,
        private readonly RelayDeviceService $devices,
        private readonly RelayTopicService $topics
    ) {
    }

    /**
     * Owner grant: private subscribe rights on the response topic of every
     * actively paired device.
     */
    public function ownerGrant(User $user, string $contractDigest): array
    {
        $userId = (int) $user->getAuthIdentifier();
        $ttl = RelayFabricContract::duration('grant_ttl_seconds');
        $hubUrl = RelayContract::publicUrl('mercure_hub');
        $ownerToken = $this->topics->ownerToken($userId);
        $rows = $this->pairings->activePairingRows($userId);
        $topics = [];
        $devices = [];

        RelayFabricContract::assertSameDigest($contractDigest);
        RelayFabricStore::rosterPut($userId, $rows, RelayFabricContract::duration('roster_cache_seconds'));
        foreach ($rows as $row) {
            $topic = $this->responseTopic($ownerToken, $row['device_id']);
            $presence = RelayFabricStore::presence($row['device_id']);
            $topics[] = $topic;
            $devices[] = [
                'device_id' => $row['device_id'],
                'pairing_id' => $row['pairing_id'],
                'response_topic' => $topic,
                'fast_available' => $presence !== null,
                'last_seen_ms' => (int) ($presence['seen_ms'] ?? 0),
            ];
        }

        return [
            'hub_url' => $hubUrl,
            'subscriber_token' => $topics === []
                ? ''
                : RelayHubJwt::subscriberTokenForTtl('relay-fabric-owner:'.$userId, $topics, $ttl, $hubUrl),
            'topics' => array_values(array_unique($topics)),
            'devices' => $devices,
            'grant_version' => $this->version(array_column($rows, 'pairing_id')),
            'expires_in_seconds' => $ttl,
            'contract_digest' => RelayFabricContract::digest(),
            'server_time_ms' => $this->nowMs(),
        ];
    }

    /**
     * Admit one request frame and publish it to the device request topic.
     *
     * @return array{status: int, body: array<string, mixed>}
     */
    public function admitFrame(User $user, array $payload): array
    {
        $startedMs = $this->nowMs();
        $userId = (int) $user->getAuthIdentifier();
        $operationId = (string) $payload['operation_id'];
        $pairingId = (string) $payload['pairing_id'];
        $method = strtoupper((string) $payload['method']);
        $path = RelayContract::canonicalPath((string) $payload['path']);
        $policy = RelayContract::routePolicy($path, $method);
        $profile = (string) ($policy['profile'] ?? 'denied');
        $retry = (string) ($policy['retry'] ?? RelayConstants::RETRY_AT_MOST_ONCE);
        $body = is_array($payload['body'] ?? null) ? $payload['body'] : [];
        $bytes = $this->decodeBody($body);
        $deviceId = '';
        $deadlineMs = 0;
        $frame = [];
        $json = '';
        $updateId = null;
        $reply = [];

        if (!RelayFabricStore::available()) {
            throw new RelayDomainException('fabric_unavailable', 503);
        }
        if ((string) ($policy['exposure'] ?? 'denied') !== 'relay') {
            throw new RelayDomainException('route_denied', 403);
        }
        if (RelayFabricContract::lane($profile) !== self::LANE_FAST
            || !in_array($retry, RelayFabricContract::fastRetryPolicies(), true)) {
            throw new RelayDomainException('lane_durable_required', 409);
        }
        if (!RelayFabricStore::rateAllow($userId, RelayFabricContract::limit('owner_frames_per_minute'))) {
            throw new RelayDomainException('fabric_rate_limited', 429);
        }
        $deviceId = $this->deviceForPairing($userId, $pairingId);
        if (RelayFabricStore::presence($deviceId) === null) {
            throw new RelayDomainException('device_fabric_unavailable', 503);
        }
        $deadlineMs = $startedMs + 1000 * max(
            RelayFabricContract::duration('min_deadline_seconds'),
            min(RelayFabricContract::duration('max_deadline_seconds'), (int) ($policy['timeout_seconds'] ?? 0))
        );
        $reply = [
            'operation_id' => $operationId,
            'deadline_ms' => $deadlineMs,
            'device_id' => $deviceId,
            'lane' => self::LANE_FAST,
            'server_time_ms' => $startedMs,
        ];
        if (!RelayFabricStore::operationFirst($operationId, RelayFabricContract::duration('operation_dedupe_seconds'))) {
            return ['status' => 200, 'body' => $reply];
        }
        $frame = [
            'v' => 3,
            'op' => $operationId,
            'owner' => $this->topics->ownerToken($userId),
            'pair' => $pairingId,
            'm' => $method,
            'p' => $path,
            'q' => is_array($payload['query'] ?? null) && $payload['query'] !== [] ? $payload['query'] : new \stdClass(),
            'h' => RelayContract::filterHeaders(is_array($payload['headers'] ?? null) ? $payload['headers'] : [], 'request') ?: new \stdClass(),
            'pol' => $profile,
            'lane' => self::LANE_FAST,
            'b' => [
                'len' => strlen($bytes),
                'sha256' => hash('sha256', $bytes),
                'b64' => (bool) ($body['present'] ?? false) ? base64_encode($bytes) : null,
            ],
            'iat' => $startedMs,
            'dl' => $deadlineMs,
        ];
        $json = json_encode($frame, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($json) || strlen($json) > RelayFabricContract::limit('frame_bytes')) {
            throw new RelayDomainException('frame_too_large', 413);
        }
        $updateId = MercurePublisher::publish(
            RelayFabricContract::topic('request', ['device_id' => $deviceId]),
            $json,
            true,
            RelayFabricContract::eventType('request')
        );
        if ($updateId === null) {
            throw new RelayDomainException('fabric_unavailable', 503);
        }
        RelayFabricStore::ledgerPush([
            'kind' => 'admit',
            'operation_id' => $operationId,
            'user_id' => $userId,
            'device_id' => $deviceId,
            'route_policy' => $profile,
            'lane' => self::LANE_FAST,
            't_admit' => $startedMs,
            't_publish' => $this->nowMs(),
            'bytes_in' => strlen($json),
        ]);

        return ['status' => 202, 'body' => $reply];
    }

    /**
     * Device heartbeat: refreshes the fast capability and hands out a grant
     * when none is current.
     */
    public function deviceHeartbeat(string $deviceId, array $payload): array
    {
        $device = $this->devices->activeDevice($deviceId);
        $connected = (bool) ($payload['stream_connected'] ?? false);
        $presence = RelayFabricStore::presence($deviceId) ?? [];
        $ttl = RelayFabricContract::duration('grant_ttl_seconds');
        $margin = RelayFabricContract::duration('grant_refresh_margin_seconds');
        $rows = $this->devicePairingRows($deviceId, (int) $device->current_credential_version);
        $version = $this->version(array_map(static fn (array $row): string => $row['pairing_id'].'|'.$row['owner_token'], $rows));
        $issuedMs = (int) ($presence['grant_issued_ms'] ?? 0);
        $needsGrant = $connected && ($version !== (string) ($payload['grant_version'] ?? '')
            || $version !== (string) ($presence['grant_version'] ?? '')
            || ($this->nowMs() - $issuedMs) > 1000 * ($ttl - $margin));
        $grant = null;

        RelayFabricContract::assertSameDigest((string) $payload['contract_digest']);
        if (!$connected) {
            RelayFabricStore::presenceClear($deviceId);

            return ['fast_capable' => false, 'grant' => null];
        }
        if ($needsGrant) {
            $grant = $this->deviceGrant($deviceId, $rows, $version, $ttl);
            $issuedMs = $this->nowMs();
        }
        RelayFabricStore::presenceSet($deviceId, [
            'seen_ms' => $this->nowMs(),
            'active' => (int) ($payload['active_requests'] ?? 0),
            'grant_version' => $version,
            'grant_issued_ms' => $issuedMs,
        ], RelayFabricContract::duration('device_presence_ttl_seconds'));

        return ['fast_capable' => true, 'grant' => $grant];
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    public function recordTelemetry(int $userId, array $items): int
    {
        $accepted = 0;

        foreach (array_slice($items, 0, RelayFabricContract::limit('telemetry_batch')) as $item) {
            if (!is_array($item) || !isset($item['operation_id'])) {
                continue;
            }
            // The UI cannot know the route profile ("unknown") and reports 0 for
            // device timings it never received; neither may overwrite the admit row.
            if (in_array((string) ($item['route_policy'] ?? ''), ['', 'unknown'], true)) {
                unset($item['route_policy']);
            }
            foreach (['t_dev_recv', 't_dev_send', 'exec_ms'] as $timing) {
                if (isset($item[$timing]) && (int) $item[$timing] === 0) {
                    unset($item[$timing]);
                }
            }
            RelayFabricStore::ledgerPush(array_merge($item, ['kind' => 'telemetry', 'user_id' => $userId]));
            $accepted++;
        }

        return $accepted;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function stats(int $userId, int $minutes): array
    {
        if (!$this->ledgerReady()) {
            return [];
        }
        $connection = DB::connection(RelayTablesMaps::connection());
        $rows = $connection->select(
            'SELECT route_policy, lane, count(*) AS calls,
                    count(*) FILTER (WHERE http_status >= 400) AS errors,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY (t_ui_recv - t_ui_send)) AS p50,
                    percentile_cont(0.9) WITHIN GROUP (ORDER BY (t_ui_recv - t_ui_send)) AS p90,
                    percentile_cont(0.99) WITHIN GROUP (ORDER BY (t_ui_recv - t_ui_send)) AS p99
               FROM '.self::LEDGER_TABLE.'
              WHERE user_id = ? AND t_ui_recv IS NOT NULL AND t_ui_send IS NOT NULL
                AND created_at > now() - (? * interval \'1 minute\')
              GROUP BY route_policy, lane
              ORDER BY calls DESC',
            [$userId, max(1, min(1440, $minutes))]
        );

        return array_map(static fn ($row): array => [
            'route_policy' => (string) $row->route_policy,
            'lane' => (string) $row->lane,
            'calls' => (int) $row->calls,
            'error_rate' => (int) $row->calls > 0 ? round(((int) $row->errors) / ((int) $row->calls), 4) : 0.0,
            'p50_ms' => (int) round((float) $row->p50),
            'p90_ms' => (int) round((float) $row->p90),
            'p99_ms' => (int) round((float) $row->p99),
        ], $rows);
    }

    /**
     * Drain the Redis ledger queue into PostgreSQL (one batched upsert) and
     * prune old rows. Runs from the relay maintenance slice, never per request.
     *
     * @return array{drained: int, pruned: int}
     */
    public function drainLedger(): array
    {
        if (!$this->ledgerReady()) {
            return ['drained' => 0, 'pruned' => 0];
        }
        $rows = RelayFabricStore::ledgerPop(RelayFabricContract::limit('ledger_drain_batch'));
        $merged = [];
        $connection = DB::connection(RelayTablesMaps::connection());
        $columns = ['operation_id', 'user_id', 'device_id', 'route_policy', 'lane', 'http_status', 'outcome', 't_admit', 't_publish', 't_dev_recv', 't_dev_send', 't_ui_send', 't_ui_recv', 'exec_ms', 'bytes_in', 'bytes_out'];
        $pruned = 0;

        foreach ($rows as $row) {
            $id = (string) ($row['operation_id'] ?? '');
            if ($id === '') {
                continue;
            }
            $merged[$id] = array_merge($merged[$id] ?? [], array_filter($row, static fn ($value): bool => $value !== null));
        }
        foreach ($merged as $id => $row) {
            if (!isset($row['user_id'])) {
                unset($merged[$id]);
                continue;
            }
            $merged[$id]['lane'] = (string) ($row['lane'] ?? self::LANE_FAST);
        }
        foreach (array_chunk(array_values($merged), 100) as $chunk) {
            $this->upsertLedger($connection, $chunk, $columns);
        }
        $pruned = $connection->delete(
            'DELETE FROM '.self::LEDGER_TABLE.' WHERE ctid IN (SELECT ctid FROM '.self::LEDGER_TABLE.' WHERE created_at < now() - (? * interval \'1 second\') LIMIT 1000)',
            [RelayFabricContract::duration('ledger_retention_seconds')]
        );

        return ['drained' => count($merged), 'pruned' => $pruned];
    }

    /**
     * The ledger table arrives with the migration; until then the maintenance
     * slice must keep working, and queued rows stay in Redis (not popped).
     */
    private function ledgerReady(): bool
    {
        if (self::$ledgerReadyUntil > microtime(true)) {
            return self::$ledgerReady;
        }
        self::$ledgerReady = Schema::connection(RelayTablesMaps::connection())->hasTable(self::LEDGER_TABLE);
        self::$ledgerReadyUntil = microtime(true) + ($this->ledgerReadyCacheSeconds());

        return self::$ledgerReady;
    }

    private function ledgerReadyCacheSeconds(): int
    {
        return self::$ledgerReady ? 300 : 30;
    }

    private function upsertLedger($connection, array $chunk, array $columns): void
    {
        $values = [];
        $bindings = [];
        $updates = [];
        $sql = '';

        foreach ($chunk as $row) {
            $values[] = '('.implode(',', array_fill(0, count($columns), '?')).')';
            foreach ($columns as $column) {
                $bindings[] = $row[$column] ?? null;
            }
        }
        foreach ($columns as $column) {
            if ($column !== 'operation_id') {
                $updates[] = $column.' = COALESCE(EXCLUDED.'.$column.', '.self::LEDGER_TABLE.'.'.$column.')';
            }
        }
        $sql = 'INSERT INTO '.self::LEDGER_TABLE.' ('.implode(',', $columns).') VALUES '.implode(',', $values)
            .' ON CONFLICT (operation_id) DO UPDATE SET '.implode(', ', $updates).', updated_at = now()';
        if ($values !== []) {
            $connection->insert($sql, $bindings);
        }
    }

    private function deviceForPairing(int $userId, string $pairingId): string
    {
        $rows = RelayFabricStore::rosterGet($userId);

        if ($rows === null) {
            $rows = $this->pairings->activePairingRows($userId);
            RelayFabricStore::rosterPut($userId, $rows, RelayFabricContract::duration('roster_cache_seconds'));
        }
        foreach ($rows as $row) {
            if ($row['pairing_id'] === $pairingId) {
                return (string) $row['device_id'];
            }
        }
        RelayFabricStore::rosterForget($userId);

        throw new RelayDomainException('pairing_not_active', 409);
    }

    /**
     * @return array<int, array{pairing_id: string, owner_token: string}>
     */
    private function devicePairingRows(string $deviceId, int $credentialVersion): array
    {
        return RelayPairingModel::query()
            ->where('device_id', $deviceId)
            ->where('state', RelayConstants::PAIRING_ACTIVE)
            ->where('credential_version', $credentialVersion)
            ->where('expires_at', '>', now())
            ->get(['pairing_id', 'user_id'])
            ->map(fn ($row): array => [
                'pairing_id' => (string) $row->pairing_id,
                'owner_token' => $this->topics->ownerToken((int) $row->user_id),
            ])
            ->unique('owner_token')
            ->values()
            ->all();
    }

    private function deviceGrant(string $deviceId, array $rows, string $version, int $ttl): array
    {
        $hubUrl = RelayContract::publicUrl('mercure_hub');
        $requestTopic = RelayFabricContract::topic('request', ['device_id' => $deviceId]);
        $responseTopics = array_map(fn (array $row): array => [
            'pairing_id' => $row['pairing_id'],
            'owner_topic_token' => $row['owner_token'],
            'topic' => $this->responseTopic($row['owner_token'], $deviceId),
        ], $rows);

        return [
            'hub_url' => $hubUrl,
            'subscriber_token' => RelayHubJwt::subscriberTokenForTtl('relay-fabric-device:'.$deviceId, [$requestTopic], $ttl, $hubUrl),
            'publish_token' => $responseTopics === []
                ? ''
                : RelayHubJwt::scopedPublisherToken('relay-fabric-device:'.$deviceId, array_column($responseTopics, 'topic'), $ttl, $hubUrl),
            'request_topic' => $requestTopic,
            'response_topics' => $responseTopics,
            'grant_version' => $version,
            'expires_in_seconds' => $ttl,
        ];
    }

    private function responseTopic(string $ownerToken, string $deviceId): string
    {
        return RelayFabricContract::topic('response', ['owner_topic_token' => $ownerToken, 'device_id' => $deviceId]);
    }

    private function decodeBody(array $body): string
    {
        $present = (bool) ($body['present'] ?? false);
        $encoded = $body['base64'] ?? null;
        $bytes = '';

        if (!$present) {
            if ($encoded !== null || (int) ($body['length'] ?? 0) !== 0) {
                throw new RelayDomainException('request_body_unexpected', 422);
            }

            return '';
        }
        if (!is_string($encoded)) {
            throw new RelayDomainException('request_body_source_invalid', 422);
        }
        // inline_body_bytes bounds the base64 text, the same unit the device
        // uses for responses, so one frame always stays under frame_bytes.
        if (strlen($encoded) > RelayFabricContract::limit('inline_body_bytes')) {
            throw new RelayDomainException('frame_too_large', 413);
        }
        $bytes = base64_decode($encoded, true);
        if (!is_string($bytes)) {
            throw new RelayDomainException('request_body_base64_invalid', 422);
        }
        if (strlen($bytes) !== (int) ($body['length'] ?? -1)
            || !hash_equals(hash('sha256', $bytes), strtolower((string) ($body['sha256'] ?? '')))) {
            throw new RelayDomainException('request_body_digest_conflict', 409);
        }

        return $bytes;
    }

    /**
     * @param array<int, string> $parts
     */
    private function version(array $parts): string
    {
        sort($parts);

        return substr(hash('sha256', implode("\n", $parts)), 0, 16);
    }

    private function nowMs(): int
    {
        return (int) floor(microtime(true) * 1000);
    }
}
