<?php

namespace App\Services\DataSync;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

final class DataSyncStateStore
{
    private const STORAGE_SUBDIR = 'data-sync/jobs';
    private const LOCKS_SUBDIR = 'data-sync/locks';

    public function __construct(private readonly DataSyncArtifactStore $artifacts) {}

    public function create(string $role, array $attributes): array
    {
        $now = now()->toIso8601String();
        $job = array_merge([
            'id' => str_replace('-', '', (string) str()->uuid()),
            'protocol_version' => DataSyncProtocol::VERSION,
            'role' => $role,
            'status' => 'queued',
            'current_step' => 0,
            'progress' => 0,
            'backup_directory' => in_array($role, ['receiver', 'fetcher'], true)
                ? PathMapper::getBackupDir('db-manager')
                : null,
            'steps' => DataSyncStepCatalog::create($role),
            'context' => [],
            'error' => null,
            'created_at' => $now,
            'updated_at' => $now,
            'completed_at' => null,
        ], $attributes);

        $this->touchActivity((string) $job['id']);
        return $this->save($job);
    }

    public function get(string $id): ?array
    {
        if (!DataSyncSessionId::valid($id)) {
            return null;
        }
        $content = FileSystemManager::readFile($this->jobPath($id));
        $job = $content !== false ? json_decode($content, true) : null;

        return is_array($job) ? $job : null;
    }

    public function delete(string $id): void
    {
        if (!DataSyncSessionId::valid($id)) {
            return;
        }
        FileSystemManager::delete($this->jobPath($id));
        FileSystemManager::delete($this->summaryPath($id));
        FileSystemManager::delete($this->lockPath($id, 'cancel'));
        FileSystemManager::delete($this->lockPath($id, 'activity'));
        FileSystemManager::delete($this->lockPath($id, 'lock'));
        $this->artifacts->forgetSession($id);
    }

    /**
     * Terminal sessions are stored compactly (the public summary only) and
     * their bulk artifacts are removed; only the newest TERMINAL_RETENTION
     * terminal sessions are retained so finished runs stay visible.
     */
    public function save(array $job): array
    {
        $id = (string) $job['id'];
        $job['updated_at'] = now()->toIso8601String();
        $job['progress'] = $this->progress($job);
        $terminal = in_array($job['status'] ?? null, DataSyncProtocol::TERMINAL_STATUSES, true);

        if ($terminal) {
            $job['completed_at'] ??= $job['updated_at'];
            $tokenHash = $job['context']['token_hash']
                ?? (isset($job['context']['token']) ? hash('sha256', (string) $job['context']['token']) : null);
            $job = $this->summary($job);
            if ($tokenHash !== null) {
                $job['context']['token_hash'] = $tokenHash;
            }
        }

        $this->writeJson($this->jobPath($id), $job);
        $this->writeJson($this->summaryPath($id), $this->summary($job));

        if ($terminal) {
            FileSystemManager::delete($this->lockPath($id, 'cancel'));
            FileSystemManager::delete($this->lockPath($id, 'activity'));
            $this->artifacts->forgetSession($id);
            $this->pruneTerminal();
        }

        return $job;
    }

    public function listSummaries(): array
    {
        $jobs = [];

        foreach ($this->storedJobIds() as $id) {
            $job = $this->readSummary($id);
            if ($job !== null) {
                $jobs[] = $job;
            }
        }

        usort($jobs, static fn (array $left, array $right): int => strcmp(
            (string) ($right['created_at'] ?? ''),
            (string) ($left['created_at'] ?? '')
        ));
        return $jobs;
    }

