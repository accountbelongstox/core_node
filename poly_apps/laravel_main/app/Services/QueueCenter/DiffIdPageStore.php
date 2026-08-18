<?php

namespace App\Services\QueueCenter;

use App\Support\QueueCenterContract;

class DiffIdPageStore
{
    private const VERSION = 2;
    private const LOCK_SECONDS = 10;

    public function read(string $scope, int|string $page): array
    {
        $ids = QueueCenterCacheStore::get()->get($this->key($scope, $page), []);

        return is_array($ids) ? array_values($ids) : [];
    }

    public function write(string $scope, int|string $page, array $ids): void
    {
        QueueCenterCacheStore::get()->forever(
            $this->key($scope, $page),
            array_values(array_unique($ids, SORT_REGULAR))
        );
    }

    public function writeTemporary(string $scope, int|string $page, array $ids): void
    {
        $ttl = max(1, (int) (QueueCenterContract::diffDelivery()['ready_ttl_seconds'] ?? 300));
        QueueCenterCacheStore::get()->put(
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
            QueueCenterCacheStore::get()->forget($this->key($scope, $expiredPage));
        }
    }

    public function promote(string $scope, int|string $id): void
    {
        $this->moveToHead($scope, $id);
    }

    public function moveToHead(string $scope, int|string $id): void
    {
        $lock = QueueCenterCacheStore::get()->lock(
            $this->key($scope, 'head') . ':lock',
            self::LOCK_SECONDS
        );
        if (!$lock->get()) {
            return;
        }
        try {
            $limit = max(1, (int) (QueueCenterContract::diffDelivery()['id_limit'] ?? 4096));
            $ids = $this->read($scope, 'head');
            $ids = array_values(array_filter(
                $ids,
                static fn ($candidate): bool => (string) $candidate !== (string) $id
            ));
            array_unshift($ids, $id);
            $this->write($scope, 'head', array_slice($ids, 0, $limit));
        } finally {
            $lock->release();
        }
    }

    private function key(string $scope, int|string $page): string
    {
        return 'queue_center:diff_pages:v' . self::VERSION . ':' . sha1($scope) . ':page:' . $page;
    }
}
