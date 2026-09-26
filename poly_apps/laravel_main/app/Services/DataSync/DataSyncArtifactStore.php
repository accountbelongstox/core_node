<?php

namespace App\Services\DataSync;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

/**
 * Per-session bulk data kept outside the session state: inventories,
 * manifests, resource plans, completion receipts, incoming parts, and
 * archives. Everything below the session's directories is removed with
 * forgetSession() once the session reaches a terminal state.
 */
final class DataSyncArtifactStore
{
    private const ROOT_SUBDIR = 'data-sync';
    private const SESSION_SUBDIRS = ['artifacts', 'receipts', 'incoming', 'archives', 'plans'];

    public function put(string $jobId, string $name, array $value): void
    {
        $json = (string) json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (!FileSystemManager::writeFileAtomic($this->artifactPath($jobId, $name), $json)) {
            throw new \RuntimeException("Unable to persist the synchronization artifact: {$name}");
        }
    }

    public function get(string $jobId, string $name): ?array
    {
        $content = FileSystemManager::readFile($this->artifactPath($jobId, $name), false);
        $value = is_string($content) ? json_decode($content, true) : null;
        return is_array($value) ? $value : null;
    }

    public function require(string $jobId, string $name): array
    {
        return $this->get($jobId, $name)
            ?? throw new \RuntimeException("Synchronization artifact is missing or invalid: {$name}");
    }

    public function forget(string $jobId, string $name): void
    {
        FileSystemManager::delete($this->artifactPath($jobId, $name));
    }

    /**
     * Idempotent completion receipt: true only the first time an identity is
     * recorded, so repeated chunk deliveries never double-count a file.
     */
    public function recordReceipt(string $jobId, string $identity): bool
    {
        $directory = $this->sessionDirectory('receipts', $jobId);
        $path = $directory . DIRECTORY_SEPARATOR . hash('sha256', $identity) . '.receipt';
        if (FileSystemManager::isFile($path)) {
            return false;
        }
        if (!FileSystemManager::writeFile($path, 'completed')) {
            throw new \RuntimeException('Unable to persist the resource completion receipt.');
        }
        return true;
    }

    public function incomingPath(string $jobId, string $relativePath): string
    {
        return $this->sessionDirectory('incoming', $jobId) . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
    }

    public function archivePath(string $jobId, string $key): string
    {
        return $this->sessionDirectory('archives', $jobId) . DIRECTORY_SEPARATOR . $key . '.7z';
    }

    public function forgetSession(string $jobId): void
    {
        foreach (self::SESSION_SUBDIRS as $subdir) {
            FileSystemManager::delete($this->sessionDirectory($subdir, $jobId));
        }
    }

    private function artifactPath(string $jobId, string $name): string
    {
        if (preg_match('/^[a-z0-9_.-]{1,96}$/', $name) !== 1) {
            throw new \InvalidArgumentException("Invalid synchronization artifact name: {$name}");
        }
        return $this->sessionDirectory('artifacts', $jobId) . DIRECTORY_SEPARATOR . $name . '.json';
    }

    private function sessionDirectory(string $subdir, string $jobId): string
    {
        $safeJobId = DataSyncSessionId::require($jobId);
        return rtrim(PathMapper::getBackupDir(self::ROOT_SUBDIR . "/{$subdir}/{$safeJobId}"), '/\\');
    }
}
