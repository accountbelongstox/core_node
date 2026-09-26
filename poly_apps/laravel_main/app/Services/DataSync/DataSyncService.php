<?php

namespace App\Services\DataSync;

use App\Utils\SystemArchiveManager;

/**
 * Operator-facing machine data synchronization. One node runs at most one
 * active session: starting a session cancels every other active local
 * session, and each session performs exactly one run.
 */
final class DataSyncService
{
    public function __construct(
        private readonly DataSyncStateStore $store,
        private readonly DataSyncSessionRuntime $runtime,
        private readonly DataSyncDriverService $driver,
        private readonly DataSyncPassiveService $passive,
        private readonly DataSyncPeerClient $peer,
        private readonly DataSyncTopologyGuard $topology,
        private readonly DataSyncMachineIdentity $machine
    ) {}

    /** Push mode: this node sends its data to the target receiver. */
    public function start(string $target, bool $syncDatabases, bool $syncResources, bool $compression): array
    {
        $targetInput = trim($target);
        $normalizedTarget = $targetInput !== '' ? $this->peer->normalizeAddress($targetInput) : null;

        return $this->createDriver('source', $targetInput, $normalizedTarget, $syncDatabases, $syncResources, $compression);
    }

    /** Pull mode: this node downloads the target exporter's data. */
    public function startFetch(string $target, bool $syncDatabases, bool $syncResources, bool $compression): array
    {
        $targetInput = trim($target);
        if ($targetInput === '') {
            throw new \InvalidArgumentException('A fetch synchronization target is required.');
        }

        return $this->createDriver('fetcher', $targetInput, $this->peer->normalizeAddress($targetInput), $syncDatabases, $syncResources, $compression);
    }

    public function probeTarget(string $target): array
    {
        $normalizedTarget = $this->peer->normalizeAddress(trim($target));
        $probe = ['target' => $normalizedTarget] + $this->peer->healthProbe($normalizedTarget);
        $peerMachineCode = (string) ($probe['health']['machine_code'] ?? '');

        $probe['machine_code'] = $this->machine->code();
        $probe['peer_machine_code'] = $peerMachineCode !== '' ? $peerMachineCode : null;
        $probe['same_machine'] = $peerMachineCode !== '' ? hash_equals($this->machine->code(), $peerMachineCode) : null;
        $probe['protocol_compatible'] = (int) ($probe['health']['protocol_version'] ?? 0) === DataSyncProtocol::VERSION;

        return $probe;
    }

    public function setTarget(string $id, string $target): array
    {
        $targetInput = trim($target);
        $normalizedTarget = $this->peer->normalizeAddress($targetInput);

        return $this->runtime->withLock($id, function () use ($id, $targetInput, $normalizedTarget): array {
            $job = $this->requireDriver($id);
            if (!$this->runtime->isActive($job)) {
                throw new \RuntimeException('A finished synchronization session cannot accept a target.');
            }
            if (!empty($job['context']['peer_session_id'])) {
                throw new \RuntimeException('The synchronization target cannot change after the peer session was prepared.');
            }
            $job['target_input'] = $targetInput;
            $job['target'] = $normalizedTarget;
            $job['context']['awaiting_target'] = false;
            return $this->publicJob($this->store->save($job));
        });
    }

    public function list(): array
    {
        $this->store->pruneTerminal();
        return array_map([$this, 'publicJob'], $this->store->listSummaries());
    }

    public function get(string $id): ?array
    {
        $job = $this->store->get($id);
        return $job !== null ? $this->publicJob($job) : null;
    }

    public function pause(string $id): array
    {
        return $this->runtime->withLock($id, function () use ($id): array {
            $job = $this->requireDriver($id);
            if (!in_array($job['status'], ['queued', 'running'], true)) {
                return $this->publicJob($job);
            }
            $job['status'] = 'paused';
            return $this->publicJob($this->store->save($job));
        });
    }

    public function resume(string $id): array
    {
        return $this->runtime->withLock($id, function () use ($id): array {
            $job = $this->requireDriver($id);
            if ($job['status'] !== 'paused') {
                return $this->publicJob($job);
            }
            $job['status'] = 'running';
            return $this->publicJob($this->store->save($job));
        });
    }

