<?php

namespace App\Services\DataSync;

use App\Providers\PathMapper;
use App\Services\Dashboard\DatabaseManagerService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Context;

/**
 * Passive session roles answering a remote driver: a receiver accepts pushed
 * data (push mode), an exporter serves data to a fetcher (pull mode). All
 * slow preparation (inventory, backups, manifests) runs in this node's own
 * timer ticks; peer requests only read prepared artifacts or apply chunks.
 */
final class DataSyncPassiveService
{
    public function __construct(
        private readonly DataSyncStateStore $store,
        private readonly DataSyncArtifactStore $artifacts,
        private readonly DataSyncSessionRuntime $runtime,
        private readonly DatabaseSyncService $databases,
        private readonly ResourceSyncService $resources,
        private readonly DataSyncTopologyGuard $topology
    ) {}

    public function prepare(string $role, string $driverJobId, string $prepareToken, array $options, ?string $driverAddress): array
    {
        $driverKey = $role === 'receiver' ? 'source_job_id' : 'fetcher_job_id';

        return $this->topology->run(function () use ($role, $driverKey, $driverJobId, $prepareToken, $options, $driverAddress): array {
            foreach ($this->store->activeAll(DataSyncProtocol::PASSIVE_ROLES) as $active) {
                if ($active['role'] === $role && ($active['context'][$driverKey] ?? null) === $driverJobId) {
                    if (!hash_equals((string) ($active['context']['prepare_token_hash'] ?? ''), hash('sha256', $prepareToken))) {
                        throw new \RuntimeException('Invalid synchronization preparation token.');
                    }
                    return $this->handshake($active);
                }
                if ($this->store->secondsSinceActivity($active) < DataSyncProtocol::PASSIVE_SUPERSEDE_SECONDS) {
                    throw new \RuntimeException('This node is serving another synchronization session.');
                }
                $this->runtime->finish($active, 'cancelled', 'Superseded by a new synchronization session.');
            }
            $this->assertNoConflictingLocalSession($role);

            $job = $this->store->create($role, [
                'target_input' => $driverAddress,
                'target' => null,
                'options' => [
                    'databases' => (bool) ($options['databases'] ?? true),
                    'resources' => (bool) ($options['resources'] ?? true),
                    'compression' => (bool) ($options['compression'] ?? false),
                ],
                'context' => [
                    $driverKey => $driverJobId,
                    'prepare_token_hash' => hash('sha256', $prepareToken),
                    'token' => bin2hex(random_bytes(32)),
                    'ready' => false,
                    'finalized' => false,
                    'backups' => [],
                    'received' => ['database_rows' => 0, 'resource_bytes' => 0, 'resource_files' => 0],
                ],
            ]);

            return $this->handshake($job);
        });
    }

    public function status(string $id, string $token): array
    {
        return $this->store->summary($this->requireSession($id, $token));
    }

    public function databaseInventory(string $id, string $token): array
    {
        $this->requireReady($id, $token);
        return ['databases' => $this->artifacts->require($id, 'inventory')];
    }

    public function databaseCounts(string $id, string $token): array
    {
        $this->requireReady($id, $token, 'receiver');
        return ['counts' => $this->databases->rowCounts()];
    }

    public function resourceManifest(string $id, string $token, string $key, bool $fresh): array
    {
        $this->requireReady($id, $token);
        $this->resources->root($key);
        if ($fresh) {
            return $this->resources->manifest($key);
        }
        return ['key' => $key, 'files' => $this->artifacts->require($id, "manifest-{$key}")];
    }

    public function exportDatabaseChunk(string $id, string $token, string $connection, string $table, int $offset): array
    {
        $this->requireReady($id, $token, 'exporter');
        return $this->databases->readChunk($connection, $table, $offset);
    }

    public function exportFileChunk(string $id, string $token, string $key, string $relativePath, int $offset): array
    {
        $this->requireReady($id, $token, 'exporter');
        return $this->resources->readFileChunk($key, $relativePath, $offset);
    }

    public function exportFileBatch(string $id, string $token, array $items): array
    {
        $this->requireReady($id, $token, 'exporter');
        return $this->resources->readFileBatch($items);
    }