    public function summary(array $job): array
    {
        $context = $job['context'] ?? [];
        $existingCounterpart = isset($job['counterpart']) && is_array($job['counterpart'])
            ? $job['counterpart']
            : [];
        $job['protocol_version'] = (int) ($job['protocol_version'] ?? 0);
        $job['counterpart'] = array_replace($existingCounterpart, $this->counterpart($job, $context));
        $job['context'] = array_filter([
            'source_job_id' => $context['source_job_id'] ?? null,
            'fetcher_job_id' => $context['fetcher_job_id'] ?? null,
            'awaiting_target' => $context['awaiting_target'] ?? null,
            'local_manifest' => $context['local_manifest'] ?? null,
            'database_results' => $context['database_results'] ?? null,
            'resource_results' => $context['resource_results'] ?? null,
            'database_checkpoint_index' => $context['database_checkpoint_index'] ?? null,
            'database_checkpoint_count' => $context['database_checkpoint_count'] ?? null,
            'resource_checkpoint_index' => $context['resource_checkpoint_index'] ?? null,
            'resource_checkpoint_count' => $context['resource_checkpoint_count'] ?? null,
            'received' => $context['received'] ?? null,
            'cancel_requested' => $context['cancel_requested'] ?? null,
            'ready' => $context['ready'] ?? null,
            'finalized' => $context['finalized'] ?? null,
            'receiver_status' => $context['receiver_status'] ?? ($context['receiver']['status'] ?? null),
        ], static fn ($value): bool => $value !== null);

        return $job;
    }

    private function counterpart(array $job, array $context): array
    {
        $receiver = isset($context['receiver']) && is_array($context['receiver'])
            ? $context['receiver']
            : null;

        if ($receiver !== null) {
            unset($receiver['counterpart']);
        }

        $isDriver = in_array($job['role'] ?? null, DataSyncProtocol::DRIVER_ROLES, true);

        return array_filter([
            'endpoint' => $isDriver
                ? ($job['target'] ?? null)
                : ($job['target_input'] ?? null),
            'session_id' => $isDriver
                ? ($context['peer_session_id'] ?? null)
                : ($context['source_job_id'] ?? $context['fetcher_job_id'] ?? null),
            'reachable' => $isDriver ? ($context['counterpart_reachable'] ?? null) : null,
            'observed_at' => $isDriver ? ($context['counterpart_observed_at'] ?? null) : null,
            'error' => $isDriver ? ($context['counterpart_error'] ?? null) : null,
            'session' => $isDriver ? $receiver : null,
        ], static fn ($value): bool => $value !== null);
    }

