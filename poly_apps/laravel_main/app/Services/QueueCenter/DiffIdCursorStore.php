<?php

namespace App\Services\QueueCenter;

use Illuminate\Support\Facades\Cache;

class DiffIdCursorStore
{
    private const VERSION = 2;
    private const LOCK_SECONDS = 10;

    public function read(string $scope): array
    {
        $state = Cache::get($this->key($scope));

        return is_array($state) && (int) ($state['version'] ?? 0) === self::VERSION
            ? $state
            : [];
    }

    public function write(string $scope, array $state): void
    {
        $state['version'] = self::VERSION;
        Cache::forever($this->key($scope), $state);
    }

    public function locked(string $scope, callable $callback): mixed
    {
        return Cache::lock($this->key($scope) . ':lock', self::LOCK_SECONDS)->block(
            self::LOCK_SECONDS,
            fn () => $callback($this->read($scope))
        );
    }

    public function touch(string $scope, int|string $id): array
    {
        return $this->locked($scope, function (array $state) use ($scope, $id): array {
            $state['revision'] = (int) ($state['revision'] ?? 0) + 1;
            $state['head_id'] = (string) $id;
            $state['touched_at'] = now()->toIso8601String();
            $this->write($scope, $state);

            return $state;
        });
    }

    public function key(string $scope): string
    {
        return 'queue_center:diff_cursor:v' . self::VERSION . ':' . sha1($scope);
    }
}
