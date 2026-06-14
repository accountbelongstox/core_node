<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Providers\PathMapper;

class TTSCacheManager
{
    private $cacheDir;
    private $connection;
    private $appKey;

    public function __construct()
    {
        $this->cacheDir = PathMapper::getLaravelCacheDir() . '/tts';
        PathMapper::ensureDirectory($this->cacheDir);

        // Table should be created by sys:init command via UserSyncService::ensureTTSCacheTablesExist()
        $this->appKey = AppKeys::APPQYV1;
        $connectionName = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->connection = DB::connection($connectionName);
        
        // Verify table exists (should be created by sys:init)
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_cache');
        if (!Schema::connection($connectionName)->hasTable($tableName)) {
            Log::warning('[TTSCacheManager] TTS cache table does not exist. Run php artisan sys:init to create it.');
        }
    }

    private function getTableName(): string
    {
        return AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_cache');
    }

    private function generateAudioUrl(string $filePath): string
    {
        $fileName = basename($filePath);
        return route('mcp.v1.voice-subtitle.audio', ['filename' => $fileName], false);
    }

    public function getCached(string $text, string $language, string $voice): ?array
    {
        $textHash = md5($text);
        $tableName = $this->getTableName();

        try {
            $result = $this->connection
                ->table($tableName)
                ->where('text_hash', $textHash)
                ->where('language', $language)
                ->where('voice', $voice)
                ->first();

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
        $tableName = $this->getTableName();

        try {
            file_put_contents($filePath, $audioData);
            $fileSize = filesize($filePath);

            // Check if record exists by text_hash (which is unique)
            $existing = $this->connection
                ->table($tableName)
                ->where('text_hash', $textHash)
                ->where('language', $language)
                ->first();

            if ($existing) {
                $this->connection
                    ->table($tableName)
                    ->where('id', $existing->id)
                    ->update([
                        'text' => $text,
                        'voice' => $voice,
                        'audio_path' => $filePath,
                        'audio_size' => $fileSize,
                        'last_accessed' => now(),
                        // Mixed with several other column updates, so keep the raw
                        // expression (no native form for increment-within-update).
                        // "access_count + 1" is plain SQL, cross-DB safe (sqlite/pgsql).
                        'access_count' => DB::raw('access_count + 1'),
                    ]);
            } else {
                $this->connection
                    ->table($tableName)
                    ->insert([
                        'text_hash' => $textHash,
                        'text' => $text,
                        'language' => $language,
                        'type' => 'word',
                        'voice' => $voice,
                        'audio_path' => $filePath,
                        'audio_size' => $fileSize,
                        'created_at' => now(),
                        'last_accessed' => now(),
                        'access_count' => 1,
                    ]);
            }

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
            $tableName = $this->getTableName();
            
            // Native increment: bumps access_count by 1 and sets last_accessed in one
            // UPDATE. Cross-DB safe (Laravel emits "access_count" + 1 for sqlite/pgsql).
            $this->connection
                ->table($tableName)
                ->where('id', $cacheId)
                ->increment('access_count', 1, [
                    'last_accessed' => now(),
                ]);

        } catch (\Exception $e) {
            Log::warning('[TTSCacheManager] Failed to update access stats', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function deleteCache(int $cacheId): void
    {
        try {
            $tableName = $this->getTableName();
            
            $result = $this->connection
                ->table($tableName)
                ->where('id', $cacheId)
                ->first();

            if ($result && isset($result->audio_path) && file_exists($result->audio_path)) {
                @unlink($result->audio_path);
            }

            $this->connection
                ->table($tableName)
                ->where('id', $cacheId)
                ->delete();

        } catch (\Exception $e) {
            Log::error('[TTSCacheManager] Error deleting cache', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function cleanupOldCache(int $daysOld = 30): int
    {
        try {
            $tableName = $this->getTableName();
            $cutoffDate = now()->subDays($daysOld);
            
            $results = $this->connection
                ->table($tableName)
                ->where('last_accessed', '<', $cutoffDate)
                ->get(['id', 'audio_path']);

            $deletedCount = 0;
            foreach ($results as $row) {
                if (isset($row->audio_path) && file_exists($row->audio_path)) {
                    @unlink($row->audio_path);
                }
                $deletedCount++;
            }

            $this->connection
                ->table($tableName)
                ->where('last_accessed', '<', $cutoffDate)
                ->delete();

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
            $tableName = $this->getTableName();
            
            $stats = $this->connection
                ->table($tableName)
                ->selectRaw('COUNT(*) as total_count')
                ->selectRaw('SUM(audio_size) as total_size')
                ->selectRaw('SUM(access_count) as total_accesses')
                ->selectRaw('COUNT(DISTINCT language) as language_count')
                ->first();

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
