<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Cache;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ExternalStorageManager;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1AudioFileProcessor;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ImageFileProcessor;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;

class AppQyV1SystemInitializationController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    protected $storageManager;
    protected $audioProcessor;
    protected $imageProcessor;
    protected $markerManager;

    public function __construct()
    {
        $this->storageManager = new AppQyV1ExternalStorageManager();
        $this->audioProcessor = new AppQyV1AudioFileProcessor();
        $this->imageProcessor = new AppQyV1ImageFileProcessor();
        $this->markerManager = new AppQyV1InitializationMarkerManager();
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
            // Retired: per-language dictionary tables (tts_cache_{lang}) are
            // populated by sys:init migrations + UserSyncService, so the legacy
            // vocabulary-file import is a graceful no-op.
            return [
                'status' => 'complete',
                'progress' => 100,
                'stats' => [
                    'status' => 'skipped',
                    'note' => 'Per-language dictionary tables are populated by sys:init migrations + UserSyncService; the legacy vocabulary-file import is retired.'
                ]
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
        // Retired: the legacy single-table SQLite import is gone. Modern data
        // comes from sys:init migrations / the per-language tts_cache tables,
        // so there is nothing to import here. The caller marks the database step
        // processed when this returns complete.
        return ['status' => 'complete', 'progress' => 100];
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
            // Canonical store is the per-language tts_cache_{lang} tables. Any
            // populated language means the dictionary database exists. Each count
            // is guarded so a not-yet-migrated language (missing table) is skipped
            // rather than throwing.
            foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
                try {
                    if (AppQyV1LangDictionaryModel::forLanguage($lang)->count() > 0) {
                        return true;
                    }
                } catch (\Throwable $e) {
                    // Missing/not-yet-migrated table for this language; continue.
                    continue;
                }
            }

            return false;
    }

    /**
     * Check if vocabulary metadata has been processed
     * 
     * @return bool
     */
    protected function checkVocabularyMetadataProcessed(): bool
    {
            return $this->markerManager->isVocabularyProcessingComplete();
    }

    /**
     * Cache TTL (seconds) for the consolidated per-language dictionary stats.
     */
    private const SYSINIT_STATS_TTL = 300;

    /**
     * Cache key for the consolidated per-language dictionary aggregate.
     * Delegates to the model so reads and the write-side invalidation
     * (AppQyV1LangDictionaryModel::forgetMetricsCache) share one definition.
     */
    /**
     * Compute ALL per-language dictionary metrics in a SINGLE table scan.
     *
     * Metrics are computed by the dictionary model in one cached aggregate.
     *
     * Returns an associative array of integer counts, or all-zero when the
     * table is missing.
     */
    private function getDictStats(string $langCode): array
    {
        return AppQyV1LangDictionaryModel::cachedSystemInitStats($langCode, self::SYSINIT_STATS_TTL);
    }

    /**
     * Consolidated per-language article stats in a SINGLE scan: total rows and
     * audio rows. has_audio compared with true (cross-DB safe).
     */
    private function getArticleStats(string $langCode): array
    {
        return AppQyV1ArticleLibraryModel::aggregateStats($langCode);
    }

    /**
     * Former TTS-queue completed-audio supplement for a language.
     *
     * Queue-less: completed word/article audio is already counted on the
     * canonical tables (getDictStats / getArticleStats), so the old queue
     * supplement would double-count, and sentence audio is stateless (files
     * only, no rows). Always zero now; the shape is kept so the call sites
     * and response fields stay unchanged.
     */
    private function getTtsLangCounts(string $langCode): array
    {
        return ['sentence_audio' => 0, 'completed_audio' => 0];
    }

    /**
     * Legacy flat queue-stats shape {pending, processing, completed, failed,
     * total}, derived live from the canonical tables via the coordinator.
     */
    private function getTtsQueueStats(): array
    {
        $stats = (new AppQyV1DictionaryTTSCoordinator())->statistics();

        return [
            'pending' => $stats['by_status']['pending'],
            'processing' => $stats['by_status']['processing'],
            'completed' => $stats['by_status']['completed'],
            'failed' => $stats['by_status']['failed'],
            'total' => $stats['total'],
        ];
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
            // Unified schema: has_translation is the reviewed/usable signal.
            $reviewed = $model->where('has_translation', true)->count();
            
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
        $languageStats = $supportedLanguages->map(function ($langCode) {
            $dictStats = $this->getDictStats($langCode);

            if (!$dictStats['table_exists']) {
                return [
                    'language_code' => $langCode,
                    'words' => 0,
                    'sentences' => 0,
                    'articles' => 0,
                    'audio' => 0,
                ];
            }

            $articleStats = $this->getArticleStats($langCode);
            $ttsCounts = $this->getTtsLangCounts($langCode);

            return [
                'language_code' => $langCode,
                'words' => $dictStats['words'],
                'sentences' => $dictStats['sentences'] + $ttsCounts['sentence_audio'],
                'articles' => $articleStats['articles'],
                'audio' => $dictStats['audio'] + $articleStats['audio'] + $ttsCounts['completed_audio'],
            ];
        });
        
        // Get TTS coordination statistics (live from the canonical tables)
        $ttsQueueStats = $this->getTtsQueueStats();

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
        $lockKey = $cacheKey . '_lock';

        $cached = Cache::get($cacheKey);

        if ($cached !== null) {
            return $this->success($cached);
        }

        $lock = Cache::lock($lockKey, 60);

        if ($lock->get()) {
            $cached = Cache::get($cacheKey);

            if ($cached !== null) {
                $lock->release();
                return $this->success($cached);
            }

            $result = $this->computeSystemStatisticsSummary();

            Cache::put($cacheKey, $result, now()->addMinutes(5));

            $lock->release();

            return $this->success($result);
        }

        $maxWaitTime = 10;
        $waitStart = microtime(true);

        while (microtime(true) - $waitStart < $maxWaitTime) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                return $this->success($cached);
            }
            usleep(100000);
        }

        $result = $this->computeSystemStatisticsSummary();
        return $this->success($result);
    }

    private function computeSystemStatisticsSummary(): array
    {
        $supportedLanguages = collect(AppQyV1TableMaps::getSupportedLanguages());
        $summary = [
            'total_languages' => $supportedLanguages->count(),
            'total_words' => 0,
            'total_sentences' => 0,
            'total_articles' => 0,
            'total_audio' => 0,
        ];

        $languageDetails = [];

        $includeFileScan = request()->boolean('include_file_scan', false);

        $wordSoundsDir = \App\Providers\PathMapper::getAppQyV1AudioDir();
        $sentenceSoundsDir = \App\Providers\PathMapper::getAppQyV1SentenceSoundsDir();
        $audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];

        foreach ($supportedLanguages as $langCode) {
            $dictStats = $this->getDictStats($langCode);

            if (!$dictStats['table_exists']) {
                continue;
            }

            $langWords = $dictStats['words'];

            if ($langWords === 0) {
                continue;
            }

            $langAudioFiles = 0;
            $langAudioSize = 0;

            $langSentences = $dictStats['sentences'];
            $langAudio = $dictStats['audio'];

            $articleStats = $this->getArticleStats($langCode);
            $langArticles = $articleStats['articles'];
            $langAudio += $articleStats['audio'];

            if ($includeFileScan) {
                $langWordDir = $wordSoundsDir . '/' . $langCode;
                $langSentenceDir = $sentenceSoundsDir . '/' . $langCode;

                $langDirs = [];
                if (is_dir($langWordDir)) {
                    $langDirs[] = $langWordDir;
                }
                if (is_dir($langSentenceDir)) {
                    $langDirs[] = $langSentenceDir;
                }

                if (!empty($langDirs)) {
                    $langAudioStats = \App\Utils\FileSystemManager::scanDirectoriesForFiles($langDirs, $audioExtensions);
                    $langAudioFiles = $langAudioStats['total_files'];
                    $langAudioSize = $langAudioStats['total_size'];
                }
            }

            $summary['total_words'] += $langWords;
            $summary['total_sentences'] += $langSentences;
            $summary['total_articles'] += $langArticles;
            $summary['total_audio'] += $langAudio;

            $languageDetails[$langCode] = [
                'words' => $langWords,
                'sentences' => $langSentences,
                'articles' => $langArticles,
                'audio' => $langAudio,
                'audio_files' => $langAudioFiles,
                'audio_size_bytes' => $langAudioSize,
                'audio_size_mb' => round($langAudioSize / (1024 * 1024), 2),
                'audio_formatted_size' => $this->formatFileSize($langAudioSize),
            ];
        }

        $result = array_merge($summary, [
            'languages' => $languageDetails,
        ]);

        return $result;
    }

    /**
     * Get detailed language statistics (load on demand)
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSystemStatisticsLanguages()
    {
        $supportedLanguages = collect(AppQyV1TableMaps::getSupportedLanguages());
        $languageStats = $supportedLanguages->map(function ($langCode) {
            $dictStats = $this->getDictStats($langCode);

            if (!$dictStats['table_exists']) {
                return [
                    'language_code' => $langCode,
                    'words' => 0,
                    'sentences' => 0,
                    'articles' => 0,
                    'audio' => 0,
                ];
            }

            $articleStats = $this->getArticleStats($langCode);
            $ttsCounts = $this->getTtsLangCounts($langCode);

            $wordCount = $dictStats['words'];
            $sentenceCount = $dictStats['sentences'];
            $audioCount = $dictStats['audio'];
            $articleCount = $articleStats['articles'];
            $articleAudioCount = $articleStats['audio'];
            $sentenceAudioCount = $ttsCounts['sentence_audio'];
            $completedAudioByLang = $ttsCounts['completed_audio'];

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
        $ttsQueueStats = $this->getTtsQueueStats();
        $untranslatedStats = $this->getUntranslatedWordsStatistics();
        
        // Get force_refresh parameter from request
        $forceRefresh = request()->boolean('force_refresh', false);
        
        // Get audio file size statistics (cached for 30 minutes, or force refresh)
        $audioSizeStats = $this->getAudioFileSizeStatistics($forceRefresh);
        
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
     * Get audio file size statistics with language breakdown
     * Cached for 30 minutes, only recalculates if cache is expired or force refresh is true
     * 
     * @param bool $forceRefresh Force refresh even if cache exists
     * @return array
     */
    private function getAudioFileSizeStatistics(bool $forceRefresh = false): array
    {
        $cacheKey = 'appqyv1_audio_file_size_stats';
        
        // If not forcing refresh, check cache first
        if (!$forceRefresh) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                return $cached;
            }
        }
        
        // Get all audio directories using PathMapper (unified path management)
        $wordSoundsDir = \App\Providers\PathMapper::getAppQyV1AudioDir();
        $sentenceSoundsDir = \App\Providers\PathMapper::getAppQyV1SentenceSoundsDir();
        
        // Scan directories using FileSystemManager (handles path mapping automatically)
        $audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];
        
        // Get total statistics
        $audioDirectories = [$wordSoundsDir, $sentenceSoundsDir];
        $stats = \App\Utils\FileSystemManager::scanDirectoriesForFiles($audioDirectories, $audioExtensions);
        
        // Get language-specific statistics
        $supportedLanguages = AppQyV1TableMaps::getSupportedLanguages();
        $languageStats = [];
        $totalSizeByLang = 0;
        $totalFilesByLang = 0;
        $totalZeroByLang = 0;
        
        foreach ($supportedLanguages as $langCode) {
            $langWordDir = $wordSoundsDir . '/' . $langCode;
            $langSentenceDir = $sentenceSoundsDir . '/' . $langCode;
            
            $langDirs = [];
            if (is_dir($langWordDir)) {
                $langDirs[] = $langWordDir;
            }
            if (is_dir($langSentenceDir)) {
                $langDirs[] = $langSentenceDir;
            }
            
            if (!empty($langDirs)) {
                $langStats = \App\Utils\FileSystemManager::scanDirectoriesForFiles($langDirs, $audioExtensions);
                
                $langSize = $langStats['total_size'];
                $langFiles = $langStats['total_files'];
                $langZero = $langStats['zero_byte_files'];
                
                $totalSizeByLang += $langSize;
                $totalFilesByLang += $langFiles;
                $totalZeroByLang += $langZero;
                
                $languageStats[$langCode] = [
                    'size_bytes' => $langSize,
                    'size_mb' => round($langSize / (1024 * 1024), 2),
                    'size_gb' => round($langSize / (1024 * 1024 * 1024), 2),
                    'files' => $langFiles,
                    'zero_byte_files' => $langZero,
                    'formatted_size' => $this->formatFileSize($langSize),
                ];
            } else {
                $languageStats[$langCode] = [
                    'size_bytes' => 0,
                    'size_mb' => 0,
                    'size_gb' => 0,
                    'files' => 0,
                    'zero_byte_files' => 0,
                    'formatted_size' => '0 B',
                ];
            }
        }
        
        $result = [
            'total_size_bytes' => $stats['total_size'],
            'total_size_mb' => round($stats['total_size'] / (1024 * 1024), 2),
            'total_size_gb' => round($stats['total_size'] / (1024 * 1024 * 1024), 2),
            'total_files' => $stats['total_files'],
            'zero_byte_files' => $stats['zero_byte_files'],
            'formatted_size' => $this->formatFileSize($stats['total_size']),
            'scanned_directories' => $stats['scanned_directories'],
            'errors' => $stats['errors'],
            'by_language' => $languageStats,
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
     * Get untranslated words and sentences statistics
     * Statistics by language namespace, reusing the same logic as getSystemStatistics
     * 
     * @return array
     */
    private function getUntranslatedWordsStatistics(): array
    {
        $supportedLanguages = collect(AppQyV1TableMaps::getSupportedLanguages());
        $totalWords = 0;
        $totalSentences = 0;
        $completeWords = 0;
        $completeSentences = 0;
        $missingTranslation = 0;
        $missingPhonetic = 0;
        $missingAudio = 0;
        $missingImages = 0;
        $missingSentenceTranslation = 0;
        $missingSentenceAudio = 0;

        // Statistics by language namespace. All per-table counts come from a
        // single cached aggregate scan (getDictStats) instead of ~9 separate
        // scans of the same tts_cache_{lang} table.
        foreach ($supportedLanguages as $langCode) {
            $dictStats = $this->getDictStats($langCode);

            if (!$dictStats['table_exists']) {
                continue;
            }

            $totalWords += $dictStats['words'];
            $totalSentences += $dictStats['sentences'];
            $completeWords += $dictStats['complete_words'];
            $missingTranslation += $dictStats['missing_translation'];
            $missingPhonetic += $dictStats['missing_phonetic'];
            $missingAudio += $dictStats['missing_audio'];
            $missingImages += $dictStats['missing_images'];
            $completeSentences += $dictStats['complete_sentences'];
            $missingSentenceTranslation += $dictStats['missing_sentence_translation'];
            $missingSentenceAudio += $dictStats['missing_sentence_audio'];
        }
        
        // Queue-less: sentence audio is stateless (deterministic files, no
        // rows anywhere), so the former completed-sentence supplement from the
        // decommissioned queue is always zero now.
        $sentenceAudioCount = 0;

        // Total sentences includes both dictionary sentences and completed TTS sentence audio
        // This matches the logic in getSystemStatistics: 'sentences' => $sentenceCount + $sentenceAudioCount
        $totalSentencesWithAudio = $totalSentences + $sentenceAudioCount;

        return [
            'total_words' => $totalWords,
            'complete_words' => $completeWords,
            'completion_rate' => $totalWords > 0 ? round(($completeWords / $totalWords) * 100, 2) : 0,
            'total_sentences' => $totalSentencesWithAudio,
            'complete_sentences' => $completeSentences + $sentenceAudioCount,
            'sentence_completion_rate' => $totalSentencesWithAudio > 0 ? round((($completeSentences + $sentenceAudioCount) / $totalSentencesWithAudio) * 100, 2) : 0,
            'missing_breakdown' => [
                'translation' => $missingTranslation,
                'phonetic' => $missingPhonetic,
                'audio' => $missingAudio,
                'images' => $missingImages,
                'sentence_translation' => $missingSentenceTranslation,
                'sentence_audio' => $missingSentenceAudio,
            ],
            'missing_percentages' => [
                'translation' => $totalWords > 0 ? round(($missingTranslation / $totalWords) * 100, 2) : 0,
                'phonetic' => $totalWords > 0 ? round(($missingPhonetic / $totalWords) * 100, 2) : 0,
                'audio' => $totalWords > 0 ? round(($missingAudio / $totalWords) * 100, 2) : 0,
                'images' => $totalWords > 0 ? round(($missingImages / $totalWords) * 100, 2) : 0,
                'sentence_translation' => $totalSentences > 0 ? round(($missingSentenceTranslation / $totalSentences) * 100, 2) : 0,
                'sentence_audio' => $totalSentences > 0 ? round(($missingSentenceAudio / $totalSentences) * 100, 2) : 0,
            ],
        ];
    }
}
