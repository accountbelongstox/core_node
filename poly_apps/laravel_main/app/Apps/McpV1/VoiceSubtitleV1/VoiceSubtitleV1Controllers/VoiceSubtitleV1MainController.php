<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\UploadedFile;
use App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils\VoiceSubtitleProcessor;
use App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils\SubtitleQueueManager;
use App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils\UserSettingsManager;
use App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils\VoiceSubtitleTaskManager;

class VoiceSubtitleV1MainController
{
    private $processor;
    private $queueManager;
    private $settingsManager;
    private $taskManager;
    private string $databaseDir;

    public function __construct()
    {
        $this->processor = new VoiceSubtitleProcessor();
        $this->queueManager = SubtitleQueueManager::getInstance();
        $this->settingsManager = new UserSettingsManager();
        $this->taskManager = new VoiceSubtitleTaskManager();
        $this->databaseDir = rtrim(\App\Providers\PathMapper::getLaravelDatabaseDir(), DIRECTORY_SEPARATOR);
    }

    private function getUserIdentifier(Request $request): string
    {
        return $request->ip() . '_' . ($request->header('User-Agent') ? md5($request->header('User-Agent')) : 'anonymous');
    }

    public function addToQueue(Request $request)
    {
        $type = $request->input('type');
        $content = $request->input('content');
        $language = $request->input('language', 'en');
        $voice = $request->input('voice', 'en-US-AriaNeural');
        $group = $request->input('group', 'default');

        if (!$type) {
            return response()->json([
                'success' => false,
                'error' => 'Type is required',
            ], 400);
        }

        $cachedFiles = [];
        $payloadReference = null;

        if ($type === 'file' && $request->hasFile('file')) {
            $file = $request->file('file');
            $content = $this->cacheUploadedFile($file, 'file_upload');
            $cachedFiles[] = $content;
            $payloadReference = $this->toRelativeDatabasePath($content);

        } elseif ($type === 'image' && $request->hasFile('image')) {
            $file = $request->file('image');
            $content = $this->cacheUploadedFile($file, 'image_upload');
            $cachedFiles[] = $content;
            $payloadReference = $this->toRelativeDatabasePath($content);

        } elseif (!$content) {
            return response()->json([
                'success' => false,
                'error' => 'Content is required',
            ], 400);
        }

        $validTypes = ['text', 'image', 'url', 'voice', 'file'];
        if (!in_array($type, $validTypes)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid type. Must be one of: ' . implode(', ', $validTypes),
            ], 400);
        }

        $userIdentifier = $this->getUserIdentifier($request);
        $userSettings = $this->settingsManager->getUserSettings($userIdentifier);
        $targetLanguage = $userSettings['target_language'];

        $task = $this->taskManager->createTask([
            'type' => $type,
            'language' => $language,
            'voice' => $voice,
            'group' => $group,
            'target_language' => $targetLanguage,
            'input_reference' => $this->summarizeContent(
                $type,
                $payloadReference ?? $content
            ),
        ]);

        app()->terminating(function () use ($task, $type, $content, $language, $voice, $targetLanguage, $group, $cachedFiles) {
            $this->processTaskPipeline($task['id'], $type, $content, $language, $voice, $targetLanguage, $group, $cachedFiles);
        });

        return response()->json([
            'success' => true,
            'task_id' => $task['id'],
            'task' => $task,
            'queue_length' => $this->queueManager->getQueueLength(),
            'message' => 'Task accepted and scheduled for background processing',
        ]);
    }

    private function summarizeContent(string $type, ?string $content): ?string
    {
        if (!$content) {
            return null;
        }

        if ($type === 'text') {
            $preview = mb_substr($content, 0, 160);
            return mb_strlen($content) > 160 ? $preview . '...' : $preview;
        }

        return $content;
    }

    private function processTaskPipeline(
        string $taskId,
        string $type,
        string $content,
        string $language,
        string $voice,
        $targetLanguage,
        string $group,
        array $cachedFiles = []
    ): void {
        try {
            $this->taskManager->updateStatus($taskId, 'processing');
            $this->processor->setProgressReporter(function ($step, $status, $message = null, $meta = []) use ($taskId) {
                $this->taskManager->markStep($taskId, $step, $status, $message, $meta);
            });

            $item = $this->processor->processInput($type, $content, $language, $voice, $targetLanguage);

            if (!$item) {
                throw new \RuntimeException('Failed to generate queue item for task');
            }

            $this->taskManager->markStep($taskId, 'queue_append', 'running', 'Appending item to playback queue');
            $queueItem = $this->queueManager->addItem($item, $group);
            $this->taskManager->markStep($taskId, 'queue_append', 'completed', 'Item added to queue', [
                'queue_item_id' => $queueItem['id'],
            ]);

            $sanitizedQueueItem = $this->sanitizeQueueItem($queueItem);

            $this->taskManager->completeTask($taskId, [
                'queue_item_id' => $queueItem['id'],
                'queue_length' => $this->queueManager->getQueueLength(),
            ], $sanitizedQueueItem);

        } catch (\Throwable $e) {
            $this->taskManager->failTask($taskId, $e->getMessage());
            Log::error('[VoiceSubtitleV1] Task processing failed', [
                'task_id' => $taskId,
                'error' => $e->getMessage(),
            ]);

        } finally {
            $this->processor->setProgressReporter(null);
            $this->cleanupCachedFiles($cachedFiles);
        }
    }

    public function getQueue(Request $request)
    {
        $userIdentifier = $this->getUserIdentifier($request);
        $userSettings = $this->settingsManager->getUserSettings($userIdentifier);

        $allQueue = $this->queueManager->getQueue();
        $filteredQueue = $this->applyPlayFilters($allQueue, $userSettings);

        $currentIndex = $this->queueManager->getCurrentIndex();

        $sanitizedFiltered = $this->sanitizeQueueItems($filteredQueue);
        $sanitizedAllQueue = $this->sanitizeQueueItems($allQueue);

        return response()->json([
            'success' => true,
            'queue' => $sanitizedFiltered,
            'all_queue' => $sanitizedAllQueue,
            'current_index' => $currentIndex,
            'queue_length' => count($filteredQueue),
            'total_length' => count($allQueue),
            'play_mode' => $userSettings['play_mode'],
        ]);
    }

    private function applyPlayFilters(array $queue, array $settings): array
    {
        $playMode = $settings['play_mode'] ?? 'all';
        $playLimit = $settings['play_limit'] ?? 300;
        $playGroup = $settings['play_group'];
        $playLanguage = $settings['play_language'];

        $filtered = $queue;

        if ($playMode === 'today') {
            $today = date('Y-m-d');
            $filtered = array_filter($filtered, function($item) use ($today) {
                $createdAt = $item['created_at'] ?? $item['added_at'] ?? '';
                return strpos($createdAt, $today) === 0;
            });
        }

        if ($playMode === 'group' && $playGroup) {
            $filtered = array_filter($filtered, function($item) use ($playGroup) {
                return ($item['group'] ?? 'default') === $playGroup;
            });
        }

        if ($playMode === 'language' && $playLanguage) {
            $filtered = array_filter($filtered, function($item) use ($playLanguage) {
                return $item['language'] === $playLanguage;
            });
        }

        if ($playMode === 'latest' || $playMode === 'all') {
            $filtered = array_slice($filtered, -$playLimit);
        }

        return array_values($filtered);
    }

    public function getCurrent(Request $request)
    {
        try {
            $current = $this->queueManager->getCurrentItem();

            if (!$current) {
                return response()->json([
                    'success' => true,
                    'current' => null,
                    'message' => 'Queue is empty',
                ]);
            }

            return response()->json([
                'success' => true,
                'current' => $this->sanitizeQueueItem($current),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function next(Request $request)
    {
        try {
            $next = $this->queueManager->moveToNext();

            return response()->json([
                'success' => true,
                'current' => $this->sanitizeQueueItem($next),
                'current_index' => $this->queueManager->getCurrentIndex(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function previous(Request $request)
    {
        try {
            $previous = $this->queueManager->moveToPrevious();

            return response()->json([
                'success' => true,
                'current' => $this->sanitizeQueueItem($previous),
                'current_index' => $this->queueManager->getCurrentIndex(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function setIndex(Request $request)
    {
        try {
            $index = $request->input('index');

            if ($index === null) {
                return response()->json([
                    'success' => false,
                    'error' => 'Index is required',
                ], 400);
            }

            $this->queueManager->setCurrentIndex((int)$index);
            $current = $this->queueManager->getCurrentItem();

            return response()->json([
                'success' => true,
                'current' => $this->sanitizeQueueItem($current),
                'current_index' => $this->queueManager->getCurrentIndex(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function removeItem(Request $request)
    {
        try {
            $index = $request->input('index');

            if ($index === null) {
                return response()->json([
                    'success' => false,
                    'error' => 'Index is required',
                ], 400);
            }

            $this->queueManager->removeItem((int)$index);

            return response()->json([
                'success' => true,
                'queue_length' => $this->queueManager->getQueueLength(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function clearQueue(Request $request)
    {
        try {
            $this->queueManager->clearQueue();

            return response()->json([
                'success' => true,
                'message' => 'Queue cleared',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getStats(Request $request)
    {
        try {
            $stats = $this->processor->getStats();

            return response()->json([
                'success' => true,
                'stats' => $stats,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function serveAudio(string $filename)
    {
        $cacheDir = \App\Providers\PathMapper::getLaravelCacheDir() . '/tts';
        $filePath = $cacheDir . '/' . $filename;

        if (!file_exists($filePath)) {
            return response()->json([
                'success' => false,
                'error' => 'Audio file not found',
            ], 404);
        }

        return response()->file($filePath, [
            'Content-Type' => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=31536000',
        ]);
    }

    public function getUserSettings(Request $request)
    {
        $userIdentifier = $this->getUserIdentifier($request);
        $settings = $this->settingsManager->getUserSettings($userIdentifier);

        return response()->json([
            'success' => true,
            'settings' => $settings,
        ]);
    }

    public function updateUserSettings(Request $request)
    {
        $userIdentifier = $this->getUserIdentifier($request);
        $data = $request->only(['target_language', 'default_voice', 'playback_rate', 'auto_play', 'play_mode', 'play_limit', 'play_group', 'play_language']);

        $result = $this->settingsManager->updateUserSettings($userIdentifier, $data);

        if (!$result['success']) {
            return response()->json($result, 400);
        }

        return response()->json($result);
    }

    public function getSupportedLanguages(Request $request)
    {
        $languages = $this->settingsManager->getSupportedLanguages();

        return response()->json([
            'success' => true,
            'languages' => $languages,
            'total' => count($languages),
        ]);
    }

    public function getTaskStatus(string $taskId)
    {
        $task = $this->taskManager->getTask($taskId);

        if (!$task) {
            return response()->json([
                'success' => false,
                'error' => 'Task not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'task' => $this->sanitizeTask($task),
        ]);
    }

    public function listTasks(Request $request)
    {
        $ids = $request->query('ids');
        $limit = (int) $request->query('limit', 20);
        $limit = max(1, min(100, $limit));

        $tasks = [];
        if ($ids) {
            $taskIds = [];
            if (is_array($ids)) {
                $taskIds = array_map('trim', $ids);
            } else {
                $taskIds = array_map('trim', explode(',', (string)$ids));
            }
            $taskIds = array_filter($taskIds);
            $tasks = $this->taskManager->getTasksByIds($taskIds);
        } else {
            $tasks = $this->taskManager->getRecentTasks($limit);
        }

        $sanitizedTasks = array_map(function ($task) {
            return $this->sanitizeTask($task);
        }, $tasks);

        return response()->json([
            'success' => true,
            'tasks' => $sanitizedTasks,
            'limit' => $limit,
        ]);
    }

    public function deleteTasks(Request $request)
    {
        $taskIds = $request->input('task_ids');

        if (empty($taskIds)) {
            return response()->json([
                'success' => false,
                'error' => 'task_ids is required',
            ], 400);
        }

        if (!is_array($taskIds)) {
            $taskIds = array_map('trim', explode(',', (string) $taskIds));
        }

        $deleted = $this->taskManager->deleteTasks($taskIds);

        return response()->json([
            'success' => true,
            'deleted' => $deleted,
        ]);
    }

    public function updateItemGroup(Request $request)
    {
        $index = $request->input('index');
        $group = $request->input('group', 'default');

        if ($index === null) {
            return response()->json([
                'success' => false,
                'error' => 'Index is required',
            ], 400);
        }

        $success = $this->queueManager->updateItemGroup((int)$index, $group);

        if (!$success) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid index',
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Group updated successfully',
        ]);
    }

    public function getAllGroups(Request $request)
    {
        $groups = $this->queueManager->getAllGroups();

        return response()->json([
            'success' => true,
            'groups' => $groups,
        ]);
    }

    public function getQueueByGroup(Request $request, ?string $group = null)
    {
        $queue = $this->queueManager->getQueueByGroup($group);

        $sanitizedQueue = $this->sanitizeQueueItems($queue);

        return response()->json([
            'success' => true,
            'queue' => $sanitizedQueue,
            'group' => $group,
            'count' => count($queue),
        ]);
    }

    private function sanitizeQueueItems(array $queue): array
    {
        return array_map(function ($item) {
            return $this->sanitizeQueueItem($item);
        }, array_values($queue));
    }

    private function sanitizeQueueItem(?array $item): ?array
    {
        if (!$item) {
            return $item;
        }

        if (isset($item['tts_files']) && is_array($item['tts_files'])) {
            $item['tts_files'] = $this->sanitizeTtsFiles($item['tts_files']);
        }

        if (isset($item['voice_file'])) {
            $item['voice_file'] = $this->toRelativeDatabasePath($item['voice_file']);
        }

        if (isset($item['file_path'])) {
            $item['file_path'] = $this->toRelativeDatabasePath($item['file_path']);
        }

        return $item;
    }

    private function sanitizeTtsFiles(array $files): array
    {
        return array_map(function ($file) {
            if (isset($file['file_path'])) {
                $file['file_path'] = $this->toRelativeDatabasePath($file['file_path']);
            }

            if (isset($file['source_path'])) {
                $file['source_path'] = $this->toRelativeDatabasePath($file['source_path']);
            }

            return $file;
        }, $files);
    }

    private function toRelativeDatabasePath(?string $path): ?string
    {
        if (!$path) {
            return $path;
        }

        $normalizedPath = str_replace('\\', '/', $path);
        $normalizedBase = str_replace('\\', '/', $this->databaseDir);

        if ($normalizedBase !== '' && str_starts_with($normalizedPath, $normalizedBase)) {
            $relative = ltrim(substr($normalizedPath, strlen($normalizedBase)), '/');
            return $relative === '' ? null : $relative;
        }

        return basename($path);
    }

    private function sanitizeTask(array $task): array
    {
        if (isset($task['result']['item']) && is_array($task['result']['item'])) {
            $task['result']['item'] = $this->sanitizeQueueItem($task['result']['item']);
        }

        if (isset($task['payload']) && is_array($task['payload'])) {
            if (isset($task['payload']['file_path'])) {
                $task['payload']['file_path'] = $this->toRelativeDatabasePath($task['payload']['file_path']);
            }
            if (isset($task['payload']['input_reference'])) {
                $task['payload']['input_reference'] = $this->toRelativeDatabasePath($task['payload']['input_reference']);
            }
        }

        return $task;
    }

    private function cacheUploadedFile(UploadedFile $file, string $prefix): string
    {
        $cacheDir = $this->getUploadCacheDir();
        $this->cleanupExpiredCacheFiles($cacheDir);

        $extension = $file->getClientOriginalExtension();
        $filename = $prefix . '_' . time() . '_' . uniqid('', true);
        if ($extension) {
            $filename .= '.' . $extension;
        }

        $file->move($cacheDir, $filename);
        return $cacheDir . '/' . $filename;
    }

    private function getUploadCacheDir(): string
    {
        $dir = \App\Providers\PathMapper::getLaravelCacheDir() . '/voice_subtitle_uploads';
        \App\Providers\PathMapper::ensureDirectory($dir);
        return $dir;
    }

    private function cleanupCachedFiles(array $files): void
    {
        foreach ($files as $filePath) {
            if ($filePath && is_file($filePath)) {
                @unlink($filePath);
            }
        }
    }

    private function cleanupExpiredCacheFiles(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $expireSeconds = 24 * 3600;
        $now = time();

        foreach (scandir($dir) as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $path = $dir . '/' . $item;
            if (!is_file($path)) {
                continue;
            }

            $modified = filemtime($path);
            if ($modified !== false && ($now - $modified) > $expireSeconds) {
                @unlink($path);
            }
        }
    }
}
