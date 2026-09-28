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
        private readonly DataSyncSessionLock $sessionLock,
        private readonly DataSyncPeerClient $peer
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
                    $this->finish($job, 'cancelled', DataSyncProtocol::cancelledMessage());
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
        return in_array($job['status'] ?? null, DataSyncProtocol::activeStatuses(), true);
    }

    /**
     * Moves a session into a terminal status; the running step records the
     * reason and every untouched step stays pending. A driver that ends
     * without completing also cancels its peer session.
     */
    public function finish(array $job, string $status, ?string $error = null): array
    {
        $index = (int) ($job['current_step'] ?? 0);
        $activeJob = $job;

        if ($status !== 'completed' && isset($job['steps'][$index])) {
            $job['steps'][$index]['status'] = 'failed';
            $job['steps'][$index]['detail'] = $error;
        }
        $job['status'] = $status;
        $job['error'] = $status === 'completed' ? null : $error;
        $job['completed_at'] = now()->toIso8601String();
        $job = $this->store->save($job);

        if ($status !== 'completed') {
            $this->cancelPeer($activeJob);
        }
        return $job;
    }

    /**
     * Token-authenticated peer cancel. It takes the job as it was before the
     * terminal save, whose compact summary drops the peer session id, base
     * path and token.
     */
    private function cancelPeer(array $job): void
    {
        if (
            !in_array($job['role'] ?? null, DataSyncProtocol::driverRoles(), true)
            || empty($job['context']['peer_session_id'])
            || empty($job['context']['peer_token'])
            || in_array($job['context']['receiver']['status'] ?? null, DataSyncProtocol::terminalStatuses(), true)
        ) {
            return;
        }
        try {
            $this->peer->call($job, 'POST', '/cancel');
        } catch (\Throwable) {
            // The passive side also ends itself once the driver stays idle.
        }
    }
}
