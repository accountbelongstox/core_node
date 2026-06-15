<?php

namespace App\Apps\McpV1\McpV1Utils;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

/**
 * Task Queue Service (McpV1)
 *
 * Manages task queues (based on JSON file storage)
 * Each paragraph in prompts file (separated by \n\n) is a task
 * Stores queue data in external storage to prevent git commits
 *
 * Supports both MCP (Model Context Protocol) and web query interfaces
 * Following Laravel 12.x MCP specifications
 *
 * @see https://laravel.com/docs/12.x/mcp
 */
class TaskQueueService
{
    private $baseDirectory;
    private $queueDirectory;
    private $mappingService;

    /** Whether the queue directory is usable (degraded mode when false). */
    private $directoryReady = false;

    public function __construct($baseDirectory = null)
    {
        $this->baseDirectory = $baseDirectory ?? PathMapper::getCoreNodeDir();

        // Store queue data in _prompts/task-data/queues/ (not committed to git)
        // Fall back to shared-data if needed for static file mapping.
        // ensurePromptsDirectory resolves a file squatting on the _prompts path
        // (preserving it) and never throws — a bare mkdir() here would raise an
        // ErrorException from the constructor and 500 every queue route.
        $promptsDir = $this->baseDirectory . DIRECTORY_SEPARATOR . '_prompts';
        $this->queueDirectory = $promptsDir . DIRECTORY_SEPARATOR . 'task-data' . DIRECTORY_SEPARATOR . 'queues';

        $this->directoryReady = TaskCategoryService::ensurePromptsDirectory($promptsDir)
            && FileSystemManager::ensureDirectoryExists($this->queueDirectory);

        if (!$this->directoryReady) {
            error_log('[TaskQueueService] queue directory unavailable: ' . $this->queueDirectory . ' — queue persistence disabled');
        }

        $this->mappingService = new PromptMappingService();
    }

    /**
     * Get the category queue file path
     */
    private function getCategoryQueueFile($categoryId)
    {
        return $this->queueDirectory . DIRECTORY_SEPARATOR . $categoryId . '.json';
    }

    /**
     * Load the category queue
     */
    public function loadCategoryQueue($categoryId)
    {
        $queueFile = $this->getCategoryQueueFile($categoryId);

        if (!$this->directoryReady || !file_exists($queueFile)) {
            return $this->initializeCategoryQueue($categoryId);
        }

        $content = @file_get_contents($queueFile);
        $decoded = $content === false ? null : json_decode($content, true);

        // A corrupt/unreadable queue file degrades to an empty queue instead
        // of letting callers explode on null.
        if (!is_array($decoded) || !isset($decoded['tasks'])) {
            return $this->initializeCategoryQueue($categoryId);
        }

        return $decoded;
    }

    /**
     * Initialize the category queue
     */
    private function initializeCategoryQueue($categoryId)
    {
        $queue = [
            'category' => $categoryId,
            'tasks' => [],
            'created_at' => date('Y-m-d H:i:s'),
            'last_updated' => date('Y-m-d H:i:s')
        ];

        $this->saveCategoryQueue($categoryId, $queue);
        return $queue;
    }