    public function exportArchive(string $id, string $token, string $key, array $relativePaths): array
    {
        return $this->runtime->withLock($id, function () use ($id, $token, $key, $relativePaths): array {
            $job = $this->requireReady($id, $token, 'exporter');
            if (empty($job['options']['compression'])) {
                throw new \RuntimeException('This exporter session does not serve compressed archives.');
            }
            $existing = $job['context']['archives'][$key] ?? null;
            if (is_array($existing)) {
                return $existing;
            }
            $archive = $this->resources->createArchive($id, $key, $relativePaths);
            $job['context']['archives'][$key] = $archive;
            $this->store->save($job);
            return $archive;
        });
    }

    public function exportArchiveChunk(string $id, string $token, string $key, int $offset): array
    {
        $job = $this->requireReady($id, $token, 'exporter');
        if (!isset($job['context']['archives'][$key])) {
            throw new \RuntimeException("The exported resource archive has not been prepared: {$key}");
        }
        return $this->resources->readArchiveChunk($id, $key, $offset) + ['sha256' => $job['context']['archives'][$key]['sha256']];
    }

    /**
     * Applies one pushed row chunk. A table-level database error is reported
     * to the driver (which skips the table) instead of failing the session.
     */
    public function receiveDatabaseChunk(string $id, string $token, string $connection, string $table, array $rows): array
    {
        return $this->runtime->withLock($id, function () use ($id, $token, $connection, $table, $rows): array {
            $job = $this->requireReady($id, $token, 'receiver');
            try {
                $result = $this->databases->applyDiff($connection, $table, $rows);
            } catch (QueryException|\InvalidArgumentException $exception) {
                return ['success' => false, 'table_error' => $exception->getMessage()];
            }
            $job['context']['received']['database_rows'] += count($rows);
            $job = $this->markRunning($job, ['receive_database_chunks', 'apply_database_differences'], "{$connection}.{$table}");
            $this->store->save($job);
            return ['success' => true] + $result;
        });
    }

    public function advanceSequence(string $id, string $token, string $connection, string $table): array
    {
        $this->requireReady($id, $token, 'receiver');
        $this->databases->advanceSequence($connection, $table);
        return ['success' => true];
    }

    public function completeDatabaseTransfer(string $id, string $token): array
    {
        return $this->runtime->withLock($id, function () use ($id, $token): array {
            $job = $this->requireReady($id, $token, 'receiver');
            foreach (['receive_database_chunks', 'apply_database_differences'] as $key) {
                $job = $this->setStep($job, $key, !empty($job['options']['databases']) ? 'completed' : 'skipped');
            }
            $this->store->save($job);
            return ['success' => true];
        });
    }

    public function receiveFileBatch(string $id, string $token, array $files): array
    {
        return $this->runtime->withLock($id, function () use ($id, $token, $files): array {
            $job = $this->requireReady($id, $token, 'receiver');
            $results = [];

            foreach ($files as $file) {
                $key = (string) ($file['key'] ?? '');
                $relativePath = (string) ($file['relative_path'] ?? '');
                $content = base64_decode((string) ($file['content'] ?? ''), true);
                if ($content === false) {
                    throw new \InvalidArgumentException('Resource file content is not valid base64.');
                }
                try {
                    $result = $this->resources->commitWholeFile($id, $key, $relativePath, $content, (string) ($file['sha256'] ?? ''));
                } catch (DataSyncHashMismatchException) {
                    $results[] = ['relative_path' => $relativePath, 'hash_mismatch' => true];
                    continue;
                }
                $job = $this->countFile($job, "file:{$key}:{$relativePath}:" . ($file['sha256'] ?? ''), 1, $result['bytes']);
                $results[] = ['relative_path' => $relativePath, 'already_present' => $result['already_present']];
            }
            $job = $this->markRunning($job, ['receive_resource_chunks', 'verify_resource_payloads', 'apply_resource_payloads'], (string) (end($files)['relative_path'] ?? ''));
            $this->store->save($job);
            return ['success' => true, 'files' => $results];
        });
    }

