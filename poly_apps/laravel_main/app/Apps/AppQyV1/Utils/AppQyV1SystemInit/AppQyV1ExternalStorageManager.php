<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Config;

/**
 * External Storage Manager for Dictionary System
 * Reference: DevOps provider/baseDir/BaseDirProvider.js, config/index.js
 */
class AppQyV1ExternalStorageManager
{
    protected $externalDataPath;
    protected $databasesPath;
    protected $audioPath;
    protected $imagesPath;
    protected $cachePath;
    protected $markersPath;

    public function __construct()
    {
        $legacyDatabasePath = null;
        $audioDirectoryPath = null;
        $imagesDirectoryPath = null;

        // External directory structure using PathMapper (unified path management)
        $this->externalDataPath = \App\Providers\PathMapper::getAppQyV1ExternalDataRoot();
        $legacyDatabasePath = Config::get('AppQyV1.paths.legacy_database');
        $this->databasesPath = $legacyDatabasePath ? dirname($legacyDatabasePath) : $this->externalDataPath . '/databases';
        $audioDirectoryPath = \App\Providers\PathMapper::getAppQyV1AudioDir();
        $this->audioPath = $audioDirectoryPath ? dirname($audioDirectoryPath) : $this->externalDataPath . '/audio';
        $imagesDirectoryPath = Config::get('AppQyV1.paths.images_directory');
        $this->imagesPath = $imagesDirectoryPath ? dirname($imagesDirectoryPath) : $this->externalDataPath . '/images';
        // Cache and markers derive from the canonical mapWebPath-backed root so
        // this pre-creation matches exactly where AppQyV1InitializationMarkerManager
        // actually writes/reads markers (no split-brain across WSL/Windows/Ubuntu).
        $this->cachePath = \App\Providers\PathMapper::getAppQyV1ExternalDataRoot('cache');
        $this->markersPath = \App\Providers\PathMapper::getAppQyV1ExternalDataRoot('markers');
    }

