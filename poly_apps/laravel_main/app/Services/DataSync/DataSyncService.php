<?php

namespace App\Services\DataSync;

use App\Services\Dashboard\DatabaseManagerService;
use App\Utils\FileSystemManager;
use App\Utils\SystemArchiveManager;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

final class DataSyncService
{
    public const PROTOCOL_VERSION = 2;
    private const START_LOCK_SECONDS = 15;
    private const REQUEST_TIMEOUT_SECONDS = 60;
    private int $sourceCursor = 0;

    public function __construct(
        private readonly DataSyncStateStore $store,
        private readonly DatabaseSyncService $databases,
        private readonly ResourceSyncService $resources,
        private readonly DataSyncSessionLock $sessionLock,
        private readonly DataSyncTransferPlanStore $plans,
        private readonly DataSyncReceiptStore $receipts
    ) {}

    public function start(string $target, bool $syncDatabases, bool $syncResources, bool $compression): array
    {
        $targetInput = trim($target);
        $normalizedTarget = $targetInput !== '' ? $this->normalizeAddress($targetInput) : null;
        $lock = Cache::store('file')->lock('data-sync:start', self::START_LOCK_SECONDS);

        if (!$syncDatabases && !$syncResources) {
            throw new \InvalidArgumentException('At least one synchronization scope must be enabled.');
        }
        if (!$lock->get()) {
            throw new \RuntimeException('Another synchronization start request is already being processed.');
        }

        try {
            $activeReceiver = $this->store->active('receiver');
            if ($activeReceiver !== null) {
                throw new \RuntimeException('An incoming synchronization session is active on this node.');
            }
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
            return $this->publicJob($job);
        } finally {
            $lock->release();
        }
    }

    public function setTarget(string $id, string $target): array
    {
        $targetInput = trim($target);
        $normalizedTarget = $this->normalizeAddress($targetInput);
        $lock = Cache::store('file')->lock('data-sync:start', self::START_LOCK_SECONDS);

        if (!$lock->get()) {
            throw new \RuntimeException('Another synchronization target request is already being processed.');
        }

        try {
            return $this->withSessionLock($id, function () use ($id, $targetInput, $normalizedTarget): array {
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
            });
        } finally {
            $lock->release();
        }
    }

