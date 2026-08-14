<?php

namespace App\Services\DataSync;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

final class DataSyncStateStore
{
    private const STORAGE_SUBDIR = 'data-sync/jobs';

    public function create(string $role, array $attributes): array
    {
        $now = now()->toIso8601String();
        $job = array_merge([
            'id' => str_replace('-', '', (string) str()->uuid()),
            'role' => $role,
            'status' => 'queued',
            'current_step' => 0,
            'progress' => 0,
            'backup_directory' => $role === 'receiver' ? PathMapper::getBackupDir('db-manager') : null,
            'steps' => DataSyncStepCatalog::create($role),
            'context' => [],
            'error' => null,
            'created_at' => $now,
            'updated_at' => $now,
            'completed_at' => null,
        ], $attributes);

        $this->save($job);
        return $job;
    }

    public function get(string $id): ?array
    {
        if (preg_match('/^[A-Za-z0-9_-]{1,64}$/', $id) !== 1) {
            return null;
        }
        $path = $this->jobPath($id);
        $content = FileSystemManager::readFile($path);
        $job = $content !== false ? json_decode($content, true) : null;

        if (!is_array($job)) {
            $pendingContent = FileSystemManager::readFile($this->pendingPath($id));
            $job = $pendingContent !== false ? json_decode($pendingContent, true) : null;
        }

        return is_array($job) ? $job : null;
    }

    public function save(array $job): array
    {
        $stateJson = null;
        $summaryJson = null;
        $job['updated_at'] = now()->toIso8601String();
        $stepCount = count($job['steps'] ?? []);
        $completedCount = count(array_filter(
            $job['steps'] ?? [],
            static fn (array $step): bool => in_array($step['status'] ?? null, ['completed', 'skipped'], true)
        ));
        $job['progress'] = $stepCount > 0 ? (int) floor(($completedCount / $stepCount) * 100) : 0;

        $stateJson = (string) json_encode(
            $job,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );
        $summaryJson = (string) json_encode(
            $this->summary($job),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );

        if (!FileSystemManager::writeFile($this->pendingPath((string) $job['id']), $stateJson)) {
            throw new \RuntimeException('Unable to stage data synchronization state.');
        }
        if (!FileSystemManager::writeFile($this->jobPath((string) $job['id']), $stateJson)) {
            throw new \RuntimeException('Unable to persist data synchronization state.');
        }
        FileSystemManager::delete($this->pendingPath((string) $job['id']));
        if (!FileSystemManager::writeFile($this->summaryPath((string) $job['id']), $summaryJson)) {
            throw new \RuntimeException('Unable to persist data synchronization summary.');
        }

        return $job;
    }

