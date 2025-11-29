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

    private function __construct()
    {
        $cacheDir = PathMapper::getLaravelCacheDir() . '/voice_subtitle';
        PathMapper::ensureDirectory($cacheDir);

        $this->queueFilePath = $cacheDir . '/subtitle_queue.json';

        $this->loadQueue();
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
        $item['group'] = $group ?: 'default';
        $item['id'] = uniqid('item_', true);
        $item['added_at'] = date('Y-m-d H:i:s');

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
        return $this->queue;
    }

    public function getQueueLength(): int
    {
        return count($this->queue);
    }

    public function getCurrentIndex(): int
    {
        return $this->currentIndex;
    }

    public function setCurrentIndex(int $index): void
    {
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
        if (empty($this->queue) || $this->currentIndex >= count($this->queue)) {
            return null;
        }

        return $this->queue[$this->currentIndex];
    }

    public function moveToNext(): ?array
    {
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
        if ($index >= 0 && $index < count($this->queue)) {
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

    public function clearQueue(): void
    {
        $this->queue = [];
        $this->currentIndex = 0;
        $this->saveQueue();

        Log::info('[SubtitleQueueManager] Queue cleared');
    }

    public function updateItemGroup(int $index, string $group): bool
    {
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
        if ($group === null) {
            return $this->queue;
        }

        return array_values(array_filter($this->queue, function ($item) use ($group) {
            return ($item['group'] ?? 'default') === $group;
        }));
    }

    private function loadQueue(): void
    {
        if (file_exists($this->queueFilePath)) {
            try {
                $data = json_decode(file_get_contents($this->queueFilePath), true);

                if ($data && isset($data['queue'])) {
                    $this->queue = $data['queue'];
                    $this->currentIndex = $data['current_index'] ?? 0;
                }

            } catch (\Exception $e) {
                Log::error('[SubtitleQueueManager] Error loading queue', [
                    'error' => $e->getMessage(),
                ]);
            }
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

            file_put_contents(
                $this->queueFilePath,
                json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
            );

        } catch (\Exception $e) {
            Log::error('[SubtitleQueueManager] Error saving queue', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
