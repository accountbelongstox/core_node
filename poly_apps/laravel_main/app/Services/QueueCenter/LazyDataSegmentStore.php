<?php

namespace App\Services\QueueCenter;

use App\Support\QueueCenterContract;

class LazyDataSegmentStore
{
    private const VERSION = 1;
    public function materialize(
        string $scope,
        int|string $segment,
        array $ids,
        callable $loader
    ): array {
        if ($ids === []) {
            return [];
        }

        $key = $this->key($scope, $segment);
        $stored = QueueCenterCacheStore::get()->get($key);
        if (is_array($stored) && ($stored['state'] ?? '') === 'ready') {
            return is_array($stored['rows'] ?? null) ? $stored['rows'] : [];
        }

        $rows = $loader($ids);
        $rows = is_array($rows) ? array_values($rows) : [];
        QueueCenterCacheStore::get()->put($key, [
            'version' => self::VERSION,
            'state' => 'ready',
            'ids' => array_values($ids),
            'rows' => $rows,
            'materialized_at' => now()->toIso8601String(),
        ], $this->ttl('ready_ttl_seconds', 300));

        return $rows;
    }

    public function consume(string $scope, int|string $segment, array $ids): void
    {
        QueueCenterCacheStore::get()->put($this->key($scope, $segment), [
            'version' => self::VERSION,
            'state' => 'consumed',
            'ids' => array_values($ids),
            'count' => count($ids),
            'consumed_at' => now()->toIso8601String(),
        ], $this->ttl('consumed_ttl_seconds', 86400));
    }

    public function forget(string $scope, int|string $segment): void
    {
        QueueCenterCacheStore::get()->forget($this->key($scope, $segment));
    }

    private function key(string $scope, int|string $segment): string
    {
        return 'queue_center:data_segments:v' . self::VERSION . ':' . sha1($scope) . ':' . $segment;
    }

    private function ttl(string $name, int $default): int
    {
        return max(1, (int) (QueueCenterContract::diffDelivery()[$name] ?? $default));
    }
}