    /**
     * Save the category queue
     */
    private function saveCategoryQueue($categoryId, $queue)
    {
        $queue['last_updated'] = date('Y-m-d H:i:s');

        if (!$this->directoryReady) {
            return;
        }

        $queueFile = $this->getCategoryQueueFile($categoryId);
        $written = @file_put_contents(
            $queueFile,
            json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        if ($written === false) {
            error_log('[TaskQueueService] Failed to write queue file: ' . $queueFile);
        }
    }

    /**
     * Parse task paragraphs from file content
     *
     * Uses \n\n as the paragraph separator
     */
    private function parseParagraphsFromContent($content)
    {
        // Split paragraphs using \n\n
        $paragraphs = preg_split('/\n\s*\n/', trim($content));

        $result = [];
        foreach ($paragraphs as $index => $paragraph) {
            $paragraph = trim($paragraph);
            if (!empty($paragraph)) {
                $result[] = [
                    'index' => $index + 1,
                    'content' => $paragraph,
                    'hash' => md5($paragraph)
                ];
            }
        }

        return $result;
    }

    /**
     * Add a file to the task queue
     *
     * @param string $categoryId Category ID
     * @param string $filePath File path (relative to _prompts)
     * @param string $content File content
     * @param bool $applyMapping Whether to apply prompt mapping (default true)
     */
    public function addFileToQueue($categoryId, $filePath, $content, $applyMapping = true)
    {
        $queue = $this->loadCategoryQueue($categoryId);

        // Parse paragraphs
        $paragraphs = $this->parseParagraphsFromContent($content);

        // Create a task for each paragraph
        foreach ($paragraphs as $paragraph) {
            $taskId = 'task_' . uniqid();

            // Apply mapping to content
            $originalContent = $paragraph['content'];
            $processedContent = $applyMapping
                ? $this->mappingService->applyMapping($categoryId, $originalContent)
                : $originalContent;

            // Check whether a task with the same content already exists (by hash)
            $exists = false;
            foreach ($queue['tasks'] as $task) {
                if ($task['file'] === $filePath &&
                    $task['paragraph_index'] === $paragraph['index'] &&
                    $task['content_hash'] === $paragraph['hash']) {
                    $exists = true;
                    break;
                }
            }

            if (!$exists) {
                $queue['tasks'][] = [
                    'id' => $taskId,
                    'file' => $filePath,
                    'paragraph_index' => $paragraph['index'],
                    'content' => $processedContent,
                    'original_content' => $originalContent,
                    'content_hash' => $paragraph['hash'],
                    'status' => 'pending',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ];
            }
        }

        $this->saveCategoryQueue($categoryId, $queue);

        return [
            'success' => true,
            'file' => $filePath,
            'paragraphs_added' => count($paragraphs)
        ];
    }

    /**
     * Get all tasks
     */
    public function getAllTasks($categoryId)
    {
        $queue = $this->loadCategoryQueue($categoryId);
        return $queue['tasks'] ?? [];
    }

    /**
     * Get the last task (the newest task)
     */
    public function getLastTask($categoryId)
    {
        $queue = $this->loadCategoryQueue($categoryId);
        $tasks = $queue['tasks'] ?? [];

        if (empty($tasks)) {
            return null;
        }

        return $tasks[count($tasks) - 1];
    }

    /**
     * Check whether there is a latest task
     */
    public function hasLatestTask($categoryId)
    {
        $lastTask = $this->getLastTask($categoryId);
        return $lastTask !== null;
    }

    /**
     * Search tasks by keyword
     */
    public function searchTasksByKeyword($categoryId, $keyword)
    {
        $queue = $this->loadCategoryQueue($categoryId);
        $tasks = $queue['tasks'] ?? [];

        $result = [];
        foreach ($tasks as $task) {
            if (stripos($task['content'], $keyword) !== false ||
                stripos($task['file'], $keyword) !== false) {
                $result[] = $task;
            }
        }

        return $result;
    }

    /**
     * Update task status
     */
    public function updateTaskStatus($categoryId, $taskId, $status)
    {
        $queue = $this->loadCategoryQueue($categoryId);

        foreach ($queue['tasks'] as &$task) {
            if ($task['id'] === $taskId) {
                $task['status'] = $status;
                $task['updated_at'] = date('Y-m-d H:i:s');
                break;
            }
        }

        $this->saveCategoryQueue($categoryId, $queue);

        return ['success' => true];
    }

    /**
     * Delete a task
     */
    public function deleteTask($categoryId, $taskId)
    {
        $queue = $this->loadCategoryQueue($categoryId);

        $queue['tasks'] = array_filter($queue['tasks'], function($task) use ($taskId) {
            return $task['id'] !== $taskId;
        });

        // Re-index the array
        $queue['tasks'] = array_values($queue['tasks']);

        $this->saveCategoryQueue($categoryId, $queue);

        return ['success' => true];
    }

    /**
     * Clear the category queue
     */
    public function clearCategoryQueue($categoryId)
    {
        $queue = $this->initializeCategoryQueue($categoryId);
        return ['success' => true, 'queue' => $queue];
    }

    /**
     * Get queue statistics
     */
    public function getQueueStats($categoryId)
    {
        $queue = $this->loadCategoryQueue($categoryId);
        $tasks = $queue['tasks'] ?? [];

        $stats = [
            'total' => count($tasks),
            'pending' => 0,
            'completed' => 0,
            'in_progress' => 0
        ];

        foreach ($tasks as $task) {
            $status = $task['status'] ?? 'pending';
            if (isset($stats[$status])) {
                $stats[$status]++;
            }
        }

        return $stats;
    }
}