    public function receiveFileChunk(
        string $id,
        string $token,
        string $key,
        string $relativePath,
        int $offset,
        string $content,
        string $hash,
        bool $final
    ): array {
        return $this->runtime->withLock($id, function () use ($id, $token, $key, $relativePath, $offset, $content, $hash, $final): array {
            $job = $this->requireReady($id, $token, 'receiver');
            try {
                $result = $this->resources->receiveFileChunk($id, $key, $relativePath, $offset, $content, $hash, $final);
            } catch (DataSyncHashMismatchException) {
                return ['success' => false, 'hash_mismatch' => true, 'complete' => false, 'offset' => 0];
            }
            if (!empty($result['success']) && empty($result['already_present'])) {
                $job['context']['received']['resource_bytes'] += strlen($content);
            }
            if (!empty($result['complete'])) {
                $job = $this->countFile($job, "file:{$key}:{$relativePath}:{$hash}", 1, 0);
            }
            $job = $this->markRunning($job, ['receive_resource_chunks'], $relativePath);
            $this->store->save($job);
            return $result;
        });
    }

    public function receiveArchiveChunk(string $id, string $token, string $key, int $offset, string $content, string $hash, bool $final): array
    {
        return $this->runtime->withLock($id, function () use ($id, $token, $key, $offset, $content, $hash, $final): array {
            $job = $this->requireReady($id, $token, 'receiver');
            try {
                $result = $this->resources->receiveArchiveChunk($id, $key, $offset, $content, $hash, $final);
            } catch (DataSyncHashMismatchException) {
                return ['success' => false, 'hash_mismatch' => true, 'complete' => false, 'offset' => 0];
            }
            if (!empty($result['success'])) {
                $job['context']['received']['resource_bytes'] += strlen($content);
            }
            if (!empty($result['complete'])) {
                $job = $this->countFile($job, "archive:{$key}:{$hash}", (int) ($result['files'] ?? 0), 0);
            }
            $job = $this->markRunning($job, ['receive_resource_chunks'], $key);
            $this->store->save($job);
            return $result;
        });
    }

    public function finalize(string $id, string $token): array
    {
        return $this->runtime->withLock($id, function () use ($id, $token): array {
            $job = $this->requireSession($id, $token);
            if ($job['status'] === 'completed') {
                return ['success' => true];
            }
            if (!$this->runtime->isActive($job)) {
                throw new \RuntimeException((string) ($job['error'] ?? 'The synchronization session has ended.'));
            }
            $job['context']['finalized'] = true;
            $this->store->save($job);
            return ['success' => true];
        });
    }

    /**
     * Driver-initiated cancel. Applied immediately when the lock is free;
     * otherwise the flag ends the session at the next lock boundary.
     */
    public function cancel(string $id, string $token): array
    {
        $job = $this->requireSession($id, $token);
        if (!$this->runtime->isActive($job)) {
            return ['success' => true, 'status' => $job['status']];
        }
        $this->runtime->requestCancel($id);
        $result = $this->runtime->tryLock($id, function () use ($id): ?array {
            $current = $this->store->get($id);
            return $current !== null && $this->runtime->isActive($current)
                ? $this->runtime->finish($current, 'cancelled', 'Synchronization session cancelled by the driver.')
                : $current;
        });

        return ['success' => true, 'status' => $result['acquired'] ? ($result['result']['status'] ?? 'cancelled') : 'cancelling'];
    }

    public function advance(array $job): void
    {
        $id = (string) $job['id'];

        if (($job['context']['ready'] ?? false) && !($job['context']['finalized'] ?? false) && !$this->runtime->cancelRequested($id)) {
            if ($this->store->secondsSinceActivity($job) < DataSyncProtocol::PASSIVE_IDLE_SECONDS) {
                return;
            }
        }

        Context::scope(fn (): array => $this->runtime->tryLock($id, function () use ($id): void {
            $job = $this->store->get($id);
            if ($job === null || !$this->runtime->isActive($job)) {
                return;
            }
            if ($this->runtime->cancelRequested($id)) {
                $this->runtime->finish($job, 'cancelled', DataSyncProtocol::CANCELLED_MESSAGE);
                return;
            }
            if ((int) ($job['protocol_version'] ?? 0) !== DataSyncProtocol::VERSION) {
                $this->runtime->finish($job, 'failed', 'The session protocol version is incompatible.');
                return;
            }
            if ($this->store->secondsSinceActivity($job) >= DataSyncProtocol::PASSIVE_IDLE_SECONDS) {
                $this->runtime->finish($job, 'failed', 'The synchronization driver stopped responding.');
                return;
            }
            try {
                $this->step($job);
            } catch (DataSyncAbortException) {
                $this->runtime->finish($this->store->get($id) ?? $job, 'cancelled', DataSyncProtocol::CANCELLED_MESSAGE);
            } catch (\Throwable $exception) {
                $this->runtime->finish($this->store->get($id) ?? $job, 'failed', $exception->getMessage());
            }
        }), data: ['data_sync_session_id' => $id, 'data_sync_role' => $job['role']]);
    }

