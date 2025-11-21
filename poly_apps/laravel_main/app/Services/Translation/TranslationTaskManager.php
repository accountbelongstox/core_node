<?php

namespace App\Services\Translation;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

class TranslationTaskManager
{
    private $dataDir;
    private $tasksFile;
    private $cacheFile;
    private $lockFile;
    
    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';
    const STATUS_CANCELLED = 'cancelled';
    
    const CACHE_EXPIRY = 86400 * 7;
    
    const MODE_SINGLE_TASK = 'single';
    const MODE_MULTI_TASK = 'multi';
    
    private $taskMode = self::MODE_SINGLE_TASK;
    
    public function __construct()
    {
        $laravelDataDir = PathMapper::getLaravelDatabaseDir();
        if (!$laravelDataDir) {
            throw new \Exception('Laravel data directory not found');
        }
        
        $this->dataDir = $laravelDataDir . '/translation_tasks';
        $this->tasksFile = $this->dataDir . '/tasks.json';
        $this->cacheFile = $this->dataDir . '/cache.json';
        $this->lockFile = $this->dataDir . '/singleton.lock';
        
        $this->initializeDirectory();
    }
    
    private function initializeDirectory(): void
    {
        if (!is_dir($this->dataDir)) {
            mkdir($this->dataDir, 0755, true);
        }
        
        if (!file_exists($this->tasksFile)) {
            file_put_contents($this->tasksFile, json_encode([], JSON_PRETTY_PRINT));
        }
        
        if (!file_exists($this->cacheFile)) {
            file_put_contents($this->cacheFile, json_encode([], JSON_PRETTY_PRINT));
        }
    }
    
    public function createTask(array $params): string
    {
        if ($this->taskMode === self::MODE_SINGLE_TASK) {
            $this->cancelPendingAndProcessingTasks();
        }
        
        $taskId = $this->generateTaskId($params);
        
        $skipCache = $params['skip_cache'] ?? false;
        
        if (!$skipCache) {
            $cached = $this->getFromCache($params);
            if ($cached) {
                $task = [
                    'task_id' => $taskId,
                    'status' => self::STATUS_COMPLETED,
                    'params' => $params,
                    'result' => $cached['result'],
                    'cached' => true,
                    'created_at' => time(),
                    'completed_at' => time(),
                    'processing_time' => 0,
                    'error' => null,
                ];
                
                $this->saveTask($taskId, $task);
                return $taskId;
            }
        }
        
        $task = [
            'task_id' => $taskId,
            'status' => self::STATUS_PENDING,
            'params' => $params,
            'result' => null,
            'cached' => false,
            'created_at' => time(),
            'started_at' => null,
            'completed_at' => null,
            'processing_time' => null,
            'error' => null,
        ];
        
        $this->saveTask($taskId, $task);
        
        return $taskId;
    }
    
    public function setTaskMode(string $mode): void
    {
        if (in_array($mode, [self::MODE_SINGLE_TASK, self::MODE_MULTI_TASK])) {
            $this->taskMode = $mode;
        }
    }
    
    public function getTaskMode(): string
    {
        return $this->taskMode;
    }
    
