<?php

namespace App\Services\EdgeTTS;

use App\Providers\PathMapper;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageConfigService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Cache;

/**
 * EdgeTTS Service - Common TTS service using TTSCacheManager
 *
 * @deprecated This service is deprecated and maintained only for backward compatibility.
 * Use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TTSService for new implementations.
 *
 * Migration Path:
 * - Old: App\Services\EdgeTTS\EdgeTTSService
 * - New: App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TTSService
 *
 * IMPORTANT: This service should ONLY be called by AppQyV1UnifiedTTSQueueService.
 * All external requests should go through the TTS queue system to ensure:
 * - Sequential processing (edge-tts cannot handle concurrent requests)
 * - Proper error handling and retry logic
 * - Dynamic interval adjustment
 * - Task deduplication
 *
 * DO NOT call this service directly from controllers or other services.
 * Use the queue API endpoints instead: POST /api/app_qy_v1/ai_tools/tts/queue/batch/query
 *
 * Features:
 * - 82 languages support with neural network voices
 * - File-based caching with TTSCacheManager
 * - Automatic availability checking with EdgeTTSChecker
 * - Sequential execution only (no concurrent support)
 */
class EdgeTTSService
{
    private $dataDir;
    private $audioDir;
    private $cacheManager;

    // Concurrent request counter
    private const CONCURRENT_COUNTER_KEY = 'edge_tts_concurrent_count';

    // Cached voices and text types (loaded from AppQyV1LanguageConfigService)
    private static $cachedVoices = null;
    private static $cachedTextTypes = null;

    /**
     * Get Edge-TTS voice mappings
     * Single source of truth: AppQyV1LanguageConfigService::getTTSVoices()
     * 
     * @return array Language code => voice_id mapping
     */
    public static function getVoices(): array
    {
        if (self::$cachedVoices === null) {
            self::$cachedVoices = AppQyV1LanguageConfigService::getTTSVoices();
        }
        return self::$cachedVoices;
    }

    /**
     * Get Edge-TTS text types
     * Single source of truth: AppQyV1LanguageConfigService::getTTSTextTypes()
     * 
     * @return array Text types array
     */
    public static function getTextTypes(): array
    {
        if (self::$cachedTextTypes === null) {
            self::$cachedTextTypes = AppQyV1LanguageConfigService::getTTSTextTypes();
        }
        return self::$cachedTextTypes;
    }

    /**
     * @deprecated Use getTextTypes() instead. Kept for backward compatibility.
     * Returns cached text types from AppQyV1LanguageConfigService
     */
    public static function getTEXT_TYPES(): array
    {
        return self::getTextTypes();
    }

    public function __construct()
    {
        $laravelDataDir = PathMapper::getLaravelDataDir();
        if (!$laravelDataDir) {
            throw new \Exception('Laravel data directory not found');
        }

        // json_db sidecar stays under the legacy tts_data root (it is a small
        // cache index, not served), but the AUDIO base moves to the unified
        // static tree so the write target equals the serve base
        // (/api/app_qy_v1/ai_tools/tts/audio/{...}) and laravel_db copies
        // cleanly. Stored tts_files relative paths ({lang}/{type}/{file}) are
        // unchanged — only the physical base differs.
        $this->dataDir = $laravelDataDir . '/tts_data';
        $this->audioDir = PathMapper::getAppQyV1AudioBaseDir();
        $jsonDbDir = $this->dataDir . '/json_db';

        $this->initializeDirectories();
        $this->cacheManager = new TTSCacheManager($jsonDbDir);

        // Automatic cleanup: 5% chance to clean zero-byte files on initialization
        if (rand(1, 100) <= 5) {
            $this->cleanZeroByteFilesBackground();
        }
    }

    private function initializeDirectories(): void
    {
        $jsonDbDir = $this->dataDir . '/json_db';
        $dirs = [$this->dataDir, $this->audioDir, $jsonDbDir];

        foreach ($dirs as $dir) {
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
        }
    }

    private function ensureDirectoryExists(string $path): void
    {
        // IDEMPOTENCY: Use FileSystemManager for dynamic user ownership
        if (!\App\Utils\FileSystemManager::ensureDirectoryExists($path, 0775)) {
            throw new \Exception('Failed to create directory: ' . $path);
        }

        if (!is_writable($path)) {
            throw new \Exception('Directory is not writable: ' . $path);
        }
    }

    /**
     * Check if edge-tts is available on the system
     */
    public function isAvailable(): bool
    {
        return EdgeTTSChecker::isAvailable();
    }