    private function step(array $job): void
    {
        $id = (string) $job['id'];
        $abort = $this->runtime->abortHook($id);

        while (isset($job['steps'][$job['current_step']])) {
            $key = (string) $job['steps'][$job['current_step']]['key'];
            if (in_array($job['steps'][$job['current_step']]['status'], ['completed', 'skipped'], true)) {
                $job['current_step']++;
                continue;
            }
            $job['status'] = 'running';

            $outcome = match ($key) {
                'accept_peer_session' => 'completed',
                'discover_receiver_databases', 'discover_source_databases' => $this->prepareInventory($job, $abort),
                'backup_receiver_databases' => $this->backupNext($job),
                'record_backup_directory' => 'completed',
                'discover_resource_roots' => 'completed',
                'build_receiver_resource_manifests', 'build_source_resource_manifests' => $this->prepareManifests($job, $abort),
                'ready_for_transfer', 'ready_for_export' => 'completed',
                'finalize_receiver_session', 'finalize_export_session', 'complete' => !empty($job['context']['finalized']) ? 'completed' : 'wait',
                default => !empty($job['context']['finalized'])
                    ? ($this->scopeEnabled($job, $key) ? 'completed' : 'skipped')
                    : 'wait',
            };
            $job = $this->store->get($id) ?? $job;
            $job['status'] = 'running';

            if ($key === 'record_backup_directory') {
                $job['backup_directory'] = !empty($job['options']['databases']) ? PathMapper::getBackupDir('db-manager') : null;
            }
            if (in_array($key, ['ready_for_transfer', 'ready_for_export'], true)) {
                $job['context']['ready'] = true;
                $this->store->touchActivity($id);
            }
            if (is_array($outcome)) {
                $this->store->markCurrentStep($job, 'running', $outcome['detail']);
                return;
            }
            if ($outcome === 'wait') {
                if ($job['steps'][$job['current_step']]['status'] !== 'running') {
                    $this->store->markCurrentStep($job, 'running');
                }
                return;
            }
            if ($key === 'complete') {
                $job['steps'][$job['current_step']]['status'] = 'completed';
                $this->runtime->finish($job, 'completed');
                return;
            }
            $job = $this->store->markCurrentStep($job, $outcome);
        }
    }

    private function scopeEnabled(array $job, string $key): bool
    {
        return match (true) {
            str_contains($key, 'database') => !empty($job['options']['databases']),
            str_contains($key, 'resource') => !empty($job['options']['resources']),
            default => true,
        };
    }

    private function prepareInventory(array $job, callable $abort): string
    {
        if (empty($job['options']['databases'])) {
            return 'skipped';
        }
        $inventory = $this->databases->inventory($abort);
        $this->artifacts->put((string) $job['id'], 'inventory', $inventory);
        $job['context']['local_manifest'] = array_merge($job['context']['local_manifest'] ?? [], self::inventorySummary($inventory));
        $this->store->save($job);
        return 'completed';
    }

    private function backupNext(array $job): string|array
    {
        if (empty($job['options']['databases'])) {
            return 'skipped';
        }
        $connections = DatabaseManagerService::physicalConnections();
        $index = count($job['context']['backups'] ?? []);
        if (!isset($connections[$index])) {
            return 'completed';
        }
        $job['context']['backups'][] = DatabaseManagerService::backup((string) $connections[$index]['connection']);
        $this->store->save($job);
        return isset($connections[$index + 1])
            ? ['detail' => ($index + 1) . '/' . count($connections)]
            : 'completed';
    }

