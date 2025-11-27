<?php

namespace App\Apps\McpV1\McpV1Utils;

use App\Providers\PathMapper;
use App\Utils\ImageProcessUtil;
use App\Utils\FileSystemManager;
use Illuminate\Support\Str;

/**
 * Screenshot Management Service (McpV1)
 *
 * Manages screenshots with metadata (id, description, keywords)
 * - Files stored in Laravel uploads directory (writable)
 * - File names encoded to prevent encoding issues
 * - Metadata stored in Laravel data directory
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
        // Store screenshots in Laravel uploads directory (writable)
        $uploadsDir = PathMapper::getLaravelUploadsDir();
        $this->storageDirectory = $uploadsDir . DIRECTORY_SEPARATOR . 'mcp_screenshots';

        // Ensure directory exists using FileSystemManager
        FileSystemManager::ensureDirectoryExists($this->storageDirectory);

        // Metadata file in Laravel data directory
        $dataDir = PathMapper::getLaravelDataDir();
        FileSystemManager::ensureDirectoryExists($dataDir);
        $this->metadataFile = $dataDir . DIRECTORY_SEPARATOR . '.mcp-screenshots-metadata.json';

        $this->loadMetadata();
    }

    /**
     * Load metadata from file
     */
    private function loadMetadata()
    {
        if (FileSystemManager::exists($this->metadataFile)) {
            $content = FileSystemManager::readFile($this->metadataFile);
            if ($content !== false) {
                $data = json_decode($content, true);
                $this->screenshots = $data['screenshots'] ?? [];
            }
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

        FileSystemManager::writeFile(
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
     * @param bool $replace Whether to replace existing screenshot with same ID
     * @return array Result with screenshot info
     */
    public function uploadScreenshot($filePath, $id = null, $description = null, $keywords = [], $replace = false)
    {
        if (!file_exists($filePath)) {
            return ['error' => 'File not found', 'success' => false];
        }

        // Generate or validate ID
        if ($id === null) {
            $id = $this->generateId();
        } elseif ($this->exists($id)) {
            if (!$replace) {
                return ['error' => 'Screenshot ID already exists', 'success' => false, 'exists' => true, 'existing_id' => $id];
            }
            // Delete existing screenshot before replacing
            $this->delete($id);
        }

        // Get file info
        $originalName = basename($filePath);
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $mimeType = mime_content_type($filePath);

        // Supported image formats (extension and mime type mapping)
        $supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif'];
        $supportedMimeTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
            'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon',
            'image/tiff', 'image/avif', 'image/heic', 'image/heif'
        ];

        // Validate by extension OR mime type (more flexible)
        $isValidExtension = in_array($extension, $supportedExtensions);
        $isValidMimeType = in_array($mimeType, $supportedMimeTypes);

        if (!$isValidExtension && !$isValidMimeType) {
            return ['error' => 'Invalid image format. Supported: ' . implode(', ', $supportedExtensions), 'success' => false];
        }

        // If extension is missing or invalid but mime is valid, derive extension from mime
        if (!$isValidExtension && $isValidMimeType) {
            $mimeToExt = [
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/gif' => 'gif',
                'image/webp' => 'webp',
                'image/bmp' => 'bmp',
                'image/svg+xml' => 'svg',
                'image/x-icon' => 'ico',
                'image/vnd.microsoft.icon' => 'ico',
                'image/tiff' => 'tiff',
                'image/avif' => 'avif',
                'image/heic' => 'heic',
                'image/heif' => 'heif'
            ];
            $extension = $mimeToExt[$mimeType] ?? 'png';
        }

        // Generate encoded filename (UUID-based to avoid encoding issues)
        $encodedFilename = Str::uuid()->toString() . '.' . $extension;
        $targetPath = $this->storageDirectory . DIRECTORY_SEPARATOR . $encodedFilename;

        // Copy file to storage using FileSystemManager
        if (!FileSystemManager::copy($filePath, $targetPath)) {
            return ['error' => 'Failed to copy file to storage', 'success' => false];
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

        // Delete file using FileSystemManager
        if (FileSystemManager::exists($screenshot['file_path'])) {
            FileSystemManager::delete($screenshot['file_path']);
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
            if (FileSystemManager::exists($screenshot['file_path'])) {
                FileSystemManager::delete($screenshot['file_path']);
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

    /**
     * Upload multiple screenshots and merge them into one image
     *
     * @param array $filePaths Array of uploaded file paths
     * @param array $descriptions Array of descriptions (same index as files)
     * @param string $keyword Common keyword for the merged image
     * @param string|null $id Custom ID (optional)
     * @return array Result with merged screenshot info
     */
    public function uploadAndMerge(array $filePaths, array $descriptions = [], string $keyword = '', ?string $id = null, bool $replace = false)
    {
        if (empty($filePaths)) {
            return ['error' => 'No files provided', 'success' => false];
        }

        // Validate all files exist
        foreach ($filePaths as $index => $filePath) {
            if (!file_exists($filePath)) {
                return ['error' => "File not found at index $index: $filePath", 'success' => false];
            }
        }

        // Generate or validate ID
        if ($id === null) {
            $id = $this->generateId();
        } elseif ($this->exists($id)) {
            if (!$replace) {
                return ['error' => 'Screenshot ID already exists', 'success' => false, 'exists' => true, 'existing_id' => $id];
            }
            // Delete existing screenshot before replacing
            $this->delete($id);
        }

        try {
            // Merge images using common utility
            $mergeResult = ImageProcessUtil::mergeImagesVertically($filePaths, $descriptions);

            if (!isset($mergeResult['success']) || !$mergeResult['success']) {
                return ['error' => 'Failed to merge images', 'success' => false];
            }

            $mergedPath = $mergeResult['path'];

            // Get merged file info
            $extension = 'png';
            $mimeType = 'image/png';

            // Generate encoded filename
            $encodedFilename = Str::uuid()->toString() . '.' . $extension;
            $targetPath = $this->storageDirectory . DIRECTORY_SEPARATOR . $encodedFilename;

            // Move merged file to storage using FileSystemManager
            if (!FileSystemManager::copy($mergedPath, $targetPath)) {
                return ['error' => 'Failed to save merged file', 'success' => false];
            }
            // Clean up temp file
            @unlink($mergedPath);

            // Build description from all provided descriptions
            $combinedDescription = '';
            if (!empty($descriptions)) {
                $combinedDescription = implode(' | ', array_filter($descriptions));
            }

            // Build keywords array
            $keywords = [];
            if (!empty($keyword)) {
                $keywords[] = $keyword;
            }
            $keywords[] = 'merged';
            $keywords[] = count($filePaths) . '_images';

            // Store metadata
            $screenshot = [
                'id' => $id,
                'original_name' => 'merged_' . count($filePaths) . '_images.png',
                'encoded_filename' => $encodedFilename,
                'file_path' => $targetPath,
                'description' => $combinedDescription,
                'keywords' => $keywords,
                'mime_type' => $mimeType,
                'size' => filesize($targetPath),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
                'merged_info' => [
                    'image_count' => $mergeResult['image_count'],
                    'width' => $mergeResult['width'],
                    'height' => $mergeResult['height'],
                    'individual_descriptions' => $descriptions
                ]
            ];

            $this->screenshots[$id] = $screenshot;
            $this->saveMetadata();

            error_log('[ScreenshotService] Uploaded merged screenshot: ' . $id . ' (' . count($filePaths) . ' images)');

            return [
                'success' => true,
                'screenshot' => $screenshot
            ];

        } catch (\Exception $e) {
            error_log('[ScreenshotService] Merge error: ' . $e->getMessage());
            return ['error' => 'Merge failed: ' . $e->getMessage(), 'success' => false];
        }
    }

    /**
     * Upload multiple screenshots individually (batch upload without merge)
     *
     * @param array $filePaths Array of uploaded file paths
     * @param array $descriptions Array of descriptions
     * @param string $keyword Common keyword
     * @return array Result with all uploaded screenshots
     */
    public function uploadBatch(array $filePaths, array $descriptions = [], string $keyword = '')
    {
        $results = [];
        $successCount = 0;
        $failCount = 0;

        foreach ($filePaths as $index => $filePath) {
            $description = $descriptions[$index] ?? '';
            $keywords = [];
            if (!empty($keyword)) {
                $keywords[] = $keyword;
            }

            $result = $this->uploadScreenshot($filePath, null, $description, $keywords);

            if ($result['success']) {
                $successCount++;
                $results[] = [
                    'index' => $index,
                    'success' => true,
                    'screenshot' => $result['screenshot']
                ];
            } else {
                $failCount++;
                $results[] = [
                    'index' => $index,
                    'success' => false,
                    'error' => $result['error']
                ];
            }
        }

        return [
            'success' => $failCount === 0,
            'total' => count($filePaths),
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'results' => $results
        ];
    }
}
