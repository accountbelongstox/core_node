<?php

namespace App\Services\DataSync;

use App\Services\Dashboard\DatabaseManagerService;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use App\Utils\SystemArchiveManager;
use Illuminate\Support\Facades\Context;

final class DataSyncService
{
    public function __construct(
        private readonly DataSyncStateStore $store,
        private readonly DatabaseSyncService $databases,
        private readonly ResourceSyncService $resources,
        private readonly DataSyncSessionLock $sessionLock,
        private readonly DataSyncTransferPlanStore $plans,
        private readonly DataSyncReceiptStore $receipts,
        private readonly DataSyncPeerClient $peer,
        private readonly DataSyncTopologyGuard $topology
    ) {}

    public function start(string $target, bool $syncDatabases, bool $syncResources, bool $compression): array
    {
        $targetInput = trim($target);
        $normalizedTarget = $targetInput !== '' ? $this->peer->normalizeAddress($targetInput) : null;

        if (!$syncDatabases && !$syncResources) {
            throw new \InvalidArgumentException('At least one synchronization scope must be enabled.');
        }

        $this->assertNotSelfTarget($normalizedTarget);

        return $this->topology->run(function () use (
            $targetInput,
            $normalizedTarget,
            $syncDatabases,
            $syncResources,
            $compression
        ): array {
            $cancelled = $this->cancelOtherActiveSessions();
            $this->assertNoActiveWriter('An incoming synchronization session is active on this node.');
            $this->assertNoActiveReader();
            $this->assertSourceTargetAvailable($normalizedTarget);

            $job = $this->store->create('source', [
                'target_input' => $targetInput,
                'target' => $normalizedTarget,
                'options' => [
                    'databases' => $syncDatabases,
                    'resources' => $syncResources,
                    'compression' => $syncResources && $compression,
                ],
                'context' => [
                    'prepare_token' => bin2hex(random_bytes(32)),
                ],
            ]);

            $result = $this->publicJob($job);
            $result['cancelled_sessions'] = $cancelled;
            return $result;
        });
    }

    /**
     * Reachability probe used by the dashboard to negotiate the transfer
     * direction between two authenticated nodes. The first node that the
     * other Laravel can reach becomes the externally reachable server.
     */
    public function probeTarget(string $target): array
    {
        $normalizedTarget = $this->peer->normalizeAddress(trim($target));
        // Probing a loopback/self address would always "succeed" (the node
        // probes itself) and falsely negotiate a push onto itself.
        $this->assertNotSelfTarget($normalizedTarget);

        return ['target' => $normalizedTarget] + $this->peer->healthProbe($normalizedTarget);
    }

    /**
     * Pull mode: this node (the new server) downloads packaged data from a
     * peer exporter (the old server) when the peer cannot reach this node.
     * A fetcher writes local databases and resource roots, so it follows the
     * same exclusivity rules as a receiver.
     */
    public function startFetch(string $target, bool $syncDatabases, bool $syncResources, bool $compression): array
    {
        $targetInput = trim($target);
        if ($targetInput === '') {
            throw new \InvalidArgumentException('A fetch synchronization target is required.');
        }
        $normalizedTarget = $this->peer->normalizeAddress($targetInput);

        if (!$syncDatabases && !$syncResources) {
            throw new \InvalidArgumentException('At least one synchronization scope must be enabled.');
        }

        $this->assertNotSelfTarget($normalizedTarget);

        return $this->topology->run(function () use (
            $targetInput,
            $normalizedTarget,
            $syncDatabases,
            $syncResources,
            $compression
        ): array {
            $cancelled = $this->cancelOtherActiveSessions();
            $this->assertNoActiveWriter('An incoming synchronization session is active on this node.');
            $this->assertNoActiveReader();

            $job = $this->store->create('fetcher', [
                'target_input' => $targetInput,
                'target' => $normalizedTarget,
                'options' => [
                    'databases' => $syncDatabases,
                    'resources' => $syncResources,
                    'compression' => $syncResources && $compression,
                ],
                'context' => [
                    'prepare_token' => bin2hex(random_bytes(32)),
                    'backups' => [],
                    'received' => [
                        'database_rows' => 0,
                        'resource_bytes' => 0,
                        'resource_files' => 0,
                    ],
                ],
            ]);

            $result = $this->publicJob($job);
            $result['cancelled_sessions'] = $cancelled;
            return $result;
        });
    }

    public function setTarget(string $id, string $target): array
    {
        $targetInput = trim($target);
        $normalizedTarget = $this->peer->normalizeAddress($targetInput);
        $this->assertNotSelfTarget($normalizedTarget);

        return $this->topology->run(fn (): array => $this->withSessionLock(
            $id,
            function () use ($id, $targetInput, $normalizedTarget): array {
                $job = $this->requireJob($id, 'source');
                if (in_array($job['status'], ['completed', 'failed'], true)) {
                    throw new \RuntimeException('A finished synchronization session cannot accept a target.');
                }
                if (isset($job['context']['peer_session_id'])) {
                    throw new \RuntimeException('The synchronization target cannot change after receiver preparation.');
                }

                $this->assertSourceTargetAvailable($normalizedTarget, $id);
                $job['target_input'] = $targetInput;
                $job['target'] = $normalizedTarget;
                $job['context']['awaiting_target'] = false;

                return $this->publicJob($this->store->save($job));
            }
        ));
    }

    public function list(): array
    {
        $jobs = $this->store->listSummaries();
        usort($jobs, static fn (array $left, array $right): int => strcmp(
            (string) ($right['created_at'] ?? ''),
            (string) ($left['created_at'] ?? '')
        ));
        return array_map([$this, 'publicJob'], $jobs);
    }

    public function get(string $id): ?array
    {
        $job = $this->store->get($id);
        return $job !== null ? $this->publicJob($job) : null;
    }

    public function pause(string $id): array
    {
        return $this->withSessionLock($id, function () use ($id): array {
            $job = $this->requireDriverJob($id);
            if ($job['status'] === 'paused') {
                return $this->publicJob($job);
            }
            if (in_array($job['status'], ['completed', 'failed'], true)) {
                throw new \RuntimeException('Only queued or running synchronization sessions can be paused.');
            }
            $job['status'] = 'paused';
            return $this->publicJob($this->store->save($job));
        });
    }

    public function resume(string $id): array
    {
        return $this->withSessionLock($id, function () use ($id): array {
            $job = $this->requireDriverJob($id);
            if ($job['status'] === 'running') {
                return $this->publicJob($job);
            }
            if ($job['status'] !== 'paused') {
                throw new \RuntimeException('Only paused synchronization sessions can be resumed.');
            }
            $job['status'] = 'running';
            return $this->publicJob($this->store->save($job));
        });
    }

    /**
     * Operator-initiated abort of a driver session (source/fetcher). Finished
     * sessions are already inactive; active ones leave the active set so they
     * no longer block new topologies (writer exclusivity, target conflicts).
     *
     * The scheduler may hold the session lock for a whole slow step (e.g.
     * probing a dead peer with connect-timeout retries), so the request is
     * recorded as a flag file first — a race-free signal the driver honors at
     * the next tick boundary — and then applied immediately when the lock
     * happens to be free (paused or idle sessions).
     */
    public function cancel(string $id): array
    {
        $job = $this->requireAnyJob($id);
        if (in_array($job['status'], ['completed', 'failed'], true)) {
            FileSystemManager::delete($this->cancelFlagPath($id));
            return $this->publicJob($job);
        }

        FileSystemManager::writeFile(
            $this->cancelFlagPath($id),
            (string) json_encode(['requested_at' => now()->toIso8601String()])
        );

        try {
            return $this->withSessionLock($id, fn (): array => $this->applyCancel($id));
        } catch (\RuntimeException $exception) {
            if (!in_array($exception->getMessage(), [
                'The synchronization session is busy; retry the request.',
                'The synchronization session has been cancelled.',
            ], true)) {
                throw $exception;
            }
            // Busy: the driver or the next peer call applies the recorded
            // cancel request at the next lock boundary; already-applied cancels
            // surface through the refreshed job state.
            return $this->publicJob($this->store->get($id) ?? $job);
        }
    }

    private function applyCancel(string $id): array
    {
        $job = $this->requireAnyJob($id);
        FileSystemManager::delete($this->cancelFlagPath($id));
        if (in_array($job['status'], ['completed', 'failed'], true)) {
            return $this->publicJob($job);
        }
        $job['status'] = 'failed';
        $job['error'] = 'Synchronization session cancelled by the operator.';
        $job = $this->store->markCurrentStep($job, 'failed', $job['error']);
        return $this->publicJob($job);
    }

    private function cancelRequested(string $id): bool
    {
        return FileSystemManager::isFile($this->cancelFlagPath($id));
    }

    private function cancelFlagPath(string $id): string
    {
        $safeId = DataSyncSessionId::require($id);
        return rtrim(PathMapper::getBackupDir('data-sync/locks'), '/\\')
            . DIRECTORY_SEPARATOR . $safeId . '.cancel';
    }

    /**
     * Single-active-session contract: only one synchronization may run per
     * node. Starting a new session cancels every other active session (any
     * role); busy sessions wind down at their next lock boundary via the
     * cancel flag, so the new session never blocks on them.
     *
     * @return list<string> ids of sessions a cancel was requested for
     */
    private function cancelOtherActiveSessions(?string $excludeId = null): array
    {
        $cancelled = [];
        foreach (['source', 'fetcher', 'receiver', 'exporter'] as $role) {
            try {
                $actives = $this->store->activeAll($role);
            } catch (\Throwable) {
                continue;
            }
            foreach ($actives as $active) {
                $activeId = (string) ($active['id'] ?? '');
                if ($activeId === '' || $activeId === $excludeId || $this->cancelRequested($activeId)) {
                    continue;
                }
                try {
                    $this->cancel($activeId);
                    $cancelled[] = $activeId;
                } catch (\Throwable) {
                    // A session that cannot be signalled keeps the exclusivity
                    // asserts below authoritative.
                }
            }
        }
        return $cancelled;
    }

