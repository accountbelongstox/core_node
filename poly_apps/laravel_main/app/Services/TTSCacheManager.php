<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsCacheModel;
use App\Providers\PathMapper;

class TTSCacheManager
{
    private $cacheDir;

    public function __construct()
    {
        $this->cacheDir = PathMapper::getLaravelCacheDir() . '/tts';
        PathMapper::ensureDirectory($this->cacheDir);

        // Table should be created by sys:init command via UserSyncService::ensureTTSCacheTablesExist()
        if (!AppQyV1TtsCacheModel::configuredTableExists()) {
            Log::warning('[TTSCacheManager] TTS cache table does not exist. Run php artisan sys:init to create it.');
        }
    }

    private function generateAudioUrl(string $filePath): string
    {
        $fileName = basename($filePath);
        return route('mcp.v1.voice-subtitle.audio', ['filename' => $fileName], false);
    }

    public function getCached(string $text, string $language, string $voice): ?array
    {
        $textHash = md5($text);
        try {
            $result = AppQyV1TtsCacheModel::findCached($textHash, $language, $voice);

            if ($result && file_exists($result->audio_path)) {
                $this->updateAccessStats($result->id);

                return [
                    'id' => $result->id,
                    'text' => $result->text,
                    'file_path' => $result->audio_path,
                    'audio_url' => $this->generateAudioUrl($result->audio_path),
                    'file_size' => $result->audio_size,
                    'language' => $result->language,
                    'voice' => $result->voice ?? $voice,
                    'cached' => true,
                ];
            }

            if ($result && !file_exists($result->audio_path)) {
                $this->deleteCache($result->id);
            }

            return null;

        } catch (\Exception $e) {
            Log::error('[TTSCacheManager] Error fetching cache', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    public function saveCache(
        string $text,
        string $language,
        string $voice,
        string $audioData
    ): ?array {
        $textHash = md5($text);
        $fileName = $textHash . '_' . $language . '_' . str_replace(['/', ' '], '_', $voice) . '.mp3';
        $filePath = $this->cacheDir . '/' . $fileName;
        try {
            file_put_contents($filePath, $audioData);
            $fileSize = filesize($filePath);

            AppQyV1TtsCacheModel::storeAudio($textHash, $language, [
                'text' => $text,
                'voice' => $voice,
                'audio_path' => $filePath,
                'audio_size' => $fileSize,
            ]);

            return [
                'file_path' => $filePath,
                'audio_url' => $this->generateAudioUrl($filePath),
                'file_size' => $fileSize,
                'cached' => false,
            ];

        } catch (\Exception $e) {
            Log::error('[TTSCacheManager] Error saving cache', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    private function updateAccessStats(int $cacheId): void
    {
        try {
            AppQyV1TtsCacheModel::recordAccess($cacheId);

        } catch (\Exception $e) {
            Log::warning('[TTSCacheManager] Failed to update access stats', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function deleteCache(int $cacheId): void
    {
        try {
            $result = AppQyV1TtsCacheModel::findById($cacheId);

            if ($result && isset($result->audio_path) && file_exists($result->audio_path)) {
                @unlink($result->audio_path);
            }

            AppQyV1TtsCacheModel::deleteById($cacheId);

        } catch (\Exception $e) {
            Log::error('[TTSCacheManager] Error deleting cache', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function cleanupOldCache(int $daysOld = 30): int
    {
        try {
            $cutoffDate = now()->subDays($daysOld);
            $results = AppQyV1TtsCacheModel::olderThan($cutoffDate);

            $deletedCount = 0;
            foreach ($results as $row) {
                if (isset($row->audio_path) && file_exists($row->audio_path)) {
                    @unlink($row->audio_path);
                }
                $deletedCount++;
            }

            AppQyV1TtsCacheModel::deleteOlderThan($cutoffDate);

            Log::info('[TTSCacheManager] Cleaned up old cache', [
                'deleted_count' => $deletedCount,
                'days_old' => $daysOld,
            ]);

            return $deletedCount;

        } catch (\Exception $e) {
            Log::error('[TTSCacheManager] Error cleaning up cache', [
                'error' => $e->getMessage(),
            ]);
            return 0;
        }
    }

    public function getCacheStats(): array
    {
        try {
            $stats = AppQyV1TtsCacheModel::cacheStats();

            return [
                'total_cached_items' => (int)($stats->total_count ?? 0),
                'total_cache_size_bytes' => (int)($stats->total_size ?? 0),
                'total_cache_size_mb' => round((int)($stats->total_size ?? 0) / 1024 / 1024, 2),
                'total_accesses' => (int)($stats->total_accesses ?? 0),
                'language_count' => (int)($stats->language_count ?? 0),
                'cache_directory' => $this->cacheDir,
            ];

        } catch (\Exception $e) {
            Log::error('[TTSCacheManager] Error getting cache stats', [
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    public function splitTextToParagraphs(string $text): array
    {
        $paragraphs = preg_split('/\n+/', trim($text));

        return array_values(array_filter(array_map('trim', $paragraphs)));
    }

    public function batchGenerateCache(
        array $paragraphs,
        string $language,
        string $voice,
        callable $ttsGenerator
    ): array {
        $results = [];

        foreach ($paragraphs as $index => $paragraph) {
            if (empty($paragraph)) {
                continue;
            }

            $cached = $this->getCached($paragraph, $language, $voice);

            if ($cached) {
                $results[] = $cached;
                continue;
            }

            try {
                $audioData = $ttsGenerator($paragraph, $language, $voice);

                if ($audioData) {
                    $saved = $this->saveCache($paragraph, $language, $voice, $audioData);
                    if ($saved) {
                        $results[] = array_merge($saved, [
                            'text' => $paragraph,
                            'language' => $language,
                            'voice' => $voice,
                        ]);
                    }
                }

            } catch (\Exception $e) {
                Log::error('[TTSCacheManager] Error generating TTS for paragraph', [
                    'index' => $index,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $results;
    }

}
