<?php

namespace App\Services\EdgeTTS;

use App\Providers\PathMapper;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageConfigService;
use App\Models\GlobalTask;
use App\Services\PycoreTasks\PycoreTaskQueue;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Log;

/**
 * EdgeTTS Service - Common TTS service using EdgeTTSPayloadCache
 *
 * Canonical TTS service. The legacy
 * App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TTSService was removed; all
 * former consumers were migrated here.
 *
 * Laravel never synthesizes (LARAVEL_GUIDE §1 pycore boundary): a cache
 * miss queues one `tts_synthesize` task per audio file. pycore pulls it,
 * synthesizes with its TTS orchestrator, and posts the MP3 back;
 * TtsSynthesizeTaskProcessor stores it via storeSynthesizedAudio().
 *
 * Task payload: {text, language, voice, rate, volume, pitch, text_type, relative_path, provider: edge}.
 * Task result:  {audio_base64, mime?, engine?, model?, bytes?}.
 *
 * Features:
 * - 82 languages with neural voices
 * - File-based caching with EdgeTTSPayloadCache
 */
class EdgeTTSService
{
    private $dataDir;
    private $audioDir;
    private $cacheManager;

    public const TASK_TYPE = 'tts_synthesize';
    private const PROVIDER = 'edge';
    private const MIN_AUDIO_BYTES = 100;

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
        $this->cacheManager = new EdgeTTSPayloadCache($jsonDbDir);
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

    /** Synthesis is always available as a queued pycore task. */
    public function isAvailable(): bool
    {
        return true;
    }

    /**
     * Get detailed status information
     */
    public function getStatus(): array
    {
        return [
            'available' => true,
            'task_type' => self::TASK_TYPE,
            'in_flight' => self::getConcurrentCount(),
        ];
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

        // Check cache using EdgeTTSPayloadCache (an explicit voice override is part of the identity)
        $voiceOverride = trim((string) ($options['voice'] ?? ''));
        $cacheKey = $text . '|speed:' . $rate . ($voiceOverride !== '' ? '|voice:' . $voiceOverride : '');
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
        $hash = md5($langCode . ':' . $textType . ':' . $rate . ':' . $text . ($voiceOverride !== '' ? ':' . $voiceOverride : ''));
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

        $view = PycoreTaskQueue::request(self::TASK_TYPE, [
            'text' => $text,
            'language' => $langCode,
            'voice' => $voiceOverride !== '' ? $voiceOverride : $voices[$langCode],
            'rate' => $rate,
            'volume' => $options['volume'] ?? '+0%',
            'pitch' => $options['pitch'] ?? '+0Hz',
            'text_type' => $textType,
            'relative_path' => $relativePath,
            'cache_key' => $cacheKey,
            'provider' => self::PROVIDER,
        ], ['relative_path' => $relativePath], $options['client_task_id'] ?? null, 0, true);

        return $view + [
            'audio_path' => $relativePath,
            'audio_url' => '/tts/audio/' . $relativePath,
            'text' => $text,
            'language' => $langCode,
            'type' => $textType,
            'speed' => $rate,
        ];
    }

    /**
     * Store pycore's MP3 for one tts_synthesize task at its payload path and
     * index it in the payload cache. False when the audio or path is invalid.
     */
    public function storeSynthesizedAudio(array $payload, string $binary): bool
    {
        $relativePath = (string) ($payload['relative_path'] ?? '');
        $fullPath = $this->audioDir . '/' . $relativePath;

        if ($relativePath === '' || str_contains($relativePath, '..') || strlen($binary) < self::MIN_AUDIO_BYTES) {
            return false;
        }
        $this->ensureDirectoryExists(dirname($fullPath));
        if (!FileSystemManager::writeFile($fullPath, $binary)) {
            return false;
        }
        $this->cacheManager->set(
            (string) $payload['language'],
            (string) $payload['text_type'],
            (string) $payload['cache_key'],
            $relativePath
        );

        return true;
    }

    /** tts_synthesize tasks pycore is working on now. */
    public static function getConcurrentCount(): int
    {
        $counts = GlobalTask::statusCountsForTaskType(self::TASK_TYPE);

        return (int) ($counts[GlobalTask::status('assigned')] ?? 0) + (int) ($counts[GlobalTask::status('processing')] ?? 0);
    }

    /**
     * Get cache statistics using EdgeTTSPayloadCache
     */
    public function getCacheStats(): array
    {
        return $this->cacheManager->getAllStats();
    }

    /**
     * Clear cache using EdgeTTSPayloadCache
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
    /**
     * Deterministic relative path for a (text, lang, type, rate[, variant]) tuple
     * - the SAME formula generateAudio uses, exposed so other writers (the pycore
     * worker report endpoint) produce identical paths and existence checks stay
     * equivalent to generation-time cache hits.
     *
     * When $variantKey is a non-empty string, a ``_{variantKey}`` segment is
     * appended to the filename (e.g. ``.../{hash}_uk_f.mp3``) so multiple
     * accent/gender voices for one word coexist. When $variantKey is null/empty
     * the path is BYTE-IDENTICAL to the legacy formula (primary audio).
     */
    public function buildRelativePath(string $text, string $langCode, string $textType = 'word', string $rate = '+0%', ?string $variantKey = null): string
    {
        $speedKey = str_replace(['+', '%', '-'], ['p', 'pct', 'm'], $rate);
        $hash = md5($langCode . ':' . $textType . ':' . $rate . ':' . trim($text));
        $suffix = ($variantKey !== null && $variantKey !== '') ? '_' . $variantKey : '';
        return $langCode . '/' . $textType . '/' . $speedKey . '/' . $hash . $suffix . '.mp3';
    }

    /**
     * Time-boxed zero-byte audio cleanup, invoked from the CLI maintenance
     * schedule (QueueCenterAudioScanTask) — never from the request path.
     * Both the file budget and the wall-clock budget stop the traversal.
     *
     * @return int Number of zero-byte files removed
     */
    public function cleanZeroByteFilesMaintenance(int $maxFilesToClean = 100, float $wallClockSeconds = 5.0): int
    {
        $cleaned = 0;

        try {
            $deadline = microtime(true) + max(0.1, $wallClockSeconds);

            // Use RecursiveIteratorIterator for efficient directory traversal
            if (!is_dir($this->audioDir)) {
                return 0;
            }

            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($this->audioDir, \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $file) {
                // Stop on file budget or wall-clock budget
                if ($cleaned >= $maxFilesToClean || microtime(true) >= $deadline) {
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
                Log::info('[EdgeTTS] Maintenance cleanup removed zero-byte files', [
                    'files_cleaned' => $cleaned,
                ]);
            }
        } catch (\Exception $e) {
            // Silent fail - don't break TTS service if cleanup fails
            Log::warning('[EdgeTTS] Maintenance cleanup failed', [
                'error' => $e->getMessage(),
            ]);
        }

        return $cleaned;
    }
}