    public function health(): array
    {
        return [
            'service' => 'laravel-main-data-sync',
            'protocol_version' => DataSyncProtocol::VERSION,
            'compression_available' => SystemArchiveManager::available(),
            'default_port' => DataSyncProtocol::DEFAULT_PORT,
        ];
    }

    public function prepareReceiver(
        string $sourceJobId,
        string $prepareToken,
        array $options,
        ?string $sourceAddress = null
    ): array
    {
        return $this->topology->run(function () use (
            $sourceJobId,
            $prepareToken,
            $options,
            $sourceAddress
        ): array {
            $active = $this->store->active('receiver');
            $token = bin2hex(random_bytes(32));

            if ($active !== null) {
                if (($active['context']['source_job_id'] ?? null) !== $sourceJobId) {
                    throw new \RuntimeException('This receiver already has an active synchronization session.');
                }
                if (!hash_equals(
                    (string) ($active['context']['prepare_token_hash'] ?? ''),
                    hash('sha256', $prepareToken)
                )) {
                    throw new \RuntimeException('Invalid receiver preparation token.');
                }
                return $this->receiverHandshake($active);
            }
            $this->assertNoActiveWriter('This node already has an active incoming synchronization session.');
            $this->assertNoActiveReader();

            $job = $this->store->create('receiver', [
                'status' => 'queued',
                'target_input' => $sourceAddress,
                'target' => null,
                'options' => [
                    'databases' => (bool) ($options['databases'] ?? true),
                    'resources' => (bool) ($options['resources'] ?? true),
                    'compression' => (bool) ($options['compression'] ?? false),
                ],
                'context' => [
                    'source_job_id' => $sourceJobId,
                    'prepare_token_hash' => hash('sha256', $prepareToken),
                    'token' => $token,
                    'ready' => false,
                    'finalized' => false,
                    'backups' => [],
                    'received' => [
                        'database_rows' => 0,
                        'resource_bytes' => 0,
                        'resource_files' => 0,
                    ],
                ],
            ]);

            return $this->receiverHandshake($job);
        });
    }

    /**
     * Pull mode counterpart of prepareReceiver: the old server opens a
     * read-only exporter session so the unreachable new server can download
     * packaged synchronization data. Exporters only read local data, so they
     * coexist with source sessions but never with a local writer.
     */
    public function prepareExporter(
        string $fetcherJobId,
        string $prepareToken,
        array $options,
        ?string $fetcherAddress = null
    ): array {
        return $this->topology->run(function () use (
            $fetcherJobId,
            $prepareToken,
            $options,
            $fetcherAddress
        ): array {
            $active = $this->store->active('exporter');
            $token = bin2hex(random_bytes(32));

            if ($active !== null) {
                if (($active['context']['fetcher_job_id'] ?? null) !== $fetcherJobId) {
                    throw new \RuntimeException('This exporter already has an active synchronization session.');
                }
                if (!hash_equals(
                    (string) ($active['context']['prepare_token_hash'] ?? ''),
                    hash('sha256', $prepareToken)
                )) {
                    throw new \RuntimeException('Invalid exporter preparation token.');
                }
                return $this->exporterHandshake($active);
            }
            $this->assertNoActiveWriter('This node already has an active incoming synchronization session.');

            $job = $this->store->create('exporter', [
                'status' => 'queued',
                'target_input' => $fetcherAddress,
                'target' => null,
                'options' => [
                    'databases' => (bool) ($options['databases'] ?? true),
                    'resources' => (bool) ($options['resources'] ?? true),
                    'compression' => (bool) ($options['compression'] ?? false),
                ],
                'context' => [
                    'fetcher_job_id' => $fetcherJobId,
                    'prepare_token_hash' => hash('sha256', $prepareToken),
                    'token' => $token,
                    'ready' => false,
                    'finalized' => false,
                    'archives' => [],
                ],
            ]);

            return $this->exporterHandshake($job);
        });
    }

    public function exporterStatus(string $id, string $token): array
    {
        return $this->publicReceiverJob($this->requireExporter($id, $token));
    }

    public function exporterDatabaseInventory(string $id, string $token): array
    {
        $this->requireReadyExporter($id, $token);
        return ['databases' => $this->databases->inventory()];
    }

    public function exporterDatabaseChunk(
        string $id,
        string $token,
        string $connection,
        string $table,
        int $offset
    ): array {
        $job = $this->requireReadyExporter($id, $token);
        $this->store->markStepByKey($job, 'serve_database_chunks', 'running', "{$connection}.{$table}");
        return $this->databases->readChunk($connection, $table, $offset);
    }

    public function exporterResourceManifest(string $id, string $token, string $key): array
    {
        $job = $this->requireReadyExporter($id, $token);
        $this->store->markStepByKey($job, 'serve_resource_chunks', 'running', $key);
        return $this->resources->manifest($key);
    }

    public function exporterResourceFileChunk(
        string $id,
        string $token,
        string $key,
        string $relativePath,
        int $offset
    ): array {
        $job = $this->requireReadyExporter($id, $token);
        $this->store->markStepByKey($job, 'serve_resource_chunks', 'running', $relativePath);
        $path = $this->resources->sourceFilePath($key, $relativePath);
        $size = FileSystemManager::filesize($path);
        if ($size === false) {
            throw new \RuntimeException("Exported resource file is missing: {$key}/{$relativePath}");
        }
        $content = FileSystemManager::readFileSegment($path, max(0, $offset), ResourceSyncService::CHUNK_BYTES);
        if ($content === false) {
            throw new \RuntimeException("Unable to read the exported resource file: {$key}/{$relativePath}");
        }
        $nextOffset = $offset + strlen($content);

        return [
            'key' => $key,
            'relative_path' => $relativePath,
            'offset' => $offset,
            'next_offset' => $nextOffset,
            'size' => $size,
            'final' => $nextOffset >= $size,
            'content' => base64_encode($content),
        ];
    }

    /**
     * Build (or reuse) the on-demand 7-Zip archive for one resource root. The
     * fetcher sends the difference list; the archive is cached per root so a
     * lost response can be retried without repacking.
     */
    public function exporterResourceArchive(string $id, string $token, string $key, array $relativePaths): array
    {
        return $this->withSessionLock($id, function () use ($id, $token, $key, $relativePaths): array {
            $job = $this->requireReadyExporter($id, $token);
            if (empty($job['options']['compression'])) {
                throw new \RuntimeException('This exporter session does not serve compressed archives.');
            }
            $existing = $job['context']['archives'][$key] ?? null;
            if (is_array($existing) && FileSystemManager::isFile((string) ($existing['path'] ?? ''))) {
                return $existing;
            }
            $archive = $this->resources->createArchive($id, $key, $relativePaths);
            $job['context']['archives'][$key] = $archive;
            $this->store->markStepByKey($job, 'serve_resource_chunks', 'running', $key);
            return $archive;
        });
    }

    public function exporterResourceArchiveChunk(
        string $id,
        string $token,
        string $key,
        int $offset
    ): array {
        $job = $this->requireReadyExporter($id, $token);
        $archive = $job['context']['archives'][$key] ?? null;
        if (!is_array($archive) || !FileSystemManager::isFile((string) ($archive['path'] ?? ''))) {
            throw new \RuntimeException("The exported resource archive has not been prepared: {$key}");
        }
        $size = (int) $archive['size'];
        $content = FileSystemManager::readFileSegment(
            (string) $archive['path'],
            max(0, $offset),
            ResourceSyncService::CHUNK_BYTES
        );
        if ($content === false) {
            throw new \RuntimeException("Unable to read the exported resource archive: {$key}");
        }
        $nextOffset = $offset + strlen($content);

        return [
            'key' => $key,
            'offset' => $offset,
            'next_offset' => $nextOffset,
            'size' => $size,
            'sha256' => (string) $archive['sha256'],
            'final' => $nextOffset >= $size,
            'content' => base64_encode($content),
        ];
    }

    public function finalizeExporter(string $id, string $token): array
    {
        return $this->withSessionLock($id, function () use ($id, $token): array {
            $job = $this->requireExporter($id, $token);
            if ($job['status'] === 'completed') {
                return ['success' => true];
            }
            if ($job['status'] === 'failed') {
                throw new \RuntimeException((string) ($job['error'] ?? 'Exporter synchronization failed.'));
            }
            if (empty($job['context']['ready'])) {
                throw new \RuntimeException('Exporter manifest preparation is not complete.');
            }
            $databaseStatus = !empty($job['options']['databases']) ? 'completed' : 'skipped';
            $resourceStatus = !empty($job['options']['resources']) ? 'completed' : 'skipped';

            $job = $this->store->markStepByKey($job, 'serve_database_chunks', $databaseStatus);
            $job = $this->store->markStepByKey($job, 'serve_resource_chunks', $resourceStatus);
            $job['context']['finalized'] = true;
            $this->store->save($job);
            return ['success' => true];
        }, $token);
    }

    public function receiverStatus(string $id, string $token): array
    {
        return $this->publicReceiverJob($this->requireReceiver($id, $token));
    }

    public function receiverResourceManifest(string $id, string $token, string $key): array
    {
        $this->requireReadyReceiver($id, $token);
        return $this->resources->manifest($key);
    }

    public function receiverDatabaseInventory(string $id, string $token): array
    {
        $this->requireReadyReceiver($id, $token);
        return ['databases' => $this->databases->inventory()];
    }

    public function receiveDatabaseChunk(
        string $id,
        string $token,
        string $connection,
        string $table,
        array $rows
    ): array {
        return $this->withSessionLock($id, function () use ($id, $token, $connection, $table, $rows): array {
            $job = $this->requireReadyReceiver($id, $token);
            $job = $this->store->markStepByKey($job, 'receive_database_chunks', 'running', $table);
            $job = $this->store->markStepByKey($job, 'apply_database_differences', 'running', $table);
            $result = $this->databases->applyDiff($connection, $table, $rows);
            $job['context']['received']['database_rows'] += count($rows);
            $this->store->save($job);
            return $result;
        }, $token);
    }

