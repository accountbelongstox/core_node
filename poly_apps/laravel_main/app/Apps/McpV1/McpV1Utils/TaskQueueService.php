<?php

namespace App\Apps\McpV1\McpV1Utils;

use App\Providers\PathMapper;

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

    public function __construct($baseDirectory = null)
    {
        $this->baseDirectory = $baseDirectory ?? PathMapper::getCoreNodeDir();

        $sharedDataDir = PathMapper::getSharedData();
        $this->queueDirectory = $sharedDataDir . DIRECTORY_SEPARATOR . 'task-dispatch' . DIRECTORY_SEPARATOR . 'queues';

        if (!file_exists($this->queueDirectory)) {
            mkdir($this->queueDirectory, 0755, true);
        }
    }

    /**
     * 获取分类队列文件路径
     */
    private function getCategoryQueueFile($categoryId)
    {
        return $this->queueDirectory . DIRECTORY_SEPARATOR . $categoryId . '.json';
    }

    /**
     * 加载分类队列
     */
    public function loadCategoryQueue($categoryId)
    {
        $queueFile = $this->getCategoryQueueFile($categoryId);

        if (!file_exists($queueFile)) {
            return $this->initializeCategoryQueue($categoryId);
        }

        $content = file_get_contents($queueFile);
        return json_decode($content, true);
    }

    /**
     * 初始化分类队列
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
     * 保存分类队列
     */
    private function saveCategoryQueue($categoryId, $queue)
    {
        $queue['last_updated'] = date('Y-m-d H:i:s');

        $queueFile = $this->getCategoryQueueFile($categoryId);
        file_put_contents(
            $queueFile,
            json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    /**
     * 从文件内容解析任务段落
     *
     * 使用\n\n作为段落分隔符
     */
    private function parseParagraphsFromContent($content)
    {
        // 使用\n\n分隔段落
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
     * 添加文件到任务队列
     *
     * @param string $categoryId 分类ID
     * @param string $filePath 文件路径（相对于_prompts）
     * @param string $content 文件内容
     */
    public function addFileToQueue($categoryId, $filePath, $content)
    {
        $queue = $this->loadCategoryQueue($categoryId);

        // 解析段落
        $paragraphs = $this->parseParagraphsFromContent($content);

        // 为每个段落创建任务
        foreach ($paragraphs as $paragraph) {
            $taskId = 'task_' . uniqid();

            // 检查是否已存在相同内容的任务（通过hash）
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
                    'content' => $paragraph['content'],
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
     * 获取所有任务
     */
    public function getAllTasks($categoryId)
    {
        $queue = $this->loadCategoryQueue($categoryId);
        return $queue['tasks'] ?? [];
    }

    /**
     * 获取最后一个任务（最新任务）
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
     * 检查是否有最新任务
     */
    public function hasLatestTask($categoryId)
    {
        $lastTask = $this->getLastTask($categoryId);
        return $lastTask !== null;
    }

    /**
     * 根据关键字搜索任务
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
     * 更新任务状态
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
     * 删除任务
     */
    public function deleteTask($categoryId, $taskId)
    {
        $queue = $this->loadCategoryQueue($categoryId);

        $queue['tasks'] = array_filter($queue['tasks'], function($task) use ($taskId) {
            return $task['id'] !== $taskId;
        });

        // 重新索引数组
        $queue['tasks'] = array_values($queue['tasks']);

        $this->saveCategoryQueue($categoryId, $queue);

        return ['success' => true];
    }

    /**
     * 清空分类队列
     */
    public function clearCategoryQueue($categoryId)
    {
        $queue = $this->initializeCategoryQueue($categoryId);
        return ['success' => true, 'queue' => $queue];
    }

    /**
     * 获取队列统计信息
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
