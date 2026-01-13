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
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Cache;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ExternalStorageManager;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1LegacyDatabaseProcessor;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1AudioFileProcessor;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ImageFileProcessor;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;
use App\Apps\AppQyV1\Utils\AppQyV1VocabularyProcessor\AppQyV1VocabularyProcessor;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TTSQueueModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;

class AppQyV1SystemInitializationController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

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

    }

    /**
     * Process vocabulary files from metadata
     * This step precedes legacy data processing to establish complete word database
     * 
     * @return array
     */
    protected function processVocabularyFiles(): array
    {
            $result = $this->vocabularyProcessor->processVocabularyFiles();
            return [
                'status' => 'complete',
                'progress' => 100,
                'stats' => $result
            ];
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
    }

    /**
     * Get vocabulary processing status
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getVocabularyStatus()
    {
            $stats = $this->vocabularyProcessor->getProcessingStats();
            
            return response()->json([
                'status' => 'success',
                'data' => $stats,
                'processing_complete' => $this->markerManager->isVocabularyProcessingComplete()
            ]);
    }

    /**
     * Get detailed information about storage directories
     * 
     * @return array
     */
    protected function getStorageDirectoriesInfo(): array
    {
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
            // Check if we have any dictionary records in the main database
            return AppQyV1DictionaryModel::count() > 0;
    }

    /**
     * Check if vocabulary metadata has been processed
     * 
     * @return bool
     */
    protected function checkVocabularyMetadataProcessed(): bool
    {
            $stats = $this->vocabularyProcessor->getProcessingStats();
            return isset($stats['processed_files']) && $stats['processed_files'] > 0;
    }

    public function getDictionaryStatistics()
    {
        $languages = [
            'english' => 'English',
            'lao' => 'Lao',
            'japanese' => 'Japanese',
            'vietnamese' => 'Vietnamese',
        ];
        
        $statistics = collect($languages)->map(function ($langName, $langCode) {
            $model = AppQyV1MultiLangDictionaryModel::forLanguage($langCode);
            
            $total = $model->count();
            $reviewed = $model->where('ai_reviewed', true)->count();
            
            return [
                'language' => $langName,
                'language_code' => $langCode,
                'total_words' => $total,
                'ai_reviewed' => $reviewed,
                'review_percentage' => $total > 0 ? round(($reviewed / $total) * 100, 2) : 0
            ];
        });
        
        $totalWords = $statistics->sum('total_words');
        $totalReviewed = $statistics->sum('ai_reviewed');
        
        return $this->success([
            'languages' => $statistics->values(),
            'summary' => [
                'total_words' => $totalWords,
                'total_reviewed' => $totalReviewed,
                'overall_review_percentage' => $totalWords > 0 ? round(($totalReviewed / $totalWords) * 100, 2) : 0
            ]
        ]);
    }

    public function getSystemStatistics()
    {
        $supportedLanguages = collect(AppQyV1TableMaps::getSupportedLanguages());
        $connectionName = (new AppQyV1LangDictionaryModel)->getConnectionName();
        
        $languageStats = $supportedLanguages->map(function ($langCode) use ($connectionName) {
            $dictModel = AppQyV1LangDictionaryModel::forLanguage($langCode);
            $tableExists = Schema::connection($connectionName)->hasTable($dictModel->getTable());
            
            if (!$tableExists) {
                return [
                    'language_code' => $langCode,
                    'words' => 0,
                    'sentences' => 0,
                    'articles' => 0,
                    'audio' => 0,
                ];
            }
            
            $wordCount = $dictModel->count();
            $sentenceCount = $dictModel->whereRaw('LENGTH(content) > 50')
                ->whereRaw('LENGTH(content) < 500')
                ->count();
            $audioCount = $dictModel->where('has_audio', true)->count();
            
            $articleModel = AppQyV1ArticleLibraryModel::forLanguage($langCode);
            $articleCount = 0;
            $articleAudioCount = 0;
            if (Schema::connection($connectionName)->hasTable($articleModel->getTable())) {
                $articleCount = $articleModel->count();
                $articleAudioCount = $articleModel->where('has_audio', true)->count();
            }
            
            $sentenceAudioCount = AppQyV1TTSQueueModel::where('language', $langCode)
                ->where('task_type', 'sentence')
                ->where('status', 'completed')
                ->count();
            
            $completedAudioByLang = AppQyV1TTSQueueModel::where('language', $langCode)
                ->where('status', 'completed')
                ->count();
            
            return [
                'language_code' => $langCode,
                'words' => $wordCount,
                'sentences' => $sentenceCount + $sentenceAudioCount,
                'articles' => $articleCount,
                'audio' => $audioCount + $articleAudioCount + $completedAudioByLang,
            ];
        });
        
        // Get TTS Queue Statistics
        $ttsQueueStats = AppQyV1TTSQueueModel::getStats();
        
        // Get Untranslated Words Statistics (for English dictionary as reference)
        $untranslatedStats = $this->getUntranslatedWordsStatistics();
        
        $summary = [
            'total_languages' => $supportedLanguages->count(),
            'total_words' => $languageStats->sum('words'),
            'total_sentences' => $languageStats->sum('sentences'),
            'total_articles' => $languageStats->sum('articles'),
            'total_audio' => $languageStats->sum('audio'),
        ];
        
        return $this->success([
            'languages' => $languageStats->values(),
            'summary' => $summary,
            'queues' => [
                'tts' => [
                    'pending' => $ttsQueueStats['pending'],
                    'processing' => $ttsQueueStats['processing'],
                    'completed' => $ttsQueueStats['completed'],
                    'failed' => $ttsQueueStats['failed'],
                    'total' => $ttsQueueStats['total'],
                ],
                'translation' => $untranslatedStats,
            ],
        ]);
    }

    /**
     * Get system statistics summary (fast, cached)
     * Returns only summary data without detailed language breakdown
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSystemStatisticsSummary()
    {
        $cacheKey = 'appqyv1_system_statistics_summary';
        $cached = Cache::get($cacheKey);
        
        if ($cached !== null) {
            return $this->success($cached);
        }
        
        $supportedLanguages = collect(AppQyV1TableMaps::getSupportedLanguages());
        $connectionName = (new AppQyV1LangDictionaryModel)->getConnectionName();
        
        $summary = [
            'total_languages' => $supportedLanguages->count(),
            'total_words' => 0,
            'total_sentences' => 0,
            'total_articles' => 0,
            'total_audio' => 0,
        ];
        
        foreach ($supportedLanguages as $langCode) {
            $dictModel = AppQyV1LangDictionaryModel::forLanguage($langCode);
            $tableExists = Schema::connection($connectionName)->hasTable($dictModel->getTable());
            
            if ($tableExists) {
                $summary['total_words'] += $dictModel->count();
                $summary['total_sentences'] += $dictModel->whereRaw('LENGTH(content) > 50')
                    ->whereRaw('LENGTH(content) < 500')
                    ->count();
                $summary['total_audio'] += $dictModel->where('has_audio', true)->count();
                
                $articleModel = AppQyV1ArticleLibraryModel::forLanguage($langCode);
                if (Schema::connection($connectionName)->hasTable($articleModel->getTable())) {
                    $summary['total_articles'] += $articleModel->count();
                    $summary['total_audio'] += $articleModel->where('has_audio', true)->count();
                }
            }
        }
        
        Cache::put($cacheKey, $summary, now()->addMinutes(5));
        
        return $this->success($summary);
    }

    /**
     * Get detailed language statistics (load on demand)
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSystemStatisticsLanguages()
    {
        $supportedLanguages = collect(AppQyV1TableMaps::getSupportedLanguages());
        $connectionName = (new AppQyV1LangDictionaryModel)->getConnectionName();
        
        $languageStats = $supportedLanguages->map(function ($langCode) use ($connectionName) {
            $dictModel = AppQyV1LangDictionaryModel::forLanguage($langCode);
            $tableExists = Schema::connection($connectionName)->hasTable($dictModel->getTable());
            
            if (!$tableExists) {
                return [
                    'language_code' => $langCode,
                    'words' => 0,
                    'sentences' => 0,
                    'articles' => 0,
                    'audio' => 0,
                ];
            }
            
            $wordCount = $dictModel->count();
            $sentenceCount = $dictModel->whereRaw('LENGTH(content) > 50')
                ->whereRaw('LENGTH(content) < 500')
                ->count();
            $audioCount = $dictModel->where('has_audio', true)->count();
            
            $articleModel = AppQyV1ArticleLibraryModel::forLanguage($langCode);
            $articleCount = 0;
            $articleAudioCount = 0;
            if (Schema::connection($connectionName)->hasTable($articleModel->getTable())) {
                $articleCount = $articleModel->count();
                $articleAudioCount = $articleModel->where('has_audio', true)->count();
            }
            
            $sentenceAudioCount = AppQyV1TTSQueueModel::where('language', $langCode)
                ->where('task_type', 'sentence')
                ->where('status', 'completed')
                ->count();
            
            $completedAudioByLang = AppQyV1TTSQueueModel::where('language', $langCode)
                ->where('status', 'completed')
                ->count();
            
            $totalData = $wordCount + $sentenceCount + $sentenceAudioCount + $articleCount + $audioCount + $articleAudioCount + $completedAudioByLang;
            
            return [
                'language_code' => $langCode,
                'words' => $wordCount,
                'sentences' => $sentenceCount + $sentenceAudioCount,
                'articles' => $articleCount,
                'audio' => $audioCount + $articleAudioCount + $completedAudioByLang,
                '_total_data' => $totalData, // Internal field for sorting
            ];
        });
        
        // Sort by total data (descending), languages with data first
        $sortedStats = $languageStats->sortByDesc('_total_data')->map(function ($item) {
            unset($item['_total_data']); // Remove internal sorting field
            return $item;
        })->values();
        
        return $this->success($sortedStats);
    }

    /**
     * Get queue statistics (load on demand)
     * Includes audio file size statistics with 30-minute cache
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSystemStatisticsQueues()
    {
        $ttsQueueStats = AppQyV1TTSQueueModel::getStats();
        $untranslatedStats = $this->getUntranslatedWordsStatistics();
        
        // Get audio file size statistics (cached for 30 minutes)
        $audioSizeStats = $this->getAudioFileSizeStatistics();
        
        return $this->success([
            'tts' => [
                'pending' => $ttsQueueStats['pending'],
                'processing' => $ttsQueueStats['processing'],
                'completed' => $ttsQueueStats['completed'],
                'failed' => $ttsQueueStats['failed'],
                'total' => $ttsQueueStats['total'],
            ],
            'translation' => $untranslatedStats,
            'audio_storage' => $audioSizeStats,
        ]);
    }

    /**
     * Get audio file size statistics
     * Cached for 30 minutes, only recalculates if cache is expired
     * 
     * @return array
     */
    private function getAudioFileSizeStatistics(): array
    {
        $cacheKey = 'appqyv1_audio_file_size_stats';
        $cached = Cache::get($cacheKey);
        
        if ($cached !== null) {
            return $cached;
        }
        
        // Get all audio directories using PathMapper (no hardcoded paths)
        $audioDirectories = \App\Providers\PathMapper::getAppQyV1AllAudioDirs();
        
        // Scan directories using FileSystemManager (handles path mapping automatically)
        $audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];
        $stats = \App\Utils\FileSystemManager::scanDirectoriesForFiles($audioDirectories, $audioExtensions);
        
        $result = [
            'total_size_bytes' => $stats['total_size'],
            'total_size_mb' => round($stats['total_size'] / (1024 * 1024), 2),
            'total_size_gb' => round($stats['total_size'] / (1024 * 1024 * 1024), 2),
            'total_files' => $stats['total_files'],
            'zero_byte_files' => $stats['zero_byte_files'],
            'formatted_size' => $this->formatFileSize($stats['total_size']),
            'scanned_directories' => $stats['scanned_directories'],
            'errors' => $stats['errors'],
        ];
        
        if ($stats['zero_byte_files'] > 0) {
            $result['warning'] = "Found {$stats['zero_byte_files']} zero-byte audio files. These may be incomplete or failed TTS generations.";
        }
        
        // Cache for 30 minutes
        Cache::put($cacheKey, $result, now()->addMinutes(30));
        
        return $result;
    }

    /**
     * Format file size in human-readable format (MB/GB)
     * 
     * @param int $bytes
     * @return string
     */
    private function formatFileSize(int $bytes): string
    {
        if ($bytes >= 1024 * 1024 * 1024) {
            return round($bytes / (1024 * 1024 * 1024), 2) . ' GB';
        } elseif ($bytes >= 1024 * 1024) {
            return round($bytes / (1024 * 1024), 2) . ' MB';
        } elseif ($bytes >= 1024) {
            return round($bytes / 1024, 2) . ' KB';
        }
        return $bytes . ' B';
    }

    /**
     * Get untranslated words statistics
     * 
     * @return array
     */
    private function getUntranslatedWordsStatistics(): array
    {
        $totalWords = AppQyV1DictionaryModel::count();
        
        $missingTranslation = AppQyV1DictionaryModel::where(function ($q) {
            $q->whereNull('translation')
              ->orWhere('translation', '')
              ->orWhere('translation', '{}')
              ->orWhere('translation', '[]')
              ->orWhere('isTranslation', false);
        })->count();

        $missingPhonetic = AppQyV1DictionaryModel::where(function ($q) {
            $q->where(function ($subQuery) {
                $subQuery->whereNull('usPhonetic')
                         ->orWhere('usPhonetic', '');
            })->where(function ($subQuery) {
                $subQuery->whereNull('ukPhonetic')
                         ->orWhere('ukPhonetic', '');
            });
        })->count();

        $missingAudio = AppQyV1DictionaryModel::where(function ($q) {
            $q->whereNull('voice_files')
              ->orWhere('voice_files', '')
              ->orWhere('voice_files', '{}')
              ->orWhere('voice_files', '[]');
        })->count();

        $missingImages = AppQyV1DictionaryModel::where(function ($q) {
            $q->whereNull('image_files')
              ->orWhere('image_files', '')
              ->orWhere('image_files', '{}')
              ->orWhere('image_files', '[]');
        })->count();

        $completeWords = AppQyV1DictionaryModel::where('isTranslation', true)
            ->whereNotNull('translation')
            ->where('translation', '!=', '')
            ->where('translation', '!=', '{}')
            ->whereNotNull('usPhonetic')
            ->where('usPhonetic', '!=', '')
            ->count();

        return [
            'total_words' => $totalWords,
            'complete_words' => $completeWords,
            'completion_rate' => $totalWords > 0 ? round(($completeWords / $totalWords) * 100, 2) : 0,
            'missing_breakdown' => [
                'translation' => $missingTranslation,
                'phonetic' => $missingPhonetic,
                'audio' => $missingAudio,
                'images' => $missingImages,
            ],
            'missing_percentages' => [
                'translation' => $totalWords > 0 ? round(($missingTranslation / $totalWords) * 100, 2) : 0,
                'phonetic' => $totalWords > 0 ? round(($missingPhonetic / $totalWords) * 100, 2) : 0,
                'audio' => $totalWords > 0 ? round(($missingAudio / $totalWords) * 100, 2) : 0,
                'images' => $totalWords > 0 ? round(($missingImages / $totalWords) * 100, 2) : 0,
            ],
        ];
    }
}
