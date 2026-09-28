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
 * Following Laravel 13.x MCP specifications
 *
 * @see https://laravel.com/docs/13.x/mcp
 */
class TaskCategoryService
{
    private $baseDirectory;
    private $promptsDirectory;
    private $categoriesConfigFile;

    /**
     * Whether the _prompts directory is actually usable. When false (e.g. the
     * path is squatted by an unrenamable regular file, or mkdir failed), every
     * read degrades to the in-memory defaults and every write becomes a no-op
     * with an error result — the service must never 500 the route from its
     * constructor (it is built inside the controller constructor, so an
     * exception here takes down ALL task-dispatch endpoints).
     */
    private $directoryReady = false;

    // Default task categories
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

        // Use _prompts/.categories.json as the config file (can be committed to git)
        // Data files are stored in _prompts/task-data/ (not committed)
        $this->categoriesConfigFile = $this->promptsDirectory . DIRECTORY_SEPARATOR . '.categories.json';

        $this->ensureDefaultStructure();
    }

    /**
     * Ensure the default directory structure exists.
     *
     * Live incident 2026-06-12: a regular FILE (user notes) sat at the
     * _prompts path, so ensureDirectoryExists() returned false (silently) and
     * the config write threw "Failed to open stream: No such file or
     * directory" — a 500 on every task-dispatch route. Such a file is user
     * data: preserve it by renaming it aside, then create the directory. If
     * the path still cannot become a directory, mark the service degraded
     * instead of throwing.
     */
    private function ensureDefaultStructure()
    {
        $this->directoryReady = self::ensurePromptsDirectory($this->promptsDirectory);

        if (!$this->directoryReady) {
            error_log('[TaskCategoryService] prompts directory unavailable: ' . $this->promptsDirectory . ' — serving in-memory default categories');
            return;
        }

        if (!file_exists($this->categoriesConfigFile)) {
            $this->initializeCategoriesConfig();
        }

        $this->autoCreateCategoryDirectories();
    }

    /**
     * Make the _prompts path a usable directory, shared by every McpV1 service
     * that stores data under it (TaskCategoryService / PromptMappingService /
     * TaskQueueService). A regular file squatting on the path is user data:
     * it is preserved by renaming it aside before the directory is created.
     * Returns false (never throws) when the path cannot become a directory.
     */
    public static function ensurePromptsDirectory(string $promptsDirectory): bool
    {
        if (is_file($promptsDirectory)) {
            $backup = $promptsDirectory . '.file-backup-' . date('Ymd-His') . '.txt';
            if (@rename($promptsDirectory, $backup)) {
                error_log('[McpV1] _prompts path was a regular file; preserved as: ' . $backup);
            } else {
                error_log('[McpV1] _prompts path is a regular file and could not be renamed: ' . $promptsDirectory);
                return false;
            }
        }

        return FileSystemManager::ensureDirectoryExists($promptsDirectory);
    }

    /**
     * Initialize the categories config file (no-op when the directory is
     * unavailable — degraded mode serves the in-memory defaults instead).
     */
    private function initializeCategoriesConfig()
    {
        if (!$this->directoryReady) {
            return;
        }

        $config = [
            'version' => '1.0',
            'categories' => $this->defaultCategories
        ];

        $written = @file_put_contents(
            $this->categoriesConfigFile,
            json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        if ($written === false) {
            error_log('[TaskCategoryService] Failed to write categories config at: ' . $this->categoriesConfigFile);
            return;
        }

        error_log('[TaskCategoryService] Created categories config at: ' . $this->categoriesConfigFile);
    }

    /**
     * Automatically create the category directories that require auto_create
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
     * Load the categories config. Falls back to the in-memory defaults when
     * the directory is degraded or the config file is unreadable/corrupt, so
     * readers always get a valid structure.
     */
    public function loadCategoriesConfig()
    {
        $defaults = [
            'version' => '1.0',
            'categories' => $this->defaultCategories
        ];

        if (!$this->directoryReady) {
            return $defaults;
        }

        if (!file_exists($this->categoriesConfigFile)) {
            $this->initializeCategoriesConfig();
        }

        $content = @file_get_contents($this->categoriesConfigFile);
        if ($content === false) {
            return $defaults;
        }

        $decoded = json_decode($content, true);
        if (!is_array($decoded) || empty($decoded['categories'])) {
            return $defaults;
        }

        return $decoded;
    }

    /**
     * Get all categories
     */
    public function getAllCategories()
    {
        $config = $this->loadCategoriesConfig();
        return $config['categories'] ?? [];
    }

    /**
     * Get the default category
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
     * Get a category by ID
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
     * Create a new category
     */
    public function createCategory($id, $name, $path)
    {
        if (!$this->directoryReady) {
            return ['success' => false, 'error' => 'Prompts directory unavailable (degraded mode) — check the _prompts path on the server'];
        }

        $config = $this->loadCategoriesConfig();

        // Check whether the ID already exists
        foreach ($config['categories'] as $category) {
            if ($category['id'] === $id) {
                return ['success' => false, 'error' => 'Category ID already exists'];
            }
        }

        // Create the directory
        if (!empty($path)) {
            $categoryPath = $this->promptsDirectory . DIRECTORY_SEPARATOR . $path;
            if (!is_dir($categoryPath)) {
                @mkdir($categoryPath, 0755, true);
            }
        }

        // Add to the config
        $config['categories'][] = [
            'id' => $id,
            'name' => $name,
            'path' => $path,
            'default' => false,
            'auto_create' => false,
            'created_at' => date('Y-m-d H:i:s')
        ];

        $config['updated_at'] = date('Y-m-d H:i:s');

        $written = @file_put_contents(
            $this->categoriesConfigFile,
            json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        if ($written === false) {
            return ['success' => false, 'error' => 'Failed to persist categories config'];
        }

        return ['success' => true, 'category' => $config['categories'][count($config['categories']) - 1]];
    }

    /**
     * Get all files under a category
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