    /**
     * Get detailed status information
     */
    public function getStatus(): array
    {
        return EdgeTTSChecker::getStatus();
    }

    /**
     * Generate audio for given text
     */
    public function generateAudio(
        string $text,
        string $langCode,
        string $textType = 'sentence',
        array $options = []
    ): array {
        // Check if edge-tts is available
        if (!$this->isAvailable()) {
            return [
                'success' => false,
                'error' => 'edge-tts is not available. ' . EdgeTTSChecker::getInstallInstructions(),
            ];
        }

        $voices = self::getVoices();
        if (!isset($voices[$langCode])) {
            return [
                'success' => false,
                'error' => 'Unsupported language: ' . $langCode,
            ];
        }

        $textTypes = self::getTextTypes();
        if (!in_array($textType, $textTypes)) {
            $textType = 'sentence';
        }

        $text = trim($text);
        if (empty($text)) {
            return [
                'success' => false,
                'error' => 'Empty text',
            ];
        }

        $rate = $options['rate'] ?? '+0%';
        $speedKey = str_replace(['+', '%', '-'], ['p', 'pct', 'm'], $rate);

        // Check cache using TTSCacheManager
        $cacheKey = $text . '|speed:' . $rate;
        $cached = $this->cacheManager->get($langCode, $textType, $cacheKey);
        if ($cached && isset($cached['audio_path'])) {
            $fullPath = $this->audioDir . '/' . $cached['audio_path'];
            if (file_exists($fullPath)) {
                // Verify cached file is not zero-byte
                $fileSize = filesize($fullPath);
                if ($fileSize === 0) {
                    // Remove zero-byte file from cache and filesystem
                    @unlink($fullPath);
                    Log::warning('[EdgeTTS] Removed zero-byte cached file', [
                        'path' => $cached['audio_path'],
                    ]);
                    // Continue to generate new file
                } else {
                    return [
                        'success' => true,
                        'cached' => true,
                        'audio_path' => $cached['audio_path'],
                        'audio_url' => '/tts/audio/' . $cached['audio_path'],
                        'text' => $text,
                        'language' => $langCode,
                        'type' => $textType,
                        'speed' => $rate,
                    ];
                }
            }
        }

        // Generate file path
        $hash = md5($langCode . ':' . $textType . ':' . $rate . ':' . $text);
        $relativePath = $langCode . '/' . $textType . '/' . $speedKey . '/' . $hash . '.mp3';
        $fullPath = $this->audioDir . '/' . $relativePath;

        if (file_exists($fullPath)) {
            // Verify existing file is not zero-byte
            $fileSize = filesize($fullPath);
            if ($fileSize === 0) {
                // Remove zero-byte file
                @unlink($fullPath);
                Log::warning('[EdgeTTS] Removed zero-byte existing file', [
                    'path' => $relativePath,
                ]);
                // Continue to generate new file
            } else {
                $this->cacheManager->set($langCode, $textType, $cacheKey, $relativePath);
                return [
                    'success' => true,
                    'cached' => true,
                    'audio_path' => $relativePath,
                    'audio_url' => '/tts/audio/' . $relativePath,
                    'text' => $text,
                    'language' => $langCode,
                    'type' => $textType,
                    'speed' => $rate,
                ];
            }
        }

        $voices = self::getVoices();
        $voice = $voices[$langCode];
        $volume = $options['volume'] ?? '+0%';
        $pitch = $options['pitch'] ?? '+0Hz';

        try {
            $speedDir = dirname($fullPath);
            $this->ensureDirectoryExists($speedDir);

            $result = $this->executeEdgeTTS($text, $voice, $fullPath, $rate, $volume, $pitch);

            if ($result['success']) {
                $this->cacheManager->set($langCode, $textType, $cacheKey, $relativePath);

                return [
                    'success' => true,
                    'cached' => false,
                    'audio_path' => $relativePath,
                    'audio_url' => '/tts/audio/' . $relativePath,
                    'text' => $text,
                    'language' => $langCode,
                    'type' => $textType,
                    'speed' => $rate,
                ];
            } else {
                return [
                    'success' => false,
                    'error' => $result['error'],
                ];
            }
        } catch (\Exception $e) {
            Log::error('[EdgeTTS] Generation failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Execute edge-tts command
     *
     * IMPORTANT: This method should ONLY be called by AppQyV1UnifiedTTSQueueService
     * in a sequential manner (one task at a time). Edge-TTS cannot handle concurrent
     * requests and will fail with NoAudioReceived errors.
     *
     * No mutex lock is needed here because the queue ensures sequential execution.
     */
    private function executeEdgeTTS(
        string $text,
        string $voice,
        string $outputPath,
        string $rate = '+0%',
        string $volume = '+0%',
        string $pitch = '+0Hz'
    ): array {
        // Increment concurrent counter
        $this->incrementConcurrentCounter();

        try {
            $pythonPath = $this->findPythonPath();
            if (!$pythonPath) {
                return [
                    'success' => false,
                    'error' => 'Python not found',
                ];
            }

            $edgeTtsPath = $this->findEdgeTTSPath($pythonPath);
            if (!$edgeTtsPath) {
                return [
                    'success' => false,
                    'error' => 'edge-tts not installed. Run: pip install edge-tts',
                ];
            }

            $escapedText = escapeshellarg($text);
            $escapedOutput = escapeshellarg($outputPath);
            $escapedVoice = escapeshellarg($voice);

            $command = sprintf(
                '%s -m edge_tts --text %s --voice %s --rate=%s --volume=%s --pitch=%s --write-media %s 2>&1',
                $pythonPath,
                $escapedText,
                $escapedVoice,
                escapeshellarg($rate),
                escapeshellarg($volume),
                escapeshellarg($pitch),
                $escapedOutput
            );

            $output = [];
            $returnCode = 0;
            exec($command, $output, $returnCode);

            if ($returnCode === 0 && file_exists($outputPath)) {
                // Verify file size - MP3 files should be at least 100 bytes
                // A valid MP3 file header alone is typically 10-32 bytes, but we use 100 bytes as minimum
                $fileSize = filesize($outputPath);
                $minFileSize = 100; // Minimum valid MP3 file size in bytes
                
                if ($fileSize === 0) {
                    // Delete zero-byte file
                    @unlink($outputPath);
                    $error = 'Generated audio file is 0 bytes (empty file). This may indicate a network issue, timeout, or edge-tts service problem.';
                    Log::error('[EdgeTTS] Zero-byte file detected and deleted', [
                        'output_path' => $outputPath,
                        'text_length' => strlen($text),
                        'voice' => $voice,
                    ]);
                    return [
                        'success' => false,
                        'error' => $error,
                    ];
                }
                
                if ($fileSize < $minFileSize) {
                    // File is suspiciously small, but not zero - log warning but keep file
                    // Some very short audio clips might be valid but small
                    Log::warning('[EdgeTTS] Generated audio file is very small', [
                        'output_path' => $outputPath,
                        'file_size' => $fileSize,
                        'min_expected' => $minFileSize,
                        'text_length' => strlen($text),
                    ]);
                }
                
                return ['success' => true];
            } else {
                $error = implode("\n", $output);
                Log::error('[EdgeTTS] Command failed: ' . $command);
                Log::error('[EdgeTTS] Output: ' . $error);
                
                // Clean up: if file was created but command failed, delete it
                if (file_exists($outputPath)) {
                    $fileSize = filesize($outputPath);
                    if ($fileSize === 0) {
                        @unlink($outputPath);
                        Log::info('[EdgeTTS] Deleted zero-byte file after command failure', [
                            'output_path' => $outputPath,
                        ]);
                    }
                }
                
                return [
                    'success' => false,
                    'error' => 'edge-tts execution failed: ' . $error,
                ];
            }
        } finally {
            // Decrement concurrent counter
            $this->decrementConcurrentCounter();
        }
    }

    /**
     * Increment concurrent request counter
     * Uses Octane cache (memory) for real-time concurrent counting
     */
    private function incrementConcurrentCounter(): void
    {
        Cache::store('octane')->increment(self::CONCURRENT_COUNTER_KEY, 1);
    }

    /**
     * Decrement concurrent request counter
     * Uses Octane cache (memory) for real-time concurrent counting
     */
    private function decrementConcurrentCounter(): void
    {
        $current = Cache::store('octane')->get(self::CONCURRENT_COUNTER_KEY, 0);
        if ($current > 0) {
            Cache::store('octane')->decrement(self::CONCURRENT_COUNTER_KEY, 1);
        }
    }

    /**
     * Get current concurrent request count
     * Uses Octane cache (memory) for real-time concurrent counting
     */
    public static function getConcurrentCount(): int
    {
        return Cache::store('octane')->get(self::CONCURRENT_COUNTER_KEY, 0);
    }

    private function findPythonPath(): ?string
    {
        $pythonCommands = ['python3', 'python'];

        foreach ($pythonCommands as $cmd) {
            $result = Process::run("which {$cmd} 2>/dev/null");
            if ($result->successful()) {
                return trim($result->output());
            }
        }

        return null;
    }

    private function findEdgeTTSPath(string $pythonPath): ?string
    {
        $result = Process::run("{$pythonPath} -m edge_tts --help 2>/dev/null");
        return $result->successful() ? 'edge_tts' : null;
    }

    /**
     * Get cache statistics using TTSCacheManager
     */
    public function getCacheStats(): array
    {
        return $this->cacheManager->getAllStats();
    }

    /**
     * Clear cache using TTSCacheManager
     */
    public function clearCache(?string $langCode = null, ?string $textType = null): int
    {
        return $this->cacheManager->clearCache($langCode, $textType);
    }

    /**
     * Batch generate audio for multiple texts
     */
    public function batchGenerate(array $items): array
    {
        $results = [];

        foreach ($items as $item) {
            $text = $item['text'] ?? '';
            $langCode = $item['language'] ?? 'en';
            $textType = $item['type'] ?? 'sentence';
            $options = $item['options'] ?? [];

            $results[] = $this->generateAudio($text, $langCode, $textType, $options);
        }

        return $results;
    }

    /**
     * Check if audio generation is complete
     */
    public function checkGeneration(string $audioPath): array
    {
        $fullPath = $this->audioDir . '/' . $audioPath;

        if (file_exists($fullPath)) {
            return [
                'success' => true,
                'ready' => true,
                'audio_url' => '/tts/audio/' . $audioPath,
            ];
        } else {
            return [
                'success' => true,
                'ready' => false,
            ];
        }
    }

    /**
     * Get all available voices
     */
    public function getAvailableVoices(): array
    {
        return self::getVoices();
    }

    /**
     * Get list of supported language codes
     */
    public function getSupportedLanguages(): array
    {
        return array_keys(self::getVoices());
    }

    /**
     * Get audio file path
     */
    public function getAudioPath(string $relativePath): ?string
    {
        $fullPath = $this->audioDir . '/' . $relativePath;
        return file_exists($fullPath) ? $fullPath : null;
    }

    /**
     * Absolute audio storage root (PathMapper::getAppQyV1AudioBaseDir() =
     * <laravel_db>/static/app_qy_v1/audio). External result ingestion (the
     * worker report endpoint + Bing-assist audio write-back) writes through this
     * + buildRelativePath so worker-generated files land exactly where
     * generateAudio would put them and the serve route reads them back.
     */
    public function getAudioBaseDir(): string
    {
        return $this->audioDir;
    }

    /**
     * Deterministic relative path for a (text, lang, type, rate) tuple — the
     * SAME formula generateAudio uses, exposed so other writers (the pycore
     * worker report endpoint) produce identical paths and existence checks
     * stay equivalent to generation-time cache hits.
     */
    public function buildRelativePath(string $text, string $langCode, string $textType = 'word', string $rate = '+0%'): string
    {
        $speedKey = str_replace(['+', '%', '-'], ['p', 'pct', 'm'], $rate);
        $hash = md5($langCode . ':' . $textType . ':' . $rate . ':' . trim($text));
        return $langCode . '/' . $textType . '/' . $speedKey . '/' . $hash . '.mp3';
    }

    /**
     * Clean zero-byte audio files in background (non-blocking)
     * Called randomly during service initialization to maintain clean storage
     * Limits: Max 100 files per call to avoid performance impact
     */
    private function cleanZeroByteFilesBackground(): void
    {
        try {
            $maxFilesToClean = 100;
            $cleaned = 0;

            // Use RecursiveIteratorIterator for efficient directory traversal
            if (!is_dir($this->audioDir)) {
                return;
            }

            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($this->audioDir, \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $file) {
                // Stop after cleaning max files
                if ($cleaned >= $maxFilesToClean) {
                    break;
                }

                // Only process .mp3 files
                if (!$file->isFile() || $file->getExtension() !== 'mp3') {
                    continue;
                }

                // Check if file is zero bytes
                if ($file->getSize() === 0) {
                    $filePath = $file->getRealPath();
                    if (@unlink($filePath)) {
                        $cleaned++;
                    }
                }
            }

            if ($cleaned > 0) {
                Log::info('[EdgeTTS] Background cleanup removed zero-byte files', [
                    'files_cleaned' => $cleaned,
                ]);
            }
        } catch (\Exception $e) {
            // Silent fail - don't break TTS service if cleanup fails
            Log::warning('[EdgeTTS] Background cleanup failed', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
