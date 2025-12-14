<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\UploadedFile;
use App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils\VoiceSubtitleProcessor;
use App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils\SubtitleQueueManager;
use App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils\UserSettingsManager;
use App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils\VoiceSubtitleTaskManager;
use App\Traits\ApiResponse;

class VoiceSubtitleV1MainController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private const REQUEST_CACHED_FILES_KEY = '_voice_subtitle_cached_files';

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
        $group = $request->input('group', $request->input('category', 'default'));

        if (!$type) {
            return response()->json([
                'success' => false,
                'error' => 'Type is required',
            ], 400);
        }

        $cachedFiles = $request->attributes->get(self::REQUEST_CACHED_FILES_KEY, []);
        $request->attributes->set(self::REQUEST_CACHED_FILES_KEY, []);
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

        $overrideLanguages = $request->input('target_language')
            ?? $request->input('target_languages')
            ?? $request->input('langs');

        if ($overrideLanguages) {
            $targetLanguage = $this->resolveTargetLanguage($overrideLanguages, $targetLanguage);
        }

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

    public function addText(Request $request)
    {
        $text = $request->input('text');
        if (!$text) {
            return response()->json([
                'success' => false,
                'error' => 'text is required',
            ], 400);
        }

        $request->merge([
            'type' => 'text',
            'content' => $text,
            'language' => $request->input('language', 'en'),
            'voice' => $request->input('voice', 'en-US-AriaNeural'),
            'group' => $request->input('category', 'default'),
        ]);

        return $this->addToQueue($request);
    }

    public function addImage(Request $request)
    {
        $language = $request->input('language', 'en');
        $voice = $request->input('voice', 'en-US-AriaNeural');
        $group = $request->input('category', 'default');

        $localPath = null;

        $cleanup = false;

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $localPath = $this->cacheUploadedFile($file, 'image_upload');
            $cleanup = true;
        } elseif ($request->hasFile('file')) {
            $file = $request->file('file');
            $localPath = $this->cacheUploadedFile($file, 'image_upload');
            $cleanup = true;
        } elseif ($imagePath = $request->input('image_path')) {
            $localPath = $this->resolveLocalPath($imagePath);
        } elseif ($imageUrl = $request->input('image_url')) {
            $localPath = $this->downloadRemoteFile($imageUrl, 'image_url');
            $cleanup = true;
        } elseif ($imageBase64 = $request->input('image_base64')) {
            $localPath = $this->cacheBase64Payload($imageBase64, 'image_base64');
            $cleanup = true;
        }

        if (!$localPath || !file_exists($localPath)) {
            return response()->json([
                'success' => false,
                'error' => 'Valid image source is required',
            ], 400);
        }

        if ($cleanup) {
            $this->registerCachedFile($request, $localPath);
        }

        $request->merge([
            'type' => 'image',
            'content' => $localPath,
            'language' => $language,
            'voice' => $voice,
            'group' => $group,
        ]);

        return $this->addToQueue($request);
    }

    public function addVoice(Request $request)
    {
        $language = $request->input('language', 'en');
        $voice = $request->input('voice', 'en-US-AriaNeural');
        $group = $request->input('category', 'default');

        $localPath = null;

        $cleanup = false;

        if ($request->hasFile('voice')) {
            $file = $request->file('voice');
            $localPath = $this->cacheUploadedFile($file, 'voice_upload');
            $cleanup = true;
        } elseif ($request->hasFile('file')) {
            $file = $request->file('file');
            $localPath = $this->cacheUploadedFile($file, 'voice_upload');
            $cleanup = true;
        } elseif ($audioPath = $request->input('audio_path')) {
            $localPath = $this->resolveLocalPath($audioPath);
        } elseif ($audioUrl = $request->input('audio_url')) {
            $localPath = $this->downloadRemoteFile($audioUrl, 'audio_url');
            $cleanup = true;
        } elseif ($audioBase64 = $request->input('audio_base64')) {
            $localPath = $this->cacheBase64Payload($audioBase64, 'audio_base64');
            $cleanup = true;
        }

        if (!$localPath || !file_exists($localPath)) {
            return response()->json([
                'success' => false,
                'error' => 'Valid audio source is required',
            ], 400);
        }

        if ($cleanup) {
            $this->registerCachedFile($request, $localPath);
        }

        $request->merge([
            'type' => 'voice',
            'content' => $localPath,
            'language' => $language,
            'voice' => $voice,
            'group' => $group,
        ]);

        return $this->addToQueue($request);
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

        $formattedQueue = $this->formatQueueItemsForRemote($sanitizedFiltered);

        return response()->json([
            'success' => true,
            'queue' => $formattedQueue,
            'all_queue' => $sanitizedAllQueue,
            'current_index' => $currentIndex,
            'queue_length' => count($filteredQueue),
            'total_length' => count($allQueue),
            'play_mode' => $userSettings['play_mode'],
        ]);
    }

    public function getQueueLatest(Request $request)
    {
        $limit = (int) $request->query('limit', 300);
        $limit = max(1, min(1000, $limit));

        $queue = $this->sanitizeQueueItems($this->queueManager->getQueue());
        $items = array_slice($queue, -$limit);

        return response()->json([
            'success' => true,
            'items' => $this->formatQueueItemsForRemote($items),
            'count' => count($items),
            'limit' => $limit,
        ]);
    }

    public function getQueueToday(Request $request)
    {
        $today = date('Y-m-d');
        $queue = $this->sanitizeQueueItems($this->queueManager->getQueue());

        $items = array_filter($queue, function ($item) use ($today) {
            $created = $item['added_at'] ?? '';
            if (isset($item['created_at'])) {
                $created = $item['created_at'];
            }
            return strpos($created, $today) === 0;
        });

        $items = array_values($items);

        return response()->json([
            'success' => true,
            'items' => $this->formatQueueItemsForRemote($items),
            'count' => count($items),
        ]);
    }

    public function getQueueByCategoryFilter(Request $request)
    {
        $category = $request->query('category');

        if ($category === null || $category === '') {
            return response()->json([
                'success' => false,
                'error' => 'category is required',
            ], 400);
        }

        $queue = $this->sanitizeQueueItems($this->queueManager->getQueueByGroup($category));

        return response()->json([
            'success' => true,
            'category' => $category,
            'items' => $this->formatQueueItemsForRemote($queue),
            'count' => count($queue),
        ]);
    }

    private function applyPlayFilters(array $queue, array $settings): array
    {
        $playMode = 'all';
        if (isset($settings['play_mode'])) {
            $playMode = $settings['play_mode'];
        }
        $playLimit = 300;
        if (isset($settings['play_limit'])) {
            $playLimit = $settings['play_limit'];
        }
        $playGroup = $settings['play_group'];
        $playLanguage = $settings['play_language'];

        $filtered = $queue;

        if ($playMode === 'today') {
            $today = date('Y-m-d');
            $filtered = array_filter($filtered, function($item) use ($today) {
                $createdAt = $item['added_at'] ?? '';
                if (isset($item['created_at'])) {
                    $createdAt = $item['created_at'];
                }
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

    }

    public function next(Request $request)
    {
            $next = $this->queueManager->moveToNext();

            return response()->json([
                'success' => true,
                'current' => $this->sanitizeQueueItem($next),
                'current_index' => $this->queueManager->getCurrentIndex(),
            ]);

    }

    public function previous(Request $request)
    {
            $previous = $this->queueManager->moveToPrevious();

            return response()->json([
                'success' => true,
                'current' => $this->sanitizeQueueItem($previous),
                'current_index' => $this->queueManager->getCurrentIndex(),
            ]);

    }

    public function setIndex(Request $request)
    {
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

    }

    public function incrementPlayCount(Request $request)
    {
        $index = $request->input('index');
        if ($index === null) {
            $index = $this->queueManager->getCurrentIndex();
        }

        $updated = $this->queueManager->incrementPlayCount((int) $index);

        if (!$updated) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid index',
            ], 400);
        }

        return response()->json([
            'success' => true,
            'current_index' => (int) $index,
            'item' => $this->formatQueueItemForRemote($this->sanitizeQueueItem($updated)),
        ]);
    }

    public function removeItem(Request $request)
    {
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

    }

    public function removeItems(Request $request)
    {
        $indices = $request->input('indices');

        if (empty($indices)) {
            return response()->json([
                'success' => false,
                'error' => 'indices is required',
            ], 400);
        }

        if (!is_array($indices)) {
            $indices = array_map('trim', explode(',', (string) $indices));
        }

        $removed = $this->queueManager->removeItems($indices);

        return response()->json([
            'success' => true,
            'removed_count' => $removed,
            'queue_length' => $this->queueManager->getQueueLength(),
        ]);
    }

    public function clearQueue(Request $request)
    {
            $this->queueManager->clearQueue();

            return response()->json([
                'success' => true,
                'message' => 'Queue cleared',
            ]);

    }

    public function getStats(Request $request)
    {
            $stats = $this->processor->getStats();

            return response()->json([
                'success' => true,
                'stats' => $stats,
            ]);

    }

    public function serveAudio(string $filename)
    {
        return $this->streamAudioFile($filename);
    }

    public function serveAudioByQuery(Request $request)
    {
        $path = $request->query('path');

        if (!$path) {
            return response()->json([
                'success' => false,
                'error' => 'path is required',
            ], 400);
        }

        return $this->streamAudioFile(basename($path));
    }

    private function streamAudioFile(string $filename)
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

    public function getCategories(Request $request)
    {
        $groups = $this->queueManager->getAllGroups();

        return response()->json([
            'success' => true,
            'categories' => $groups,
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

    private function formatQueueItemsForRemote(array $queue): array
    {
        return array_map(function ($item) {
            return $this->formatQueueItemForRemote($item);
        }, array_values($queue));
    }

    private function formatQueueItemForRemote(?array $item): ?array
    {
        if (!$item) {
            return null;
        }

        $audioPath = null;
        if (!empty($item['tts_files']) && isset($item['tts_files'][0]['file_path'])) {
            $audioPath = $item['tts_files'][0]['file_path'];
        }

        $created = $item['added_at'] ?? date('Y-m-d H:i:s');
        if (isset($item['created_at'])) {
            $created = $item['created_at'];
        }

        $formatted = [
            'text' => $item['translated_text'] ?? $item['original_text'] ?? '',
            'audio_path' => $audioPath,
            'audio_url' => $this->buildAudioUrl($audioPath),
            'category' => $item['group'] ?? $item['type'] ?? 'default',
            'play_count' => $item['play_count'] ?? 0,
            'created_at' => $this->formatIso8601($created),
            'langs' => $this->normalizeLangs($item),
            'language' => $item['language'] ?? null,
            'voice' => $item['voice'] ?? null,
        ];

        foreach ($item as $key => $value) {
            if (!isset($formatted[$key])) {
                $formatted[$key] = $value;
            }
        }

        return $formatted;
    }

    private function normalizeLangs(array $item): array
    {
        $langs = [];

        if (!empty($item['target_language'])) {
            $langs[] = $item['target_language'];
        }

        if (!empty($item['language'])) {
            $langs[] = $item['language'];
        }

        $langs = array_values(array_filter(array_unique($langs)));

        return $langs ?: ['en'];
    }

    private function buildAudioUrl(?string $filePath): ?string
    {
        if (!$filePath) {
            return null;
        }

        $filename = basename($filePath);

            return route('mcp.v1.voice-subtitle.audio', ['filename' => $filename], true);
    }

    private function resolveTargetLanguage($override, string $fallback): string
    {
        if (is_array($override)) {
            foreach ($override as $value) {
                if (is_string($value) && trim($value) !== '') {
                    return trim($value);
                }
            }
            return $fallback;
        }

        if (is_string($override)) {
            if (strpos($override, ',') !== false) {
                $parts = array_filter(array_map('trim', explode(',', $override)));
                if (!empty($parts)) {
                    return $parts[0];
                }
            }

            $clean = trim($override);
            return $clean !== '' ? $clean : $fallback;
        }

        return $fallback;
    }

    private function registerCachedFile(Request $request, string $path): void
    {
        $files = $request->attributes->get(self::REQUEST_CACHED_FILES_KEY, []);
        $files[] = $path;
        $request->attributes->set(self::REQUEST_CACHED_FILES_KEY, $files);
    }

    private function resolveLocalPath(string $path): ?string
    {
        if (file_exists($path)) {
            return $path;
        }

        $dbPath = $this->databaseDir . '/' . ltrim($path, '/');
        if (file_exists($dbPath)) {
            return $dbPath;
        }

        return null;
    }

    private function downloadRemoteFile(string $url, string $prefix): ?string
    {
            $response = Http::timeout(20)->get($url);
            if (!$response->successful()) {
                return null;
            }

            $contentType = $response->header('Content-Type');
            $extension = pathinfo(parse_url($url, PHP_URL_PATH) ?? '', PATHINFO_EXTENSION);
            if ($this->guessExtensionFromMime($contentType) !== null) {
                $extension = $this->guessExtensionFromMime($contentType);
            }

            return $this->cacheBinaryContent($response->body(), $prefix, $extension);
    }

    private function cacheBase64Payload(string $payload, string $prefix): ?string
    {
        $data = $payload;
        $extension = null;

        if (str_contains($payload, ',')) {
            [$header, $data] = explode(',', $payload, 2);
            if (preg_match('/data:(.*?);base64/', $header, $matches)) {
                $extension = $this->guessExtensionFromMime($matches[1]);
            }
        }

        $binary = base64_decode($data, true);
        if ($binary === false) {
            return null;
        }

        return $this->cacheBinaryContent($binary, $prefix, $extension);
    }

    private function cacheBinaryContent(string $binary, string $prefix, ?string $extension = null): ?string
    {
        $cacheDir = $this->getUploadCacheDir();
        $this->cleanupExpiredCacheFiles($cacheDir);

        $filename = $prefix . '_' . time() . '_' . uniqid('', true);
        if ($extension) {
            $extension = ltrim($extension, '.');
            $filename .= '.' . $extension;
        }

        $path = $cacheDir . '/' . $filename;
        $bytes = @file_put_contents($path, $binary);

        if ($bytes === false) {
            return null;
        }

        return $path;
    }

    private function guessExtensionFromMime(?string $mime): ?string
    {
        if (!$mime) {
            return null;
        }

        return match ($mime) {
            'image/png' => 'png',
            'image/jpeg' => 'jpg',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'audio/mpeg', 'audio/mp3' => 'mp3',
            'audio/wav' => 'wav',
            'audio/x-wav' => 'wav',
            'audio/ogg' => 'ogg',
            'audio/mp4', 'audio/m4a' => 'm4a',
            default => null,
        };
    }

    private function formatIso8601(string $datetime): string
    {
        $timestamp = strtotime($datetime);
        if ($timestamp === false) {
            $timestamp = time();
        }
        return date('c', $timestamp);
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