    public function advanceReceiverSequence(string $id, string $token, string $connection, string $table): array
    {
        return $this->withSessionLock($id, function () use ($id, $token, $connection, $table): array {
            $job = $this->requireReadyReceiver($id, $token);
            $this->databases->advanceSequence($connection, $table);
            $this->store->markStepByKey($job, 'apply_database_differences', 'running', $table);
            return ['success' => true];
        }, $token);
    }

    public function completeReceiverDatabaseTransfer(string $id, string $token): array
    {
        return $this->withSessionLock($id, function () use ($id, $token): array {
            $job = $this->requireReadyReceiver($id, $token);
            $status = !empty($job['options']['databases']) ? 'completed' : 'skipped';
            $job = $this->store->markStepByKey($job, 'receive_database_chunks', $status);
            $this->store->markStepByKey($job, 'apply_database_differences', $status);
            return ['success' => true];
        }, $token);
    }

    public function receiveResourceChunk(
        string $id,
        string $token,
        string $key,
        int $offset,
        string $content,
        string $hash,
        bool $final
    ): array {
        return $this->withSessionLock($id, function () use (
            $id,
            $token,
            $key,
            $offset,
            $content,
            $hash,
            $final
        ): array {
            $job = $this->requireReadyReceiver($id, $token);
            $job = $this->store->markStepByKey($job, 'receive_resource_chunks', 'running', $key);
            $result = $this->resources->receiveChunk($id, $key, $offset, $content, $hash, $final);
            if (!empty($result['success'])) {
                $job['context']['received']['resource_bytes'] += strlen($content);
            }
            if ($result['complete']) {
                $completionKey = 'archive:' . $key . ':' . $hash;
                if ($this->receipts->recordResource($id, $completionKey)) {
                    $job['context']['received']['resource_files'] += (int) ($result['files'] ?? 0);
                }
                $job = $this->store->markStepByKey($job, 'verify_resource_payloads', 'completed', $key);
                $job = $this->store->markStepByKey($job, 'apply_resource_payloads', 'completed', $key);
            }
            $this->store->save($job);
            return $result;
        }, $token);
    }

    public function receiveResourceFileChunk(
        string $id,
        string $token,
        string $key,
        string $relativePath,
        int $offset,
        string $content,
        string $hash,
        bool $final
    ): array {
        return $this->withSessionLock($id, function () use (
            $id,
            $token,
            $key,
            $relativePath,
            $offset,
            $content,
            $hash,
            $final
        ): array {
            $job = $this->requireReadyReceiver($id, $token);
            $job = $this->store->markStepByKey($job, 'receive_resource_chunks', 'running', $relativePath);
            $result = $this->resources->receiveFileChunk(
                $id,
                $key,
                $relativePath,
                $offset,
                $content,
                $hash,
                $final
            );
            if (!empty($result['success']) && empty($result['already_present'])) {
                $job['context']['received']['resource_bytes'] += strlen($content);
            }
            if ($result['complete']) {
                $completionKey = 'file:' . $key . ':' . $relativePath . ':' . $hash;
                if ($this->receipts->recordResource($id, $completionKey)) {
                    $job['context']['received']['resource_files']++;
                }
            }
            $this->store->save($job);
            return $result;
        }, $token);
    }

    public function finalizeReceiver(string $id, string $token): array
    {
        return $this->withSessionLock($id, function () use ($id, $token): array {
            $job = $this->requireReceiver($id, $token);
            if ($job['status'] === 'completed') {
                return ['success' => true];
            }
            if ($job['status'] === 'failed') {
                throw new \RuntimeException((string) ($job['error'] ?? 'Receiver synchronization failed.'));
            }
            if (empty($job['context']['ready'])) {
                throw new \RuntimeException('Receiver backup is not complete.');
            }
            $databaseStatus = !empty($job['options']['databases']) ? 'completed' : 'skipped';
            $resourceStatus = !empty($job['options']['resources']) ? 'completed' : 'skipped';

            $job = $this->store->markStepByKey($job, 'receive_database_chunks', $databaseStatus);
            $job = $this->store->markStepByKey($job, 'apply_database_differences', $databaseStatus);
            $job = $this->store->markStepByKey($job, 'receive_resource_chunks', $resourceStatus);
            $job = $this->store->markStepByKey($job, 'verify_resource_payloads', $resourceStatus);
            $job = $this->store->markStepByKey($job, 'apply_resource_payloads', $resourceStatus);
            $job = $this->store->markStepByKey($job, 'verify_received_data', 'completed');
            $job['context']['finalized'] = true;
            $this->store->save($job);
            return ['success' => true];
        }, $token);
    }

    public function advance(): void
    {
        $receiver = $this->store->active('receiver');
        $fetcher = $this->store->active('fetcher');
        $exporters = $this->store->activeAll('exporter');
        $sources = array_values(array_filter(
            $this->store->activeAll('source'),
            static fn (array $source): bool => $source['status'] !== 'paused'
        ));

        if ($receiver !== null && $receiver['status'] !== 'paused') {
            $this->advanceReceiverWithLock((string) $receiver['id']);
        }
        if ($fetcher !== null && $fetcher['status'] !== 'paused') {
            $this->advanceDriverWithLock((string) $fetcher['id']);
        }
        foreach ($exporters as $exporter) {
            if ($exporter['status'] !== 'paused') {
                $this->advanceExporterWithLock((string) $exporter['id']);
            }
        }

        // One source per tick, least-recently-advanced first. Stateless (the
        // old in-memory round-robin cursor reset in every fresh scheduler
        // process, starving all but the newest source); a busy session lock
        // skips to the next source instead of wasting the tick.
        usort($sources, static fn (array $left, array $right): int => strcmp(
            (string) ($left['updated_at'] ?? ''),
            (string) ($right['updated_at'] ?? '')
        ));
        foreach ($sources as $source) {
            if ($this->advanceDriverWithLock((string) $source['id'])) {
                break;
            }
        }
    }

    private function advanceReceiverWithLock(string $id): void
    {
        $result = Context::scope(
            fn (): array => $this->sessionLock->run($id, function () use ($id): void {
                $receiver = $this->store->get($id);
                if ($receiver === null || $receiver['status'] === 'paused') {
                    return;
                }
                if ($this->cancelRequested($id)) {
                    $this->applyCancel($id);
                    return;
                }
                try {
                    $this->advanceReceiver($receiver);
                } catch (\Throwable $exception) {
                    $receiver = $this->store->get($id) ?? $receiver;
                    $receiver['status'] = 'failed';
                    $receiver['error'] = $exception->getMessage();
                    $this->store->markCurrentStep($receiver, 'failed', $exception->getMessage());
                }
            }),
            data: ['data_sync_session_id' => $id, 'data_sync_role' => 'receiver']
        );

        if (!$result['acquired']) {
            return;
        }
    }

    private function advanceDriverWithLock(string $id): bool
    {
        $result = Context::scope(
            fn (): array => $this->sessionLock->run($id, function () use ($id): void {
                $source = $this->store->get($id);
                if ($source === null || $source['status'] === 'paused') {
                    return;
                }
                if ($this->cancelRequested($id)) {
                    $this->applyCancel($id);
                    return;
                }
                $this->advanceDriver($source);
            }),
            data: ['data_sync_session_id' => $id, 'data_sync_role' => 'driver']
        );

        return (bool) ($result['acquired'] ?? false);
    }

    private function advanceExporterWithLock(string $id): void
    {
        $result = Context::scope(
            fn (): array => $this->sessionLock->run($id, function () use ($id): void {
                $exporter = $this->store->get($id);
                if ($exporter === null || $exporter['status'] === 'paused') {
                    return;
                }
                if ($this->cancelRequested($id)) {
                    $this->applyCancel($id);
                    return;
                }
                try {
                    $this->advanceExporter($exporter);
                } catch (\Throwable $exception) {
                    $exporter = $this->store->get($id) ?? $exporter;
                    $exporter['status'] = 'failed';
                    $exporter['error'] = $exception->getMessage();
                    $this->store->markCurrentStep($exporter, 'failed', $exception->getMessage());
                }
            }),
            data: ['data_sync_session_id' => $id, 'data_sync_role' => 'exporter']
        );

        if (!$result['acquired']) {
            return;
        }
    }

    private function advanceReceiver(array $job): void
    {
        if ((int) ($job['protocol_version'] ?? 0) !== DataSyncProtocol::VERSION) {
            throw new \RuntimeException('The receiver session protocol version is incompatible.');
        }

        while (
            isset($job['steps'][$job['current_step']])
            && in_array($job['steps'][$job['current_step']]['status'], ['completed', 'skipped'], true)
        ) {
            $job['current_step']++;
        }
        $key = $job['steps'][$job['current_step']]['key'] ?? null;

        if ($key === null) {
            return;
        }
        $job['status'] = 'running';
        $job = $this->store->markCurrentStep($job, 'running');

        if (($job['context']['ready'] ?? false) && !($job['context']['finalized'] ?? false)) {
            return;
        }

        if ($key === 'discover_receiver_databases') {
            $job['context']['inventory'] = $this->databases->inventory();
        } elseif ($key === 'backup_receiver_databases' && !empty($job['options']['databases'])) {
            $connections = DatabaseManagerService::physicalConnections();
            $backupIndex = count($job['context']['backups']);
            if (isset($connections[$backupIndex])) {
                $descriptor = $connections[$backupIndex];
                $job['context']['backups'][] = DatabaseManagerService::backup((string) $descriptor['connection']);
                $this->store->save($job);
                if (isset($connections[$backupIndex + 1])) {
                    return;
                }
            }
        } elseif ($key === 'record_backup_directory') {
            $job['backup_directory'] = \App\Providers\PathMapper::getBackupDir('db-manager');
        } elseif ($key === 'ready_for_transfer') {
            $job['context']['ready'] = true;
        } elseif (($job['context']['finalized'] ?? false) && $key === 'finalize_receiver_session') {
            $job['status'] = 'running';
        } elseif (($job['context']['finalized'] ?? false) && $key === 'release_receiver_lock') {
            $job['status'] = 'running';
        } elseif (($job['context']['finalized'] ?? false) && $key === 'complete') {
            $job['status'] = 'completed';
            $job['completed_at'] = now()->toIso8601String();
        } elseif (in_array($key, [
            'receive_database_chunks',
            'apply_database_differences',
            'receive_resource_chunks',
            'verify_resource_payloads',
            'apply_resource_payloads',
            'verify_received_data',
        ], true)) {
            return;
        }

        $this->store->markCurrentStep($job, 'completed');
    }

