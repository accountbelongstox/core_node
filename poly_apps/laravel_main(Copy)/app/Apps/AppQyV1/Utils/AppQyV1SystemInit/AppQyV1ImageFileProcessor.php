<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use Illuminate\Support\Facades\File;
use ZipArchive;

/**
 * Image File Processor for Dictionary System
 * Reference: DevOps basetool/folder.js, config image directory structure
 */
class AppQyV1ImageFileProcessor
{
    protected $storageManager;

    public function __construct()
    {
        $this->storageManager = new AppQyV1ExternalStorageManager();
    }

    /**
     * Process image archive and merge to new directory structure
     * Reference: DevOps basetool/folder.js file operations
     * 
     * @param string $imageArchivePath
     * @return array
     */
    public function processImageArchive(string $imageArchivePath): array
    {
        try {
            if (!File::exists($imageArchivePath)) {
                return ['success' => false, 'progress' => 0, 'error' => 'Image archive not found'];
            }

            // Get file extension to determine archive type
            $extension = strtolower(pathinfo($imageArchivePath, PATHINFO_EXTENSION));
            
            // Extract archive based on type
            $extractionResult = $this->extractArchive($imageArchivePath, $extension);
            if (!$extractionResult['success']) {
                return $extractionResult;
            }

            $extractedPath = $extractionResult['extracted_path'];
            
            // Process extracted image files
            $processingResult = $this->processExtractedImageFiles($extractedPath);
            
            // Clean up temporary extraction directory
            if (File::exists($extractedPath)) {
                File::deleteDirectory($extractedPath);
            }
            
            return $processingResult;

        } catch (\Exception $e) {
            return [
                'success' => false,
                'progress' => 0,
                'error' => 'Image processing failed: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Extract archive file
     * 
     * @param string $archivePath
     * @param string $extension
     * @return array
     */
    protected function extractArchive(string $archivePath, string $extension): array
    {
        try {
            $tempPath = $this->storageManager->getTempPath() . '/image_extract_' . time();
            File::makeDirectory($tempPath, 0755, true);

            switch ($extension) {
                case 'zip':
                    return $this->extractZip($archivePath, $tempPath);
                case '7z':
                    return $this->extract7z($archivePath, $tempPath);
                case 'tar':
                case 'gz':
                case 'tar.gz':
                    return $this->extractTar($archivePath, $tempPath);
                default:
                    return ['success' => false, 'error' => 'Unsupported archive format: ' . $extension];
            }

        } catch (\Exception $e) {
            return ['success' => false, 'error' => 'Archive extraction failed: ' . $e->getMessage()];
        }
    }

    /**
     * Extract ZIP archive
     * 
     * @param string $archivePath
     * @param string $tempPath
     * @return array
     */
    protected function extractZip(string $archivePath, string $tempPath): array
    {
        try {
            $zip = new ZipArchive();
            $result = $zip->open($archivePath);
            
            if ($result !== TRUE) {
                return ['success' => false, 'error' => 'Failed to open ZIP archive'];
            }
            
            $zip->extractTo($tempPath);
            $zip->close();
            
            return ['success' => true, 'extracted_path' => $tempPath];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => 'ZIP extraction failed: ' . $e->getMessage()];
        }
    }

    /**
     * Extract 7z archive using system command
     * 
     * @param string $archivePath
     * @param string $tempPath
     * @return array
     */
    protected function extract7z(string $archivePath, string $tempPath): array
    {
        try {
            $command = "7z x \"$archivePath\" -o\"$tempPath\" -y";
            $output = [];
            $returnCode = 0;
            
            exec($command, $output, $returnCode);
            
            if ($returnCode === 0) {
                return ['success' => true, 'extracted_path' => $tempPath];
            } else {
                return ['success' => false, 'error' => '7z extraction failed: ' . implode("\n", $output)];
            }

        } catch (\Exception $e) {
            return ['success' => false, 'error' => '7z extraction failed: ' . $e->getMessage()];
        }
    }

    /**
     * Extract TAR/GZ archive
     * 
     * @param string $archivePath
     * @param string $tempPath
     * @return array
     */
    protected function extractTar(string $archivePath, string $tempPath): array
    {
        try {
            $command = "tar -xf \"$archivePath\" -C \"$tempPath\"";
            $output = [];
            $returnCode = 0;
            
            exec($command, $output, $returnCode);
            
            if ($returnCode === 0) {
                return ['success' => true, 'extracted_path' => $tempPath];
            } else {
                return ['success' => false, 'error' => 'TAR extraction failed: ' . implode("\n", $output)];
            }

        } catch (\Exception $e) {
            return ['success' => false, 'error' => 'TAR extraction failed: ' . $e->getMessage()];
        }
    }

    /**
     * Process extracted image files and organize them
     * 
     * @param string $extractedPath
     * @return array
     */
    protected function processExtractedImageFiles(string $extractedPath): array
    {
        try {
            // Image file extensions to process
            $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];
            
            // Find all image files recursively
            $imageFiles = $this->findImageFilesRecursively($extractedPath, $imageExtensions);
            
            if (empty($imageFiles)) {
                return ['success' => false, 'progress' => 0, 'error' => 'No image files found in archive'];
            }

            $totalFiles = count($imageFiles);
            $processedFiles = 0;
            $copiedFiles = 0;
            $skippedFiles = 0;
            $errors = [];

            // Process each image file
            foreach ($imageFiles as $imageFile) {
                try {
                    $result = $this->processSingleImageFile($imageFile);
                    if ($result['success']) {
                        $copiedFiles++;
                    } elseif ($result['skipped']) {
                        $skippedFiles++;
                    } else {
                        $errors[] = $result['error'];
                    }
                } catch (\Exception $e) {
                    $errors[] = "Failed to process {$imageFile}: " . $e->getMessage();
                }
                
                $processedFiles++;
                
                // Return progress for very large archives
                if ($processedFiles % 500 === 0 && $processedFiles < $totalFiles) {
                    return [
                        'success' => false,
                        'progress' => round(($processedFiles / $totalFiles) * 100)
                    ];
                }
            }

            return [
                'success' => true,
                'progress' => 100,
                'total_files' => $totalFiles,
                'copied_files' => $copiedFiles,
                'skipped_files' => $skippedFiles,
                'errors' => $errors
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'progress' => 0,
                'error' => 'Image file processing failed: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Find image files recursively in directory
     * 
     * @param string $directory
     * @param array $extensions
     * @return array
     */
    protected function findImageFilesRecursively(string $directory, array $extensions): array
    {
        $imageFiles = [];
        
        if (!File::exists($directory)) {
            return $imageFiles;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $extension = strtolower($file->getExtension());
                if (in_array($extension, $extensions)) {
                    $imageFiles[] = $file->getPathname();
                }
            }
        }

        return $imageFiles;
    }

    /**
     * Process a single image file
     * 
     * @param string $imageFilePath
     * @return array
     */
    protected function processSingleImageFile(string $imageFilePath): array
    {
        try {
            $filename = basename($imageFilePath);
            $filenameWithoutExt = pathinfo($filename, PATHINFO_FILENAME);
            
            // Validate image file
            $validation = $this->validateImageFile($imageFilePath);
            if (!$validation['valid']) {
                return ['success' => false, 'error' => $validation['error']];
            }

            // Skip files that are too small (likely thumbnails or icons)
            if ($validation['file_size'] < 1024) { // Less than 1KB
                return ['success' => false, 'skipped' => true, 'error' => 'File too small, likely thumbnail'];
            }

            // Target directory for word images
            $targetDir = $this->storageManager->getWordImagesPath();

            // Ensure target directory exists
            if (!File::exists($targetDir)) {
                File::makeDirectory($targetDir, 0755, true);
            }

            // Generate new filename to avoid conflicts and organize by word
            $targetFilename = $this->generateOrganizedFilename($filename, $validation);
            $targetPath = $targetDir . '/' . $targetFilename;

            // Copy and optimize image if needed
            if ($this->copyAndOptimizeImage($imageFilePath, $targetPath, $validation)) {
                return [
                    'success' => true,
                    'source' => $imageFilePath,
                    'target' => $targetPath,
                    'size' => $validation['file_size'],
                    'dimensions' => $validation['width'] . 'x' . $validation['height']
                ];
            } else {
                return ['success' => false, 'error' => "Failed to copy image: $filename"];
            }

        } catch (\Exception $e) {
            return ['success' => false, 'error' => 'Image processing error: ' . $e->getMessage()];
        }
    }

    /**
     * Validate image file
     * 
     * @param string $imageFilePath
     * @return array
     */
    protected function validateImageFile(string $imageFilePath): array
    {
        try {
            if (!File::exists($imageFilePath)) {
                return ['valid' => false, 'error' => 'File does not exist'];
            }

            $fileSize = File::size($imageFilePath);
            if ($fileSize === 0) {
                return ['valid' => false, 'error' => 'File is empty'];
            }

            // Get image info
            $imageInfo = getimagesize($imageFilePath);
            if ($imageInfo === false) {
                return ['valid' => false, 'error' => 'Not a valid image file'];
            }

            $width = $imageInfo[0];
            $height = $imageInfo[1];
            $mimeType = $imageInfo['mime'];

            // Check dimensions
            if ($width < 10 || $height < 10) {
                return ['valid' => false, 'error' => 'Image dimensions too small'];
            }

            // Check file size limits (max 20MB)
            if ($fileSize > 20 * 1024 * 1024) {
                return ['valid' => false, 'error' => 'File size too large (>20MB)'];
            }

            return [
                'valid' => true,
                'width' => $width,
                'height' => $height,
                'mime_type' => $mimeType,
                'file_size' => $fileSize
            ];

        } catch (\Exception $e) {
            return ['valid' => false, 'error' => 'Image validation failed: ' . $e->getMessage()];
        }
    }

    /**
     * Generate organized filename based on image characteristics
     * 
     * @param string $originalFilename
     * @param array $validation
     * @return string
     */
    protected function generateOrganizedFilename(string $originalFilename, array $validation): string
    {
        $pathInfo = pathinfo($originalFilename);
        $basename = $pathInfo['filename'];
        $extension = strtolower($pathInfo['extension']);
        
        // Clean basename for safe filename
        $safeBasename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $basename);
        $safeBasename = preg_replace('/_+/', '_', $safeBasename); // Remove multiple underscores
        $safeBasename = trim($safeBasename, '_');
        
        // Add dimensions and timestamp for uniqueness
        $timestamp = date('YmdHis');
        $dimensions = $validation['width'] . 'x' . $validation['height'];
        
        return $safeBasename . '_' . $dimensions . '_' . $timestamp . '.' . $extension;
    }

    /**
     * Copy and optimize image
     * 
     * @param string $sourcePath
     * @param string $targetPath
     * @param array $validation
     * @return bool
     */
    protected function copyAndOptimizeImage(string $sourcePath, string $targetPath, array $validation): bool
    {
        try {
            // For now, just copy the file
            // Future enhancement: resize large images, convert formats, etc.
            
            $copied = File::copy($sourcePath, $targetPath);
            
            if ($copied) {
                // Set proper permissions
                chmod($targetPath, 0644);
                return true;
            }
            
            return false;

        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Generate unique filename to avoid conflicts
     * 
     * @param string $targetDir
     * @param string $originalFilename
     * @return string
     */
    protected function generateUniqueFilename(string $targetDir, string $originalFilename): string
    {
        $pathInfo = pathinfo($originalFilename);
        $basename = $pathInfo['filename'];
        $extension = $pathInfo['extension'];
        
        $targetFilename = $originalFilename;
        $counter = 1;
        
        while (File::exists($targetDir . '/' . $targetFilename)) {
            $targetFilename = $basename . '_' . $counter . '.' . $extension;
            $counter++;
        }
        
        return $targetFilename;
    }

    /**
     * Validate image archive before processing
     * 
     * @param string $archivePath
     * @return array
     */
    public function validateImageArchive(string $archivePath): array
    {
        try {
            if (!File::exists($archivePath)) {
                return ['valid' => false, 'error' => 'Archive file does not exist'];
            }

            $fileSize = File::size($archivePath);
            if ($fileSize === 0) {
                return ['valid' => false, 'error' => 'Archive file is empty'];
            }

            // Check file extension
            $extension = strtolower(pathinfo($archivePath, PATHINFO_EXTENSION));
            $supportedExtensions = ['zip', '7z', 'tar', 'gz'];
            
            if (!in_array($extension, $supportedExtensions)) {
                return ['valid' => false, 'error' => 'Unsupported archive format'];
            }

            return [
                'valid' => true,
                'size' => $fileSize,
                'extension' => $extension,
                'size_mb' => round($fileSize / (1024 * 1024), 2)
            ];

        } catch (\Exception $e) {
            return ['valid' => false, 'error' => 'Archive validation failed: ' . $e->getMessage()];
        }
    }

    /**
     * Get image statistics from processed files
     * 
     * @return array
     */
    public function getImageStatistics(): array
    {
        try {
            $imageDir = $this->storageManager->getWordImagesPath();
            
            if (!File::exists($imageDir)) {
                return [
                    'total_images' => 0,
                    'total_size' => 0,
                    'average_size' => 0
                ];
            }

            $imageFiles = glob($imageDir . '/*.{jpg,jpeg,png,gif,webp,bmp}', GLOB_BRACE);
            $totalImages = count($imageFiles);
            $totalSize = 0;

            foreach ($imageFiles as $imageFile) {
                $totalSize += File::size($imageFile);
            }

            return [
                'total_images' => $totalImages,
                'total_size' => $totalSize,
                'total_size_mb' => round($totalSize / (1024 * 1024), 2),
                'average_size' => $totalImages > 0 ? round($totalSize / $totalImages) : 0,
                'directory' => $imageDir
            ];

        } catch (\Exception $e) {
            return ['error' => 'Failed to get statistics: ' . $e->getMessage()];
        }
    }
}
