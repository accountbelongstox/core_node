<?php

namespace App\Apps\MeshSync\MeshSyncServices;

use App\Apps\MeshSync\MeshSyncTablesMaps\MeshSyncTablesMaps;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Replicated records of every stream. A record is `(stream, key)` with a version (the writer's
 * millisecond clock), a content hash, an optional payload and its search text. Writes are
 * last-writer-wins: a higher version wins, an equal version is decided by the larger hash, so every
 * server converges on the same record whatever order copies arrive in. Each accepted write takes the
 * next local `seq` (writers are serialized by an advisory lock, so commit order is seq order): the
 * change feed `changes(after)` is what peers pull, and a record a server learned from one peer is
 * passed on to the others.
 */
final class MeshSyncRecordStore
{
    private const SEQ_LOCK_KEY = 6046117301;
    private const HASH_PATTERN = '~^[0-9a-f]{64}$~';
    private const ORIGIN_PATTERN = '~^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$~';
    private const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR;

    /**
     * Apply records last-writer-wins.
     *
     * A machine's own records get `$origin` (its signing machine id) and a hash computed here; records
     * pulled from a peer keep their own origin and hash, so identical content never flaps between servers.
     *
     * @return array{accepted: int, unchanged: int, rejected: array<int, array{stream: string, key: string, error: string}>}
     */
    public function apply(array $records, string $origin, string $receivedFrom, bool $fromPeer): array
    {
        $normalized = [];
        $rejected = [];
        $record = [];

        foreach ($records as $raw) {
            $record = is_array($raw) ? $this->normalize($raw, $origin, $fromPeer) : ['error' => 'record_invalid'];
            if (isset($record['error'])) {
                $rejected[] = [
                    'stream' => is_array($raw) ? (string) ($raw['stream'] ?? '') : '',
                    'key' => is_array($raw) ? (string) ($raw['key'] ?? '') : '',
                    'error' => $record['error'],
                ];
                continue;
            }
            $normalized[] = $record;
        }
        if ($normalized === []) {
            return ['accepted' => 0, 'unchanged' => 0, 'rejected' => $rejected];
        }

        return array_merge($this->write($normalized, $receivedFrom), ['rejected' => $rejected]);
    }

    /** @return array{records: array<int, array<string, mixed>>, next_after: int, has_more: bool, latest_seq: int} */
    public function changes(int $after, int $limit): array
    {
        $rows = $this->table()->where('seq', '>', $after)->orderBy('seq')->limit($limit)->get();
        $records = $rows->map(fn (object $row): array => $this->present($row, true))->all();

        return [
            'records' => $records,
            'next_after' => $records === [] ? $after : (int) end($records)['seq'],
            'has_more' => count($records) >= $limit,
            'latest_seq' => $this->latestSeq(),
        ];
    }

    /** Live (not deleted) records whose search text contains `$query` (case-insensitive), newest version first. */
    public function search(string $query, array $streams, int $limit): array
    {
        $builder = $this->table()
            ->where('deleted', false)
            ->whereRaw('search_text ILIKE ?', ['%'.addcslashes($query, '\\%_').'%'])
            ->orderByDesc('version')
            ->limit($limit);

        if ($streams !== []) {
            $builder->whereIn('stream', $streams);
        }

        return $builder->get()->map(fn (object $row): array => $this->present($row, false))->all();
    }

    public function latestSeq(): int
    {
        return (int) $this->table()->max('seq');
    }

    public function count(): int
    {
        return $this->table()->count();
    }

