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

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ExternalStorageManager;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1LegacyDatabaseProcessor;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1AudioFileProcessor;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ImageFileProcessor;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;
use App\Apps\AppQyV1\Utils\AppQyV1VocabularyProcessor\AppQyV1VocabularyProcessor;

class AppQyV1SystemInitializationController extends Controller
{
    protected $storageManager;
    protected $databaseProcessor;
    protected $audioProcessor;
    protected $imageProcessor;
    protected $markerManager;
    protected $vocabularyProcessor;

    public function __construct()
    {
        $this->storageManager = new AppQyV1ExternalStorageManager();
        $this->databaseProcessor = new AppQyV1LegacyDatabaseProcessor();
        $this->audioProcessor = new AppQyV1AudioFileProcessor();
        $this->imageProcessor = new AppQyV1ImageFileProcessor();
        $this->markerManager = new AppQyV1InitializationMarkerManager();
        $this->vocabularyProcessor = new AppQyV1VocabularyProcessor();
    }

    /**
     * Initialize the dictionary system
     * Reference: DevOps server_controller/server_init_olddb.js, server_migrate.js
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function initialize(Request $request)
    {
        try {
            // Check if initialization already completed
            if ($this->markerManager->isInitializationComplete()) {
                return response()->json([
                    'status' => 'success',
                    'message' => 'System already initialized',
                    'storage_directories' => $this->getStorageDirectoriesInfo(),
                    'current_progress' => $this->getCurrentProgress(),
                    'progress' => [
                        'vocabulary' => ['status' => 'complete', 'progress' => 100],
                        'database' => ['status' => 'complete', 'progress' => 100],
                        'audio' => ['status' => 'complete', 'progress' => 100],
                        'images' => ['status' => 'complete', 'progress' => 100]
                    ]
                ]);
            }

            // Initialize external storage directories
            $this->storageManager->ensureDirectoryStructure();

            $progress = [
                'vocabulary' => ['status' => 'pending', 'progress' => 0],
                'database' => ['status' => 'pending', 'progress' => 0],
                'audio' => ['status' => 'pending', 'progress' => 0],
                'images' => ['status' => 'pending', 'progress' => 0]
            ];

            $downloadInstructions = [];

            // Step 1: Process vocabulary files (this step precedes legacy data processing)
            $vocabularyResult = $this->processVocabularyFiles();
            if ($vocabularyResult['status'] === 'complete') {
                $progress['vocabulary'] = ['status' => 'complete', 'progress' => 100];
            } else {
                $progress['vocabulary'] = ['status' => 'processing', 'progress' => $vocabularyResult['progress'] ?? 50];
            }

            // Step 2: Process legacy database
            $databaseResult = $this->processLegacyDatabase();
            $legacyDbPath = $this->storageManager->getLegacyDatabasePath();
            $progress['database']['legacy_db_path'] = $legacyDbPath;
            if ($databaseResult['status'] === 'download_required') {
                $downloadInstructions['database'] = $databaseResult['download_url'];
                $progress['database'] = ['status' => 'pending', 'progress' => 0];
            } elseif ($databaseResult['status'] === 'complete') {
                $progress['database'] = ['status' => 'complete', 'progress' => 100];
                $this->markerManager->setDatabaseProcessed();
            } else {
                $progress['database'] = ['status' => 'processing', 'progress' => $databaseResult['progress']];
            }

            // Step 2: Process audio files
            $audioResult = $this->processAudioFiles();
            if ($audioResult['status'] === 'download_required') {
                $downloadInstructions['audio'] = $audioResult['download_url'];
                $progress['audio'] = ['status' => 'pending', 'progress' => 0];
            } elseif ($audioResult['status'] === 'complete') {
                $progress['audio'] = ['status' => 'complete', 'progress' => 100];
                $this->markerManager->setAudioProcessed();
            } else {
                $progress['audio'] = ['status' => 'processing', 'progress' => $audioResult['progress']];
            }

            // Step 4: Process image files
            $imageResult = $this->processImageFiles();
            if ($imageResult['status'] === 'download_required') {
                $downloadInstructions['images'] = $imageResult['download_url'];
                $progress['images'] = ['status' => 'pending', 'progress' => 0];
            } elseif ($imageResult['status'] === 'complete') {
                $progress['images'] = ['status' => 'complete', 'progress' => 100];
                $this->markerManager->setImagesProcessed();
            } else {
                $progress['images'] = ['status' => 'processing', 'progress' => $imageResult['progress']];
            }

            // Check if all processes completed
            $allComplete = $progress['vocabulary']['status'] === 'complete' &&
                          $progress['database']['status'] === 'complete' && 
                          $progress['audio']['status'] === 'complete' && 
                          $progress['images']['status'] === 'complete';

            if ($allComplete) {
                $this->markerManager->setInitializationComplete();
            }

            $response = [
                'status' => $allComplete ? 'success' : 'processing',
                'message' => $allComplete ? 'Initialization completed' : 'Initialization in progress',
                'storage_directories' => $this->getStorageDirectoriesInfo(),
                'current_progress' => $this->getCurrentProgress(),
                'detailed_status' => $this->getDetailedStatus(),
                'progress' => $progress
            ];

            if (!empty($downloadInstructions)) {
                $response['download_instructions'] = $downloadInstructions;
            }

            return response()->json($response);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Initialization failed: ' . $e->getMessage(),
                'progress' => [
                    'vocabulary' => ['status' => 'error', 'progress' => 0],
                    'database' => ['status' => 'error', 'progress' => 0],
                    'audio' => ['status' => 'error', 'progress' => 0],
                    'images' => ['status' => 'error', 'progress' => 0]
                ]
            ], 500);
        }
    }

    /**
     * Process vocabulary files from metadata
     * This step precedes legacy data processing to establish complete word database
     * 
     * @return array
     */
    protected function processVocabularyFiles(): array
    {
        try {
            $result = $this->vocabularyProcessor->processVocabularyFiles();
            return [
                'status' => 'complete',
                'progress' => 100,
                'stats' => $result
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'progress' => 0,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Process legacy database files
     * Reference: DevOps server_controller/server_init_olddb.js
     * 
     * @return array
     */
    protected function processLegacyDatabase(): array
    {
        if ($this->markerManager->isDatabaseProcessed()) {
            return ['status' => 'complete', 'progress' => 100];
        }

        $legacyDbPath = $this->storageManager->getLegacyDatabasePath();
        
        if (!file_exists($legacyDbPath)) {
            return [
                'status' => 'download_required',
                'download_url' => 'https://drive.google.com/file/d/legacy-database-id/view',
                'message' => 'Please download legacy database from Google Drive'
            ];
        }

        // Process legacy database conversion
        $result = $this->databaseProcessor->convertLegacyDatabase($legacyDbPath);
        
        if ($result['success']) {
            return ['status' => 'complete', 'progress' => 100];
        } else {
            return ['status' => 'processing', 'progress' => $result['progress']];
        }
    }

    /**
     * Process audio files
     * Reference: DevOps basetool/voice_tool/search_voice.js, config audio paths
     * 
     * @return array
     */
    protected function processAudioFiles(): array
    {
        if ($this->markerManager->isAudioProcessed()) {
            return ['status' => 'complete', 'progress' => 100];
        }

        $audioArchivePath = $this->storageManager->getLegacyAudioArchivePath();
        
        if (!file_exists($audioArchivePath)) {
            return [
                'status' => 'download_required',
                'download_url' => 'https://drive.google.com/file/d/audio-archive-id/view',
                'message' => 'Please download audio archive from Google Drive'
            ];
        }

        // Process audio archive extraction and merging
        $result = $this->audioProcessor->processAudioArchive($audioArchivePath);
        
        if ($result['success']) {
            return ['status' => 'complete', 'progress' => 100];
        } else {
            return ['status' => 'processing', 'progress' => $result['progress']];
        }
    }

    /**
     * Process image files
     * Reference: DevOps basetool/folder.js, config image paths
     * 
     * @return array
     */
    protected function processImageFiles(): array
    {
        if ($this->markerManager->isImagesProcessed()) {
            return ['status' => 'complete', 'progress' => 100];
        }

        $imageArchivePath = $this->storageManager->getLegacyImageArchivePath();
        
        if (!file_exists($imageArchivePath)) {
            return [
                'status' => 'download_required',
                'download_url' => 'https://drive.google.com/file/d/images-archive-id/view',
                'message' => 'Please download image archive from Google Drive'
            ];
        }

        // Process image archive extraction and merging
        $result = $this->imageProcessor->processImageArchive($imageArchivePath);
        
        if ($result['success']) {
            return ['status' => 'complete', 'progress' => 100];
        } else {
            return ['status' => 'processing', 'progress' => $result['progress']];
        }
    }

    /**
     * Get initialization status
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function status()
    {
        $progress = [
            'vocabulary' => [
                'status' => $this->markerManager->isVocabularyProcessingComplete() ? 'complete' : 'pending',
                'progress' => $this->markerManager->isVocabularyProcessingComplete() ? 100 : 0
            ],
            'database' => [
                'status' => $this->markerManager->isDatabaseProcessed() ? 'complete' : 'pending',
                'progress' => $this->markerManager->isDatabaseProcessed() ? 100 : 0
            ],
            'audio' => [
                'status' => $this->markerManager->isAudioProcessed() ? 'complete' : 'pending',
                'progress' => $this->markerManager->isAudioProcessed() ? 100 : 0
            ],
            'images' => [
                'status' => $this->markerManager->isImagesProcessed() ? 'complete' : 'pending',
                'progress' => $this->markerManager->isImagesProcessed() ? 100 : 0
            ]
        ];

        return response()->json([
            'status' => $this->markerManager->isInitializationComplete() ? 'complete' : 'pending',
            'progress' => $progress
        ]);
    }

    /**
     * Process vocabulary files only (separate endpoint)
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function processVocabularyOnly()
    {
        try {
            $result = $this->processVocabularyFiles();
            
            if ($result['status'] === 'complete') {
                return response()->json([
                    'status' => 'success',
                    'message' => 'Vocabulary processing completed successfully',
                    'data' => $result['stats']
                ]);
            } else {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Vocabulary processing failed',
                    'error' => $result['error'] ?? 'Unknown error'
                ], 500);
            }
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vocabulary processing failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get vocabulary processing status
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getVocabularyStatus()
    {
        try {
            $stats = $this->vocabularyProcessor->getProcessingStats();
            
            return response()->json([
                'status' => 'success',
                'data' => $stats,
                'processing_complete' => $this->markerManager->isVocabularyProcessingComplete()
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to get vocabulary status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get detailed information about storage directories
     * 
     * @return array
     */
    protected function getStorageDirectoriesInfo(): array
    {
        try {
            return [
                'external_data_path' => $this->storageManager->getExternalDataPath(),
                'legacy_database_path' => $this->storageManager->getLegacyDatabasePath(),
                'legacy_audio_archive_path' => $this->storageManager->getLegacyAudioArchivePath(),
                'legacy_image_archive_path' => $this->storageManager->getLegacyImageArchivePath(),
                'word_sounds_path' => $this->storageManager->getWordSoundsPath(),
                'word_images_path' => $this->storageManager->getWordImagesPath(),
                'temp_path' => $this->storageManager->getTempPath(),
                'markers_path' => $this->storageManager->getMarkersPath(),
                'storage_stats' => $this->storageManager->getStorageStats()
            ];
        } catch (\Exception $e) {
            return ['error' => 'Unable to retrieve storage directory information: ' . $e->getMessage()];
        }
    }

    /**
     * Get current overall progress
     * 
     * @return array
     */
    protected function getCurrentProgress(): array
    {
        $completedSteps = 0;
        $totalSteps = 4;
        
        if ($this->markerManager->isVocabularyProcessingComplete()) $completedSteps++;
        if ($this->markerManager->isDatabaseProcessed()) $completedSteps++;
        if ($this->markerManager->isAudioProcessed()) $completedSteps++;
        if ($this->markerManager->isImagesProcessed()) $completedSteps++;
        
        $percentage = ($completedSteps / $totalSteps) * 100;
        
        return [
            'completed_steps' => $completedSteps,
            'total_steps' => $totalSteps,
            'percentage' => round($percentage, 2),
            'is_complete' => $this->markerManager->isInitializationComplete()
        ];
    }

    /**
     * Get detailed status information for each component
     * 
     * @return array
     */
    protected function getDetailedStatus(): array
    {
        $legacyDbPath = $this->storageManager->getLegacyDatabasePath();
        $audioArchivePath = $this->storageManager->getLegacyAudioArchivePath();
        $imageArchivePath = $this->storageManager->getLegacyImageArchivePath();
        
        return [
            'old_database' => [
                'downloaded' => file_exists($legacyDbPath),
                'extracted' => $this->markerManager->isDatabaseProcessed(),
                'processed' => $this->markerManager->isDatabaseProcessed(),
                'new_database_created' => $this->checkNewDatabaseExists(),
                'path' => $legacyDbPath
            ],
            'audio_files' => [
                'downloaded' => file_exists($audioArchivePath),
                'extracted' => $this->markerManager->isAudioProcessed(),
                'processed' => $this->markerManager->isAudioProcessed(),
                'path' => $audioArchivePath
            ],
            'image_files' => [
                'downloaded' => file_exists($imageArchivePath),
                'extracted' => $this->markerManager->isImagesProcessed(),
                'processed' => $this->markerManager->isImagesProcessed(),
                'path' => $imageArchivePath
            ],
            'vocabulary_processing' => [
                'completed' => $this->markerManager->isVocabularyProcessingComplete(),
                'metadata_processed' => $this->checkVocabularyMetadataProcessed()
            ]
        ];
    }

    /**
     * Check if new database has been created
     * 
     * @return bool
     */
    protected function checkNewDatabaseExists(): bool
    {
        try {
            // Check if we have any dictionary records in the main database
            return AppQyV1DictionaryModel::count() > 0;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Check if vocabulary metadata has been processed
     * 
     * @return bool
     */
    protected function checkVocabularyMetadataProcessed(): bool
    {
        try {
            $stats = $this->vocabularyProcessor->getProcessingStats();
            return isset($stats['processed_files']) && $stats['processed_files'] > 0;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function getDictionaryStatistics()
    {
        try {
            $connection = 'appqyv1';
            
            $languages = [
                'english' => 'English',
                'lao' => 'Lao',
                'japanese' => 'Japanese',
                'vietnamese' => 'Vietnamese',
            ];
            
            $statistics = [];
            $totalWords = 0;
            $totalReviewed = 0;
            
            foreach ($languages as $langCode => $langName) {
                $tableName = "app_qy_v1_words_{$langCode}";
                
                $total = DB::connection($connection)->table($tableName)->count();
                $reviewed = DB::connection($connection)->table($tableName)->where('ai_reviewed', 1)->count();
                
                $statistics[] = [
                    'language' => $langName,
                    'language_code' => $langCode,
                    'total_words' => $total,
                    'ai_reviewed' => $reviewed,
                    'review_percentage' => $total > 0 ? round(($reviewed / $total) * 100, 2) : 0
                ];
                
                $totalWords += $total;
                $totalReviewed += $reviewed;
            }
            
            return response()->json([
                'status' => 'success',
                'data' => [
                    'languages' => $statistics,
                    'summary' => [
                        'total_words' => $totalWords,
                        'total_reviewed' => $totalReviewed,
                        'overall_review_percentage' => $totalWords > 0 ? round(($totalReviewed / $totalWords) * 100, 2) : 0
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to get dictionary statistics: ' . $e->getMessage()
            ], 500);
        }
    }
}
