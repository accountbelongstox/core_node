<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use App\Providers\PathMapper;

class TTSCacheManager
{
    private $cacheDir;
    private $cacheDatabasePath;
    private $dbConnection;

    public function __construct()
    {
        $this->cacheDir = PathMapper::getLaravelCacheDir() . '/tts';
        $this->cacheDatabasePath = $this->cacheDir . '/tts_cache.sqlite';

        PathMapper::ensureDirectory($this->cacheDir);

        $this->initializeDatabase();
    }

    private function generateAudioUrl(string $filePath): string
    {
        $fileName = basename($filePath);
        return route('mcp.v1.voice-subtitle.audio', ['filename' => $fileName], false);
    }

    private function initializeDatabase(): void
    {
        try {
            $this->dbConnection = new \PDO('sqlite:' . $this->cacheDatabasePath);
            $this->dbConnection->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

            $this->dbConnection->exec("
                CREATE TABLE IF NOT EXISTS tts_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    text_hash VARCHAR(32) NOT NULL,
                    text TEXT NOT NULL,
                    language VARCHAR(10) NOT NULL,
                    voice VARCHAR(100) NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    access_count INTEGER DEFAULT 1,
                    UNIQUE(text_hash, language, voice)
                )
            ");

            $this->dbConnection->exec("
                CREATE INDEX IF NOT EXISTS idx_text_hash ON tts_cache(text_hash)
            ");

            $this->dbConnection->exec("
                CREATE INDEX IF NOT EXISTS idx_language ON tts_cache(language)
            ");

            $this->dbConnection->exec("
                CREATE INDEX IF NOT EXISTS idx_last_accessed ON tts_cache(last_accessed_at)
            ");

        } catch (\PDOException $e) {
            Log::error('[TTSCacheManager] Failed to initialize database', [
                'error' => $e->getMessage(),
                'path' => $this->cacheDatabasePath,
            ]);
            throw $e;
        }
    }

    public function getCached(string $text, string $language, string $voice): ?array
    {
        $textHash = md5($text);

        try {
            $stmt = $this->dbConnection->prepare("
                SELECT * FROM tts_cache
                WHERE text_hash = :text_hash
                AND language = :language
                AND voice = :voice
                LIMIT 1
            ");

            $stmt->execute([
                ':text_hash' => $textHash,
                ':language' => $language,
                ':voice' => $voice,
            ]);

            $result = $stmt->fetch(\PDO::FETCH_ASSOC);

            if ($result && file_exists($result['file_path'])) {
                $this->updateAccessStats($result['id']);

                return [
                    'id' => $result['id'],
                    'text' => $result['text'],
                    'file_path' => $result['file_path'],
                    'audio_url' => $this->generateAudioUrl($result['file_path']),
                    'file_size' => $result['file_size'],
                    'language' => $result['language'],
                    'voice' => $result['voice'],
                    'cached' => true,
                ];
            }

            if ($result && !file_exists($result['file_path'])) {
                $this->deleteCache($result['id']);
            }

            return null;

        } catch (\PDOException $e) {
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

            $stmt = $this->dbConnection->prepare("
                INSERT OR REPLACE INTO tts_cache
                (text_hash, text, language, voice, file_path, file_size, created_at, last_accessed_at, access_count)
                VALUES
                (:text_hash, :text, :language, :voice, :file_path, :file_size, datetime('now'), datetime('now'), 1)
            ");

            $stmt->execute([
                ':text_hash' => $textHash,
                ':text' => $text,
                ':language' => $language,
                ':voice' => $voice,
                ':file_path' => $filePath,
                ':file_size' => $fileSize,
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
            $stmt = $this->dbConnection->prepare("
                UPDATE tts_cache
                SET last_accessed_at = datetime('now'),
                    access_count = access_count + 1
                WHERE id = :id
            ");

            $stmt->execute([':id' => $cacheId]);

        } catch (\PDOException $e) {
            Log::warning('[TTSCacheManager] Failed to update access stats', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function deleteCache(int $cacheId): void
    {
        try {
            $stmt = $this->dbConnection->prepare("
                SELECT file_path FROM tts_cache WHERE id = :id
            ");
            $stmt->execute([':id' => $cacheId]);
            $result = $stmt->fetch(\PDO::FETCH_ASSOC);

            if ($result && file_exists($result['file_path'])) {
                @unlink($result['file_path']);
            }

            $stmt = $this->dbConnection->prepare("
                DELETE FROM tts_cache WHERE id = :id
            ");
            $stmt->execute([':id' => $cacheId]);

        } catch (\PDOException $e) {
            Log::error('[TTSCacheManager] Error deleting cache', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function cleanupOldCache(int $daysOld = 30): int
    {
        try {
            $stmt = $this->dbConnection->prepare("
                SELECT id, file_path FROM tts_cache
                WHERE last_accessed_at < datetime('now', '-' || :days || ' days')
            ");
            $stmt->execute([':days' => $daysOld]);
            $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            $deletedCount = 0;
            foreach ($results as $row) {
                if (file_exists($row['file_path'])) {
                    @unlink($row['file_path']);
                }
                $deletedCount++;
            }

            $stmt = $this->dbConnection->prepare("
                DELETE FROM tts_cache
                WHERE last_accessed_at < datetime('now', '-' || :days || ' days')
            ");
            $stmt->execute([':days' => $daysOld]);

            Log::info('[TTSCacheManager] Cleaned up old cache', [
                'deleted_count' => $deletedCount,
                'days_old' => $daysOld,
            ]);

            return $deletedCount;

        } catch (\PDOException $e) {
            Log::error('[TTSCacheManager] Error cleaning up cache', [
                'error' => $e->getMessage(),
            ]);
            return 0;
        }
    }

    public function getCacheStats(): array
    {
        try {
            $stmt = $this->dbConnection->query("
                SELECT
                    COUNT(*) as total_count,
                    SUM(file_size) as total_size,
                    SUM(access_count) as total_accesses,
                    COUNT(DISTINCT language) as language_count
                FROM tts_cache
            ");

            $stats = $stmt->fetch(\PDO::FETCH_ASSOC);

            return [
                'total_cached_items' => (int)$stats['total_count'],
                'total_cache_size_bytes' => (int)$stats['total_size'],
                'total_cache_size_mb' => round((int)$stats['total_size'] / 1024 / 1024, 2),
                'total_accesses' => (int)$stats['total_accesses'],
                'language_count' => (int)$stats['language_count'],
                'cache_directory' => $this->cacheDir,
            ];

        } catch (\PDOException $e) {
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

    public function __destruct()
    {
        $this->dbConnection = null;
    }
}
