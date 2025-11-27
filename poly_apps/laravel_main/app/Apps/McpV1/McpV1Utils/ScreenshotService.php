<?php

namespace App\Apps\McpV1\McpV1Utils;

use App\Providers\PathMapper;
use Illuminate\Support\Str;

/**
 * Screenshot Management Service (McpV1)
 *
 * Manages screenshots with metadata (id, description, keywords)
 * - Files stored outside code directory in /www/shared-data/screenshots/
 * - File names encoded to prevent encoding issues
 * - Metadata stored in-memory (can be persisted to database if needed)
 *
 * Supports both MCP (Model Context Protocol) and web API interfaces
 * Following Laravel 12.x MCP specifications
 *
 * @see https://laravel.com/docs/12.x/mcp
 */
class ScreenshotService
{
    private $storageDirectory;
    private $screenshots = [];
    private $metadataFile;

    public function __construct()
    {
        // Store screenshots outside code directory
        $sharedDataDir = PathMapper::getSharedData();
        $this->storageDirectory = $sharedDataDir . DIRECTORY_SEPARATOR . 'screenshots';

        if (!file_exists($this->storageDirectory)) {
            mkdir($this->storageDirectory, 0755, true);
        }

        // Metadata file in code directory (can be committed)
        $baseDir = PathMapper::getCoreNodeDir();
        $promptsDir = $baseDir . DIRECTORY_SEPARATOR . '_prompts';
        $this->metadataFile = $promptsDir . DIRECTORY_SEPARATOR . '.screenshots-metadata.json';

        $this->loadMetadata();
    }

    /**
     * Load metadata from file
     */
    private function loadMetadata()
    {
        if (file_exists($this->metadataFile)) {
            $data = json_decode(file_get_contents($this->metadataFile), true);
            $this->screenshots = $data['screenshots'] ?? [];
        }
    }

    /**
     * Save metadata to file
     */
    private function saveMetadata()
    {
        $data = [
            'version' => '1.0',
            'screenshots' => $this->screenshots,
            'updated_at' => date('Y-m-d H:i:s')
        ];

        file_put_contents(
            $this->metadataFile,
            json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    /**
     * Upload a screenshot
     *
     * @param string $filePath Uploaded file path
     * @param string|null $id Custom ID (optional, auto-generated if not provided)
     * @param string|null $description Description
     * @param array $keywords Keywords array
     * @return array Result with screenshot info
     */
    public function uploadScreenshot($filePath, $id = null, $description = null, $keywords = [])
    {
        if (!file_exists($filePath)) {
            return ['error' => 'File not found', 'success' => false];
        }

        // Generate or validate ID
        if ($id === null) {
            $id = $this->generateId();
        } elseif ($this->exists($id)) {
            return ['error' => 'Screenshot ID already exists', 'success' => false];
        }

        // Get file info
        $originalName = basename($filePath);
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $mimeType = mime_content_type($filePath);

        // Validate image type
        if (!in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'])) {
            return ['error' => 'Invalid image format', 'success' => false];
        }

        // Generate encoded filename (UUID-based to avoid encoding issues)
        $encodedFilename = Str::uuid()->toString() . '.' . $extension;
        $targetPath = $this->storageDirectory . DIRECTORY_SEPARATOR . $encodedFilename;

        // Copy file to storage
        if (!copy($filePath, $targetPath)) {
            return ['error' => 'Failed to copy file', 'success' => false];
        }

        // Store metadata
        $screenshot = [
            'id' => $id,
            'original_name' => $originalName,
            'encoded_filename' => $encodedFilename,
            'file_path' => $targetPath,
            'description' => $description ?? '',
            'keywords' => is_array($keywords) ? $keywords : [],
            'mime_type' => $mimeType,
            'size' => filesize($targetPath),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ];

        $this->screenshots[$id] = $screenshot;
        $this->saveMetadata();

        error_log('[ScreenshotService] Uploaded screenshot: ' . $id . ' -> ' . $encodedFilename);

        return [
            'success' => true,
            'screenshot' => $screenshot
        ];
    }

    /**
     * Get the latest screenshot
     *
     * @return array|null Screenshot data or null
     */
    public function getLatest()
    {
        if (empty($this->screenshots)) {
            return null;
        }

        // Sort by created_at descending
        $sorted = $this->screenshots;
        uasort($sorted, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });

        return reset($sorted);
    }

    /**
     * Get screenshot by ID
     *
     * @param string $id Screenshot ID
     * @return array|null Screenshot data or null
     */
    public function getById($id)
    {
        return $this->screenshots[$id] ?? null;
    }

    /**
     * Search screenshots by keywords
     *
     * @param string $keyword Keyword to search
     * @return array Array of matching screenshots
     */
    public function searchByKeyword($keyword)
    {
        $results = [];

        foreach ($this->screenshots as $screenshot) {
            // Search in keywords array
            if (in_array($keyword, $screenshot['keywords'])) {
                $results[] = $screenshot;
                continue;
            }

            // Search in description
            if (stripos($screenshot['description'], $keyword) !== false) {
                $results[] = $screenshot;
                continue;
            }

            // Search in original name
            if (stripos($screenshot['original_name'], $keyword) !== false) {
                $results[] = $screenshot;
            }
        }

        return $results;
    }

    /**
     * Get all screenshots
     *
     * @param int|null $limit Limit number of results
     * @param int $offset Offset for pagination
     * @return array Array of screenshots
     */
    public function getAll($limit = null, $offset = 0)
    {
        $screenshots = array_values($this->screenshots);

        // Sort by created_at descending
        usort($screenshots, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });

        if ($limit !== null) {
            return array_slice($screenshots, $offset, $limit);
        }

        return $screenshots;
    }

