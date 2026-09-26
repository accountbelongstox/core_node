<?php

namespace App\Services\DataSync;

use App\Services\Dashboard\DatabaseManagerService;
use App\Utils\SystemArchiveManager;
use Illuminate\Support\Facades\Context;

/**
 * Driver session roles: a source pushes local data into a remote receiver,
 * a fetcher pulls data from a remote exporter into this node. Each timer
 * tick advances the session for a bounded time budget.
 */
final class DataSyncDriverService
{
    private const SKIP_LIST_LIMIT = 200;

    public function __construct(
        private readonly DataSyncStateStore $store,
        private readonly DataSyncArtifactStore $artifacts,
        private readonly DataSyncSessionRuntime $runtime,
        private readonly DatabaseSyncService $databases,
        private readonly ResourceSyncService $resources,
        private readonly DataSyncPeerClient $peer,
        private readonly DataSyncMachineIdentity $machine
    ) {}

    /**
     * @return bool whether the session lock was acquired
     */
    public function advance(string $id): bool
    {
        $result = Context::scope(
            fn (): array => $this->runtime->tryLock($id, function () use ($id): void {
                $job = $this->store->get($id);
                if ($job === null || !$this->runtime->isActive($job)) {
                    return;
                }
                if ($this->runtime->cancelRequested($id)) {
                    $this->finishCancelled($job);
                    return;
                }
                if ($job['status'] === 'paused') {
                    $this->keepalive($job);
                    return;
                }
                $this->run($job);
            }),
            data: ['data_sync_session_id' => $id, 'data_sync_role' => 'driver']
        );

        return (bool) ($result['acquired'] ?? false);
    }

    /**
     * Operator cancel: applied at once when the session is idle, otherwise
     * at the running tick's next boundary.
     */
    public function cancel(array $job): array
    {
        $id = (string) $job['id'];
        $this->runtime->requestCancel($id);
        $result = $this->runtime->tryLock($id, function () use ($id): ?array {
            $current = $this->store->get($id);
            return $current !== null && $this->runtime->isActive($current) ? $this->finishCancelled($current) : $current;
        });

        if ($result['acquired']) {
            return $result['result'] ?? $job;
        }
        $job['context']['cancel_requested'] = true;
        return $job;
    }

    public function finishCancelled(array $job): array
    {
        $job = $this->runtime->finish($job, 'cancelled', DataSyncProtocol::CANCELLED_MESSAGE);
        $this->cancelPeer($job);
        return $job;
    }

    private function run(array $job): void
    {
        $id = (string) $job['id'];
        $deadline = microtime(true) + DataSyncProtocol::DRIVER_TICK_BUDGET_SECONDS;

        try {
            if ((int) ($job['protocol_version'] ?? 0) !== DataSyncProtocol::VERSION) {
                throw new \RuntimeException('The session protocol version is incompatible.');
            }
            do {
                if ($this->runtime->cancelRequested($id)) {
                    throw new DataSyncAbortException();
                }
                $key = $job['steps'][$job['current_step']]['key'] ?? null;
                if ($key === null) {
                    return;
                }
                if ($job['status'] !== 'running' || $job['steps'][$job['current_step']]['status'] !== 'running') {
                    $job['status'] = 'running';
                    $job = $this->store->markCurrentStep($job, 'running', $job['steps'][$job['current_step']]['detail'] ?? null);
                }
                $job = $this->refreshCounterpart($job, $key);

                $result = $this->executeStep($job, (string) $key);
                $job = $result['job'];
                if ($result['done'] && $key === 'complete') {
                    $job['steps'][$job['current_step']]['status'] = 'completed';
                    $job['steps'][$job['current_step']]['completed_at'] = now()->toIso8601String();
                    $this->runtime->finish($job, 'completed');
                    return;
                }
                $job = $this->store->markCurrentStep($job, $result['done'] ? 'completed' : 'running', $result['detail']);
            } while (($result['done'] || $result['progress']) && microtime(true) < $deadline);
        } catch (DataSyncAbortException) {
            $this->finishCancelled($this->store->get($id) ?? $job);
        } catch (\Throwable $exception) {
            $job = $this->runtime->finish($this->store->get($id) ?? $job, 'failed', $exception->getMessage());
            $this->cancelPeer($job);
        }
    }

    private function keepalive(array $job): void
    {
        $observed = strtotime((string) ($job['context']['counterpart_observed_at'] ?? '')) ?: 0;
        if (time() - $observed < DataSyncProtocol::KEEPALIVE_SECONDS) {
            return;
        }
        try {
            $this->refreshCounterpart($job, null, true);
        } catch (\Throwable $exception) {
            $this->runtime->finish($this->store->get((string) $job['id']) ?? $job, 'failed', $exception->getMessage());
        }
    }

    private function cancelPeer(array $job): void
    {
        if (empty($job['context']['peer_session_id']) || empty($job['context']['peer_token'])) {
            return;
        }
        try {
            $this->peer->call($job, 'POST', '/cancel');
        } catch (\Throwable) {
            // The passive side also ends itself once the driver stays idle.
        }
    }

