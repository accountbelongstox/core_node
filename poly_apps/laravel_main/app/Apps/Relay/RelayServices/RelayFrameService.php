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
 * Relay control plane: grants, frame admission, device heartbeat and
 * presence, telemetry and the ledger. Frames travel over the hub; nothing
 * here opens a PostgreSQL transaction on the request path.
 */
final class RelayFrameService
{
    private static bool $ledgerReady = false;
    private static float $ledgerReadyUntil = 0.0;

    public function __construct(
        private readonly RelayPairingService $pairings,
        private readonly RelayDeviceService $devices,
        private readonly RelayTopicService $topics,
        private readonly RelayBlobService $blobs
    ) {
    }

    /**
     * Owner grant: one private subscribe token covering the owner events topic
     * and the response topic of every actively paired device.
     */
    public function ownerGrant(User $user, string $contractDigest): array
    {
        $userId = (int) $user->getAuthIdentifier();
        $ttl = RelayContract::duration('grant_ttl_seconds');
        $hubUrl = RelayContract::publicUrl('mercure_hub');
        $ownerToken = $this->topics->ownerToken($userId);
        $ownerTopic = $this->topics->owner($userId);
        $rows = $this->pairings->activePairingRows($userId);
        $topics = [$ownerTopic];
        $devices = [];
        $topic = '';
        $presence = null;

        RelayContract::assertSameDigest($contractDigest);
        RelayStore::rosterPut($userId, $rows, RelayContract::duration('roster_cache_seconds'));
        foreach ($rows as $row) {
            $topic = $this->topics->response($ownerToken, $row['device_id']);
            $presence = RelayStore::presence($row['device_id']);
            $topics[] = $topic;
            $devices[] = [
                'device_id' => $row['device_id'],
                'pairing_id' => $row['pairing_id'],
                'response_topic' => $topic,
                'online' => $presence !== null,
                'last_seen_ms' => (int) ($presence['seen_ms'] ?? 0),
            ];
        }
        $topics = array_values(array_unique($topics));

        return [
            'hub_url' => $hubUrl,
            'subscriber_token' => RelayHubJwt::subscriberTokenForTtl('relay-owner:'.$userId, $topics, $ttl, $hubUrl),
            'owner_topic' => $ownerTopic,
            'topics' => $topics,
            'devices' => $devices,
            'grant_version' => $this->version(array_column($rows, 'pairing_id')),
            'expires_in_seconds' => $ttl,
            'contract_digest' => RelayContract::digest(),
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
        $body = is_array($payload['body'] ?? null) ? $payload['body'] : [];
        $deviceId = '';
        $deadlineMs = 0;
        $frameBody = [];
        $frame = [];
        $json = '';
        $updateId = null;
        $reply = [];

        if (!RelayStore::available()) {
            throw new RelayDomainException('relay_unavailable', RelayContract::errorStatus('relay_unavailable'));
        }
        if ((string) ($policy['exposure'] ?? 'denied') !== 'relay') {
            throw new RelayDomainException('route_denied', RelayContract::errorStatus('route_denied'));
        }
        if (!RelayStore::rateAllow($userId, RelayContract::rateLimit('owner_frames_per_minute'))) {
            throw new RelayDomainException('relay_rate_limited', RelayContract::errorStatus('relay_rate_limited'));
        }
        $deviceId = $this->deviceForPairing($userId, $pairingId);
        if (RelayStore::presence($deviceId) === null) {
            throw new RelayDomainException('device_offline', RelayContract::errorStatus('device_offline'));
        }
        $frameBody = $this->frameBody($userId, $pairingId, $deviceId, $body);
        $deadlineMs = $startedMs + 1000 * max(
            RelayContract::duration('min_deadline_seconds'),
            min(RelayContract::duration('max_deadline_seconds'), (int) ($policy['timeout_seconds'] ?? 0))
        );
        $reply = [
            'operation_id' => $operationId,
            'deadline_ms' => $deadlineMs,
            'device_id' => $deviceId,
            'server_time_ms' => $startedMs,
            'ack_required' => ($policy['ack'] ?? false) === true,
        ];
        if (!RelayStore::operationFirst($operationId, RelayContract::duration('operation_dedupe_seconds'))) {
            return ['status' => 200, 'body' => $reply];
        }
        $frame = [
            'v' => RelayContract::frameVersion(),
            'op' => $operationId,
            'owner' => $this->topics->ownerToken($userId),
            'pair' => $pairingId,
            'm' => $method,
            'p' => $path,
            'q' => is_array($payload['query'] ?? null) && $payload['query'] !== [] ? $payload['query'] : new \stdClass(),
            'h' => RelayContract::filterHeaders(is_array($payload['headers'] ?? null) ? $payload['headers'] : [], 'request') ?: new \stdClass(),
            'pol' => $profile,
            'b' => $frameBody,
            'iat' => $startedMs,
            'dl' => $deadlineMs,
        ];
        $json = json_encode($frame, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($json) || strlen($json) > RelayContract::limit('frame_bytes')) {
            throw new RelayDomainException('frame_too_large', RelayContract::errorStatus('frame_too_large'));
        }
        $updateId = MercurePublisher::publish(
            $this->topics->request($deviceId),
            $json,
            true,
            RelayContract::event('request_frame')
        );
        if ($updateId === null) {
            throw new RelayDomainException('relay_unavailable', RelayContract::errorStatus('relay_unavailable'));
        }
        RelayStore::ledgerPush([
            'kind' => 'admit',
            'operation_id' => $operationId,
            'user_id' => $userId,
            'device_id' => $deviceId,
            'route_policy' => $profile,
            't_admit' => $startedMs,
            't_publish' => $this->nowMs(),
            'bytes_in' => strlen($json),
        ]);

        return ['status' => 202, 'body' => $reply];
    }

    /**
     * Device heartbeat: updates the device row and presence, and hands out a
     * grant when none is current (independent of the stream state, so a device
     * can obtain its first grant before it has any stream).
     */
    public function deviceHeartbeat(string $deviceId, array $payload): array
    {
        $result = $this->devices->heartbeat($deviceId, $payload);
        $device = $this->devices->activeDevice($deviceId);
        $online = (bool) ($payload['online'] ?? true);
        $connected = $online && (bool) ($payload['stream_connected'] ?? false);
        $presence = RelayStore::presence($deviceId) ?? [];
        $ttl = RelayContract::duration('grant_ttl_seconds');
        $margin = RelayContract::duration('grant_refresh_margin_seconds');
        $rows = $this->devicePairingRows($deviceId, (int) $device->current_credential_version);
        $version = $this->version(array_map(static fn (array $row): string => $row['pairing_id'].'|'.$row['owner_token'], $rows));
        $issuedMs = (int) ($presence['grant_issued_ms'] ?? 0);
        $needsGrant = $online && ($version !== (string) ($payload['grant_version'] ?? '')
            || $version !== (string) ($presence['grant_version'] ?? '')
            || ($this->nowMs() - $issuedMs) > 1000 * ($ttl - $margin));
        $grant = null;

        if ($needsGrant) {
            $grant = $this->deviceGrant($deviceId, $rows, $version, $ttl);
            $issuedMs = $this->nowMs();
        }
        if ($connected) {
            RelayStore::presenceSet($deviceId, [
                'seen_ms' => $this->nowMs(),
                'active' => (int) ($payload['active_requests'] ?? 0),
                'grant_version' => $version,
                'grant_issued_ms' => $issuedMs,
            ], RelayContract::duration('presence_timeout_seconds'));
        } else {
            RelayStore::presenceClear($deviceId);
        }

        return array_merge($result, ['grant' => $grant]);
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    public function recordTelemetry(int $userId, array $items): int
    {
        $accepted = 0;

        foreach (array_slice($items, 0, RelayContract::limit('telemetry_batch')) as $item) {
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
            RelayStore::ledgerPush(array_merge($item, ['kind' => 'telemetry', 'user_id' => $userId]));
            $accepted++;
        }

        return $accepted;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function stats(int $userId, int $minutes): array
    {
        $table = RelayTablesMaps::table(RelayTablesMaps::LEDGER);
        $connection = null;
        $rows = [];

        if (!$this->ledgerReady()) {
            return [];
        }
        $connection = DB::connection(RelayTablesMaps::connection());
        $rows = $connection->select(
            'SELECT route_policy, count(*) AS calls,
                    count(*) FILTER (WHERE http_status >= 400) AS errors,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY (t_ui_recv - t_ui_send)) AS p50,
                    percentile_cont(0.9) WITHIN GROUP (ORDER BY (t_ui_recv - t_ui_send)) AS p90,
                    percentile_cont(0.99) WITHIN GROUP (ORDER BY (t_ui_recv - t_ui_send)) AS p99
               FROM '.$table.'
              WHERE user_id = ? AND t_ui_recv IS NOT NULL AND t_ui_send IS NOT NULL
                AND created_at > now() - (? * interval \'1 minute\')
              GROUP BY route_policy
              ORDER BY calls DESC',
            [$userId, max(1, min(1440, $minutes))]
        );

        return array_map(static fn ($row): array => [
            'route_policy' => (string) $row->route_policy,
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
        $table = RelayTablesMaps::table(RelayTablesMaps::LEDGER);
        $rows = [];
        $merged = [];
        $connection = null;
        $columns = ['operation_id', 'user_id', 'device_id', 'route_policy', 'http_status', 'outcome', 't_admit', 't_publish', 't_dev_recv', 't_dev_send', 't_ui_send', 't_ui_recv', 'exec_ms', 'bytes_in', 'bytes_out'];
        $pruned = 0;
        $id = '';

        if (!$this->ledgerReady()) {
            return ['drained' => 0, 'pruned' => 0];
        }
        $rows = RelayStore::ledgerPop(RelayContract::limit('ledger_drain_batch'));
        $connection = DB::connection(RelayTablesMaps::connection());
        foreach ($rows as $row) {
            $id = (string) ($row['operation_id'] ?? '');
            if ($id === '') {
                continue;
            }
            $merged[$id] = array_merge($merged[$id] ?? [], array_filter($row, static fn ($value): bool => $value !== null));
        }
        foreach (array_keys($merged) as $id) {
            if (!isset($merged[$id]['user_id'])) {
                unset($merged[$id]);
            }
        }
        foreach (array_chunk(array_values($merged), 100) as $chunk) {
            $this->upsertLedger($connection, $table, $chunk, $columns);
        }
        $pruned = $connection->delete(
            'DELETE FROM '.$table.' WHERE ctid IN (SELECT ctid FROM '.$table.' WHERE created_at < now() - (? * interval \'1 second\') LIMIT 1000)',
            [RelayContract::duration('ledger_retention_seconds')]
        );

        return ['drained' => count($merged), 'pruned' => $pruned];
    }

    /**
     * The ledger table arrives with its migration; until then the maintenance
     * slice must keep working, and queued rows stay in Redis (not popped).
     */
    private function ledgerReady(): bool
    {
        if (self::$ledgerReadyUntil > microtime(true)) {
            return self::$ledgerReady;
        }
        self::$ledgerReady = Schema::connection(RelayTablesMaps::connection())
            ->hasTable(RelayTablesMaps::table(RelayTablesMaps::LEDGER));
        self::$ledgerReadyUntil = microtime(true) + (self::$ledgerReady ? 300 : 30);

        return self::$ledgerReady;
    }

    private function upsertLedger($connection, string $table, array $chunk, array $columns): void
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
                $updates[] = $column.' = COALESCE(EXCLUDED.'.$column.', '.$table.'.'.$column.')';
            }
        }
        $sql = 'INSERT INTO '.$table.' ('.implode(',', $columns).') VALUES '.implode(',', $values)
            .' ON CONFLICT (operation_id) DO UPDATE SET '.implode(', ', $updates).', updated_at = now()';
        if ($values !== []) {
            $connection->insert($sql, $bindings);
        }
    }

    private function deviceForPairing(int $userId, string $pairingId): string
    {
        $rows = RelayStore::rosterGet($userId);

        if ($rows === null) {
            $rows = $this->pairings->activePairingRows($userId);
            RelayStore::rosterPut($userId, $rows, RelayContract::duration('roster_cache_seconds'));
        }
        foreach ($rows as $row) {
            if ($row['pairing_id'] === $pairingId) {
                return (string) $row['device_id'];
            }
        }
        RelayStore::rosterForget($userId);

        throw new RelayDomainException('pairing_not_active', RelayContract::errorStatus('pairing_not_active'));
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
        $requestTopic = $this->topics->request($deviceId);
        $responseTopics = array_map(fn (array $row): array => [
            'pairing_id' => $row['pairing_id'],
            'owner_topic_token' => $row['owner_token'],
            'topic' => $this->topics->response($row['owner_token'], $deviceId),
        ], $rows);

        return [
            'hub_url' => $hubUrl,
            'subscriber_token' => RelayHubJwt::subscriberTokenForTtl('relay-device:'.$deviceId, [$requestTopic], $ttl, $hubUrl),
            'publish_token' => $responseTopics === []
                ? ''
                : RelayHubJwt::scopedPublisherToken('relay-device:'.$deviceId, array_column($responseTopics, 'topic'), $ttl, $hubUrl),
            'request_topic' => $requestTopic,
            'response_topics' => $responseTopics,
            'grant_version' => $version,
            'expires_in_seconds' => $ttl,
        ];
    }

    /**
     * Frame body descriptor: inline base64, or the reference of a finalized
     * request blob verified against the declared digest and length.
     *
     * @return array{len: int, sha256: string, b64: string|null, ref?: string}
     */
    private function frameBody(int $userId, string $pairingId, string $deviceId, array $body): array
    {
        $ref = (string) ($body['ref'] ?? '');
        $bytes = '';
        $blob = [];

        if ($ref === '') {
            $bytes = $this->decodeBody($body);

            return [
                'len' => strlen($bytes),
                'sha256' => hash('sha256', $bytes),
                'b64' => (bool) ($body['present'] ?? false) ? base64_encode($bytes) : null,
                'ref' => null,
            ];
        }
        if (!(bool) ($body['present'] ?? false) || ($body['base64'] ?? null) !== null) {
            throw new RelayDomainException('request_body_source_invalid', 422);
        }
        $blob = $this->blobs->requestBlobForFrame(
            $userId,
            $ref,
            $pairingId,
            $deviceId,
            strtolower((string) ($body['sha256'] ?? '')),
            (int) ($body['length'] ?? -1)
        );

        return [
            'len' => (int) $blob['final_length'],
            'sha256' => (string) $blob['final_sha256'],
            'b64' => null,
            'ref' => $ref,
        ];
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
        if (strlen($encoded) > RelayContract::limit('inline_body_bytes')) {
            throw new RelayDomainException('frame_too_large', RelayContract::errorStatus('frame_too_large'));
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
