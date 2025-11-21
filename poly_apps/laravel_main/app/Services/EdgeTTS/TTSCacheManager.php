<?php

namespace App\Services\EdgeTTS;

use Illuminate\Support\Facades\Log;

class TTSCacheManager
{
    private $jsonDbDir;
    private $cache = [];
    
    const MAX_ITEMS_PER_FILE = 1000;
    
    public function __construct(string $jsonDbDir)
    {
        $this->jsonDbDir = $jsonDbDir;
    }
    
    public function get(string $langCode, string $textType, string $text): ?array
    {
        $dbFile = $this->getDbFilePath($langCode, $textType);
        
        if (!isset($this->cache[$dbFile])) {
            $this->loadDb($dbFile);
        }
        
        $key = $this->generateKey($text);
        
        if (isset($this->cache[$dbFile][$key])) {
            $entry = $this->cache[$dbFile][$key];
            $entry['last_accessed'] = time();
            $this->cache[$dbFile][$key] = $entry;
            $this->saveDeferredDb($dbFile);
            return $entry;
        }
        
        return null;
    }
    
    public function set(string $langCode, string $textType, string $text, string $audioPath): void
    {
        $dbFile = $this->getDbFilePath($langCode, $textType);
        
        if (!isset($this->cache[$dbFile])) {
            $this->loadDb($dbFile);
        }
        
        $key = $this->generateKey($text);
        
        $this->cache[$dbFile][$key] = [
            'text' => $text,
            'audio_path' => $audioPath,
            'language' => $langCode,
            'type' => $textType,
            'created_at' => time(),
            'last_accessed' => time(),
            'access_count' => ($this->cache[$dbFile][$key]['access_count'] ?? 0) + 1,
        ];
        
        $this->saveDb($dbFile);
        $this->pruneIfNeeded($dbFile);
    }
    
    private function loadDb(string $dbFile): void
    {
        if (file_exists($dbFile)) {
            $content = file_get_contents($dbFile);
            $data = json_decode($content, true);
            
            if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
                $this->cache[$dbFile] = $data;
            } else {
                Log::warning('[TTSCache] Failed to parse JSON: ' . $dbFile);
                $this->cache[$dbFile] = [];
            }
        } else {
            $this->cache[$dbFile] = [];
        }
    }
    
    private function saveDb(string $dbFile): void
    {
        $dir = dirname($dbFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        
        $content = json_encode($this->cache[$dbFile], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        file_put_contents($dbFile, $content);
    }
    
    private $deferredSaves = [];
    
    private function saveDeferredDb(string $dbFile): void
    {
        if (!isset($this->deferredSaves[$dbFile])) {
            $this->deferredSaves[$dbFile] = true;
            
            register_shutdown_function(function() use ($dbFile) {
                if (isset($this->cache[$dbFile])) {
                    $this->saveDb($dbFile);
                }
            });
        }
    }
    
    private function pruneIfNeeded(string $dbFile): void
    {
        if (!isset($this->cache[$dbFile])) {
            return;
        }
        
        $count = count($this->cache[$dbFile]);
        
        if ($count > self::MAX_ITEMS_PER_FILE) {
            $entries = $this->cache[$dbFile];
            
            uasort($entries, function($a, $b) {
                return ($b['last_accessed'] ?? 0) <=> ($a['last_accessed'] ?? 0);
            });
            
            $this->cache[$dbFile] = array_slice($entries, 0, self::MAX_ITEMS_PER_FILE, true);
            
            $this->saveDb($dbFile);
            
            Log::info('[TTSCache] Pruned cache file: ' . $dbFile . ' from ' . $count . ' to ' . self::MAX_ITEMS_PER_FILE);
        }
    }
    
    private function getDbFilePath(string $langCode, string $textType): string
    {
        return $this->jsonDbDir . '/' . $langCode . '/' . $textType . '.json';
    }
    
    private function generateKey(string $text): string
    {
        return md5($text);
    }
    
    public function getStats(string $langCode, string $textType): array
    {
        $dbFile = $this->getDbFilePath($langCode, $textType);
        
        if (!isset($this->cache[$dbFile])) {
            $this->loadDb($dbFile);
        }
        
        $count = count($this->cache[$dbFile]);
        $totalSize = file_exists($dbFile) ? filesize($dbFile) : 0;
        
        return [
            'language' => $langCode,
            'type' => $textType,
            'entries' => $count,
            'file_size' => $totalSize,
            'file_size_human' => $this->formatBytes($totalSize),
        ];
    }
    
    public function getAllStats(): array
    {
        $stats = [];
        
        $languages = array_keys(EdgeTTSService::VOICES);
        $types = EdgeTTSService::TEXT_TYPES;
        
        foreach ($languages as $langCode) {
            foreach ($types as $textType) {
                $stats[] = $this->getStats($langCode, $textType);
            }
        }
        
        return $stats;
    }
    
    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;
        
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        
        return round($bytes, 2) . ' ' . $units[$i];
    }
    
    public function clearCache(string $langCode = null, string $textType = null): int
    {
        $cleared = 0;
        
        if ($langCode && $textType) {
            $dbFile = $this->getDbFilePath($langCode, $textType);
            if (file_exists($dbFile)) {
                unlink($dbFile);
                unset($this->cache[$dbFile]);
                $cleared = 1;
            }
        } elseif ($langCode) {
            foreach (EdgeTTSService::TEXT_TYPES as $type) {
                $dbFile = $this->getDbFilePath($langCode, $type);
                if (file_exists($dbFile)) {
                    unlink($dbFile);
                    unset($this->cache[$dbFile]);
                    $cleared++;
                }
            }
        } else {
            foreach (array_keys(EdgeTTSService::VOICES) as $lang) {
                foreach (EdgeTTSService::TEXT_TYPES as $type) {
                    $dbFile = $this->getDbFilePath($lang, $type);
                    if (file_exists($dbFile)) {
                        unlink($dbFile);
                        unset($this->cache[$dbFile]);
                        $cleared++;
                    }
                }
            }
        }
        
        return $cleared;
    }
}
