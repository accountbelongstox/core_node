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
 * Audio File Processor for Dictionary System
 * Reference: DevOps basetool/voice_tool/search_voice.js, config audio directory structure
 */
class AppQyV1AudioFileProcessor
{
    protected $storageManager;

    public function __construct()
    {
        $this->storageManager = new AppQyV1ExternalStorageManager();
    }

    /**
     * Process audio archive and merge to new directory structure
     * Reference: DevOps basetool/voice_tool/search_voice.js, config audio paths
     * 
     * @param string $audioArchivePath
     * @return array
     */
    public function processAudioArchive(string $audioArchivePath): array
    {
        try {
            if (!File::exists($audioArchivePath)) {
                return ['success' => false, 'progress' => 0, 'error' => 'Audio archive not found'];
            }

            // Get file extension to determine archive type
            $extension = strtolower(pathinfo($audioArchivePath, PATHINFO_EXTENSION));
            
            // Extract archive based on type
            $extractionResult = $this->extractArchive($audioArchivePath, $extension);
            if (!$extractionResult['success']) {
                return $extractionResult;
            }

            $extractedPath = $extractionResult['extracted_path'];
            
            // Process extracted audio files
            $processingResult = $this->processExtractedAudioFiles($extractedPath);
            
            // Clean up temporary extraction directory
            if (File::exists($extractedPath)) {
                File::deleteDirectory($extractedPath);
            }
            
            return $processingResult;

        } catch (\Exception $e) {
            return [
                'success' => false,
                'progress' => 0,
                'error' => 'Audio processing failed: ' . $e->getMessage()
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
            $tempPath = $this->storageManager->getTempPath() . '/audio_extract_' . time();
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
            // Try to use 7z command line tool
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
     * Process extracted audio files and organize them
     * Reference: DevOps config/index.js audio directory structure
     * 
     * @param string $extractedPath
     * @return array
     */
    protected function processExtractedAudioFiles(string $extractedPath): array
    {
        try {
            // Audio file extensions to process
            $audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];
            
            // Find all audio files recursively
            $audioFiles = $this->findAudioFilesRecursively($extractedPath, $audioExtensions);
            
            if (empty($audioFiles)) {
                return ['success' => false, 'progress' => 0, 'error' => 'No audio files found in archive'];
            }

            $totalFiles = count($audioFiles);
            $processedFiles = 0;
            $copiedFiles = 0;
            $errors = [];

            // Process each audio file
            foreach ($audioFiles as $audioFile) {
                try {
                    $result = $this->processSingleAudioFile($audioFile);
                    if ($result['success']) {
                        $copiedFiles++;
                    } else {
                        $errors[] = $result['error'];
                    }
                } catch (\Exception $e) {
                    $errors[] = "Failed to process {$audioFile}: " . $e->getMessage();
                }
                
                $processedFiles++;
                
                // Return progress for very large archives
                if ($processedFiles % 1000 === 0 && $processedFiles < $totalFiles) {
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
                'errors' => $errors
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'progress' => 0,
                'error' => 'Audio file processing failed: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Find audio files recursively in directory
     * 
     * @param string $directory
     * @param array $extensions
     * @return array
     */
    protected function findAudioFilesRecursively(string $directory, array $extensions): array
    {
        $audioFiles = [];
        
        if (!File::exists($directory)) {
            return $audioFiles;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $extension = strtolower($file->getExtension());
                if (in_array($extension, $extensions)) {
                    $audioFiles[] = $file->getPathname();
                }
            }
        }

        return $audioFiles;
    }

    /**
     * Process a single audio file
     * Reference: DevOps basetool/voice_tool/voice_tool.js file organization
     * 
     * @param string $audioFilePath
     * @return array
     */
    protected function processSingleAudioFile(string $audioFilePath): array
    {
        try {
            $filename = basename($audioFilePath);
            $filenameWithoutExt = pathinfo($filename, PATHINFO_FILENAME);
            
            // Determine if it's a word or sentence audio based on filename patterns
            $isWordAudio = $this->isWordAudio($filename);
            
            // Determine target directory
            if ($isWordAudio) {
                $targetDir = $this->storageManager->getWordSoundsPath();
            } else {
                $targetDir = $this->storageManager->getSentenceSoundsPath();
            }

            // Ensure target directory exists
            if (!File::exists($targetDir)) {
                File::makeDirectory($targetDir, 0755, true);
            }

            // Generate new filename to avoid conflicts
            $targetFilename = $this->generateUniqueFilename($targetDir, $filename);
            $targetPath = $targetDir . '/' . $targetFilename;

            // Copy file to target location
            if (File::copy($audioFilePath, $targetPath)) {
                return [
                    'success' => true,
                    'source' => $audioFilePath,
                    'target' => $targetPath,
                    'type' => $isWordAudio ? 'word' : 'sentence'
                ];
            } else {
                return ['success' => false, 'error' => "Failed to copy file: $filename"];
            }

        } catch (\Exception $e) {
            return ['success' => false, 'error' => 'File processing error: ' . $e->getMessage()];
        }
    }

    /**
     * Determine if audio file is for word pronunciation
     * Based on filename patterns from DevOps voice_tool logic
     * 
     * @param string $filename
     * @return bool
     */
    protected function isWordAudio(string $filename): bool
    {
        $filename = strtolower($filename);
        
        // Word audio indicators
        $wordIndicators = ['word_', '_word', 'pronunciation_', '_pron', 'dict_'];
        foreach ($wordIndicators as $indicator) {
            if (strpos($filename, $indicator) !== false) {
                return true;
            }
        }
        
        // Sentence audio indicators
        $sentenceIndicators = ['sentence_', '_sentence', 'example_', '_example', 'phrase_'];
        foreach ($sentenceIndicators as $indicator) {
            if (strpos($filename, $indicator) !== false) {
                return false;
            }
        }
        
        // Default to word audio if unclear
        return true;
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
     * Validate audio archive before processing
     * 
     * @param string $archivePath
     * @return array
     */
    public function validateAudioArchive(string $archivePath): array
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
}
