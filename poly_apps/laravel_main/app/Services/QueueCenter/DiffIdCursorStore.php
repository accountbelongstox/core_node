<?php

namespace App\Services\QueueCenter;

class DiffIdCursorStore
{
    private const VERSION = 2;
    private const LOCK_SECONDS = 10;

    public function read(string $scope): array
    {
        $state = QueueCenterCacheStore::get()->get($this->key($scope));

        return is_array($state) && (int) ($state['version'] ?? 0) === self::VERSION
            ? $state
            : [];
    }

    public function write(string $scope, array $state): void
    {
        $state['version'] = self::VERSION;
        QueueCenterCacheStore::get()->forever($this->key($scope), $state);
    }

    public function locked(string $scope, callable $callback): mixed
    {
        return QueueCenterCacheStore::get()->lock($this->key($scope) . ':lock', self::LOCK_SECONDS)->block(
            self::LOCK_SECONDS,
            fn () => $callback($this->read($scope))
        );
    }

    public function touch(string $scope): int
    {
        return QueueCenterCacheStore::increment($this->revisionKey($scope));
    }

    public function revision(string $scope): int
    {
        return (int) QueueCenterCacheStore::get()->get($this->revisionKey($scope), 0);
    }

    public function key(string $scope): string
    {
        return 'queue_center:diff_cursor:v' . self::VERSION . ':' . sha1($scope);
    }

    private function revisionKey(string $scope): string
    {
        return $this->key($scope) . ':head_revision';
    }
}