    private function cancelPendingAndProcessingTasks(): void
    {
        $tasks = $this->loadTasks();
        $cancelledCount = 0;
        
        foreach ($tasks as $taskId => $task) {
            if ($task['status'] === self::STATUS_PENDING || $task['status'] === self::STATUS_PROCESSING) {
                $task['status'] = self::STATUS_CANCELLED;
                $task['completed_at'] = time();
                $task['error'] = 'Cancelled by new task submission (single-task mode)';
                $task['processing_time'] = $task['completed_at'] - ($task['started_at'] ?? $task['created_at']);
                $tasks[$taskId] = $task;
                $cancelledCount++;
            }
        }
        
        if ($cancelledCount > 0) {
            file_put_contents($this->tasksFile, json_encode($tasks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $this->releaseLock();
            Log::info("[TranslationTask] Cancelled {$cancelledCount} pending/processing tasks (single-task mode)");
        }
    }
    
    public function getTask(string $taskId): ?array
    {
        $tasks = $this->loadTasks();
        return $tasks[$taskId] ?? null;
    }
    
    public function updateTaskStatus(string $taskId, string $status, ?array $result = null, ?string $error = null): void
    {
        $task = $this->getTask($taskId);
        if (!$task) {
            return;
        }
        
        $task['status'] = $status;
        
        if ($status === self::STATUS_PROCESSING) {
            $task['started_at'] = time();
        } elseif ($status === self::STATUS_COMPLETED) {
            $task['completed_at'] = time();
            $task['result'] = $result;
            $task['processing_time'] = $task['completed_at'] - ($task['started_at'] ?? $task['created_at']);
            
            if ($result && !$task['cached']) {
                $this->saveToCache($task['params'], $result);
            }
        } elseif ($status === self::STATUS_FAILED) {
            $task['completed_at'] = time();
            $task['error'] = $error;
            $task['processing_time'] = $task['completed_at'] - ($task['started_at'] ?? $task['created_at']);
        }
        
        $this->saveTask($taskId, $task);
    }
    
    public function acquireLock(string $taskId): bool
    {
        if (file_exists($this->lockFile)) {
            $lockData = json_decode(file_get_contents($this->lockFile), true);
            
            if ($lockData && isset($lockData['locked_at'])) {
                if (time() - $lockData['locked_at'] > 300) {
                    Log::warning('[TranslationTask] Stale lock detected, removing');
                    unlink($this->lockFile);
                } else {
                    return false;
                }
            }
        }
        
        $lockData = [
            'task_id' => $taskId,
            'locked_at' => time(),
        ];
        
        file_put_contents($this->lockFile, json_encode($lockData, JSON_PRETTY_PRINT));
        return true;
    }
    
    public function releaseLock(): void
    {
        if (file_exists($this->lockFile)) {
            unlink($this->lockFile);
        }
    }
    
    public function isLocked(): bool
    {
        if (!file_exists($this->lockFile)) {
            return false;
        }
        
        $lockData = json_decode(file_get_contents($this->lockFile), true);
        if (!$lockData || !isset($lockData['locked_at'])) {
            return false;
        }
        
        if (time() - $lockData['locked_at'] > 300) {
            return false;
        }
        
        return true;
    }
    
    public function getCurrentTask(): ?array
    {
        if (!file_exists($this->lockFile)) {
            return null;
        }
        
        $lockData = json_decode(file_get_contents($this->lockFile), true);
        if (!$lockData || !isset($lockData['task_id'])) {
            return null;
        }
        
        return $this->getTask($lockData['task_id']);
    }
    
    private function loadTasks(): array
    {
        if (!file_exists($this->tasksFile)) {
            return [];
        }
        
        $content = file_get_contents($this->tasksFile);
        $tasks = json_decode($content, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error('[TranslationTask] Failed to parse tasks file');
            return [];
        }
        
        return $tasks ?? [];
    }
    
    private function saveTask(string $taskId, array $task): void
    {
        $tasks = $this->loadTasks();
        $tasks[$taskId] = $task;
        
        $this->pruneTasks($tasks);
        
        file_put_contents($this->tasksFile, json_encode($tasks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    
    private function pruneTasks(array &$tasks): void
    {
        if (count($tasks) <= 100) {
            return;
        }
        
        uasort($tasks, function($a, $b) {
            return ($b['created_at'] ?? 0) <=> ($a['created_at'] ?? 0);
        });
        
        $tasks = array_slice($tasks, 0, 100, true);
    }
    
    private function generateTaskId(array $params): string
    {
        $cacheKey = $this->generateCacheKey($params);
        return substr($cacheKey, 0, 16) . '_' . time();
    }
    
    private function generateCacheKey(array $params): string
    {
        $text = $params['text'] ?? '';
        $languages = $params['target_languages'] ?? [];
        $options = $params['options'] ?? [];
        $model = $params['model'] ?? 'free';
        
        sort($languages);
        ksort($options);
        
        $cacheString = $text . '|' . implode(',', $languages) . '|' . json_encode($options) . '|' . $model;
        
        return md5($cacheString);
    }
    
    private function getFromCache(array $params): ?array
    {
        $cacheKey = $this->generateCacheKey($params);
        
        if (!file_exists($this->cacheFile)) {
            return null;
        }
        
        $content = file_get_contents($this->cacheFile);
        $cache = json_decode($content, true);
        
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($cache)) {
            return null;
        }
        
        if (isset($cache[$cacheKey])) {
            $entry = $cache[$cacheKey];
            
            if (isset($entry['cached_at']) && (time() - $entry['cached_at']) < self::CACHE_EXPIRY) {
                return $entry;
            } else {
                unset($cache[$cacheKey]);
                file_put_contents($this->cacheFile, json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        }
        
        return null;
    }
    
    private function saveToCache(array $params, array $result): void
    {
        $cacheKey = $this->generateCacheKey($params);
        
        $cache = [];
        if (file_exists($this->cacheFile)) {
            $content = file_get_contents($this->cacheFile);
            $cache = json_decode($content, true) ?? [];
        }
        
        $cache[$cacheKey] = [
            'result' => $result,
            'cached_at' => time(),
        ];
        
        $this->pruneCache($cache);
        
        file_put_contents($this->cacheFile, json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    
    private function pruneCache(array &$cache): void
    {
        $now = time();
        
        foreach ($cache as $key => $entry) {
            if (isset($entry['cached_at']) && ($now - $entry['cached_at']) > self::CACHE_EXPIRY) {
                unset($cache[$key]);
            }
        }
        
        if (count($cache) > 500) {
            uasort($cache, function($a, $b) {
                return ($b['cached_at'] ?? 0) <=> ($a['cached_at'] ?? 0);
            });
            
            $cache = array_slice($cache, 0, 500, true);
        }
    }
    
    public function cleanupOldTasks(): int
    {
        $tasks = $this->loadTasks();
        $cleaned = 0;
        $now = time();
        
        foreach ($tasks as $taskId => $task) {
            if (isset($task['created_at']) && ($now - $task['created_at']) > 3600) {
                unset($tasks[$taskId]);
                $cleaned++;
            }
        }
        
        if ($cleaned > 0) {
            file_put_contents($this->tasksFile, json_encode($tasks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
        
        return $cleaned;
    }
}