    /**
     * Cancels any local session. Driver cancels propagate to the peer
     * session; a passive session cancelled here makes its driver fail on
     * its next status check.
     */
    public function cancel(string $id): array
    {
        $job = $this->store->get($id) ?? throw new \InvalidArgumentException('Data synchronization session was not found.');
        if (!$this->runtime->isActive($job)) {
            return $this->publicJob($job);
        }
        if (in_array($job['role'], DataSyncProtocol::DRIVER_ROLES, true)) {
            return $this->publicJob($this->driver->cancel($job));
        }
        $this->runtime->requestCancel($id);
        $result = $this->runtime->tryLock($id, function () use ($id): ?array {
            $current = $this->store->get($id);
            return $current !== null && $this->runtime->isActive($current)
                ? $this->runtime->finish($current, 'cancelled', DataSyncProtocol::CANCELLED_MESSAGE)
                : $current;
        });
        $job = $result['acquired'] ? ($result['result'] ?? $job) : $job;
        $job['context']['cancel_requested'] = !$result['acquired'] ? true : null;
        return $this->publicJob($job);
    }

    public function machineCode(): string
    {
        return $this->machine->code();
    }

    public function health(): array
    {
        return [
            'service' => 'laravel-main-data-sync',
            'protocol_version' => DataSyncProtocol::VERSION,
            'compression_available' => SystemArchiveManager::available(),
            'default_port' => DataSyncProtocol::DEFAULT_PORT,
            'machine_code' => $this->machine->code(),
        ];
    }

    /**
     * Timer entry point: passive sessions prepare and expire, driver sessions
     * advance within their time budget, and sessions left over from another
     * protocol version are closed.
     */
    public function advance(): void
    {
        foreach ($this->store->activeAll(DataSyncProtocol::ROLES) as $job) {
            if ((int) ($job['protocol_version'] ?? 0) !== DataSyncProtocol::VERSION) {
                $this->runtime->tryLock((string) $job['id'], fn (): array => $this->runtime->finish(
                    $job,
                    'failed',
                    'The session was created by another protocol version.'
                ));
                continue;
            }
            if (in_array($job['role'], DataSyncProtocol::PASSIVE_ROLES, true)) {
                $this->passive->advance($job);
            } else {
                $this->driver->advance((string) $job['id']);
            }
        }
    }

    private function createDriver(
        string $role,
        string $targetInput,
        ?string $normalizedTarget,
        bool $syncDatabases,
        bool $syncResources,
        bool $compression
    ): array {
        if (!$syncDatabases && !$syncResources) {
            throw new \InvalidArgumentException('At least one synchronization scope must be enabled.');
        }

        return $this->topology->run(function () use ($role, $targetInput, $normalizedTarget, $syncDatabases, $syncResources, $compression): array {
            $cancelled = [];
            foreach ($this->store->activeAll(DataSyncProtocol::ROLES) as $active) {
                $this->cancel((string) $active['id']);
                $cancelled[] = (string) $active['id'];
            }

            $job = $this->store->create($role, [
                'target_input' => $targetInput,
                'target' => $normalizedTarget,
                'options' => [
                    'databases' => $syncDatabases,
                    'resources' => $syncResources,
                    'compression' => $syncResources && $compression,
                ],
                'context' => [
                    'backups' => [],
                    'received' => ['database_rows' => 0, 'resource_bytes' => 0, 'resource_files' => 0],
                ],
            ]);

            return $this->publicJob($job) + ['cancelled_sessions' => $cancelled];
        });
    }

    private function requireDriver(string $id): array
    {
        $job = $this->store->get($id);
        if ($job === null || !in_array($job['role'] ?? null, DataSyncProtocol::DRIVER_ROLES, true)) {
            throw new \InvalidArgumentException('Data synchronization session was not found.');
        }
        return $job;
    }

    private function publicJob(array $job): array
    {
        $job = $this->store->summary($job);
        unset($job['context']['peer_token'], $job['context']['token'], $job['context']['prepare_token']);
        return $job;
    }
}
