<?php

namespace App\Services\DataSync;

use App\Utils\FileSystemManager;

/**
 * Session lock, cancel flag, and terminal transitions shared by driver and
 * passive sessions.
 */
final class DataSyncSessionRuntime
{
    public function __construct(
        private readonly DataSyncStateStore $store,
        private readonly DataSyncSessionLock $sessionLock
    ) {}

    /**
     * Runs the callback while holding the session's OS file lock. A pending
     * cancel is applied first; a held lock raises a retryable busy error.
     */
    public function withLock(string $id, callable $callback): mixed
    {
        $result = $this->sessionLock->run($id, function () use ($id, $callback): mixed {
            if ($this->cancelRequested($id)) {
                $job = $this->store->get($id);
                if ($job !== null && $this->isActive($job)) {
                    $this->finish($job, 'cancelled', DataSyncProtocol::CANCELLED_MESSAGE);
                }
                throw new DataSyncAbortException();
            }
            return $callback();
        });

        if (!$result['acquired']) {
            throw new DataSyncBusyException();
        }

        return $result['result'];
    }

    /**
     * @return array{acquired: bool, result: mixed}
     */
    public function tryLock(string $id, callable $callback): array
    {
        return $this->sessionLock->run($id, $callback);
    }

    public function requestCancel(string $id): void
    {
        FileSystemManager::writeFile(
            $this->store->lockPath($id, 'cancel'),
            (string) json_encode(['requested_at' => now()->toIso8601String()])
        );
    }

    public function cancelRequested(string $id): bool
    {
        return FileSystemManager::isFile($this->store->lockPath($id, 'cancel'));
    }

    public function abortHook(string $id): callable
    {
        return function () use ($id): void {
            if ($this->cancelRequested($id)) {
                throw new DataSyncAbortException();
            }
        };
    }

    public function isActive(array $job): bool
    {
        return in_array($job['status'] ?? null, DataSyncProtocol::ACTIVE_STATUSES, true);
    }

    /**
     * Moves a session into a terminal status; the running step records the
     * reason and every untouched step stays pending.
     */
    public function finish(array $job, string $status, ?string $error = null): array
    {
        $index = (int) ($job['current_step'] ?? 0);

        if ($status !== 'completed' && isset($job['steps'][$index])) {
            $job['steps'][$index]['status'] = 'failed';
            $job['steps'][$index]['detail'] = $error;
        }
        $job['status'] = $status;
        $job['error'] = $status === 'completed' ? null : $error;
        $job['completed_at'] = now()->toIso8601String();

        return $this->store->save($job);
    }
}