    private function advanceExporter(array $job): void
    {
        if ((int) ($job['protocol_version'] ?? 0) !== DataSyncProtocol::VERSION) {
            throw new \RuntimeException('The exporter session protocol version is incompatible.');
        }

        while (
            isset($job['steps'][$job['current_step']])
            && in_array($job['steps'][$job['current_step']]['status'], ['completed', 'skipped'], true)
        ) {
            $job['current_step']++;
        }
        $key = $job['steps'][$job['current_step']]['key'] ?? null;

        if ($key === null) {
            return;
        }
        $job['status'] = 'running';
        $job = $this->store->markCurrentStep($job, 'running');

        if (($job['context']['ready'] ?? false) && !($job['context']['finalized'] ?? false)) {
            return;
        }

        if ($key === 'discover_source_databases') {
            $job = !empty($job['options']['databases'])
                ? $this->refreshSourceDatabaseInventory($job)
                : $this->store->save($job);
        } elseif ($key === 'discover_resource_roots') {
            $job['context']['resource_roots'] = !empty($job['options']['resources'])
                ? array_keys($this->resources->roots())
                : [];
            $job['context']['local_manifest'] = array_merge(
                $job['context']['local_manifest'] ?? [],
                [
                    'resource_roots' => count($job['context']['resource_roots']),
                    'resource_files' => 0,
                    'resource_bytes' => 0,
                ]
            );
            $job = $this->store->save($job);
        } elseif ($key === 'build_source_resource_manifests') {
            $job = $this->refreshSourceResourceManifests($job);
        } elseif ($key === 'ready_for_export') {
            $job['context']['ready'] = true;
        } elseif (in_array($key, ['serve_database_chunks', 'serve_resource_chunks'], true)) {
            return;
        } elseif (($job['context']['finalized'] ?? false) && $key === 'complete') {
            $job['status'] = 'completed';
            $job['completed_at'] = now()->toIso8601String();
        }

        $this->store->markCurrentStep($job, 'completed');
    }

    private function advanceDriver(array $job): void
    {
        $key = $job['steps'][$job['current_step']]['key'] ?? null;
        $result = null;

        if ($key === null) {
            return;
        }

        $job['status'] = 'running';
        $job = $this->store->markCurrentStep($job, 'running');

        try {
            // The passive peer purges its own record once finalized, so the
            // closing 'complete' step must not poll it anymore.
            if ($key !== 'complete') {
                $job = $this->refreshCounterpart($job);
            }
            $result = $this->executeDriverStep($job, $key);
            $job = $result['job'];
            if (!$result['done']) {
                $this->store->markCurrentStep($job, 'running', $result['detail']);
                return;
            }
            if ($key === 'complete') {
                $job['status'] = 'completed';
                $job['completed_at'] = now()->toIso8601String();
            }
            $this->store->markCurrentStep($job, 'completed', $result['detail']);
        } catch (\Throwable $exception) {
            $job['status'] = 'failed';
            $job['error'] = $exception->getMessage();
            $this->store->markCurrentStep($job, 'failed', $exception->getMessage());
        }
    }

    private function refreshCounterpart(array $job): array
    {
        if (empty($job['context']['peer_session_id']) || empty($job['context']['peer_token'])) {
            return $job;
        }

        $response = $this->peer->status($job);
        $job['context']['counterpart_observed_at'] = now()->toIso8601String();

        if (isset($response['__waiting'])) {
            $job['context']['counterpart_reachable'] = false;
            $job['context']['counterpart_error'] = (string) $response['__waiting'];
            return $this->store->save($job);
        }

        $job['context']['counterpart_reachable'] = true;
        $job['context']['counterpart_error'] = null;
        $job['context']['receiver'] = $response;

        return $this->store->save($job);
    }

    private function executeDriverStep(array $job, string $key): array
    {
        return match ($key) {
            'validate_request' => $this->validateSourceProtocol($job),
            'normalize_peer_address' => $this->normalizeTarget($job),
            'probe_peer_health' => $this->probePeer($job),
            'negotiate_protocol' => $this->negotiateProtocol($job),
            'create_receiver_session' => $this->createPeerSession($job),
            'create_exporter_session' => $this->createExporterSession($job),
            'wait_exporter_ready' => $this->waitForReceiver($job),
            'wait_receiver_lock', 'wait_receiver_backup' => $this->waitForReceiver($job),
            'discover_source_databases' => $this->discoverSourceDatabases($job),
            'discover_receiver_databases' => $this->discoverReceiverDatabases($job),
            'discover_fetcher_databases' => $this->discoverFetcherDatabases($job),
            'backup_fetcher_databases' => $this->backupFetcherDatabases($job),
            'fetch_exporter_database_inventory' => $this->fetchExporterDatabaseInventory($job),
            'validate_database_compatibility' => $this->validateInventories($job),
            'record_receiver_backup_directory' => $this->recordBackupDirectory($job),
            'record_backup_directory' => $this->recordFetcherBackupDirectory($job),
            'initialize_database_checkpoints' => $this->initializeDatabaseCheckpoints($job),
            'transfer_database_chunks' => $this->transferDatabaseChunk($job),
            'apply_database_differences' => $this->completePeerDatabaseTransfer($job),
            'verify_database_counts' => $this->verifyDatabaseCounts($job),
            'verify_database_digests' => $this->completed(
                $job,
                (string) ($job['context']['database_results']['verified'] ?? 0) . ' receiver rows verified.'
            ),
            'discover_resource_roots' => $this->discoverResourceRoots($job),
            'build_source_resource_manifests' => $this->buildSourceResourceManifests($job),
            'build_fetcher_resource_manifests' => $this->buildFetcherResourceManifests($job),
            'fetch_receiver_resource_manifests' => $this->fetchReceiverResourceManifests($job),
            'fetch_exporter_resource_manifests' => $this->fetchExporterResourceManifests($job),
            'calculate_resource_differences' => $this->calculateResourceDifferences($job),
            'prepare_resource_batches' => $this->prepareResourceBatches($job),
            'initialize_resource_checkpoints' => $this->initializeResourceCheckpoints($job),
            'transfer_resource_chunks' => $this->transferResourceChunk($job),
            'verify_resource_manifests' => $this->verifyResourceManifests($job),
            'finalize_receiver_session' => $this->finalizePeer($job),
            'finalize_exporter_session' => $this->finalizePeer($job),
            'complete' => $this->completed($job, 'Synchronization completed.'),
            default => $this->completed($job),
        };
    }

    private function validateSourceProtocol(array $job): array
    {
        if ((int) ($job['protocol_version'] ?? 0) !== DataSyncProtocol::VERSION) {
            throw new \RuntimeException('The source session protocol version is incompatible.');
        }

        return $this->completed($job);
    }

    private function normalizeTarget(array $job): array
    {
        $input = trim((string) $job['target_input']);
        if ($input === '') {
            $job['context']['awaiting_target'] = true;
            return $this->waiting(
                $this->store->save($job),
                'Receiver IP or host is required to continue.'
            );
        }

        $job['target'] = $this->peer->normalizeAddress($input);
        $this->assertNotSelfTarget($job['target']);
        $job['context']['awaiting_target'] = false;
        return $this->completed($this->store->save($job), $job['target']);
    }

    private function probePeer(array $job): array
    {
        $response = $this->peer->call($job, 'GET', '/health', [], false);
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        $job['context']['peer_health'] = $response;
        return $this->completed($this->store->save($job));
    }

    private function negotiateProtocol(array $job): array
    {
        $peerVersion = (int) ($job['context']['peer_health']['protocol_version'] ?? 0);
        if ($peerVersion !== DataSyncProtocol::VERSION) {
            throw new \RuntimeException('The peer data synchronization protocol version is incompatible.');
        }
        if (!empty($job['options']['compression']) && empty($job['context']['peer_health']['compression_available'])) {
            throw new \RuntimeException('7-Zip compression was selected but the peer has no system 7-Zip binary.');
        }
        if (!empty($job['options']['compression']) && !SystemArchiveManager::available()) {
            throw new \RuntimeException('7-Zip compression was selected but the source has no system 7-Zip binary.');
        }
        return $this->completed($job);
    }

    private function createPeerSession(array $job): array
    {
        $prepareToken = (string) ($job['context']['prepare_token'] ?? '');
        if ($prepareToken === '') {
            $prepareToken = bin2hex(random_bytes(32));
            $job['context']['prepare_token'] = $prepareToken;
            $job = $this->store->save($job);
        }
        $response = $this->peer->call($job, 'POST', '/prepare', [
            'source_job_id' => $job['id'],
            'prepare_token' => $prepareToken,
            'options' => $job['options'],
        ], false);
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        if ((int) ($response['protocol_version'] ?? 0) !== DataSyncProtocol::VERSION) {
            throw new \RuntimeException('The prepared receiver protocol version is incompatible.');
        }
        $job['context']['peer_session_id'] = $response['id'];
        $job['context']['peer_token'] = $response['token'];
        unset($job['context']['prepare_token']);
        return $this->completed($this->store->save($job));
    }

    private function createExporterSession(array $job): array
    {
        $prepareToken = (string) ($job['context']['prepare_token'] ?? '');
        if ($prepareToken === '') {
            $prepareToken = bin2hex(random_bytes(32));
            $job['context']['prepare_token'] = $prepareToken;
            $job = $this->store->save($job);
        }
        $response = $this->peer->call($job, 'POST', '/export-prepare', [
            'fetcher_job_id' => $job['id'],
            'prepare_token' => $prepareToken,
            'options' => $job['options'],
        ], false);
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        if ((int) ($response['protocol_version'] ?? 0) !== DataSyncProtocol::VERSION) {
            throw new \RuntimeException('The prepared exporter protocol version is incompatible.');
        }
        $peerSessionId = (string) $response['id'];
        $job['context']['peer_session_id'] = $peerSessionId;
        $job['context']['peer_base_path'] = '/export-sessions/' . rawurlencode($peerSessionId);
        $job['context']['peer_token'] = $response['token'];
        unset($job['context']['prepare_token']);
        return $this->completed($this->store->save($job));
    }