    /** @return array<string, mixed> normalized record, or `['error' => code]` */
    private function normalize(array $raw, string $origin, bool $fromPeer): array
    {
        $stream = (string) ($raw['stream'] ?? '');
        $key = (string) ($raw['key'] ?? '');
        $version = $raw['version'] ?? null;
        $deleted = (bool) ($raw['deleted'] ?? false);
        $payload = $raw['payload'] ?? null;
        $searchText = '';
        $encodedPayload = null;
        $hash = '';
        $recordOrigin = $fromPeer ? (string) ($raw['origin'] ?? '') : $origin;

        if (!MeshSyncContract::validStream($stream)) {
            return ['error' => 'stream_invalid'];
        }
        if ($key === '' || strlen($key) > MeshSyncContract::limit('key_length')) {
            return ['error' => 'key_invalid'];
        }
        if (!is_int($version) && !(is_string($version) && ctype_digit($version))) {
            return ['error' => 'version_invalid'];
        }
        if (preg_match(self::ORIGIN_PATTERN, $recordOrigin) !== 1) {
            return ['error' => 'origin_invalid'];
        }
        if (!$deleted) {
            if (!is_array($payload)) {
                return ['error' => 'payload_invalid'];
            }
            $encodedPayload = json_encode($payload, self::JSON_FLAGS);
            if (strlen($encodedPayload) > MeshSyncContract::limit('record_payload_bytes')) {
                return ['error' => 'payload_too_large'];
            }
            $searchText = mb_substr((string) ($raw['search_text'] ?? ''), 0, MeshSyncContract::limit('search_text_chars'));
        }
        $hash = $fromPeer && preg_match(self::HASH_PATTERN, (string) ($raw['content_hash'] ?? '')) === 1
            ? (string) $raw['content_hash']
            : hash('sha256', json_encode([$deleted, $deleted ? null : $payload, $searchText], self::JSON_FLAGS));

        return [
            'stream' => $stream,
            'record_key' => $key,
            'origin' => $recordOrigin,
            'version' => (int) $version,
            'content_hash' => $hash,
            'deleted' => $deleted,
            'payload' => $encodedPayload,
            'search_text' => $deleted ? null : $searchText,
        ];
    }

    /** @return array{accepted: int, unchanged: int} */
    private function write(array $records, string $receivedFrom): array
    {
        $connection = $this->connection();

        return $connection->transaction(function () use ($connection, $records, $receivedFrom): array {
            $accepted = 0;
            $unchanged = 0;
            $existing = null;
            $now = now();
            $seq = 0;

            $connection->select('SELECT pg_advisory_xact_lock(?)', [self::SEQ_LOCK_KEY]);
            $seq = (int) $this->table()->max('seq');
            foreach ($records as $record) {
                $existing = $this->table()
                    ->where('stream', $record['stream'])
                    ->where('record_key', $record['record_key'])
                    ->first(['version', 'content_hash']);
                if ($existing !== null && !$this->wins($record, $existing)) {
                    $unchanged++;
                    continue;
                }
                $seq++;
                $values = array_merge($record, ['seq' => $seq, 'received_from' => $receivedFrom, 'updated_at' => $now]);
                if ($existing === null) {
                    $this->table()->insert(array_merge($values, ['created_at' => $now]));
                } else {
                    $this->table()
                        ->where('stream', $record['stream'])
                        ->where('record_key', $record['record_key'])
                        ->update($values);
                }
                $accepted++;
            }

            return ['accepted' => $accepted, 'unchanged' => $unchanged];
        });
    }

    private function wins(array $record, object $existing): bool
    {
        if ($record['version'] !== (int) $existing->version) {
            return $record['version'] > (int) $existing->version;
        }

        return strcmp($record['content_hash'], (string) $existing->content_hash) > 0;
    }

    private function present(object $row, bool $withReplicationFields): array
    {
        $record = [
            'stream' => (string) $row->stream,
            'key' => (string) $row->record_key,
            'origin' => (string) $row->origin,
            'version' => (int) $row->version,
            'deleted' => (bool) $row->deleted,
            'payload' => $row->payload === null ? null : json_decode((string) $row->payload, true),
            'updated_at' => $row->updated_at,
        ];

        if ($withReplicationFields) {
            $record['seq'] = (int) $row->seq;
            $record['content_hash'] = (string) $row->content_hash;
            $record['search_text'] = $row->search_text;
        }

        return $record;
    }

    private function table(): Builder
    {
        return $this->connection()->table(MeshSyncTablesMaps::getTableName('RECORDS'));
    }

    private function connection(): ConnectionInterface
    {
        return DB::connection(MeshSyncTablesMaps::connection());
    }
}
