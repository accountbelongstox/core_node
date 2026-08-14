<?php

namespace App\Services\DataSync;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

final class DataSyncTransferPlanStore
{
    private array $resourceItems = [];

    public function saveResourceItems(string $jobId, array $items): void
    {
        $json = (string) json_encode($items, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

        if (!FileSystemManager::writeFile($this->resourcePlanPath($jobId), $json)) {
            throw new \RuntimeException('Unable to persist the resource synchronization plan.');
        }
        $this->resourceItems[$jobId] = $items;
    }

    public function resourceItem(string $jobId, int $index): ?array
    {
        $items = $this->resourceItems($jobId);
        return isset($items[$index]) && is_array($items[$index]) ? $items[$index] : null;
    }

    public function resourceItems(string $jobId): array
    {
        if (isset($this->resourceItems[$jobId])) {
            return $this->resourceItems[$jobId];
        }

        $content = FileSystemManager::readFile($this->resourcePlanPath($jobId));
        $items = $content !== false ? json_decode($content, true) : null;

        if (!is_array($items)) {
            throw new \RuntimeException('Resource synchronization plan is missing or invalid.');
        }

        $this->resourceItems[$jobId] = $items;
        return $this->resourceItems[$jobId];
    }

    public function forgetResourceItems(string $jobId): void
    {
        unset($this->resourceItems[$jobId]);
    }

    private function resourcePlanPath(string $jobId): string
    {
        $safeJobId = preg_replace('/[^A-Za-z0-9_-]/', '', $jobId);
        $directory = PathMapper::getBackupDir('data-sync/plans');

        if ($safeJobId === '' || $safeJobId !== $jobId) {
            throw new \InvalidArgumentException('Synchronization job ID is invalid.');
        }

        FileSystemManager::ensureDirectoryExists($directory);
        return rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . $safeJobId . '.resources.json';
    }
}