    /**
     * Lightweight per-tick probe (summary files only) so timer tasks can
     * yield while any synchronization session is active.
     */
    public function hasActiveSession(): bool
    {
        foreach ($this->storedJobIds() as $id) {
            $summary = $this->readSummary($id);
            if ($summary !== null && in_array($summary['status'] ?? null, DataSyncProtocol::ACTIVE_STATUSES, true)) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param list<string>|string $roles
     */
    public function activeAll(array|string $roles): array
    {
        $roles = (array) $roles;
        $jobs = [];

        foreach ($this->storedJobIds() as $id) {
            $summary = $this->readSummary($id);
            if (
                $summary === null
                || !in_array($summary['role'] ?? null, $roles, true)
                || !in_array($summary['status'] ?? null, DataSyncProtocol::ACTIVE_STATUSES, true)
            ) {
                continue;
            }
            $job = $this->get($id);
            if ($job !== null && in_array($job['status'] ?? null, DataSyncProtocol::ACTIVE_STATUSES, true)) {
                $jobs[] = $job;
            }
        }

        usort($jobs, static fn (array $left, array $right): int => strcmp(
            (string) ($right['created_at'] ?? ''),
            (string) ($left['created_at'] ?? '')
        ));
        return $jobs;
    }

    public function markCurrentStep(array $job, string $status, ?string $detail = null): array
    {
        $index = (int) ($job['current_step'] ?? 0);

        if (!isset($job['steps'][$index])) {
            return $this->save($job);
        }

        $job['steps'][$index] = $this->stepState($job['steps'][$index], $status, $detail);
        if (in_array($status, ['completed', 'skipped'], true)) {
            $job['current_step'] = $index + 1;
        }

        return $this->save($job);
    }

    public function markStepByKey(array $job, string $key, string $status, ?string $detail = null): array
    {
        foreach ($job['steps'] as $index => $step) {
            if (($step['key'] ?? null) === $key) {
                $job['steps'][$index] = $this->stepState($step, $status, $detail);
                break;
            }
        }

        return $this->save($job);
    }

    public function touchActivity(string $id): void
    {
        FileSystemManager::writeFile($this->lockPath($id, 'activity'), (string) time());
    }

    public function secondsSinceActivity(array $job): int
    {
        $content = FileSystemManager::readFile($this->lockPath((string) $job['id'], 'activity'), false);
        $last = is_string($content) && ctype_digit(trim($content))
            ? (int) trim($content)
            : (int) strtotime((string) ($job['updated_at'] ?? 'now'));

        return max(0, time() - $last);
    }

    public function lockPath(string $id, string $kind): string
    {
        $directory = PathMapper::getBackupDir(self::LOCKS_SUBDIR);
        return rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . DataSyncSessionId::require($id) . '.' . $kind;
    }

    private function stepState(array $step, string $status, ?string $detail): array
    {
        $now = now()->toIso8601String();
        $step['status'] = $status;
        $step['detail'] = $detail;
        if (in_array($status, ['running', 'completed', 'failed'], true)) {
            $step['started_at'] ??= $now;
        }
        if (in_array($status, ['completed', 'skipped'], true)) {
            $step['completed_at'] = $now;
        }
        return $step;
    }

    private function progress(array $job): int
    {
        $steps = $job['steps'] ?? [];
        $done = count(array_filter(
            $steps,
            static fn (array $step): bool => in_array($step['status'] ?? null, ['completed', 'skipped'], true)
        ));

        return $steps !== [] ? (int) floor(($done / count($steps)) * 100) : 0;
    }

    /**
     * Drops sessions from other protocol versions and all but the newest
     * terminal sessions.
     */
    public function pruneTerminal(): void
    {
        $terminal = [];

        foreach ($this->storedJobIds() as $id) {
            $summary = $this->readSummary($id);
            if ($summary === null) {
                continue;
            }
            if ((int) ($summary['protocol_version'] ?? 0) !== DataSyncProtocol::VERSION) {
                if (!in_array($summary['status'] ?? null, DataSyncProtocol::ACTIVE_STATUSES, true)) {
                    $this->delete($id);
                }
                continue;
            }
            if (in_array($summary['status'] ?? null, DataSyncProtocol::TERMINAL_STATUSES, true)) {
                $terminal[$id] = (string) ($summary['updated_at'] ?? '');
            }
        }

        arsort($terminal);
        foreach (array_slice(array_keys($terminal), DataSyncProtocol::TERMINAL_RETENTION) as $id) {
            $this->delete((string) $id);
        }

        $known = array_flip($this->storedJobIds());
        $locksDirectory = rtrim(PathMapper::getBackupDir(self::LOCKS_SUBDIR), '/\\');
        foreach (FileSystemManager::scandir($locksDirectory) ?: [] as $entry) {
            $id = strstr($entry, '.', true);
            if ($id !== false && DataSyncSessionId::valid($id) && !isset($known[$id])) {
                FileSystemManager::delete($locksDirectory . DIRECTORY_SEPARATOR . $entry);
            }
        }
    }

    private function readSummary(string $id): ?array
    {
        $content = FileSystemManager::readFile($this->summaryPath($id));
        $summary = $content !== false ? json_decode($content, true) : null;
        if (is_array($summary)) {
            return $summary;
        }
        $job = $this->get($id);
        return $job !== null ? $this->summary($job) : null;
    }

    private function writeJson(string $path, array $value): void
    {
        $json = (string) json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (!FileSystemManager::writeFileAtomic($path, $json)) {
            throw new \RuntimeException('Unable to persist data synchronization state.');
        }
    }

    private function storageDirectory(): string
    {
        $directory = PathMapper::getBackupDir(self::STORAGE_SUBDIR);
        FileSystemManager::ensureDirectoryExists($directory);
        return rtrim($directory, '/\\');
    }

    private function storedJobIds(): array
    {
        $ids = [];

        foreach (FileSystemManager::scandir($this->storageDirectory()) ?: [] as $entry) {
            if (
                str_ends_with($entry, '.json')
                && !str_ends_with($entry, '.summary.json')
                && !str_ends_with($entry, '.pending.json')
            ) {
                $ids[] = substr($entry, 0, -5);
            }
        }

        return array_values(array_filter($ids, [DataSyncSessionId::class, 'valid']));
    }

    private function jobPath(string $id): string
    {
        return $this->storageDirectory() . DIRECTORY_SEPARATOR . DataSyncSessionId::require($id) . '.json';
    }

    private function summaryPath(string $id): string
    {
        return $this->storageDirectory() . DIRECTORY_SEPARATOR . DataSyncSessionId::require($id) . '.summary.json';
    }
}