    /**
     * Ensure all required directories exist
     * Reference: DevOps provider/baseDir/BaseDirProvider.js ensureDirectories method
     */
    public function ensureDirectoryStructure(): bool
    {
        try {
            $directories = [
                $this->externalDataPath,
                $this->databasesPath,
                // Canonical word/sentence-TTS audio tree (unified static base):
                // static/app_qy_v1/audio + its {word,sentence} namespaces, so the
                // write-back target and the serve route share one pre-created root.
                \App\Providers\PathMapper::getAppQyV1AudioBaseDir(),
                \App\Providers\PathMapper::getAppQyV1AudioBaseDir('word'),
                \App\Providers\PathMapper::getAppQyV1AudioBaseDir('sentence'),
                $this->audioPath . '/word_sounds',
                $this->audioPath . '/word_subtitles',
                $this->audioPath . '/sentence_sounds',
                $this->audioPath . '/sentence_subtitles',
                $this->imagesPath . '/word_images',
                // Canonical word-images location is now the unified static tree
                // (laravel_db/static/app_qy_v1/word_images) so laravel_db copies
                // cleanly; pre-create it here too (legacy line kept above for any
                // host still pinned via DICT_IMAGES_PATH).
                \App\Providers\PathMapper::getAppQyV1WordImagesDir(),
                $this->cachePath . '/temp',
                $this->markersPath
            ];

            foreach ($directories as $directory) {
                if (!File::exists($directory)) {
                    File::makeDirectory($directory, 0755, true);
                }
            }

            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get main database path
     * Reference: DevOps config/index.js database configuration
     */
    public function getMainDatabasePath(): string
    {
        return $this->databasesPath . '/word_main.db';
    }

    /**
     * Get cache database path
     */
    public function getCacheDatabasePath(): string
    {
        return $this->databasesPath . '/cache_translate.db';
    }

    /**
     * Get legacy database path
     */
    public function getLegacyDatabasePath(): string
    {
        return Config::get('AppQyV1.paths.legacy_database');
    }

    /**
     * Get legacy audio archive path
     */
    public function getLegacyAudioArchivePath(): string
    {
        return Config::get('AppQyV1.paths.audio_archive');
    }

    /**
     * Get legacy image archive path
     */
    public function getLegacyImageArchivePath(): string
    {
        return Config::get('AppQyV1.paths.images_archive');
    }

    /**
     * Get word sounds directory
     * Reference: DevOps config/index.js DICT_SOUND_DIR
     * Uses PathMapper for unified path management
     */
    public function getWordSoundsPath(): string
    {
        return \App\Providers\PathMapper::getAppQyV1AudioDir();
    }

    /**
     * Get word subtitles directory
     * Uses PathMapper for unified path management
     */
    public function getWordSubtitlesPath(): string
    {
        return \App\Providers\PathMapper::getAppQyV1ExternalDataRoot('audio/word_subtitles');
    }

    /**
     * Get sentence sounds directory
     * Reference: DevOps config/index.js SENTENCES_SOUND_DIR
     * Uses PathMapper for unified path management
     */
    public function getSentenceSoundsPath(): string
    {
        return \App\Providers\PathMapper::getAppQyV1SentenceSoundsDir();
    }

    /**
     * Get sentence subtitles directory
     * Uses PathMapper for unified path management
     */
    public function getSentenceSubtitlesPath(): string
    {
        return \App\Providers\PathMapper::getAppQyV1ExternalDataRoot('audio/sentence_subtitles');
    }

    /**
     * Get word images directory
     */
    public function getWordImagesPath(): string
    {
        return Config::get('AppQyV1.paths.images_directory');
    }

    /**
     * Get temporary files directory
     */
    public function getTempPath(): string
    {
        return Config::get('AppQyV1.paths.temp_directory');
    }

    /**
     * Get markers directory
     */
    public function getMarkersPath(): string
    {
        return $this->markersPath;
    }

    /**
     * Get external data root path
     */
    public function getExternalDataPath(): string
    {
        return $this->externalDataPath;
    }

    /**
     * Check if external storage is accessible
     */
    public function isExternalStorageAccessible(): bool
    {
        return File::exists($this->externalDataPath) && is_writable($this->externalDataPath);
    }

    /**
     * Get storage statistics
     */
    public function getStorageStats(): array
    {
        return [
            'external_path' => $this->externalDataPath,
            'accessible' => $this->isExternalStorageAccessible(),
            'databases_exist' => File::exists($this->databasesPath),
            'audio_exist' => File::exists($this->audioPath),
            'images_exist' => File::exists($this->imagesPath),
            'markers_exist' => File::exists($this->markersPath)
        ];
    }

    /**
     * Get file URL for serving static files
     * Reference: DevOps config/index.js STATIC_PATHS configuration
     */
    public function getFileUrl(string $filePath): string
    {
        // Convert absolute path to relative URL
        $relativePath = str_replace($this->externalDataPath, '', $filePath);
        return url('/storage/external' . $relativePath);
    }

    /**
     * Find audio file for word
     * Reference: DevOps basetool/voice_tool/search_voice.js
     */
    public function findAudioFile(string $word): ?string
    {
        $wordSoundsPath = $this->getWordSoundsPath();
        $extensions = ['mp3', 'wav', 'ogg'];
        
        foreach ($extensions as $ext) {
            $filePath = $wordSoundsPath . '/' . $word . '.' . $ext;
            if (File::exists($filePath)) {
                return $filePath;
            }
        }
        
        return null;
    }

    /**
     * Find image files for word
     */
    public function findImageFiles(string $word): array
    {
        $wordImagesPath = $this->getWordImagesPath();
        $extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        $imageFiles = [];
        
        foreach ($extensions as $ext) {
            $pattern = $wordImagesPath . '/' . $word . '*.' . $ext;
            $files = glob($pattern);
            $imageFiles = array_merge($imageFiles, $files);
        }
        
        return $imageFiles;
    }

    /**
     * Clean temporary files
     */
    public function cleanTempFiles(): bool
    {
        try {
            $tempPath = $this->getTempPath();
            if (File::exists($tempPath)) {
                File::cleanDirectory($tempPath);
            }
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }
}