    private function prepareManifests(array $job, callable $abort): string
    {
        if (empty($job['options']['resources'])) {
            return 'skipped';
        }
        $files = 0;
        $bytes = 0;
        $roots = array_keys($this->resources->roots());
        foreach ($roots as $key) {
            $manifest = $this->resources->manifest($key, $abort)['files'];
            $this->artifacts->put((string) $job['id'], "manifest-{$key}", $manifest);
            $files += count($manifest);
            $bytes += array_sum(array_column($manifest, 'size'));
        }
        $job['context']['local_manifest'] = array_merge($job['context']['local_manifest'] ?? [], [
            'resource_roots' => count($roots),
            'resource_files' => $files,
            'resource_bytes' => $bytes,
        ]);
        $this->store->save($job);
        return 'completed';
    }

    public static function inventorySummary(array $inventory): array
    {
        $tables = 0;
        $rows = 0;

        foreach ($inventory as $database) {
            $tables += count($database['tables'] ?? []);
            foreach ($database['tables'] ?? [] as $table) {
                $rows += max(0, (int) ($table['rows'] ?? 0));
            }
        }

        return ['databases' => count($inventory), 'tables' => $tables, 'rows' => $rows];
    }

    private function countFile(array $job, string $identity, int $files, int $bytes): array
    {
        $job['context']['received']['resource_bytes'] += $bytes;
        if ($this->artifacts->recordReceipt((string) $job['id'], $identity)) {
            $job['context']['received']['resource_files'] += $files;
        }
        return $job;
    }

    private function markRunning(array $job, array $keys, string $detail): array
    {
        foreach ($keys as $key) {
            $job = $this->setStep($job, $key, 'running', $detail);
        }
        return $job;
    }

    private function setStep(array $job, string $key, string $status, ?string $detail = null): array
    {
        foreach ($job['steps'] as $index => $step) {
            if ($step['key'] === $key && !in_array($step['status'], ['completed', 'skipped'], true)) {
                $job['steps'][$index]['status'] = $status;
                $job['steps'][$index]['detail'] = $detail;
                $job['steps'][$index]['started_at'] ??= now()->toIso8601String();
                if ($status === 'completed') {
                    $job['steps'][$index]['completed_at'] = now()->toIso8601String();
                }
            }
        }
        return $job;
    }

    private function assertNoConflictingLocalSession(string $role): void
    {
        $conflicting = $role === 'receiver' ? DataSyncProtocol::DRIVER_ROLES : ['fetcher'];

        foreach ($this->store->activeAll($conflicting) as $active) {
            if (!$this->runtime->cancelRequested((string) $active['id'])) {
                throw new \RuntimeException('This node already has an active synchronization session.');
            }
        }
    }

    private function requireSession(string $id, string $token): array
    {
        $job = $this->store->get($id);
        if (
            $job === null
            || !in_array($job['role'] ?? null, DataSyncProtocol::PASSIVE_ROLES, true)
            || !hash_equals(
                (string) ($job['context']['token_hash'] ?? hash('sha256', (string) ($job['context']['token'] ?? ''))),
                hash('sha256', $token)
            )
            || $token === ''
        ) {
            throw new \InvalidArgumentException('Data synchronization session was not found.');
        }
        if ($this->runtime->isActive($job)) {
            $this->store->touchActivity($id);
        }
        return $job;
    }

    private function requireReady(string $id, string $token, ?string $role = null): array
    {
        $job = $this->requireSession($id, $token);
        if ($role !== null && $job['role'] !== $role) {
            throw new \InvalidArgumentException('Data synchronization session was not found.');
        }
        if (!$this->runtime->isActive($job)) {
            throw new \RuntimeException((string) ($job['error'] ?? 'The synchronization session has ended.'));
        }
        if (empty($job['context']['ready'])) {
            throw new DataSyncBusyException();
        }
        return $job;
    }

    private function handshake(array $job): array
    {
        return [
            'id' => $job['id'],
            'protocol_version' => (int) ($job['protocol_version'] ?? 0),
            'token' => $job['context']['token'],
            'status' => $job['status'],
            'backup_directory' => $job['backup_directory'] ?? null,
        ];
    }
}