    private function waitForReceiver(array $job): array
    {
        $response = $this->peer->status($job);
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        if (($response['status'] ?? null) === 'failed') {
            throw new \RuntimeException((string) ($response['error'] ?? 'Receiver preparation failed.'));
        }
        $job['context']['receiver'] = $response;
        $job = $this->store->save($job);
        return !empty($response['context']['ready'])
            ? $this->completed($job)
            : $this->waiting($job, 'Waiting for receiver backup and preparation.');
    }

    private function discoverSourceDatabases(array $job): array
    {
        if (empty($job['options']['databases'])) {
            $job['context']['local_manifest'] = array_merge(
                $job['context']['local_manifest'] ?? [],
                ['databases' => 0, 'tables' => 0, 'rows' => 0]
            );
            return $this->completed($this->store->save($job), 'Database synchronization disabled.');
        }
        return $this->completed($this->refreshSourceDatabaseInventory($job));
    }

    private function refreshSourceDatabaseInventory(array $job): array
    {
        $inventory = $this->databases->inventory();

        $job['context']['source_inventory'] = $inventory;
        $job['context']['local_manifest'] = array_merge(
            $job['context']['local_manifest'] ?? [],
            $this->inventorySummary($inventory)
        );
        return $this->store->save($job);
    }

    private function inventorySummary(array $inventory): array
    {
        $tableCount = 0;
        $rowCount = 0;

        foreach ($inventory as $database) {
            $tableCount += count($database['tables'] ?? []);
            foreach ($database['tables'] ?? [] as $table) {
                $rowCount += max(0, (int) ($table['rows'] ?? 0));
            }
        }

        return [
            'databases' => count($inventory),
            'tables' => $tableCount,
            'rows' => $rowCount,
        ];
    }

    private function discoverReceiverDatabases(array $job): array
    {
        if (empty($job['options']['databases'])) {
            return $this->completed($job, 'Database synchronization disabled.');
        }
        if (empty($job['context']['database_inventory_snapshot_ready'])) {
            $job = $this->refreshSourceDatabaseInventory($job);
            $job['context']['database_inventory_snapshot_ready'] = true;
            $job = $this->store->save($job);
        }
        $response = $this->peer->call($job, 'GET', '/database-inventory');
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        $job['context']['receiver_inventory'] = $response['databases'] ?? [];
        return $this->completed($this->store->save($job));
    }

    private function discoverFetcherDatabases(array $job): array
    {
        if (empty($job['options']['databases'])) {
            return $this->completed($job, 'Database synchronization disabled.');
        }
        $job['context']['receiver_inventory'] = $this->databases->inventory();
        return $this->completed($this->store->save($job));
    }

    private function backupFetcherDatabases(array $job): array
    {
        if (empty($job['options']['databases'])) {
            return $this->completed($job, 'Database synchronization disabled.');
        }
        $connections = DatabaseManagerService::physicalConnections();
        $backupIndex = count($job['context']['backups'] ?? []);
        if (isset($connections[$backupIndex])) {
            $descriptor = $connections[$backupIndex];
            $job['context']['backups'][] = DatabaseManagerService::backup((string) $descriptor['connection']);
            $job = $this->store->save($job);
            if (isset($connections[$backupIndex + 1])) {
                return $this->waiting($job, 'Backing up local databases before fetch.');
            }
        }
        return $this->completed($job, 'Local database backups completed.');
    }

    private function fetchExporterDatabaseInventory(array $job): array
    {
        if (empty($job['options']['databases'])) {
            return $this->completed($job, 'Database synchronization disabled.');
        }
        if (empty($job['context']['database_inventory_snapshot_ready'])) {
            $job['context']['receiver_inventory'] = $this->databases->inventory();
            $job['context']['database_inventory_snapshot_ready'] = true;
            $job = $this->store->save($job);
        }
        $response = $this->peer->call($job, 'GET', '/database-inventory');
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        $job['context']['source_inventory'] = $response['databases'] ?? [];
        $job['context']['local_manifest'] = array_merge(
            $job['context']['local_manifest'] ?? [],
            $this->inventorySummary($job['context']['source_inventory'])
        );
        return $this->completed($this->store->save($job));
    }

    private function recordFetcherBackupDirectory(array $job): array
    {
        if (empty($job['options']['databases'])) {
            $job['backup_directory'] = null;
            return $this->completed($this->store->save($job), 'Database synchronization disabled.');
        }
        $job['backup_directory'] = \App\Providers\PathMapper::getBackupDir('db-manager');
        return $this->completed($this->store->save($job), (string) $job['backup_directory']);
    }

    private function validateInventories(array $job): array
    {
        if (empty($job['options']['databases'])) {
            return $this->completed($job, 'Database synchronization disabled.');
        }

        $source = $this->inventoryMap($job['context']['source_inventory'] ?? []);
        $receiver = $this->inventoryMap($job['context']['receiver_inventory'] ?? []);
        foreach ($source as $databaseKey => $database) {
            if (!isset($receiver[$databaseKey])) {
                throw new \RuntimeException("Receiver database is missing: {$databaseKey}");
            }
            if (($database['driver'] ?? null) !== ($receiver[$databaseKey]['driver'] ?? null)) {
                throw new \RuntimeException("Receiver database driver differs: {$databaseKey}");
            }
            foreach ($database['tables'] as $tableName => $table) {
                if (!isset($receiver[$databaseKey]['tables'][$tableName])) {
                    throw new \RuntimeException("Receiver table is missing: {$databaseKey}.{$tableName}");
                }
                $sourceColumns = $this->columnSignatures($table['columns'] ?? []);
                $receiverColumns = $this->columnSignatures(
                    $receiver[$databaseKey]['tables'][$tableName]['columns'] ?? []
                );
                if ($sourceColumns !== $receiverColumns) {
                    throw new \RuntimeException("Receiver table structure differs: {$databaseKey}.{$tableName}");
                }
                if (($table['identity'] ?? []) !== ($receiver[$databaseKey]['tables'][$tableName]['identity'] ?? [])) {
                    throw new \RuntimeException("Receiver table identity differs: {$databaseKey}.{$tableName}");
                }
            }
        }
        return $this->completed($job);
    }

    private function recordBackupDirectory(array $job): array
    {
        if (empty($job['options']['databases'])) {
            $job['backup_directory'] = null;
            return $this->completed($this->store->save($job), 'Database synchronization disabled.');
        }
        $job['backup_directory'] = $job['context']['receiver']['backup_directory']
            ?? $job['context']['receiver']['context']['backups'][0]['directory']
            ?? null;
        return $this->completed($this->store->save($job), (string) $job['backup_directory']);
    }

    private function initializeDatabaseCheckpoints(array $job): array
    {
        $checkpoints = [];

        if (!empty($job['options']['databases'])) {
            foreach ($job['context']['source_inventory'] ?? [] as $database) {
                foreach ($database['tables'] as $table) {
                    $checkpoints[] = [
                        'connection' => $database['key'],
                        'table' => $table['name'],
                        'offset' => 0,
                        'rows' => $table['rows'],
                        'completed' => false,
                    ];
                }
            }
        }

        $job['context']['database_checkpoints'] = $checkpoints;
        $job['context']['database_checkpoint_index'] = 0;
        $job['context']['database_results'] = [
            'inserted' => 0,
            'updated' => 0,
            'unchanged' => 0,
            'verified' => 0,
        ];
        return $this->completed($this->store->save($job));
    }

    private function transferDatabaseChunk(array $job): array
    {
        if (($job['role'] ?? null) === 'fetcher') {
            return $this->fetchDatabaseChunk($job);
        }

        $checkpoints = $job['context']['database_checkpoints'] ?? [];
        $index = (int) ($job['context']['database_checkpoint_index'] ?? 0);

        if (empty($job['options']['databases']) || !isset($checkpoints[$index])) {
            return $this->completed($job, 'All database chunks transferred.');
        }

        $checkpoint = $checkpoints[$index];
        $chunk = $this->databases->readChunk(
            (string) $checkpoint['connection'],
            (string) $checkpoint['table'],
            (int) $checkpoint['offset']
        );
        $response = $this->peer->call($job, 'POST', '/database-chunks', [
            'connection' => $checkpoint['connection'],
            'table' => $checkpoint['table'],
            'rows' => $chunk['rows'],
        ]);
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }

        foreach (['inserted', 'updated', 'unchanged', 'verified'] as $counter) {
            $job['context']['database_results'][$counter] += (int) ($response[$counter] ?? 0);
        }
        $job['context']['database_checkpoints'][$index]['offset'] = $chunk['next_offset'];
        if ($chunk['done']) {
            $sequenceResponse = $this->peer->call($job, 'POST', '/database-sequences', [
                'connection' => $checkpoint['connection'],
                'table' => $checkpoint['table'],
            ]);
            if (isset($sequenceResponse['__waiting'])) {
                return $this->waiting($job, $sequenceResponse['__waiting']);
            }
            $job['context']['database_checkpoints'][$index]['completed'] = true;
            $job['context']['database_checkpoint_index'] = $index + 1;
        }
        $job = $this->store->save($job);