    private function refreshCounterpart(array $job, ?string $key, bool $force = false): array
    {
        if (empty($job['context']['peer_session_id']) || empty($job['context']['peer_token'])) {
            return $job;
        }
        $observed = strtotime((string) ($job['context']['counterpart_observed_at'] ?? '')) ?: 0;
        if (!$force && time() - $observed < DataSyncProtocol::COUNTERPART_REFRESH_SECONDS) {
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
        $job = $this->store->save($job);

        if (in_array($response['status'] ?? null, ['failed', 'cancelled'], true)) {
            throw new \RuntimeException('Peer session ended: ' . ($response['error'] ?? $response['status']));
        }
        if (($response['status'] ?? null) === 'completed' && $key !== 'complete' && !str_starts_with((string) $key, 'finalize_')) {
            throw new \RuntimeException('Peer session completed before the transfer finished.');
        }
        return $job;
    }

    private function executeStep(array $job, string $key): array
    {
        $isFetcher = $job['role'] === 'fetcher';

        return match ($key) {
            'validate_request' => $this->done($job),
            'normalize_peer_address' => $this->normalizeTarget($job),
            'probe_peer_health' => $this->probePeer($job),
            'negotiate_protocol' => $this->negotiateProtocol($job),
            'create_receiver_session' => $this->createPeerSession($job, '/prepare', 'source_job_id', '/sessions/'),
            'create_exporter_session' => $this->createPeerSession($job, '/export-prepare', 'fetcher_job_id', '/export-sessions/'),
            'wait_receiver_lock' => $this->waitPeer($job, false),
            'wait_receiver_backup', 'wait_exporter_ready' => $this->waitPeer($job, true),
            'discover_source_databases' => $this->discoverLocalInventory($job, 'source_inventory'),
            'discover_fetcher_databases' => $this->discoverLocalInventory($job, 'target_inventory'),
            'discover_receiver_databases' => $this->fetchPeerInventory($job, 'target_inventory'),
            'fetch_exporter_database_inventory' => $this->fetchPeerInventory($job, 'source_inventory'),
            'backup_fetcher_databases' => $this->backupLocalDatabase($job),
            'record_backup_directory' => $this->done($job, $job['backup_directory'] ?? null),
            'record_receiver_backup_directory' => $this->recordPeerBackupDirectory($job),
            'validate_database_compatibility' => $this->buildDatabasePlan($job),
            'initialize_database_checkpoints' => $this->initializeDatabaseCheckpoints($job),
            'transfer_database_chunks' => $isFetcher ? $this->pullDatabaseChunk($job) : $this->pushDatabaseChunk($job),
            'apply_database_differences' => $this->peerCall($job, 'POST', '/database-complete'),
            'verify_database_counts' => $this->verifyDatabaseCounts($job),
            'verify_database_digests' => $this->done($job, ($job['context']['database_results']['verified'] ?? 0) . ' rows verified.'),
            'discover_resource_roots' => $this->discoverResourceRoots($job),
            'build_source_resource_manifests' => $this->buildLocalManifests($job, 'source_manifest'),
            'build_fetcher_resource_manifests' => $this->buildLocalManifests($job, 'target_manifest'),
            'fetch_receiver_resource_manifests' => $this->fetchPeerManifests($job, 'target_manifest'),
            'fetch_exporter_resource_manifests' => $this->fetchPeerManifests($job, 'source_manifest'),
            'calculate_resource_differences' => $this->buildResourcePlan($job),
            'prepare_resource_batches' => $this->prepareArchives($job),
            'initialize_resource_checkpoints' => $this->initializeResourceCheckpoints($job),
            'transfer_resource_chunks' => $this->transferResourceItem($job),
            'verify_resource_manifests' => $this->verifyResources($job),
            'finalize_receiver_session', 'finalize_exporter_session' => $this->peerCall($job, 'POST', '/finalize'),
            'complete' => $this->done($job, 'Synchronization completed.'),
            default => throw new \RuntimeException("Unknown synchronization step: {$key}"),
        };
    }

    // ------------------------------------------------------------ handshake

    private function normalizeTarget(array $job): array
    {
        $input = trim((string) ($job['target_input'] ?? ''));
        if ($input === '') {
            $job['context']['awaiting_target'] = true;
            return $this->wait($this->store->save($job), 'Receiver IP or host is required to continue.');
        }
        $job['target'] = $this->peer->normalizeAddress($input);
        $job['context']['awaiting_target'] = false;
        return $this->done($this->store->save($job), $job['target']);
    }

    private function probePeer(array $job): array
    {
        $response = $this->peer->call($job, 'GET', '/health', [], false);
        if (isset($response['__waiting'])) {
            return $this->wait($job, $response['__waiting']);
        }
        $peerMachineCode = (string) ($response['machine_code'] ?? '');
        if ($peerMachineCode !== '' && hash_equals($this->machine->code(), $peerMachineCode)) {
            throw new \RuntimeException('The peer is this same machine; choose a different node.');
        }
        $job['context']['peer_health'] = $response;
        return $this->done($this->store->save($job), $peerMachineCode !== '' ? substr($peerMachineCode, 0, 12) : null);
    }

    private function negotiateProtocol(array $job): array
    {
        $peerVersion = (int) ($job['context']['peer_health']['protocol_version'] ?? 0);
        if ($peerVersion !== DataSyncProtocol::VERSION) {
            throw new \RuntimeException("Peer protocol version {$peerVersion} differs from local version " . DataSyncProtocol::VERSION . '.');
        }
        if (!empty($job['options']['compression'])
            && (empty($job['context']['peer_health']['compression_available']) || !SystemArchiveManager::available())) {
            throw new \RuntimeException('7-Zip compression was selected but system 7-Zip is not available on both nodes.');
        }
        return $this->done($job, 'v' . DataSyncProtocol::VERSION);
    }

    private function createPeerSession(array $job, string $path, string $idField, string $basePath): array
    {
        if (!empty($job['context']['peer_session_id'])) {
            return $this->done($job);
        }
        $job['context']['prepare_token'] ??= bin2hex(random_bytes(32));
        $response = $this->peer->call($job, 'POST', $path, [
            $idField => $job['id'],
            'prepare_token' => $job['context']['prepare_token'],
            'options' => $job['options'],
        ], false);
        if (isset($response['__waiting'])) {
            return $this->wait($this->store->save($job), $response['__waiting']);
        }
        if ((int) ($response['protocol_version'] ?? 0) !== DataSyncProtocol::VERSION) {
            throw new \RuntimeException('The prepared peer session protocol version is incompatible.');
        }
        $job['context']['peer_session_id'] = (string) $response['id'];
        $job['context']['peer_base_path'] = $basePath . rawurlencode((string) $response['id']);
        $job['context']['peer_token'] = (string) $response['token'];
        unset($job['context']['prepare_token']);
        return $this->done($this->store->save($job), (string) $response['id']);
    }

    private function waitPeer(array $job, bool $requireReady): array
    {
        $response = $this->peer->status($job);
        if (isset($response['__waiting'])) {
            return $this->wait($job, $response['__waiting']);
        }
        $job['context']['receiver'] = $response;
        $job = $this->store->save($job);
        if (in_array($response['status'] ?? null, ['failed', 'cancelled'], true)) {
            throw new \RuntimeException((string) ($response['error'] ?? 'Peer preparation failed.'));
        }
        if (!$requireReady || !empty($response['context']['ready'])) {
            return $this->done($job);
        }
        $peerStep = $response['steps'][$response['current_step'] ?? 0] ?? null;
        return $this->wait($job, 'Waiting for peer: ' . ($peerStep['key'] ?? 'preparation') . (!empty($peerStep['detail']) ? " ({$peerStep['detail']})" : ''));
    }

    // ------------------------------------------------------------ databases

    private function discoverLocalInventory(array $job, string $artifact): array
    {
        if (empty($job['options']['databases'])) {
            return $this->done($job, 'Database synchronization disabled.');
        }
        $inventory = $this->databases->inventory($this->runtime->abortHook((string) $job['id']));
        $this->artifacts->put((string) $job['id'], $artifact, $inventory);
        if ($artifact === 'source_inventory') {
            $job['context']['local_manifest'] = array_merge(
                $job['context']['local_manifest'] ?? [],
                DataSyncPassiveService::inventorySummary($inventory)
            );
        }
        return $this->done($this->store->save($job), DataSyncPassiveService::inventorySummary($inventory)['tables'] . ' tables');
    }

    private function fetchPeerInventory(array $job, string $artifact): array
    {
        if (empty($job['options']['databases'])) {
            return $this->done($job, 'Database synchronization disabled.');
        }
        if ($job['role'] === 'source' && empty($job['context']['source_inventory_refreshed'])) {
            // The draft may have waited for an address; take a fresh snapshot.
            $job = $this->discoverLocalInventory($job, 'source_inventory')['job'];
            $job['context']['source_inventory_refreshed'] = true;
            $job = $this->store->save($job);
        }
        $response = $this->peer->call($job, 'GET', '/database-inventory');
        if (isset($response['__waiting'])) {
            return $this->wait($job, 'Waiting for peer inventory.');
        }
        $inventory = (array) ($response['databases'] ?? []);
        $this->artifacts->put((string) $job['id'], $artifact, $inventory);
        if ($artifact === 'source_inventory') {
            $job['context']['local_manifest'] = array_merge(
                $job['context']['local_manifest'] ?? [],
                DataSyncPassiveService::inventorySummary($inventory)
            );
        }
        return $this->done($this->store->save($job), DataSyncPassiveService::inventorySummary($inventory)['tables'] . ' tables');
    }

    private function backupLocalDatabase(array $job): array
    {
        if (empty($job['options']['databases'])) {
            return $this->done($job, 'Database synchronization disabled.');
        }
        $connections = DatabaseManagerService::physicalConnections();
        $index = count($job['context']['backups'] ?? []);
        if (!isset($connections[$index])) {
            return $this->done($job, "{$index} backups created.");
        }
        $job['context']['backups'][] = DatabaseManagerService::backup((string) $connections[$index]['connection']);
        $job = $this->store->save($job);
        return isset($connections[$index + 1])
            ? $this->progress($job, ($index + 1) . '/' . count($connections) . ' backups created.')
            : $this->done($job, count($connections) . ' backups created.');
    }

    private function recordPeerBackupDirectory(array $job): array
    {
        $job['backup_directory'] = !empty($job['options']['databases'])
            ? ($job['context']['receiver']['backup_directory'] ?? null)
            : null;
        return $this->done($this->store->save($job), $job['backup_directory']);
    }

    /**
     * Only tables present on both nodes with identical columns and identity
     * are transferred; every other table is recorded with its skip reason.
     */
    private function buildDatabasePlan(array $job): array
    {
        $plan = [];
        $skipped = [];

        if (!empty($job['options']['databases'])) {
            $source = $this->inventoryMap($this->artifacts->require((string) $job['id'], 'source_inventory'));
            $target = $this->inventoryMap($this->artifacts->require((string) $job['id'], 'target_inventory'));
            foreach ($source as $databaseKey => $database) {
                foreach ($database['tables'] as $tableName => $table) {
                    $targetTable = $target[$databaseKey]['tables'][$tableName] ?? null;
                    $reason = match (true) {
                        !isset($target[$databaseKey]) => 'database missing on target',
                        ($database['driver'] ?? null) !== ($target[$databaseKey]['driver'] ?? null) => 'driver differs',
                        $targetTable === null => 'table missing on target',
                        $this->columnSignatures($table['columns'] ?? []) !== $this->columnSignatures($targetTable['columns'] ?? []) => 'column structure differs',
                        ($table['identity'] ?? []) !== ($targetTable['identity'] ?? []) => 'identity differs',
                        default => null,
                    };
                    if ($reason !== null) {
                        $skipped[] = ['table' => "{$databaseKey}.{$tableName}", 'reason' => $reason];
                        continue;
                    }
                    $plan[] = ['connection' => $databaseKey, 'table' => $tableName, 'rows' => (int) $table['rows']];
                }
            }
        }

        $this->artifacts->put((string) $job['id'], 'database_plan', $plan);
        $job['context']['database_checkpoint_count'] = count($plan);
        $job['context']['database_results'] = [
            'inserted' => 0,
            'updated' => 0,
            'unchanged' => 0,
            'verified' => 0,
            'conflicts' => 0,
            'tables' => count($plan),
            'skipped_count' => count($skipped),
            'skipped' => array_slice($skipped, 0, self::SKIP_LIST_LIMIT),
        ];
        return $this->done($this->store->save($job), count($plan) . ' tables planned, ' . count($skipped) . ' skipped.');
    }

    private function initializeDatabaseCheckpoints(array $job): array
    {
        $job['context']['database_checkpoint_index'] ??= 0;
        $job['context']['database_checkpoint_offset'] ??= 0;
        return $this->done($this->store->save($job));
    }

    private function pushDatabaseChunk(array $job): array
    {
        [$entry, $offset] = $this->databaseCheckpoint($job);
        if ($entry === null) {
            return $this->done($job, 'All database chunks transferred.');
        }
        $chunk = $this->databases->readChunk($entry['connection'], $entry['table'], $offset);
        $response = $this->peer->call($job, 'POST', '/database-chunks', [
            'connection' => $entry['connection'],
            'table' => $entry['table'],
            'rows' => $chunk['rows'],
        ]);
        if (isset($response['__waiting'])) {
            return $this->wait($job, $response['__waiting']);
        }
        if (empty($response['success'])) {
            return $this->skipTable($job, $entry, (string) ($response['table_error'] ?? 'apply failed'));
        }
        if ($chunk['done']) {
            $sequence = $this->peer->call($job, 'POST', '/database-sequences', ['connection' => $entry['connection'], 'table' => $entry['table']]);
            if (isset($sequence['__waiting'])) {
                return $this->wait($job, $sequence['__waiting']);
            }
        }
        return $this->advanceDatabaseCheckpoint($job, $entry, $chunk, $response);
    }

    private function pullDatabaseChunk(array $job): array
    {
        [$entry, $offset] = $this->databaseCheckpoint($job);
        if ($entry === null) {
            return $this->done($job, 'All database chunks fetched.');
        }
        $chunk = $this->peer->call($job, 'GET', '/database-chunks', [
            'connection' => $entry['connection'],
            'table' => $entry['table'],
            'offset' => $offset,
        ]);
        if (isset($chunk['__waiting'])) {
            return $this->wait($job, $chunk['__waiting']);
        }
        try {
            $result = $this->databases->applyDiff($entry['connection'], $entry['table'], (array) ($chunk['rows'] ?? []));
            if (!empty($chunk['done'])) {
                $this->databases->advanceSequence($entry['connection'], $entry['table']);
            }
        } catch (\Illuminate\Database\QueryException|\InvalidArgumentException $exception) {
            return $this->skipTable($job, $entry, $exception->getMessage());
        }
        $job['context']['received']['database_rows'] = (int) ($job['context']['received']['database_rows'] ?? 0) + count((array) ($chunk['rows'] ?? []));
        return $this->advanceDatabaseCheckpoint($job, $entry, $chunk, $result);
    }

    private function databaseCheckpoint(array $job): array
    {
        $index = (int) ($job['context']['database_checkpoint_index'] ?? 0);
        $plan = empty($job['options']['databases']) ? [] : $this->artifacts->require((string) $job['id'], 'database_plan');

        return [$plan[$index] ?? null, (int) ($job['context']['database_checkpoint_offset'] ?? 0)];
    }

    private function advanceDatabaseCheckpoint(array $job, array $entry, array $chunk, array $counters): array
    {
        foreach (['inserted', 'updated', 'unchanged', 'verified', 'conflicts'] as $counter) {
            $job['context']['database_results'][$counter] = (int) ($job['context']['database_results'][$counter] ?? 0) + (int) ($counters[$counter] ?? 0);
        }
        foreach ((array) ($counters['conflict_samples'] ?? []) as $sample) {
            if (count($job['context']['database_results']['skipped'] ?? []) < self::SKIP_LIST_LIMIT) {
                $job['context']['database_results']['skipped'][] = [
                    'table' => "{$entry['connection']}.{$entry['table']}",
                    'reason' => 'row conflict: ' . $sample,
                ];
            }
        }
        $job['context']['database_checkpoint_offset'] = (int) ($chunk['next_offset'] ?? 0);
        if (!empty($chunk['done'])) {
            $job['context']['database_checkpoint_index'] = (int) $job['context']['database_checkpoint_index'] + 1;
            $job['context']['database_checkpoint_offset'] = 0;
        }
        $job = $this->store->save($job);
        $remaining = (int) $job['context']['database_checkpoint_index'] < (int) ($job['context']['database_checkpoint_count'] ?? 0);

        return $remaining
            ? $this->progress($job, "{$entry['connection']}.{$entry['table']} @ {$chunk['next_offset']}")
            : $this->done($job, 'All database chunks transferred.');
    }

    private function skipTable(array $job, array $entry, string $reason): array
    {
        $job['context']['database_results']['skipped_count'] = (int) ($job['context']['database_results']['skipped_count'] ?? 0) + 1;
        if (count($job['context']['database_results']['skipped'] ?? []) < self::SKIP_LIST_LIMIT) {
            $job['context']['database_results']['skipped'][] = [
                'table' => "{$entry['connection']}.{$entry['table']}",
                'reason' => mb_substr($reason, 0, 300),
            ];
        }
        $failed = $job['context']['database_results']['failed_tables'] ?? [];
        $failed[] = "{$entry['connection']}.{$entry['table']}";
        $job['context']['database_results']['failed_tables'] = $failed;

        return $this->advanceDatabaseCheckpoint($job, $entry, ['next_offset' => 0, 'done' => true], []);
    }

    private function verifyDatabaseCounts(array $job): array
    {
        if (empty($job['options']['databases'])) {
            return $this->done($job, 'Database synchronization disabled.');
        }
        if ($job['role'] === 'fetcher') {
            $counts = $this->databases->rowCounts();
        } else {
            $response = $this->peer->call($job, 'GET', '/database-counts');
            if (isset($response['__waiting'])) {
                return $this->wait($job, $response['__waiting']);
            }
            $counts = (array) ($response['counts'] ?? []);
        }
        $failed = array_flip($job['context']['database_results']['failed_tables'] ?? []);
        $incomplete = [];
        foreach ($this->artifacts->require((string) $job['id'], 'database_plan') as $entry) {
            $name = "{$entry['connection']}.{$entry['table']}";
            if (!isset($failed[$name]) && (int) ($counts[$entry['connection']][$entry['table']] ?? -1) < (int) $entry['rows']) {
                $incomplete[] = $name;
            }
        }
        $job['context']['database_results']['incomplete'] = array_slice($incomplete, 0, self::SKIP_LIST_LIMIT);
        return $this->done(
            $this->store->save($job),
            $incomplete === [] ? 'Target row counts cover every synchronized table.' : count($incomplete) . ' tables below the source snapshot count.'
        );
    }

    // ------------------------------------------------------------ resources

    private function discoverResourceRoots(array $job): array
    {
        $roots = !empty($job['options']['resources']) ? array_keys($this->resources->roots()) : [];
        $job['context']['resource_roots'] = $roots;
        return $this->done($this->store->save($job), implode(', ', $roots));
    }

    private function buildLocalManifests(array $job, string $prefix): array
    {
        if (empty($job['options']['resources'])) {
            return $this->done($job, 'Resource synchronization disabled.');
        }
        $job['context']['resource_roots'] ??= array_keys($this->resources->roots());
        $files = 0;
        $bytes = 0;
        foreach ($job['context']['resource_roots'] as $key) {
            $manifest = $this->resources->manifest($key, $this->runtime->abortHook((string) $job['id']))['files'];
            $this->artifacts->put((string) $job['id'], "{$prefix}-{$key}", $manifest);
            $files += count($manifest);
            $bytes += array_sum(array_column($manifest, 'size'));
        }
        if ($prefix === 'source_manifest') {
            $job['context']['local_manifest'] = array_merge($job['context']['local_manifest'] ?? [], [
                'resource_roots' => count($job['context']['resource_roots']),
                'resource_files' => $files,
                'resource_bytes' => $bytes,
            ]);
        }
        return $this->done($this->store->save($job), "{$files} files");
    }

    private function fetchPeerManifests(array $job, string $prefix): array
    {
        if (empty($job['options']['resources'])) {
            return $this->done($job, 'Resource synchronization disabled.');
        }
        if ($job['role'] === 'source' && empty($job['context']['source_manifest_refreshed'])) {
            $job = $this->buildLocalManifests($job, 'source_manifest')['job'];
            $job['context']['source_manifest_refreshed'] = true;
            $job = $this->store->save($job);
        }
        $files = 0;
        $bytes = 0;
        foreach ($job['context']['resource_roots'] ?? [] as $key) {
            $response = $this->peer->call($job, 'GET', '/resources/' . rawurlencode($key) . '/manifest');
            if (isset($response['__waiting'])) {
                return $this->wait($job, $response['__waiting']);
            }
            $manifest = (array) ($response['files'] ?? []);
            $this->artifacts->put((string) $job['id'], "{$prefix}-{$key}", $manifest);
            $files += count($manifest);
            $bytes += array_sum(array_column($manifest, 'size'));
        }
        if ($prefix === 'source_manifest') {
            $job['context']['local_manifest'] = array_merge($job['context']['local_manifest'] ?? [], [
                'resource_roots' => count($job['context']['resource_roots'] ?? []),
                'resource_files' => $files,
                'resource_bytes' => $bytes,
            ]);
        }
        return $this->done($this->store->save($job), "{$files} files");
    }

    /**
     * Plan items: 'batch' groups whole small files up to one chunk,
     * 'file' streams one large file in chunks, '7z' ships one archive per root.
     */
    private function buildResourcePlan(array $job): array
    {
        $items = [];
        $files = 0;
        $bytes = 0;

        foreach (!empty($job['options']['resources']) ? ($job['context']['resource_roots'] ?? []) : [] as $key) {
            $source = $this->artifacts->require((string) $job['id'], "source_manifest-{$key}");
            $target = $this->artifacts->require((string) $job['id'], "target_manifest-{$key}");
            $paths = $this->resources->diffManifests($source, $target);
            if ($paths === []) {
                continue;
            }
            $files += count($paths);
            $bytes += array_sum(array_map(static fn (string $path): int => (int) $source[$path]['size'], $paths));

            if (!empty($job['options']['compression'])) {
                $manifest = array_intersect_key($source, array_flip($paths));
                $items[] = ['mode' => '7z', 'key' => $key, 'paths' => $paths, 'manifest' => $manifest];
                continue;
            }
            $batch = [];
            $batchBytes = 0;
            foreach ($paths as $path) {
                $entry = ['relative_path' => $path, 'size' => (int) $source[$path]['size'], 'sha256' => (string) $source[$path]['sha256']];
                if ($entry['size'] > ResourceSyncService::CHUNK_BYTES) {
                    $items[] = ['mode' => 'file', 'key' => $key] + $entry;
                    continue;
                }
                if ($batch !== [] && (count($batch) >= ResourceSyncService::BATCH_MAX_FILES || $batchBytes + $entry['size'] > ResourceSyncService::CHUNK_BYTES)) {
                    $items[] = ['mode' => 'batch', 'key' => $key, 'files' => $batch];
                    $batch = [];
                    $batchBytes = 0;
                }
                $batch[] = $entry;
                $batchBytes += $entry['size'];
            }
            if ($batch !== []) {
                $items[] = ['mode' => 'batch', 'key' => $key, 'files' => $batch];
            }
        }

        $this->artifacts->put((string) $job['id'], 'resource_plan', $items);
        $job['context']['resource_checkpoint_count'] = count($items);
        $job['context']['resource_results'] = [
            'planned_files' => $files,
            'planned_bytes' => $bytes,
            'transferred_files' => 0,
            'transferred_bytes' => 0,
            'already_present' => 0,
            'skipped_count' => 0,
            'skipped' => [],
        ];
        return $this->done($this->store->save($job), "{$files} files, {$bytes} bytes to transfer.");
    }

    private function prepareArchives(array $job): array
    {
        if (empty($job['options']['compression'])) {
            return $this->done($job, 'Uncompressed batches prepared.');
        }
        $items = $this->artifacts->require((string) $job['id'], 'resource_plan');
        foreach ($items as $index => $item) {
            if (isset($item['sha256'])) {
                continue;
            }
            if ($job['role'] === 'fetcher') {
                $archive = $this->peer->call($job, 'POST', '/resource-archives', ['key' => $item['key'], 'paths' => $item['paths']]);
                if (isset($archive['__waiting'])) {
                    return $this->wait($job, $archive['__waiting']);
                }
            } else {
                $archive = $this->resources->createArchive((string) $job['id'], $item['key'], $item['paths']);
            }
            $items[$index]['size'] = (int) $archive['size'];
            $items[$index]['sha256'] = (string) $archive['sha256'];
            $this->artifacts->put((string) $job['id'], 'resource_plan', $items);
            return $this->progress($job, "Archive prepared: {$item['key']}");
        }
        return $this->done($job, 'System 7-Zip batches prepared.');
    }

    private function initializeResourceCheckpoints(array $job): array
    {
        $job['context']['resource_checkpoint_index'] ??= 0;
        $job['context']['resource_checkpoint_offset'] ??= 0;
        return $this->done($this->store->save($job));
    }

    private function transferResourceItem(array $job): array
    {
        $index = (int) ($job['context']['resource_checkpoint_index'] ?? 0);
        $items = empty($job['options']['resources']) ? [] : $this->artifacts->require((string) $job['id'], 'resource_plan');
        $item = $items[$index] ?? null;
        if ($item === null) {
            return $this->done($job, 'All resource batches transferred.');
        }

        return match ($item['mode']) {
            'batch' => $job['role'] === 'fetcher' ? $this->pullBatch($job, $item) : $this->pushBatch($job, $item),
            'file' => $job['role'] === 'fetcher' ? $this->pullFileChunk($job, $item) : $this->pushFileChunk($job, $item),
            default => $job['role'] === 'fetcher' ? $this->pullArchiveChunk($job, $item) : $this->pushArchiveChunk($job, $item),
        };
    }

    private function pullBatch(array $job, array $item): array
    {
        $done = (int) ($job['context']['resource_checkpoint_offset'] ?? 0);
        $pending = array_slice($item['files'], $done);
        $response = $this->peer->call($job, 'POST', '/resource-file-batch', [
            'items' => array_map(static fn (array $file): array => ['key' => $item['key'], 'relative_path' => $file['relative_path']], $pending),
        ]);
        if (isset($response['__waiting'])) {
            return $this->wait($job, $response['__waiting']);
        }
        $received = (array) ($response['files'] ?? []);
        if ($received === []) {
            throw new \RuntimeException('The exporter returned an empty resource batch.');
        }
        foreach ($received as $position => $file) {
            $planned = $pending[$position] ?? null;
            if ($planned === null || $planned['relative_path'] !== ($file['relative_path'] ?? null)) {
                throw new \RuntimeException('The exporter returned resource files out of order.');
            }
            $content = base64_decode((string) ($file['content'] ?? ''), true);
            if ($content === false || !hash_equals($planned['sha256'], hash('sha256', $content))) {
                $job = $this->skipResource($job, "{$item['key']}/{$planned['relative_path']}");
                continue;
            }
            $result = $this->resources->commitWholeFile((string) $job['id'], $item['key'], $planned['relative_path'], $content, $planned['sha256']);
            $job = $this->countResource($job, $result['already_present'], $result['bytes']);
        }
        return $this->advanceResourceBatch($job, $item, $done + count($received));
    }

    private function pushBatch(array $job, array $item): array
    {
        $done = (int) ($job['context']['resource_checkpoint_offset'] ?? 0);
        $pending = array_slice($item['files'], $done);
        $read = $this->resources->readFileBatch(array_map(
            static fn (array $file): array => ['key' => $item['key'], 'relative_path' => $file['relative_path']],
            $pending
        ))['files'];
        $send = [];
        foreach ($read as $position => $file) {
            if (hash_equals($pending[$position]['sha256'], $file['sha256'])) {
                $send[] = $file;
            } else {
                $job = $this->skipResource($job, "{$item['key']}/{$file['relative_path']}");
            }
        }
        if ($send !== []) {
            $response = $this->peer->call($job, 'POST', '/resource-file-batch', ['files' => $send]);
            if (isset($response['__waiting'])) {
                return $this->wait($job, $response['__waiting']);
            }
            foreach ((array) ($response['files'] ?? []) as $position => $result) {
                if (!empty($result['hash_mismatch'])) {
                    $job = $this->skipResource($job, "{$item['key']}/{$result['relative_path']}");
                    continue;
                }
                $size = strlen((string) base64_decode((string) ($send[$position]['content'] ?? ''), true));
                $job = $this->countResource($job, !empty($result['already_present']), !empty($result['already_present']) ? 0 : $size);
            }
        }
        return $this->advanceResourceBatch($job, $item, $done + count($read));
    }

    private function pullFileChunk(array $job, array $item): array
    {
        $offset = (int) ($job['context']['resource_checkpoint_offset'] ?? 0);
        $chunk = $this->peer->call($job, 'GET', '/resource-file-chunks', [
            'key' => $item['key'],
            'path' => $item['relative_path'],
            'offset' => $offset,
        ]);
        if (isset($chunk['__waiting'])) {
            return $this->wait($job, $chunk['__waiting']);
        }
        $content = base64_decode((string) ($chunk['content'] ?? ''), true);
        if ($content === false) {
            throw new \RuntimeException('The exported resource chunk is not valid base64.');
        }
        try {
            $result = $this->resources->receiveFileChunk((string) $job['id'], $item['key'], $item['relative_path'], $offset, $content, $item['sha256'], (bool) ($chunk['final'] ?? false));
        } catch (DataSyncHashMismatchException) {
            return $this->nextResourceItem($this->skipResource($job, "{$item['key']}/{$item['relative_path']}"));
        }
        return $this->advanceFileChunk($job, $item, $result, strlen($content));
    }

    private function pushFileChunk(array $job, array $item): array
    {
        $offset = (int) ($job['context']['resource_checkpoint_offset'] ?? 0);
        $chunk = $this->resources->readFileChunk($item['key'], $item['relative_path'], $offset);
        $response = $this->peer->call($job, 'POST', '/resource-file-chunks', [
            'key' => $item['key'],
            'relative_path' => $item['relative_path'],
            'offset' => $offset,
            'content' => $chunk['content'],
            'sha256' => $item['sha256'],
            'final' => $chunk['final'] || $chunk['next_offset'] >= (int) $item['size'],
        ]);
        if (isset($response['__waiting'])) {
            return $this->wait($job, $response['__waiting']);
        }
        if (!empty($response['hash_mismatch'])) {
            return $this->nextResourceItem($this->skipResource($job, "{$item['key']}/{$item['relative_path']}"));
        }
        return $this->advanceFileChunk($job, $item, $response, $chunk['next_offset'] - $offset);
    }

    private function advanceFileChunk(array $job, array $item, array $result, int $bytes): array
    {
        if (!empty($result['complete'])) {
            $job = $this->countResource($job, !empty($result['already_present']), !empty($result['already_present']) ? 0 : $bytes);
            return $this->nextResourceItem($job);
        }
        if (empty($result['success'])) {
            $job['context']['resource_checkpoint_offset'] = (int) ($result['offset'] ?? 0);
            return $this->progress($this->store->save($job), 'Resource checkpoint realigned.');
        }
        $job['context']['resource_checkpoint_offset'] = (int) $result['offset'];
        $job['context']['resource_results']['transferred_bytes'] = (int) ($job['context']['resource_results']['transferred_bytes'] ?? 0) + $bytes;
        return $this->progress($this->store->save($job), "{$item['key']}/{$item['relative_path']} @ {$result['offset']}");
    }

    private function pullArchiveChunk(array $job, array $item): array
    {
        $offset = (int) ($job['context']['resource_checkpoint_offset'] ?? 0);
        $chunk = $this->peer->call($job, 'GET', '/resource-archive-chunks', ['key' => $item['key'], 'offset' => $offset]);
        if (isset($chunk['__waiting'])) {
            return $this->wait($job, $chunk['__waiting']);
        }
        $content = base64_decode((string) ($chunk['content'] ?? ''), true);
        if ($content === false) {
            throw new \RuntimeException('The exported archive chunk is not valid base64.');
        }
        $result = $this->resources->receiveArchiveChunk((string) $job['id'], $item['key'], $offset, $content, $item['sha256'], (bool) ($chunk['final'] ?? false));
        return $this->advanceArchiveChunk($job, $item, $result, strlen($content));
    }

    private function pushArchiveChunk(array $job, array $item): array
    {
        $offset = (int) ($job['context']['resource_checkpoint_offset'] ?? 0);
        $chunk = $this->resources->readArchiveChunk((string) $job['id'], $item['key'], $offset);
        $response = $this->peer->call($job, 'POST', '/resource-chunks', [
            'key' => $item['key'],
            'offset' => $offset,
            'content' => $chunk['content'],
            'sha256' => $item['sha256'],
            'final' => $chunk['final'],
        ]);
        if (isset($response['__waiting'])) {
            return $this->wait($job, $response['__waiting']);
        }
        if (!empty($response['hash_mismatch'])) {
            throw new \RuntimeException("The receiver rejected the resource archive: {$item['key']}");
        }
        return $this->advanceArchiveChunk($job, $item, $response, $chunk['next_offset'] - $offset);
    }

    private function advanceArchiveChunk(array $job, array $item, array $result, int $bytes): array
    {
        if (empty($result['success'])) {
            $job['context']['resource_checkpoint_offset'] = (int) ($result['offset'] ?? 0);
            return $this->progress($this->store->save($job), 'Archive checkpoint realigned.');
        }
        $job['context']['resource_results']['transferred_bytes'] = (int) ($job['context']['resource_results']['transferred_bytes'] ?? 0) + $bytes;
        if (!empty($result['complete'])) {
            $job['context']['resource_results']['transferred_files'] = (int) ($job['context']['resource_results']['transferred_files'] ?? 0) + count($item['paths']);
            return $this->nextResourceItem($job);
        }
        $job['context']['resource_checkpoint_offset'] = (int) $result['offset'];
        return $this->progress($this->store->save($job), "{$item['key']}.7z @ {$result['offset']}");
    }

    private function advanceResourceBatch(array $job, array $item, int $done): array
    {
        if ($done >= count($item['files'])) {
            return $this->nextResourceItem($job);
        }
        $job['context']['resource_checkpoint_offset'] = $done;
        return $this->progress($this->store->save($job), "{$item['key']} batch {$done}/" . count($item['files']));
    }

    private function nextResourceItem(array $job): array
    {
        $job['context']['resource_checkpoint_index'] = (int) ($job['context']['resource_checkpoint_index'] ?? 0) + 1;
        $job['context']['resource_checkpoint_offset'] = 0;
        $job = $this->store->save($job);
        $remaining = $job['context']['resource_checkpoint_index'] < (int) ($job['context']['resource_checkpoint_count'] ?? 0);
        $results = $job['context']['resource_results'] ?? [];

        return $remaining
            ? $this->progress($job, ($results['transferred_files'] ?? 0) + ($results['already_present'] ?? 0) . '/' . ($results['planned_files'] ?? 0) . ' files')
            : $this->done($job, 'All resource batches transferred.');
    }

    private function countResource(array $job, bool $alreadyPresent, int $bytes): array
    {
        $results = $job['context']['resource_results'] ?? [];
        if ($alreadyPresent) {
            $results['already_present'] = (int) ($results['already_present'] ?? 0) + 1;
        } else {
            $results['transferred_files'] = (int) ($results['transferred_files'] ?? 0) + 1;
            $results['transferred_bytes'] = (int) ($results['transferred_bytes'] ?? 0) + $bytes;
        }
        $job['context']['resource_results'] = $results;
        $job['context']['received']['resource_files'] = ($results['transferred_files'] ?? 0) + ($results['already_present'] ?? 0);
        $job['context']['received']['resource_bytes'] = $results['transferred_bytes'] ?? 0;
        return $job;
    }

    private function skipResource(array $job, string $resource): array
    {
        $results = $job['context']['resource_results'] ?? [];
        $results['skipped_count'] = (int) ($results['skipped_count'] ?? 0) + 1;
        if (count($results['skipped'] ?? []) < self::SKIP_LIST_LIMIT) {
            $results['skipped'][] = $resource;
        }
        $job['context']['resource_results'] = $results;
        $skippedAll = $this->artifacts->get((string) $job['id'], 'resource_skipped') ?? [];
        $skippedAll[$resource] = true;
        $this->artifacts->put((string) $job['id'], 'resource_skipped', $skippedAll);
        return $job;
    }

    private function verifyResources(array $job): array
    {
        $expected = [];
        $skipped = $this->artifacts->get((string) $job['id'], 'resource_skipped') ?? [];
        foreach (empty($job['options']['resources']) ? [] : $this->artifacts->require((string) $job['id'], 'resource_plan') as $item) {
            $entries = match ($item['mode']) {
                'batch' => $item['files'],
                'file' => [$item],
                default => array_map(
                    static fn (string $path, array $meta): array => ['relative_path' => $path] + $meta,
                    array_keys($item['manifest']),
                    $item['manifest']
                ),
            };
            foreach ($entries as $entry) {
                if (!isset($skipped["{$item['key']}/{$entry['relative_path']}"])) {
                    $expected[$item['key']][$entry['relative_path']] = (string) $entry['sha256'];
                }
            }
        }

        $verified = 0;
        foreach ($expected as $key => $files) {
            if ($job['role'] === 'fetcher') {
                $manifest = $this->resources->manifest($key)['files'];
            } else {
                $response = $this->peer->call($job, 'GET', '/resources/' . rawurlencode($key) . '/manifest', ['fresh' => 1]);
                if (isset($response['__waiting'])) {
                    return $this->wait($job, $response['__waiting']);
                }
                $manifest = (array) ($response['files'] ?? []);
            }
            foreach ($files as $relativePath => $sha256) {
                if (($manifest[$relativePath]['sha256'] ?? null) !== $sha256) {
                    throw new \RuntimeException("Resource verification failed: {$key}/{$relativePath}");
                }
                $verified++;
            }
        }
        return $this->done($job, "{$verified} files verified.");
    }

    // ------------------------------------------------------------ helpers

    private function peerCall(array $job, string $method, string $path): array
    {
        $response = $this->peer->call($job, $method, $path);
        return isset($response['__waiting']) ? $this->wait($job, $response['__waiting']) : $this->done($job);
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
            $signatures[(string) ($column['name'] ?? '')] = [
                (string) ($column['type'] ?? ''),
                (string) ($column['nullable'] ?? ''),
                (string) ($column['extra'] ?? ''),
            ];
        }
        ksort($signatures);
        return $signatures;
    }

    private function done(array $job, ?string $detail = null): array
    {
        return ['done' => true, 'progress' => true, 'detail' => $detail, 'job' => $job];
    }

    private function progress(array $job, string $detail): array
    {
        return ['done' => false, 'progress' => true, 'detail' => $detail, 'job' => $job];
    }

    private function wait(array $job, string $detail): array
    {
        return ['done' => false, 'progress' => false, 'detail' => $detail, 'job' => $job];
    }
}