    /**
     * Delete screenshot by ID
     *
     * @param string $id Screenshot ID
     * @return bool Success status
     */
    public function delete($id)
    {
        if (!isset($this->screenshots[$id])) {
            return false;
        }

        $screenshot = $this->screenshots[$id];

        // Delete file
        if (file_exists($screenshot['file_path'])) {
            unlink($screenshot['file_path']);
        }

        // Remove from metadata
        unset($this->screenshots[$id]);
        $this->saveMetadata();

        error_log('[ScreenshotService] Deleted screenshot: ' . $id);

        return true;
    }

    /**
     * Clear all screenshots
     *
     * @return array Result with count
     */
    public function clearAll()
    {
        $count = 0;

        foreach ($this->screenshots as $id => $screenshot) {
            if (file_exists($screenshot['file_path'])) {
                unlink($screenshot['file_path']);
                $count++;
            }
        }

        $this->screenshots = [];
        $this->saveMetadata();

        error_log('[ScreenshotService] Cleared all screenshots: ' . $count . ' deleted');

        return [
            'success' => true,
            'deleted_count' => $count
        ];
    }

    /**
     * Check if screenshot ID exists
     *
     * @param string $id Screenshot ID
     * @return bool
     */
    public function exists($id)
    {
        return isset($this->screenshots[$id]);
    }

    /**
     * Generate unique ID
     *
     * @return string
     */
    private function generateId()
    {
        do {
            $id = 'ss_' . date('Ymd_His') . '_' . substr(Str::uuid()->toString(), 0, 8);
        } while ($this->exists($id));

        return $id;
    }

    /**
     * Get storage directory path
     *
     * @return string
     */
    public function getStorageDirectory()
    {
        return $this->storageDirectory;
    }

    /**
     * Get statistics
     *
     * @return array
     */
    public function getStats()
    {
        $totalSize = 0;
        foreach ($this->screenshots as $screenshot) {
            $totalSize += $screenshot['size'];
        }

        return [
            'total_count' => count($this->screenshots),
            'total_size' => $totalSize,
            'total_size_mb' => round($totalSize / 1024 / 1024, 2),
            'storage_directory' => $this->storageDirectory
        ];
    }
}