        return isset($checkpoints[$index + 1]) || !$chunk['done']
            ? $this->waiting($job, "{$checkpoint['connection']}.{$checkpoint['table']} @ {$chunk['next_offset']}")
            : $this->completed($job, 'All database chunks transferred.');
    }

    /**
     * Pull-mode database transfer: download the next row chunk from the peer
     * exporter and apply it idempotently to the local database.
     */
    private function fetchDatabaseChunk(array $job): array
    {
        $checkpoints = $job['context']['database_checkpoints'] ?? [];
        $index = (int) ($job['context']['database_checkpoint_index'] ?? 0);

        if (empty($job['options']['databases']) || !isset($checkpoints[$index])) {
            return $this->completed($job, 'All database chunks fetched.');
        }

        $checkpoint = $checkpoints[$index];
        $chunk = $this->peer->call($job, 'GET', '/database-chunks', [
            'connection' => $checkpoint['connection'],
            'table' => $checkpoint['table'],
            'offset' => (int) $checkpoint['offset'],
        ]);
        if (isset($chunk['__waiting'])) {
            return $this->waiting($job, $chunk['__waiting']);
        }

        $rows = (array) ($chunk['rows'] ?? []);
        $result = $this->databases->applyDiff(
            (string) $checkpoint['connection'],
            (string) $checkpoint['table'],
            $rows
        );
        foreach (['inserted', 'updated', 'unchanged', 'verified'] as $counter) {
            $job['context']['database_results'][$counter] += (int) ($result[$counter] ?? 0);
        }
        $job['context']['received']['database_rows'] =
            (int) ($job['context']['received']['database_rows'] ?? 0) + count($rows);
        $job['context']['database_checkpoints'][$index]['offset'] = (int) ($chunk['next_offset'] ?? 0);
        if (!empty($chunk['done'])) {
            $this->databases->advanceSequence(
                (string) $checkpoint['connection'],
                (string) $checkpoint['table']
            );
            $job['context']['database_checkpoints'][$index]['completed'] = true;
            $job['context']['database_checkpoint_index'] = $index + 1;
        }
        $job = $this->store->save($job);

        return isset($checkpoints[$index + 1]) || empty($chunk['done'])
            ? $this->waiting(
                $job,
                "{$checkpoint['connection']}.{$checkpoint['table']} @ {$job['context']['database_checkpoints'][$index]['offset']}"
            )
            : $this->completed($job, 'All database chunks fetched.');
    }

    private function verifyDatabaseCounts(array $job): array
    {
        if (empty($job['options']['databases'])) {
            return $this->completed($job, 'Database synchronization disabled.');
        }
        $response = ($job['role'] ?? null) === 'fetcher'
            ? ['databases' => $this->databases->inventory()]
            : $this->peer->call($job, 'GET', '/database-inventory');
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        $source = $this->inventoryMap($job['context']['source_inventory'] ?? []);
        $receiver = $this->inventoryMap($response['databases'] ?? []);
        foreach ($source as $databaseKey => $database) {
            foreach ($database['tables'] as $tableName => $table) {
                $receiverRows = (int) ($receiver[$databaseKey]['tables'][$tableName]['rows'] ?? -1);
                if ($receiverRows < (int) $table['rows']) {
                    throw new \RuntimeException("Receiver row count is incomplete: {$databaseKey}.{$tableName}");
                }
            }
        }
        unset(
            $job['context']['source_inventory'],
            $job['context']['receiver_inventory'],
            $job['context']['receiver']
        );
        return $this->completed($job, 'Receiver row counts cover every source table.');
    }

    private function completePeerDatabaseTransfer(array $job): array
    {
        $response = $this->peer->call($job, 'POST', '/database-complete');
        return isset($response['__waiting'])
            ? $this->waiting($job, $response['__waiting'])
            : $this->completed($job);
    }

    private function discoverResourceRoots(array $job): array
    {
        $job['context']['resource_roots'] = !empty($job['options']['resources'])
            ? array_keys($this->resources->roots())
            : [];
        $job['context']['local_manifest'] = array_merge(
            $job['context']['local_manifest'] ?? [],
            [
                'resource_roots' => count($job['context']['resource_roots']),
                'resource_files' => 0,
                'resource_bytes' => 0,
            ]
        );
        return $this->completed($this->store->save($job));
    }

    private function buildSourceResourceManifests(array $job): array
    {
        return $this->completed($this->refreshSourceResourceManifests($job));
    }

    private function refreshSourceResourceManifests(array $job): array
    {
        $manifests = [];
        $fileCount = 0;
        $byteCount = 0;

        foreach ($job['context']['resource_roots'] ?? [] as $key) {
            $manifests[$key] = $this->resources->manifest($key)['files'];
            $fileCount += count($manifests[$key]);
            foreach ($manifests[$key] as $metadata) {
                $byteCount += max(0, (int) ($metadata['size'] ?? 0));
            }
        }
        $job['context']['source_resource_manifests'] = $manifests;
        $job['context']['local_manifest'] = array_merge(
            $job['context']['local_manifest'] ?? [],
            [
                'resource_roots' => count($manifests),
                'resource_files' => $fileCount,
                'resource_bytes' => $byteCount,
            ]
        );
        return $this->store->save($job);
    }

    private function fetchReceiverResourceManifests(array $job): array
    {
        $manifests = [];
        if (empty($job['context']['resource_manifest_snapshot_ready'])) {
            $job = $this->refreshSourceResourceManifests($job);
            $job['context']['resource_manifest_snapshot_ready'] = true;
            $job = $this->store->save($job);
        }
        foreach ($job['context']['resource_roots'] ?? [] as $key) {
            $response = $this->peer->call($job, 'GET', '/resources/' . rawurlencode($key) . '/manifest');
            if (isset($response['__waiting'])) {
                return $this->waiting($job, $response['__waiting']);
            }
            $manifests[$key] = $response['files'] ?? [];
        }
        $job['context']['receiver_resource_manifests'] = $manifests;
        return $this->completed($this->store->save($job));
    }

    /**
     * Pull mode: the fetcher's own manifests take the receiver slot; the peer
     * exporter's manifests take the source slot, so difference calculation and
     * verification stay identical to push mode.
     */
    private function buildFetcherResourceManifests(array $job): array
    {
        if (!isset($job['context']['resource_roots'])) {
            $job['context']['resource_roots'] = !empty($job['options']['resources'])
                ? array_keys($this->resources->roots())
                : [];
            $job['context']['local_manifest'] = array_merge(
                $job['context']['local_manifest'] ?? [],
                [
                    'resource_roots' => count($job['context']['resource_roots']),
                    'resource_files' => 0,
                    'resource_bytes' => 0,
                ]
            );
        }
        $manifests = [];
        foreach ($job['context']['resource_roots'] ?? [] as $key) {
            $manifests[$key] = $this->resources->manifest($key)['files'];
        }
        $job['context']['receiver_resource_manifests'] = $manifests;
        return $this->completed($this->store->save($job));
    }

    private function fetchExporterResourceManifests(array $job): array
    {
        if (empty($job['context']['resource_manifest_snapshot_ready'])) {
            $snapshotManifests = [];
            foreach ($job['context']['resource_roots'] ?? [] as $key) {
                $snapshotManifests[$key] = $this->resources->manifest($key)['files'];
            }
            $job['context']['receiver_resource_manifests'] = $snapshotManifests;
            $job['context']['resource_manifest_snapshot_ready'] = true;
            $job = $this->store->save($job);
        }
        $manifests = [];
        $fileCount = 0;
        $byteCount = 0;

        foreach ($job['context']['resource_roots'] ?? [] as $key) {
            $response = $this->peer->call($job, 'GET', '/resources/' . rawurlencode($key) . '/manifest');
            if (isset($response['__waiting'])) {
                return $this->waiting($job, $response['__waiting']);
            }
            $manifests[$key] = (array) ($response['files'] ?? []);
            $fileCount += count($manifests[$key]);
            foreach ($manifests[$key] as $metadata) {
                $byteCount += max(0, (int) ($metadata['size'] ?? 0));
            }
        }
        $job['context']['source_resource_manifests'] = $manifests;
        $job['context']['local_manifest'] = array_merge(
            $job['context']['local_manifest'] ?? [],
            [
                'resource_roots' => count($manifests),
                'resource_files' => $fileCount,
                'resource_bytes' => $byteCount,
            ]
        );
        return $this->completed($this->store->save($job));
    }

    private function calculateResourceDifferences(array $job): array
    {
        $differences = [];
        foreach ($job['context']['resource_roots'] ?? [] as $key) {
            $differences[$key] = $this->resources->diffManifests(
                $job['context']['source_resource_manifests'][$key] ?? [],
                $job['context']['receiver_resource_manifests'][$key] ?? []
            );
        }
        $job['context']['resource_differences'] = $differences;
        return $this->completed($this->store->save($job));
    }

    private function prepareResourceBatches(array $job): array
    {
        if (($job['role'] ?? null) === 'fetcher') {
            return $this->prepareFetcherResourceBatches($job);
        }

        $archives = [];

        if (!empty($job['options']['compression'])) {
            foreach ($job['context']['resource_differences'] ?? [] as $key => $paths) {
                if ($paths !== []) {
                    $archives[$key] = $this->resources->createArchive($job['id'], $key, $paths);
                }
            }
        }
        $job['context']['resource_archives'] = $archives;
        return $this->completed(
            $this->store->save($job),
            !empty($job['options']['compression']) ? 'System 7-Zip batches prepared.' : 'Uncompressed file batches prepared.'
        );
    }

    /**
     * Pull mode: archives are packed on the exporter, so this step only
     * records the per-root difference lists that initialize_resource_checkpoints
     * will request from the peer.
     */
    private function prepareFetcherResourceBatches(array $job): array
    {
        $requests = [];

        if (!empty($job['options']['compression'])) {
            foreach ($job['context']['resource_differences'] ?? [] as $key => $paths) {
                if ($paths !== []) {
                    $requests[$key] = array_values($paths);
                }
            }
        }
        $job['context']['resource_archive_requests'] = $requests;
        return $this->completed(
            $this->store->save($job),
            !empty($job['options']['compression']) ? 'Exporter 7-Zip batches requested.' : 'Uncompressed file batches prepared.'
        );
    }

    private function initializeResourceCheckpoints(array $job): array
    {
        if (($job['role'] ?? null) === 'fetcher') {
            return $this->initializeFetcherResourceCheckpoints($job);
        }

        $items = [];

        if (!empty($job['options']['compression'])) {
            foreach ($job['context']['resource_archives'] ?? [] as $key => $archive) {
                $manifest = [];
                foreach ($job['context']['resource_differences'][$key] ?? [] as $relativePath) {
                    $manifest[$relativePath] = $job['context']['source_resource_manifests'][$key][$relativePath];
                }
                $items[] = array_merge($archive, [
                    'key' => $key,
                    'mode' => '7z',
                    'manifest' => $manifest,
                ]);
            }
        } else {
            foreach ($job['context']['resource_differences'] ?? [] as $key => $paths) {
                foreach ($paths as $relativePath) {
                    $metadata = $job['context']['source_resource_manifests'][$key][$relativePath];
                    $items[] = [
                        'key' => $key,
                        'relative_path' => $relativePath,
                        'path' => $this->resources->sourceFilePath($key, $relativePath),
                        'size' => $metadata['size'],
                        'sha256' => $metadata['sha256'],
                        'mode' => 'file',
                    ];
                }
            }
        }

        $this->plans->saveResourceItems((string) $job['id'], $items);
        $job['context']['resource_checkpoint_index'] = 0;
        $job['context']['resource_checkpoint_count'] = count($items);
        $job['context']['resource_checkpoint_offset'] = 0;
        unset(
            $job['context']['source_resource_manifests'],
            $job['context']['receiver_resource_manifests'],
            $job['context']['resource_differences'],
            $job['context']['resource_archives']
        );
        return $this->completed($this->store->save($job));
    }

    /**
     * Pull mode checkpoints: file entries point at exporter chunks instead of
     * local paths; 7-Zip entries request the on-demand archive from the peer.
     */
    private function initializeFetcherResourceCheckpoints(array $job): array
    {
        $items = [];

        if (!empty($job['options']['compression'])) {
            foreach ($job['context']['resource_archive_requests'] ?? [] as $key => $paths) {
                $response = $this->peer->call($job, 'POST', '/resource-archives', [
                    'key' => $key,
                    'paths' => array_values($paths),
                ]);
                if (isset($response['__waiting'])) {
                    return $this->waiting($job, $response['__waiting']);
                }
                $manifest = [];
                foreach ($paths as $relativePath) {
                    $manifest[$relativePath] = $job['context']['source_resource_manifests'][$key][$relativePath];
                }
                $items[] = [
                    'key' => $key,
                    'mode' => '7z',
                    'size' => (int) ($response['size'] ?? 0),
                    'sha256' => (string) ($response['sha256'] ?? ''),
                    'manifest' => $manifest,
                ];
            }
        } else {
            foreach ($job['context']['resource_differences'] ?? [] as $key => $paths) {
                foreach ($paths as $relativePath) {
                    $metadata = $job['context']['source_resource_manifests'][$key][$relativePath];
                    $items[] = [
                        'key' => $key,
                        'relative_path' => $relativePath,
                        'size' => $metadata['size'],
                        'sha256' => $metadata['sha256'],
                        'mode' => 'file',
                    ];
                }
            }
        }

        $this->plans->saveResourceItems((string) $job['id'], $items);
        $job['context']['resource_checkpoint_index'] = 0;
        $job['context']['resource_checkpoint_count'] = count($items);
        $job['context']['resource_checkpoint_offset'] = 0;
        unset(
            $job['context']['source_resource_manifests'],
            $job['context']['receiver_resource_manifests'],
            $job['context']['resource_differences'],
            $job['context']['resource_archive_requests']
        );
        return $this->completed($this->store->save($job));
    }

    private function transferResourceChunk(array $job): array
    {
        if (($job['role'] ?? null) === 'fetcher') {
            return $this->fetchResourceChunk($job);
        }

        $index = (int) ($job['context']['resource_checkpoint_index'] ?? 0);
        $count = (int) ($job['context']['resource_checkpoint_count'] ?? 0);
        $offset = (int) ($job['context']['resource_checkpoint_offset'] ?? 0);
        $item = $index < $count ? $this->plans->resourceItem((string) $job['id'], $index) : null;

        if ($item === null) {
            return $this->completed($job, 'All resource batches transferred.');
        }

        $content = FileSystemManager::readFileSegment(
            (string) $item['path'],
            $offset,
            ResourceSyncService::CHUNK_BYTES
        );
        if ($content === false) {
            throw new \RuntimeException('Unable to read the next resource transfer chunk.');
        }
        $nextOffset = $offset + strlen($content);
        $final = $nextOffset >= (int) $item['size'];
        $path = $item['mode'] === '7z' ? '/resource-chunks' : '/resource-file-chunks';
        $payload = [
            'key' => $item['key'],
            'offset' => $offset,
            'content' => base64_encode($content),
            'sha256' => $item['sha256'],
            'final' => $final,
        ];
        if ($item['mode'] === 'file') {
            $payload['relative_path'] = $item['relative_path'];
        }
        $response = $this->peer->call($job, 'POST', $path, $payload);
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        if (!(bool) ($response['success'] ?? false)) {
            $job['context']['resource_checkpoint_offset'] = (int) ($response['offset'] ?? 0);
            return $this->waiting($this->store->save($job), 'Receiver requested resource checkpoint realignment.');
        }

        $job['context']['resource_checkpoint_offset'] = (int) $response['offset'];
        if ($final) {
            $job['context']['resource_checkpoint_index'] = $index + 1;
            $job['context']['resource_checkpoint_offset'] = 0;
        }
        $job = $this->store->save($job);

        return $final && $index + 1 >= $count
            ? $this->completed($job, 'All resource batches transferred.')
            : $this->waiting($job, $item['key'] . ' @ ' . $nextOffset);
    }

    /**
     * Pull-mode resource transfer: download the next chunk from the peer
     * exporter and commit it locally through the same verified receive path
     * the receiver role uses for pushed chunks.
     */
    private function fetchResourceChunk(array $job): array
    {
        $index = (int) ($job['context']['resource_checkpoint_index'] ?? 0);
        $count = (int) ($job['context']['resource_checkpoint_count'] ?? 0);
        $offset = (int) ($job['context']['resource_checkpoint_offset'] ?? 0);
        $item = $index < $count ? $this->plans->resourceItem((string) $job['id'], $index) : null;

        if ($item === null) {
            return $this->completed($job, 'All resource batches fetched.');
        }

        $params = ['key' => $item['key'], 'offset' => $offset];
        if (($item['mode'] ?? null) === 'file') {
            $params['path'] = $item['relative_path'];
        }
        $response = $this->peer->call(
            $job,
            'GET',
            ($item['mode'] ?? null) === '7z' ? '/resource-archive-chunks' : '/resource-file-chunks',
            $params
        );
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        $content = base64_decode((string) ($response['content'] ?? ''), true);
        if ($content === false) {
            throw new \RuntimeException('The exported resource chunk is not valid base64.');
        }
        $nextOffset = $offset + strlen($content);
        $final = $nextOffset >= (int) $item['size'];
        $result = ($item['mode'] ?? null) === '7z'
            ? $this->resources->receiveChunk(
                (string) $job['id'],
                (string) $item['key'],
                $offset,
                $content,
                (string) $item['sha256'],
                $final
            )
            : $this->resources->receiveFileChunk(
                (string) $job['id'],
                (string) $item['key'],
                (string) $item['relative_path'],
                $offset,
                $content,
                (string) $item['sha256'],
                $final
            );

        if (!(bool) ($result['success'] ?? false)) {
            $job['context']['resource_checkpoint_offset'] = (int) ($result['offset'] ?? 0);
            return $this->waiting($this->store->save($job), 'Local resource checkpoint realignment required.');
        }

        if (empty($result['already_present'])) {
            $job['context']['received']['resource_bytes'] =
                (int) ($job['context']['received']['resource_bytes'] ?? 0) + strlen($content);
        }
        if ($final || !empty($result['already_present'])) {
            $completionKey = ($item['mode'] ?? null) === '7z'
                ? 'archive:' . $item['key'] . ':' . $item['sha256']
                : 'file:' . $item['key'] . ':' . ($item['relative_path'] ?? '') . ':' . $item['sha256'];
            if ($this->receipts->recordResource((string) $job['id'], $completionKey)) {
                $job['context']['received']['resource_files'] =
                    (int) ($job['context']['received']['resource_files'] ?? 0)
                    + (($item['mode'] ?? null) === '7z' ? (int) ($result['files'] ?? 0) : 1);
            }
            $job['context']['resource_checkpoint_index'] = $index + 1;
            $job['context']['resource_checkpoint_offset'] = 0;
        } else {
            $job['context']['resource_checkpoint_offset'] = $nextOffset;
        }
        $job = $this->store->save($job);

        return $job['context']['resource_checkpoint_index'] >= $count
            ? $this->completed($job, 'All resource batches fetched.')
            : $this->waiting($job, $item['key'] . ' @ ' . $nextOffset);
    }

    private function verifyResourceManifests(array $job): array
    {
        $isFetcher = ($job['role'] ?? null) === 'fetcher';

        foreach ($this->expectedResourceItems($job) as $key => $expectedFiles) {
            $response = $isFetcher
                ? $this->resources->manifest($key)
                : $this->peer->call($job, 'GET', '/resources/' . rawurlencode($key) . '/manifest');
            if (isset($response['__waiting'])) {
                return $this->waiting($job, $response['__waiting']);
            }
            foreach ($expectedFiles as $relativePath => $expected) {
                if (($response['files'][$relativePath] ?? null) !== $expected) {
                    $side = $isFetcher ? 'Local' : 'Receiver';
                    throw new \RuntimeException("{$side} resource verification failed: {$key}/{$relativePath}");
                }
            }
        }
        $this->plans->forgetResourceItems((string) $job['id']);
        return $this->completed($job);
    }

    private function expectedResourceItems(array $job): array
    {
        $expectedByRoot = [];
        foreach ($this->plans->resourceItems((string) $job['id']) as $item) {
            if (($item['mode'] ?? null) === 'file') {
                $expectedByRoot[$item['key']][$item['relative_path']] = [
                    'size' => $item['size'],
                    'sha256' => $item['sha256'],
                ];
                continue;
            }
            foreach ($item['manifest'] ?? [] as $relativePath => $metadata) {
                $expectedByRoot[$item['key']][$relativePath] = $metadata;
            }
        }

        return $expectedByRoot;
    }

    private function finalizePeer(array $job): array
    {
        $response = $this->peer->call($job, 'POST', '/finalize');
        return isset($response['__waiting'])
            ? $this->waiting($job, $response['__waiting'])
            : $this->completed($job);
    }

    private function inventoryMap(array $inventory): array
    {
        $mapped = [];

        foreach ($inventory as $database) {
            $tables = [];
            foreach ($database['tables'] ?? [] as $table) {
                $tables[$table['name']] = $table;
            }
            $database['tables'] = $tables;
            $mapped[$database['key']] = $database;
        }
        return $mapped;
    }

    private function columnSignatures(array $columns): array
    {
        $signatures = [];

        foreach ($columns as $column) {
            $name = (string) ($column['name'] ?? '');
            $signatures[$name] = [
                'type' => (string) ($column['type'] ?? ''),
                'nullable' => (string) ($column['nullable'] ?? ''),
                'extra' => (string) ($column['extra'] ?? ''),
            ];
        }

        return $signatures;
    }

    /**
     * The new server must be a different machine than this node: syncing a
     * node onto itself would diff its own databases against themselves.
     * Compared by host, with the loopback aliases folded together. A loopback
     * target always resolves back to this node (the sync protocol serves on
     * this machine's own listeners), so it is rejected outright — the UI's
     * sameNode() folds the same aliases. Hosts and domains this Laravel
     * serves (service contract: laravelApi host keys, web domains, allowed
     * hosts) are rejected too — targeting api.si.12gm.com from this machine
     * is still self.
     */
    private function assertNotSelfTarget(?string $target): void
    {
        if ($target === null) {
            return;
        }

        $targetHost = $this->hostKey($target);
        if ($targetHost === 'loopback') {
            throw new \InvalidArgumentException('The new server must be a different machine than this node.');
        }

        $selfUrl = trim((string) config('app.url'));
        if ($selfUrl !== '' && $targetHost === $this->hostKey($selfUrl)) {
            throw new \InvalidArgumentException('The new server must be a different machine than this node.');
        }

        foreach ($this->selfHostKeys() as $selfHost) {
            if ($targetHost === $selfHost || str_ends_with($targetHost, '.' . $selfHost)) {
                throw new \InvalidArgumentException('The new server must be a different machine than this node.');
            }
        }
    }

    /**
     * Every host key this node answers on: the hosts in this node's own
     * frankenphp route files (generated per machine at runtime — they are the
     * authoritative "what does THIS node serve" list), each resolved to its
     * IPs too (so the NAT'd public address behind api.si.12gm.com still
     * matches), plus the machine's own interface addresses. The fleet-wide
     * service contract is NOT used: it lists every machine's addresses.
     * Best-effort: unreadable files or failed DNS simply shrink the set.
     */
    private function selfHostKeys(): array
    {
        $hosts = [];

        foreach (glob(base_path('storage/frankenphp/routes/*.caddy')) ?: [] as $routeFile) {
            $content = FileSystemManager::readFile($routeFile, false);
            if (!is_string($content)) {
                continue;
            }
            if (preg_match_all('/(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z0-9-]+|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?=[\s,\{]|$)/mi', $content, $matches)) {
                foreach ($matches[1] as $host) {
                    $hosts[] = $host;
                }
            }
        }

        foreach (gethostbynamel(gethostname()) ?: [] as $ip) {
            $hosts[] = $ip;
        }

        $keys = [];
        foreach ($hosts as $host) {
            $key = $this->hostKey((string) $host);
            if ($key === '' || $key === '0.0.0.0') {
                continue;
            }
            $keys[] = $key;
            if (filter_var($key, FILTER_VALIDATE_IP) === false && $key !== 'loopback') {
                $resolved = gethostbyname($key);
                if ($resolved !== $key) {
                    $keys[] = strtolower($resolved);
                }
            }
        }

        return array_values(array_unique($keys));
    }

    private function hostKey(string $address): string
    {
        $candidate = str_contains($address, '://') ? $address : 'http://' . $address;
        $host = strtolower((string) parse_url($candidate, PHP_URL_HOST));

        return in_array($host, ['localhost', '127.0.0.1', '::1'], true) ? 'loopback' : $host;
    }

    private function assertSourceTargetAvailable(?string $target, ?string $excludedId = null): void
    {
        foreach ($this->store->activeAll('source') as $source) {
            if (($source['id'] ?? null) === $excludedId) {
                continue;
            }
            if ($this->cancelRequested((string) ($source['id'] ?? ''))) {
                continue;
            }

            $sourceTarget = $source['target'] ?? null;
            if ($target === null && $sourceTarget === null) {
                throw new \RuntimeException('A local manifest session waiting for a receiver address is already active.');
            }
            if ($target !== null && $sourceTarget === $target) {
                throw new \RuntimeException('An active synchronization session already targets this receiver.');
            }
        }
    }

    private function requireJob(string $id, string $role): array
    {
        $job = $this->store->get($id);
        if ($job === null || ($job['role'] ?? null) !== $role) {
            throw new \InvalidArgumentException('Data synchronization session was not found.');
        }
        return $job;
    }

    private function requireDriverJob(string $id): array
    {
        $job = $this->store->get($id);
        if ($job === null || !in_array($job['role'] ?? null, ['source', 'fetcher'], true)) {
            throw new \InvalidArgumentException('Data synchronization session was not found.');
        }
        return $job;
    }

    private function requireAnyJob(string $id): array
    {
        $job = $this->store->get($id);
        if ($job === null) {
            throw new \InvalidArgumentException('Data synchronization session was not found.');
        }
        return $job;
    }

    private function requireExporter(string $id, string $token): array
    {
        $job = $this->requireJob($id, 'exporter');
        if (!hash_equals((string) ($job['context']['token'] ?? ''), $token)) {
            throw new \RuntimeException('Invalid data synchronization peer token.');
        }
        return $job;
    }

    private function requireReadyExporter(string $id, string $token): array
    {
        $job = $this->requireExporter($id, $token);
        if ($job['status'] === 'failed') {
            throw new \RuntimeException((string) ($job['error'] ?? 'Exporter synchronization failed.'));
        }
        if ($job['status'] === 'completed') {
            throw new \RuntimeException('Exporter synchronization is already complete.');
        }
        if (empty($job['context']['ready'])) {
            throw new \RuntimeException('Exporter manifest preparation is not complete.');
        }
        return $job;
    }

    /**
     * Writers (receiver, fetcher) mutate local databases and resource roots,
     * so they are exclusive with every other session role.
     */
    private function assertNoActiveWriter(string $message): void
    {
        foreach (['receiver', 'fetcher'] as $role) {
            foreach ($this->store->activeAll($role) as $active) {
                if ($this->cancelRequested((string) ($active['id'] ?? ''))) {
                    continue;
                }
                throw new \RuntimeException($message);
            }
        }
    }

    /**
     * Readers (source, exporter) stream local data; a new writer must not
     * start while any of them is active.
     */
    private function assertNoActiveReader(): void
    {
        foreach (['source', 'exporter'] as $role) {
            foreach ($this->store->activeAll($role) as $active) {
                if ($this->cancelRequested((string) ($active['id'] ?? ''))) {
                    continue;
                }
                throw new \RuntimeException('This node already has an active outgoing synchronization session.');
            }
        }
    }

    private function withSessionLock(string $id, callable $callback, ?string $receiverToken = null): mixed
    {
        $result = $this->sessionLock->run($id, function () use ($id, $callback, $receiverToken): mixed {
            try {
                if ($this->cancelRequested($id)) {
                    $this->applyCancel($id);
                    throw new \RuntimeException('The synchronization session has been cancelled.');
                }
                return $callback();
            } catch (\Throwable $exception) {
                $job = $this->store->get($id);
                if (
                    $receiverToken !== null
                    && $job !== null
                    && in_array($job['role'] ?? null, ['receiver', 'exporter'], true)
                    && in_array($job['status'] ?? null, ['queued', 'running'], true)
                    && hash_equals((string) ($job['context']['token'] ?? ''), $receiverToken)
                ) {
                    $job['status'] = 'failed';
                    $job['error'] = $exception->getMessage();
                    $this->store->markCurrentStep($job, 'failed', $exception->getMessage());
                }
                throw $exception;
            }
        });

        if (!$result['acquired']) {
            throw new \RuntimeException('The synchronization session is busy; retry the request.');
        }

        return $result['result'];
    }

    private function requireReceiver(string $id, string $token): array
    {
        $job = $this->requireJob($id, 'receiver');
        if (!hash_equals((string) ($job['context']['token'] ?? ''), $token)) {
            throw new \RuntimeException('Invalid data synchronization peer token.');
        }
        return $job;
    }

    private function requireReadyReceiver(string $id, string $token): array
    {
        $job = $this->requireReceiver($id, $token);
        if ($job['status'] === 'failed') {
            throw new \RuntimeException((string) ($job['error'] ?? 'Receiver synchronization failed.'));
        }
        if ($job['status'] === 'completed') {
            throw new \RuntimeException('Receiver synchronization is already complete.');
        }
        if (empty($job['context']['ready'])) {
            throw new \RuntimeException('Receiver backup is not complete.');
        }
        return $job;
    }

    private function receiverHandshake(array $job): array
    {
        return [
            'id' => $job['id'],
            'protocol_version' => (int) ($job['protocol_version'] ?? 0),
            'token' => $job['context']['token'],
            'status' => $job['status'],
            'backup_directory' => $job['backup_directory'],
        ];
    }

    private function exporterHandshake(array $job): array
    {
        return [
            'id' => $job['id'],
            'protocol_version' => (int) ($job['protocol_version'] ?? 0),
            'token' => $job['context']['token'],
            'status' => $job['status'],
        ];
    }

    private function publicReceiverJob(array $job): array
    {
        return $this->store->summary($job);
    }

    private function publicJob(array $job): array
    {
        $job = $this->store->summary($job);
        unset($job['context']['peer_token']);
        return $job;
    }

    private function completed(array $job, ?string $detail = null): array
    {
        return ['done' => true, 'detail' => $detail, 'job' => $job];
    }

    private function waiting(array $job, string $detail): array
    {
        return ['done' => false, 'detail' => $detail, 'job' => $job];
    }
}
