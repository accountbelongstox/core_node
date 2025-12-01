<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils;

use Illuminate\Support\Facades\Log;
use App\Providers\PathMapper;

class SubtitleQueueManager
{
    private static $instance = null;
    private $queue = [];
    private $currentIndex = 0;
    private $queueFilePath;
    private $queueLastModified = 0;
    private $queueFileHash = null;

    private function __construct()
    {
        $cacheDir = PathMapper::getLaravelCacheDir() . '/voice_subtitle';
        PathMapper::ensureDirectory($cacheDir);

        $this->queueFilePath = $cacheDir . '/subtitle_queue.json';

        $this->loadQueue(true);
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function addItem(array $item, ?string $group = 'default'): array
    {
        $this->refreshQueueFromDisk();

        $item['group'] = $group ?: 'default';
        $item['id'] = uniqid('item_', true);
        $item['added_at'] = date('Y-m-d H:i:s');
        $item['play_count'] = $item['play_count'] ?? 0;

        $this->queue[] = $item;
        $this->saveQueue();

        Log::info('[SubtitleQueueManager] Item added to queue', [
            'queue_length' => count($this->queue),
            'group' => $item['group'],
        ]);

        return $item;
    }

    public function getQueue(): array
    {
        $this->refreshQueueFromDisk();
        return $this->queue;
    }

    public function getQueueLength(): int
    {
        $this->refreshQueueFromDisk();
        return count($this->queue);
    }

    public function getCurrentIndex(): int
    {
        $this->refreshQueueFromDisk();
        return $this->currentIndex;
    }

    public function setCurrentIndex(int $index): void
    {
        $this->refreshQueueFromDisk();

        if ($index < 0) {
            $this->currentIndex = 0;
        } elseif ($index >= count($this->queue)) {
            $this->currentIndex = count($this->queue) - 1;
        } else {
            $this->currentIndex = $index;
        }

        $this->saveQueue();
    }

    public function getCurrentItem(): ?array
    {
        $this->refreshQueueFromDisk();

        if (empty($this->queue) || $this->currentIndex >= count($this->queue)) {
            return null;
        }

        return $this->queue[$this->currentIndex];
    }

    public function moveToNext(): ?array
    {
        $this->refreshQueueFromDisk();

        if (empty($this->queue)) {
            return null;
        }

        $this->currentIndex++;

        if ($this->currentIndex >= count($this->queue)) {
            $this->currentIndex = count($this->queue) - 1;
        }

        $this->saveQueue();

        return $this->getCurrentItem();
    }

    public function moveToPrevious(): ?array
    {
        $this->refreshQueueFromDisk();

        if (empty($this->queue)) {
            return null;
        }

        $this->currentIndex--;

        if ($this->currentIndex < 0) {
            $this->currentIndex = 0;
        }

        $this->saveQueue();

        return $this->getCurrentItem();
    }

    public function removeItem(int $index, bool $deleteFiles = true): void
    {
        $this->refreshQueueFromDisk();

        if ($this->deleteItemAtIndex($index, $deleteFiles)) {
            if ($this->currentIndex >= count($this->queue) && $this->currentIndex > 0) {
                $this->currentIndex = count($this->queue) - 1;
            }

            $this->saveQueue();

            Log::info('[SubtitleQueueManager] Item removed from queue', [
                'index' => $index,
                'queue_length' => count($this->queue),
                'files_deleted' => $deleteFiles,
            ]);
        }
    }

    public function removeItems(array $indices, bool $deleteFiles = true): int
    {
        $this->refreshQueueFromDisk();

        $uniqueIndices = array_values(array_unique(array_filter($indices, function ($value) {
            return is_numeric($value);
        })));

        rsort($uniqueIndices, SORT_NUMERIC);

        $removed = 0;

        foreach ($uniqueIndices as $index) {
            if ($this->deleteItemAtIndex((int) $index, $deleteFiles)) {
                $removed++;
            }
        }

        if ($removed > 0) {
            if ($this->currentIndex >= count($this->queue) && $this->currentIndex > 0) {
                $this->currentIndex = count($this->queue) - 1;
            }
            $this->saveQueue();
        }

        return $removed;
    }

    public function incrementPlayCount(int $index): ?array
    {
        $this->refreshQueueFromDisk();

        if ($index < 0 || $index >= count($this->queue)) {
            return null;
        }

        if (!isset($this->queue[$index]['play_count'])) {
            $this->queue[$index]['play_count'] = 0;
        }

        $this->queue[$index]['play_count']++;
        $this->saveQueue();

        return $this->queue[$index];
    }

    public function clearQueue(): void
    {
        $this->refreshQueueFromDisk();

        $this->queue = [];
        $this->currentIndex = 0;
        $this->saveQueue();

        Log::info('[SubtitleQueueManager] Queue cleared');
    }

    public function updateItemGroup(int $index, string $group): bool
    {
        $this->refreshQueueFromDisk();

        if ($index >= 0 && $index < count($this->queue)) {
            $this->queue[$index]['group'] = $group ?: 'default';
            $this->saveQueue();

            Log::info('[SubtitleQueueManager] Item group updated', [
                'index' => $index,
                'group' => $group,
            ]);

            return true;
        }

        return false;
    }

    public function getAllGroups(): array
    {
        $this->refreshQueueFromDisk();

        $groups = [];
        foreach ($this->queue as $item) {
            $group = $item['group'] ?? 'default';
            if (!in_array($group, $groups)) {
                $groups[] = $group;
            }
        }
        sort($groups);
        return $groups;
    }

    public function getQueueByGroup(?string $group = null): array
    {
        $this->refreshQueueFromDisk();

        if ($group === null) {
            return $this->queue;
        }

        return array_values(array_filter($this->queue, function ($item) use ($group) {
            return ($item['group'] ?? 'default') === $group;
        }));
    }

    private function refreshQueueFromDisk(): void
    {
        $this->loadQueue();
    }

    private function loadQueue(bool $force = false): void
    {
        clearstatcache(true, $this->queueFilePath);

        if (!file_exists($this->queueFilePath)) {
            $this->queue = [];
            $this->currentIndex = 0;
            $this->queueLastModified = 0;
            $this->queueFileHash = null;
            return;
        }

        $fileModifiedAt = filemtime($this->queueFilePath);
        if ($fileModifiedAt === false) {
            $fileModifiedAt = 0;
        }

        $fileHash = md5_file($this->queueFilePath);
        if ($fileHash === false) {
            $fileHash = null;
        }

        if (!$force && $fileModifiedAt === $this->queueLastModified && $fileHash === $this->queueFileHash) {
            return;
        }

        try {
            $contents = file_get_contents($this->queueFilePath);
            $data = json_decode($contents, true);

            if ($data && isset($data['queue'])) {
                $this->queue = $data['queue'];
                $this->currentIndex = $data['current_index'] ?? 0;
                $this->queueLastModified = $fileModifiedAt;
                $this->queueFileHash = $fileHash ?? md5($contents);
            }

        } catch (\Exception $e) {
            Log::error('[SubtitleQueueManager] Error loading queue', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function saveQueue(): void
    {
        try {
            $data = [
                'queue' => $this->queue,
                'current_index' => $this->currentIndex,
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            $payload = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if ($payload === false) {
                throw new \RuntimeException('Failed to encode queue payload');
            }

            if (file_put_contents($this->queueFilePath, $payload) === false) {
                throw new \RuntimeException('Failed to write queue file');
            }

            clearstatcache(true, $this->queueFilePath);
            $this->queueLastModified = filemtime($this->queueFilePath) ?: time();
            $this->queueFileHash = md5($payload);

        } catch (\Exception $e) {
            Log::error('[SubtitleQueueManager] Error saving queue', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function deleteItemAtIndex(int $index, bool $deleteFiles): bool
    {
        if ($index < 0 || $index >= count($this->queue)) {
            return false;
        }

        $item = $this->queue[$index];

        if ($deleteFiles && isset($item['tts_files']) && is_array($item['tts_files'])) {
            foreach ($item['tts_files'] as $ttsFile) {
                if (isset($ttsFile['audio_path']) && file_exists($ttsFile['audio_path'])) {
                    @unlink($ttsFile['audio_path']);
                    Log::debug('[SubtitleQueueManager] Deleted audio file', [
                        'path' => $ttsFile['audio_path'],
                    ]);
                }
            }
        }

        array_splice($this->queue, $index, 1);
        return true;
    }
}