    public function list(): array
    {
        $jobs = array_merge(
            $this->store->listSummaries('source'),
            $this->store->listSummaries('receiver')
        );
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
            $job = $this->requireJob($id, 'source');
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
            $job = $this->requireJob($id, 'source');
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

    public function health(): array
    {
        return [
            'service' => 'laravel-main-data-sync',
            'protocol_version' => self::PROTOCOL_VERSION,
            'compression_available' => SystemArchiveManager::available(),
            'default_port' => 9000,
        ];
    }

    public function prepareReceiver(
        string $sourceJobId,
        string $prepareToken,
        array $options,
        ?string $sourceAddress = null
    ): array
    {
        $lock = Cache::store('file')->lock('data-sync:start', self::START_LOCK_SECONDS);

        if (!$lock->get()) {
            throw new \RuntimeException('Another receiver preparation request is already being processed.');
        }

        try {
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
            if ($this->store->active('source') !== null) {
                throw new \RuntimeException('This node already has an active source synchronization session.');
            }

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
        } finally {
            $lock->release();
        }
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
        $sources = array_values(array_filter(
            $this->store->activeAll('source'),
            static fn (array $source): bool => $source['status'] !== 'paused'
        ));

        if ($receiver !== null && $receiver['status'] !== 'paused') {
            $this->advanceReceiverWithLock((string) $receiver['id']);
        }
        if ($sources !== []) {
            $sourceIndex = $this->sourceCursor % count($sources);
            $this->sourceCursor = ($sourceIndex + 1) % count($sources);
            $this->advanceSourceWithLock((string) $sources[$sourceIndex]['id']);
        }
    }

    private function advanceReceiverWithLock(string $id): void
    {
        $result = $this->sessionLock->run($id, function () use ($id): void {
            $receiver = $this->store->get($id);
            if ($receiver === null || $receiver['status'] === 'paused') {
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
        });

        if (!$result['acquired']) {
            return;
        }
    }

    private function advanceSourceWithLock(string $id): void
    {
        $result = $this->sessionLock->run($id, function () use ($id): void {
            $source = $this->store->get($id);
            if ($source === null || $source['status'] === 'paused') {
                return;
            }
            $this->advanceSource($source);
        });

        if (!$result['acquired']) {
            return;
        }
    }

    private function advanceReceiver(array $job): void
    {
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

    private function advanceSource(array $job): void
    {
        $key = $job['steps'][$job['current_step']]['key'] ?? null;
        $result = null;

        if ($key === null) {
            return;
        }

        $job['status'] = 'running';
        $job = $this->store->markCurrentStep($job, 'running');

        try {
            $result = $this->executeSourceStep($job, $key);
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

    private function executeSourceStep(array $job, string $key): array
    {
        return match ($key) {
            'validate_request' => $this->completed($job),
            'normalize_peer_address' => $this->normalizeTarget($job),
            'acquire_source_lock', 'create_persistent_session' => $this->completed($job),
            'probe_peer_health' => $this->probePeer($job),
            'negotiate_protocol' => $this->negotiateProtocol($job),
            'create_receiver_session' => $this->createPeerSession($job),
            'wait_receiver_lock', 'wait_receiver_backup' => $this->waitForReceiver($job),
            'discover_source_databases' => $this->discoverSourceDatabases($job),
            'discover_receiver_databases' => $this->discoverReceiverDatabases($job),
            'validate_database_compatibility', 'validate_table_structures' => $this->validateInventories($job),
            'record_receiver_backup_directory' => $this->recordBackupDirectory($job),
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
            'fetch_receiver_resource_manifests' => $this->fetchReceiverResourceManifests($job),
            'calculate_resource_differences' => $this->calculateResourceDifferences($job),
            'prepare_resource_batches' => $this->prepareResourceBatches($job),
            'initialize_resource_checkpoints' => $this->initializeResourceCheckpoints($job),
            'transfer_resource_chunks' => $this->transferResourceChunk($job),
            'verify_resource_manifests' => $this->verifyResourceManifests($job),
            'finalize_receiver_session' => $this->finalizePeer($job),
            'complete' => $this->completed($job, 'Synchronization completed.'),
            default => $this->completed($job),
        };
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

        $job['target'] = $this->normalizeAddress($input);
        $job['context']['awaiting_target'] = false;
        return $this->completed($this->store->save($job), $job['target']);
    }

    private function normalizeAddress(string $input): string
    {
        $trimmedInput = trim($input);
        $rawIpv6 = !str_contains($trimmedInput, '://')
            && filter_var($trimmedInput, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false;
        $candidate = $rawIpv6
            ? 'http://[' . $trimmedInput . ']'
            : (str_contains($trimmedInput, '://') ? $trimmedInput : 'http://' . $trimmedInput);
        $parts = parse_url($candidate);
        if (!is_array($parts)) {
            throw new \InvalidArgumentException('The peer address is not a valid IP address or host with an optional port.');
        }
        $scheme = strtolower((string) ($parts['scheme'] ?? 'http'));
        $host = trim((string) ($parts['host'] ?? ''), '[]');
        $port = (int) ($parts['port'] ?? 9000);
        $path = (string) ($parts['path'] ?? '');

        if (
            !in_array($scheme, ['http', 'https'], true)
            || $host === ''
            || $port < 1
            || $port > 65535
            || !in_array($path, ['', '/'], true)
            || isset($parts['user'])
            || isset($parts['pass'])
            || isset($parts['query'])
            || isset($parts['fragment'])
        ) {
            throw new \InvalidArgumentException('The peer address is not a valid IP address or host with an optional port.');
        }

        $normalizedHost = strtolower($host);
        $displayHost = str_contains($normalizedHost, ':') ? "[{$normalizedHost}]" : $normalizedHost;
        return "{$scheme}://{$displayHost}:{$port}";
    }

    private function probePeer(array $job): array
    {
        $response = $this->peerCall($job, 'GET', '/health');
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        $job['context']['peer_health'] = $response;
        return $this->completed($this->store->save($job));
    }

    private function negotiateProtocol(array $job): array
    {
        $peerVersion = (int) ($job['context']['peer_health']['protocol_version'] ?? 0);
        if ($peerVersion !== self::PROTOCOL_VERSION) {
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
        $response = $this->peerCall($job, 'POST', '/prepare', [
            'source_job_id' => $job['id'],
            'prepare_token' => $prepareToken,
            'options' => $job['options'],
        ], false);
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        $job['context']['peer_session_id'] = $response['id'];
        $job['context']['peer_token'] = $response['token'];
        unset($job['context']['prepare_token']);
        return $this->completed($this->store->save($job));
    }

    private function waitForReceiver(array $job): array
    {
        $response = $this->peerStatus($job);
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
        $tableCount = 0;
        $rowCount = 0;

        foreach ($inventory as $database) {
            $tableCount += count($database['tables'] ?? []);
            foreach ($database['tables'] ?? [] as $table) {
                $rowCount += max(0, (int) ($table['rows'] ?? 0));
            }
        }

        $job['context']['source_inventory'] = $inventory;
        $job['context']['local_manifest'] = array_merge(
            $job['context']['local_manifest'] ?? [],
            [
                'databases' => count($inventory),
                'tables' => $tableCount,
                'rows' => $rowCount,
            ]
        );
        return $this->store->save($job);
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
        $response = $this->peerCall($job, 'GET', '/database-inventory');
        if (isset($response['__waiting'])) {
            return $this->waiting($job, $response['__waiting']);
        }
        $job['context']['receiver_inventory'] = $response['databases'] ?? [];
        return $this->completed($this->store->save($job));
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
        $response = $this->peerCall($job, 'POST', '/database-chunks', [
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
            $sequenceResponse = $this->peerCall($job, 'POST', '/database-sequences', [
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

    private function verifyDatabaseCounts(array $job): array
    {
        if (empty($job['options']['databases'])) {
            return $this->completed($job, 'Database synchronization disabled.');
        }
        $response = $this->peerCall($job, 'GET', '/database-inventory');
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
        $response = $this->peerCall($job, 'POST', '/database-complete');
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
            $response = $this->peerCall($job, 'GET', '/resources/' . rawurlencode($key) . '/manifest');
            if (isset($response['__waiting'])) {
                return $this->waiting($job, $response['__waiting']);
            }
            $manifests[$key] = $response['files'] ?? [];
        }
        $job['context']['receiver_resource_manifests'] = $manifests;
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

    private function initializeResourceCheckpoints(array $job): array
    {
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

    private function transferResourceChunk(array $job): array
    {
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
        $response = $this->peerCall($job, 'POST', $path, $payload);
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

    private function verifyResourceManifests(array $job): array
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

        foreach ($expectedByRoot as $key => $expectedFiles) {
            $response = $this->peerCall($job, 'GET', '/resources/' . rawurlencode($key) . '/manifest');
            if (isset($response['__waiting'])) {
                return $this->waiting($job, $response['__waiting']);
            }
            foreach ($expectedFiles as $relativePath => $expected) {
                if (($response['files'][$relativePath] ?? null) !== $expected) {
                    throw new \RuntimeException("Receiver resource verification failed: {$key}/{$relativePath}");
                }
            }
        }
        $this->plans->forgetResourceItems((string) $job['id']);
        return $this->completed($job);
    }

    private function finalizePeer(array $job): array
    {
        $response = $this->peerCall($job, 'POST', '/finalize');
        return isset($response['__waiting'])
            ? $this->waiting($job, $response['__waiting'])
            : $this->completed($job);
    }

    private function peerStatus(array $job): array
    {
        return $this->peerCall($job, 'GET', '/sessions/' . rawurlencode((string) $job['context']['peer_session_id']));
    }

    private function peerCall(
        array $job,
        string $method,
        string $path,
        array $payload = [],
        bool $authenticated = true
    ): array {
        if ($authenticated && !str_starts_with($path, '/sessions/')) {
            $path = '/sessions/' . rawurlencode((string) $job['context']['peer_session_id']) . $path;
        }
        $url = rtrim((string) $job['target'], '/') . '/api/dashboard/db-manager/sync-peer' . $path;
        $request = Http::acceptJson()->connectTimeout(5)->timeout(self::REQUEST_TIMEOUT_SECONDS)->retry([250, 500], throw: false);

        if ($authenticated) {
            $request = $request->withHeaders(['X-Data-Sync-Token' => (string) ($job['context']['peer_token'] ?? '')]);
        }

        try {
            $response = $method === 'GET'
                ? $request->get($url, $payload)
                : $request->send($method, $url, ['json' => $payload]);
        } catch (ConnectionException $exception) {
            return ['__waiting' => $exception->getMessage()];
        }

        if (in_array($response->status(), [502, 503, 504], true)) {
            return ['__waiting' => "Peer HTTP {$response->status()}; retrying idempotently."];
        }
        if ($response->serverError()) {
            $isStatusRequest = preg_match('#^/sessions/[^/]+$#', $path) === 1;
            if ($authenticated && !$isStatusRequest) {
                $receiver = $this->peerStatus($job);
                if (!isset($receiver['__waiting']) && ($receiver['status'] ?? null) === 'failed') {
                    throw new \RuntimeException((string) ($receiver['error'] ?? 'Receiver synchronization failed.'));
                }
            }
            throw new \RuntimeException(
                (string) ($response->json('message') ?? "Peer HTTP {$response->status()}")
            );
        }
        if ($response->status() === 429) {
            return ['__waiting' => "Peer HTTP {$response->status()}; retrying idempotently."];
        }
        if (!$response->successful()) {
            throw new \RuntimeException((string) ($response->json('message') ?? "Peer HTTP {$response->status()}"));
        }

        return (array) ($response->json('data') ?? $response->json());
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

    private function assertSourceTargetAvailable(?string $target, ?string $excludedId = null): void
    {
        foreach ($this->store->activeAll('source') as $source) {
            if (($source['id'] ?? null) === $excludedId) {
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

    private function withSessionLock(string $id, callable $callback, ?string $receiverToken = null): mixed
    {
        $result = $this->sessionLock->run($id, function () use ($id, $callback, $receiverToken): mixed {
            try {
                return $callback();
            } catch (\Throwable $exception) {
                $job = $this->store->get($id);
                if (
                    $receiverToken !== null
                    && $job !== null
                    && ($job['role'] ?? null) === 'receiver'
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
            'token' => $job['context']['token'],
            'status' => $job['status'],
            'backup_directory' => $job['backup_directory'],
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