    public function listSummaries(?string $role = null): array
    {
        $jobs = [];

        foreach ($this->storedJobIds() as $id) {
            $content = FileSystemManager::readFile($this->summaryPath($id));
            $job = $content !== false ? json_decode($content, true) : null;
            if (!is_array($job)) {
                $fullJob = $this->get($id);
                $job = $fullJob !== null ? $this->summary($fullJob) : null;
            }
            if ($job === null || ($role !== null && ($job['role'] ?? null) !== $role)) {
                continue;
            }
            $jobs[] = $job;
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
        $job['context'] = array_filter([
            'awaiting_target' => $context['awaiting_target'] ?? null,
            'local_manifest' => $context['local_manifest'] ?? null,
            'database_results' => $context['database_results'] ?? null,
            'database_checkpoint_index' => $context['database_checkpoint_index'] ?? null,
            'database_checkpoint_count' => $context['database_checkpoint_count']
                ?? (isset($context['database_checkpoints']) ? count($context['database_checkpoints']) : null),
            'resource_checkpoint_index' => $context['resource_checkpoint_index'] ?? null,
            'resource_checkpoint_count' => $context['resource_checkpoint_count']
                ?? (isset($context['resource_checkpoints']) ? count($context['resource_checkpoints']) : null),
            'received' => $context['received'] ?? null,
            'ready' => $context['ready'] ?? null,
            'finalized' => $context['finalized'] ?? null,
            'receiver_status' => $context['receiver_status'] ?? ($context['receiver']['status'] ?? null),
        ], static fn ($value): bool => $value !== null);

        return $job;
    }

    public function active(string $role): ?array
    {
        return $this->activeAll($role)[0] ?? null;
    }

    public function activeAll(string $role): array
    {
        $jobs = [];

        foreach ($this->storedJobIds() as $id) {
            $content = FileSystemManager::readFile($this->summaryPath($id));
            $summary = $content !== false ? json_decode($content, true) : null;
            if (
                is_array($summary)
                && (($summary['role'] ?? null) !== $role
                    || !in_array($summary['status'] ?? null, ['queued', 'running', 'paused'], true))
            ) {
                continue;
            }

            $job = $this->get($id);
            if ($job === null && is_array($summary)) {
                throw new \RuntimeException('Active synchronization state is missing or invalid.');
            }
            if (
                $job !== null
                && ($job['role'] ?? null) === $role
                && in_array($job['status'] ?? null, ['queued', 'running', 'paused'], true)
            ) {
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
            return $job;
        }

        $job['steps'][$index]['status'] = $status;
        $job['steps'][$index]['detail'] = $detail;
        if ($status === 'running' && $job['steps'][$index]['started_at'] === null) {
            $job['steps'][$index]['started_at'] = now()->toIso8601String();
        }
        if ($status === 'completed') {
            $job['steps'][$index]['completed_at'] = now()->toIso8601String();
            $job['current_step'] = $index + 1;
        }

        return $this->save($job);
    }

    public function markStepByKey(array $job, string $key, string $status, ?string $detail = null): array
    {
        foreach ($job['steps'] as $index => $step) {
            if (($step['key'] ?? null) !== $key) {
                continue;
            }
            $job['steps'][$index]['status'] = $status;
            $job['steps'][$index]['detail'] = $detail;
            if ($status === 'running' && $job['steps'][$index]['started_at'] === null) {
                $job['steps'][$index]['started_at'] = now()->toIso8601String();
            }
            if ($status === 'completed') {
                $job['steps'][$index]['started_at'] ??= now()->toIso8601String();
                $job['steps'][$index]['completed_at'] = now()->toIso8601String();
            }
            break;
        }

        return $this->save($job);
    }

    private function storageDirectory(): string
    {
        $directory = PathMapper::getBackupDir(self::STORAGE_SUBDIR);
        FileSystemManager::ensureDirectoryExists($directory);
        return rtrim($directory, '/\\');
    }

    private function storedJobIds(): array
    {
        $entries = FileSystemManager::scandir($this->storageDirectory()) ?: [];
        $ids = [];

        foreach ($entries as $entry) {
            if (
                !str_ends_with($entry, '.json')
                || str_ends_with($entry, '.summary.json')
                || str_ends_with($entry, '.pending.json')
            ) {
                continue;
            }
            $ids[] = substr($entry, 0, -5);
        }

        return $ids;
    }

    private function jobPath(string $id): string
    {
        $safeId = $this->safeId($id);
        return $this->storageDirectory() . DIRECTORY_SEPARATOR . $safeId . '.json';
    }

    private function summaryPath(string $id): string
    {
        $safeId = $this->safeId($id);
        return $this->storageDirectory() . DIRECTORY_SEPARATOR . $safeId . '.summary.json';
    }

    private function pendingPath(string $id): string
    {
        $safeId = $this->safeId($id);
        return $this->storageDirectory() . DIRECTORY_SEPARATOR . $safeId . '.pending.json';
    }

    private function safeId(string $id): string
    {
        if (preg_match('/^[A-Za-z0-9_-]{1,64}$/', $id) !== 1) {
            throw new \InvalidArgumentException('Synchronization session ID is invalid.');
        }

        return $id;
    }
}
