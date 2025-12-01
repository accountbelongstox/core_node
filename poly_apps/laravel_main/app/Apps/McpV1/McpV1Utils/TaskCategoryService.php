<?php

namespace App\Apps\McpV1\McpV1Utils;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

/**
 * Task Category Service (McpV1)
 *
 * Manages task categories (based on _prompts subdirectories)
 * Stores configuration in external storage to prevent git commits
 *
 * Supports both MCP (Model Context Protocol) and web query interfaces
 * Following Laravel 12.x MCP specifications
 *
 * @see https://laravel.com/docs/12.x/mcp
 */
class TaskCategoryService
{
    private $baseDirectory;
    private $promptsDirectory;
    private $categoriesConfigFile;

    // 默认任务分类
    private $defaultCategories = [
        [
            'id' => 'global',
            'name' => '全局任务',
            'path' => '',
            'default' => true,
            'auto_create' => false
        ],
        [
            'id' => 'mcp-dev',
            'name' => 'MCP开发任务',
            'path' => 'mcp-dev',
            'default' => false,
            'auto_create' => true
        ],
        [
            'id' => 'ncore-dev',
            'name' => 'NCORE开发任务',
            'path' => 'ncore-dev',
            'default' => false,
            'auto_create' => true
        ],
        [
            'id' => 'pycore-dev',
            'name' => 'PYCORE开发任务',
            'path' => 'pycore-dev',
            'default' => false,
            'auto_create' => true
        ],
        [
            'id' => 'laravel-main-dev',
            'name' => 'LARAVEL MAIN开发任务',
            'path' => 'laravel-main-dev',
            'default' => false,
            'auto_create' => true
        ],
        [
            'id' => 'nuxt-dev',
            'name' => 'NUXT开发任务',
            'path' => 'nuxt-dev',
            'default' => false,
            'auto_create' => true
        ]
    ];

    public function __construct($baseDirectory = null)
    {
        $this->baseDirectory = $baseDirectory ?? PathMapper::getCoreNodeDir();
        $this->promptsDirectory = $this->baseDirectory . DIRECTORY_SEPARATOR . '_prompts';

        // 使用 _prompts/.categories.json 作为配置文件（可提交到git）
        // 数据文件存储在 _prompts/task-data/ 中（不提交）
        $this->categoriesConfigFile = $this->promptsDirectory . DIRECTORY_SEPARATOR . '.categories.json';

        $this->ensureDefaultStructure();
    }

    /**
     * 确保默认目录结构存在
     */
    private function ensureDefaultStructure()
    {
        FileSystemManager::ensureDirectoryExists($this->promptsDirectory);

        if (!file_exists($this->categoriesConfigFile)) {
            $this->initializeCategoriesConfig();
        }

        $this->autoCreateCategoryDirectories();
    }

    /**
     * 初始化分类配置文件
     */
    private function initializeCategoriesConfig()
    {
        $config = [
            'version' => '1.0',
            'categories' => $this->defaultCategories
        ];

        file_put_contents(
            $this->categoriesConfigFile,
            json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        error_log('[TaskCategoryService] Created categories config at: ' . $this->categoriesConfigFile);
    }

    /**
     * 自动创建需要auto_create的分类目录
     */
    private function autoCreateCategoryDirectories()
    {
        $config = $this->loadCategoriesConfig();

        foreach ($config['categories'] as $category) {
            if (!empty($category['auto_create']) && !empty($category['path'])) {
                $categoryPath = $this->promptsDirectory . DIRECTORY_SEPARATOR . $category['path'];
                FileSystemManager::ensureDirectoryExists($categoryPath);
            }
        }
    }

    /**
     * 加载分类配置
     */
    public function loadCategoriesConfig()
    {
        if (!file_exists($this->categoriesConfigFile)) {
            $this->initializeCategoriesConfig();
        }

        $content = file_get_contents($this->categoriesConfigFile);
        return json_decode($content, true);
    }

    /**
     * 获取所有分类
     */
    public function getAllCategories()
    {
        $config = $this->loadCategoriesConfig();
        return $config['categories'] ?? [];
    }

    /**
     * 获取默认分类
     */
    public function getDefaultCategory()
    {
        $categories = $this->getAllCategories();
        foreach ($categories as $category) {
            if (!empty($category['default'])) {
                return $category;
            }
        }
        return $categories[0] ?? null;
    }

    /**
     * 根据ID获取分类
     */
    public function getCategoryById($id)
    {
        $categories = $this->getAllCategories();
        foreach ($categories as $category) {
            if ($category['id'] === $id) {
                return $category;
            }
        }
        return null;
    }

    /**
     * 创建新分类
     */
    public function createCategory($id, $name, $path)
    {
        $config = $this->loadCategoriesConfig();

        // 检查ID是否已存在
        foreach ($config['categories'] as $category) {
            if ($category['id'] === $id) {
                return ['success' => false, 'error' => 'Category ID already exists'];
            }
        }

        // 创建目录
        if (!empty($path)) {
            $categoryPath = $this->promptsDirectory . DIRECTORY_SEPARATOR . $path;
            if (!is_dir($categoryPath)) {
                @mkdir($categoryPath, 0755, true);
            }
        }

        // 添加到配置
        $config['categories'][] = [
            'id' => $id,
            'name' => $name,
            'path' => $path,
            'default' => false,
            'auto_create' => false,
            'created_at' => date('Y-m-d H:i:s')
        ];

        $config['updated_at'] = date('Y-m-d H:i:s');

        file_put_contents(
            $this->categoriesConfigFile,
            json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        return ['success' => true, 'category' => $config['categories'][count($config['categories']) - 1]];
    }

    /**
     * 获取分类下的所有文件
     */
    public function getCategoryFiles($categoryId)
    {
        $category = $this->getCategoryById($categoryId);
        if (!$category) {
            return [];
        }

        $categoryPath = empty($category['path'])
            ? $this->promptsDirectory
            : $this->promptsDirectory . DIRECTORY_SEPARATOR . $category['path'];

        if (!file_exists($categoryPath)) {
            return [];
        }

        $files = scandir($categoryPath);
        $result = [];

        foreach ($files as $file) {
            if ($file === '.' || $file === '..' || strpos($file, '.') === 0) {
                continue;
            }

            $fullPath = $categoryPath . DIRECTORY_SEPARATOR . $file;

            // Skip broken symlinks
            if (is_link($fullPath) && !file_exists($fullPath)) {
                error_log('[TaskCategoryService] Skipping broken symlink: ' . $fullPath);
                continue;
            }

            if (is_file($fullPath)) {
                $relativePath = empty($category['path'])
                    ? '_prompts' . DIRECTORY_SEPARATOR . $file
                    : '_prompts' . DIRECTORY_SEPARATOR . $category['path'] . DIRECTORY_SEPARATOR . $file;

                $result[] = [
                    'name' => $file,
                    'path' => $relativePath,
                    'category_id' => $categoryId,
                    'modified' => date('Y-m-d H:i:s', filemtime($fullPath)),
                    'size' => filesize($fullPath)
                ];
            }
        }

        return $result;
    }
}
