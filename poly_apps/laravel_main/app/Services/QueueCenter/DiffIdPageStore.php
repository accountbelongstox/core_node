<?php

namespace App\Services\QueueCenter;

use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Cache;

class DiffIdPageStore
{
    private const VERSION = 2;
    private const LOCK_SECONDS = 10;

    public function read(string $scope, int|string $page): array
    {
        $ids = Cache::get($this->key($scope, $page), []);

        return is_array($ids) ? array_values($ids) : [];
    }

    public function write(string $scope, int|string $page, array $ids): void
    {
        Cache::forever($this->key($scope, $page), array_values(array_unique($ids, SORT_REGULAR)));
    }

    public function writeTemporary(string $scope, int|string $page, array $ids): void
    {
        $ttl = max(1, (int) (QueueCenterContract::diffDelivery()['ready_ttl_seconds'] ?? 300));
        Cache::put(
            $this->key($scope, $page),
            array_values(array_unique($ids, SORT_REGULAR)),
            $ttl
        );
    }

    public function pruneConsumed(string $scope, int $consumedPage): void
    {
        $limit = max(1, (int) (QueueCenterContract::diffDelivery()['id_page_limit'] ?? 64));
        $expiredPage = $consumedPage - $limit;
        if ($expiredPage > 0) {
            Cache::forget($this->key($scope, $expiredPage));
        }
    }

    public function promote(string $scope, int|string $id): void
    {
        Cache::lock($this->key($scope, 'head') . ':lock', self::LOCK_SECONDS)->block(
            self::LOCK_SECONDS,
            function () use ($scope, $id): void {
                $limit = max(1, (int) (QueueCenterContract::diffDelivery()['id_limit'] ?? 4096));
                $ids = $this->read($scope, 'head');
                $ids = array_values(array_filter(
                    $ids,
                    static fn ($candidate): bool => (string) $candidate !== (string) $id
                ));
                array_unshift($ids, $id);
                $this->write($scope, 'head', array_slice($ids, 0, $limit));
            }
        );
    }

    private function key(string $scope, int|string $page): string
    {
        return 'queue_center:diff_pages:v' . self::VERSION . ':' . sha1($scope) . ':page:' . $page;
    }
}
