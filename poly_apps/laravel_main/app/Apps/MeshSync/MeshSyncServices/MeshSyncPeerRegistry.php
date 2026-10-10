<?php

namespace App\Apps\MeshSync\MeshSyncServices;

use App\Apps\MeshSync\MeshSyncTablesMaps\MeshSyncTablesMaps;
use App\Support\LaravelServerIdentity;
use App\Support\ServiceContract;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Other Laravel servers this one replicates from. Sources: the contract's public API domains, routes
 * pycore announces with its deliveries (each live mesh machine's `/laravel-api`), and peers learned
 * from another server's change feed (gossip). A route that turns out to be this server is kept with its
 * server id and never pulled; non-contract routes not reached for `peer_forget_days` are forgotten.
 */
final class MeshSyncPeerRegistry
{
    public const SOURCE_CONTRACT = 'contract';
    public const SOURCE_ANNOUNCED = 'announced';
    public const SOURCE_GOSSIP = 'gossip';
    private const SERVER_ID_PATTERN = '~^[A-Za-z0-9._-]{1,64}$~';
    private const URL_MAX_LENGTH = 512;
    private const PLACEHOLDER_PREFIX = '{';
    private const PLACEHOLDER_SUFFIX = '}';

    /** `scheme://host[:port][/base-path]` of a Laravel server, or '' when the value is not one. */
    public function normalizeBaseUrl(string $url): string
    {
        $parts = parse_url(trim($url));
        $scheme = '';
        $host = '';
        $port = '';
        $path = '';

        if (!is_array($parts) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
            return '';
        }
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            return '';
        }
        $port = isset($parts['port']) ? ':'.(int) $parts['port'] : '';
        $path = rtrim((string) ($parts['path'] ?? ''), '/');
        $url = $scheme.'://'.$host.$port.$path;

        return strlen($url) <= self::URL_MAX_LENGTH ? $url : '';
    }

    /** The public Laravel API of every root domain (e.g. https://api.si.12gm.com). */
    public function contractSeeds(): array
    {
        $region = ServiceContract::string('access.default_api_region_prefix');
        $labels = array_map(
            static fn (string $label): string => str_starts_with($label, self::PLACEHOLDER_PREFIX) && str_ends_with($label, self::PLACEHOLDER_SUFFIX)
                ? $region
                : $label,
            ServiceContract::stringList('access.service_domains.laravel_api')
        );

        return array_map(
            static fn (string $root): string => 'https://'.implode('.', $labels).'.'.$root,
            ServiceContract::stringList('access.root_domains')
        );
    }

    public function ensureContractSeeds(): void
    {
        $this->remember(array_map(static fn (string $url): array => ['base_url' => $url], $this->contractSeeds()), self::SOURCE_CONTRACT);
    }

    /** Record routes of other servers (`[{base_url, server_id?}]`); unknown routes are added, known ones refreshed. */
    public function remember(array $peers, string $source): int
    {
        $ownId = LaravelServerIdentity::id();
        $now = now();
        $added = 0;
        $url = '';
        $serverId = '';
        $existing = null;

        foreach ($peers as $peer) {
            $url = is_array($peer) ? $this->normalizeBaseUrl((string) ($peer['base_url'] ?? '')) : '';
            $serverId = is_array($peer) ? (string) ($peer['server_id'] ?? '') : '';
            if ($url === '') {
                continue;
            }
            if (preg_match(self::SERVER_ID_PATTERN, $serverId) !== 1) {
                $serverId = '';
            }
            $existing = $this->table()->where('base_url', $url)->first(['id', 'server_id']);
            if ($existing === null) {
                $added += $this->table()->insertOrIgnore([
                    'base_url' => $url,
                    'server_id' => $serverId !== '' ? $serverId : null,
                    'source' => $source,
                    'cursor' => 0,
                    'failures' => 0,
                    'seen_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                continue;
            }
            $this->table()->where('id', $existing->id)->update(array_merge(
                ['seen_at' => $now, 'updated_at' => $now],
                $existing->server_id === null && $serverId !== '' && $serverId !== $ownId ? ['server_id' => $serverId] : []
            ));
        }

        return $added;
    }

    /** Peers to pull now: not this server, not backing off; least recently synced first. */
    public function due(int $limit): array
    {
        return $this->table()
            ->where(static function (Builder $query): void {
                $query->whereNull('server_id')->orWhere('server_id', '!=', LaravelServerIdentity::id());
            })
            ->where(static function (Builder $query): void {
                $query->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now());
            })
            ->orderByRaw('last_success_at ASC NULLS FIRST')
            ->limit($limit)
            ->get()
            ->all();
    }

    public function markSelf(int $peerId): void
    {
        $this->table()->where('id', $peerId)->update([
            'server_id' => LaravelServerIdentity::id(),
            'failures' => 0,
            'last_error' => null,
            'next_attempt_at' => null,
            'updated_at' => now(),
        ]);
    }

    public function markSuccess(int $peerId, string $serverId, int $cursor): void
    {
        $now = now();

        $this->table()->where('id', $peerId)->update([
            'server_id' => $serverId !== '' ? $serverId : null,
            'cursor' => $cursor,
            'cursor_server_id' => $serverId !== '' ? $serverId : null,
            'failures' => 0,
            'last_error' => null,
            'next_attempt_at' => null,
            'last_success_at' => $now,
            'updated_at' => $now,
        ]);
    }

    /** Exponential backoff from the replication interval up to `peer_retry_max_seconds`. */
    public function markFailure(object $peer, string $error): void
    {
        $failures = (int) $peer->failures + 1;
        $delay = min(
            MeshSyncContract::limit('peer_retry_max_seconds'),
            MeshSyncContract::limit('replicate_interval_seconds') * (2 ** min($failures, 16))
        );

        $this->table()->where('id', $peer->id)->update([
            'failures' => $failures,
            'last_error' => mb_substr($error, 0, 2000),
            'next_attempt_at' => now()->addSeconds($delay),
            'updated_at' => now(),
        ]);
    }

    public function forgetStale(): int
    {
        $cutoff = now()->subDays(MeshSyncContract::limit('peer_forget_days'));

        return $this->table()
            ->where('source', '!=', self::SOURCE_CONTRACT)
            ->whereRaw('COALESCE(last_success_at, created_at) < ?', [$cutoff])
            ->delete();
    }

    /** Reached peers passed on to the servers that pull from this one (gossip). */
    public function gossip(): array
    {
        return $this->table()
            ->whereNotNull('last_success_at')
            ->where('server_id', '!=', LaravelServerIdentity::id())
            ->orderBy('base_url')
            ->get(['base_url', 'server_id'])
            ->map(static fn (object $row): array => ['base_url' => (string) $row->base_url, 'server_id' => (string) $row->server_id])
            ->all();
    }

    public function all(): array
    {
        $ownId = LaravelServerIdentity::id();

        return $this->table()->orderBy('base_url')->get()->map(static fn (object $row): array => [
            'base_url' => (string) $row->base_url,
            'server_id' => $row->server_id,
            'self' => $row->server_id === $ownId,
            'source' => (string) $row->source,
            'cursor' => (int) $row->cursor,
            'failures' => (int) $row->failures,
            'last_success_at' => $row->last_success_at,
            'next_attempt_at' => $row->next_attempt_at,
            'last_error' => $row->last_error,
            'seen_at' => $row->seen_at,
        ])->all();
    }

    private function table(): Builder
    {
        return DB::connection(MeshSyncTablesMaps::connection())->table(MeshSyncTablesMaps::getTableName('PEERS'));
    }
}
