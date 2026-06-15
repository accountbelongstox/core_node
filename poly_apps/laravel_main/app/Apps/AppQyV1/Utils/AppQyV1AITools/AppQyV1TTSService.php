<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

/**
 * @deprecated This class is deprecated. Use App\Services\EdgeTTS\EdgeTTSService instead.
 * All TTS functionality has been consolidated into EdgeTTSService with improved features.
 *
 * Migration Path:
 * - Old: App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TTSService
 * - New: App\Services\EdgeTTS\EdgeTTSService
 *
 * The new service includes:
 * - Database-backed caching using AppQyV1MultiLangDictionaryModel
 * - Namespace-based file organization for better scalability
 * - EdgeTTSChecker integration for availability checking
 * - All methods from both old services (batch generation, status checking, etc.)
 */
class AppQyV1TTSService
{
    private $dataDir;
    private $audioDir;
    
    /**
     * @deprecated Use \App\Services\EdgeTTS\EdgeTTSService::getVoices() instead
     * Single source of truth: AppQyV1LanguageConfigService::getTTSVoices()
     */
    public static function getVOICES(): array
    {
        return \App\Services\EdgeTTS\EdgeTTSService::getVoices();
    }
    
    /**
     * @deprecated Use \App\Services\EdgeTTS\EdgeTTSService::getTextTypes() instead
     * Single source of truth: AppQyV1LanguageConfigService::getTTSTextTypes()
     */
    public static function getTEXT_TYPES(): array
    {
        return \App\Services\EdgeTTS\EdgeTTSService::getTextTypes();
    }
    
    public function __construct()
    {
        $laravelDataDir = PathMapper::getLaravelDataDir();
        if (!$laravelDataDir) {
            Log::error('[AppQyV1TTSService] Laravel data directory not found');
            return;
        }
        
        $this->dataDir = $laravelDataDir . '/tts_data';
        $this->audioDir = $this->dataDir . '/audio';
        
        $this->initializeDirectories();
    }
    
    private function initializeDirectories(): void
    {
        $dirs = [$this->dataDir, $this->audioDir];
        
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
            Log::error('[AppQyV1TTSService] Failed to create directory', [
                'path' => $path,
            ]);
            return;
        }

        if (!is_writable($path)) {
            Log::error('[AppQyV1TTSService] Directory is not writable', [
                'path' => $path,
            ]);
            return;
        }
    }
    
    public function generateAudio(
        string $text,
        string $langCode,
        string $textType = 'sentence',
        array $options = []
    ): array {
        $voices = self::getVOICES();
        if (!isset($voices[$langCode])) {
            return [
                'success' => false,
                'error' => 'Unsupported language: ' . $langCode,
            ];
        }
        
        $textTypes = self::getTEXT_TYPES();
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
        
        $md5 = md5($text);
        $cached = $this->getCachedAudio($langCode, $md5, $speedKey);
        if ($cached) {
            return $cached;
        }
        
        $namespace = substr($md5, 0, 2);
        $relativePath = $langCode . '/' . $textType . '/' . $speedKey . '/' . $namespace . '/' . $md5 . '.mp3';
        $fullPath = $this->audioDir . '/' . $relativePath;
        
        if (file_exists($fullPath)) {
            $this->cacheAudioPath($langCode, $md5, $speedKey, $relativePath);
            return [
                'success' => true,
                'cached' => true,
                'audio_path' => $relativePath,
                'audio_url' => AppQyV1TtsUrl::forPath($relativePath),
                'text' => $text,
                'language' => $langCode,
                'type' => $textType,
                'speed' => $rate,
            ];
        }

        $voices = self::getVOICES();
        $voice = $voices[$langCode];
        $volume = $options['volume'] ?? '+0%';
        $pitch = $options['pitch'] ?? '+0Hz';
        
        try {
            $speedDir = dirname($fullPath);
            $this->ensureDirectoryExists($speedDir);
            
            $result = $this->executeEdgeTTS($text, $voice, $fullPath, $rate, $volume, $pitch);
            
            if ($result['success']) {
                $this->cacheAudioPath($langCode, $md5, $speedKey, $relativePath);
                
                return [
                    'success' => true,
                    'cached' => false,
                    'audio_path' => $relativePath,
                    'audio_url' => AppQyV1TtsUrl::forPath($relativePath),
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
            Log::error('[AppQyV1TTS] Generation failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
    
    private function executeEdgeTTS(
        string $text,
        string $voice,
        string $outputPath,
        string $rate = '+0%',
        string $volume = '+0%',
        string $pitch = '+0Hz'
    ): array {
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
            return ['success' => true];
        } else {
            $error = implode("\n", $output);
            Log::error('[AppQyV1TTS] Command failed: ' . $command);
            Log::error('[AppQyV1TTS] Output: ' . $error);
            return [
                'success' => false,
                'error' => 'edge-tts execution failed: ' . $error,
            ];
        }
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
    
    private function generateHash(string $text, string $langCode, string $textType, string $rate = '+0%'): string
    {
        return md5($langCode . ':' . $textType . ':' . $rate . ':' . $text);
    }
    
    private function getCachedAudio(string $langCode, string $md5, string $speedKey): ?array
    {
        $entry = AppQyV1MultiLangDictionaryModel::findByMd5($langCode, $md5);
        
        if (!$entry || !$entry->tts_files) {
            return null;
        }
        
        foreach ($entry->tts_files as $ttsFile) {
            if (isset($ttsFile['speed_key']) && $ttsFile['speed_key'] === $speedKey) {
                $path = $ttsFile['path'];
                if (file_exists($this->audioDir . '/' . $path)) {
                    $entry->incrementQueryCount();
                    return [
                        'success' => true,
                        'cached' => true,
                        'audio_path' => $path,
                        'audio_url' => AppQyV1TtsUrl::forPath($path),
                        'text' => $entry->content,
                        'language' => $langCode,
                        'type' => $ttsFile['type'] ?? 'sentence',
                        'speed' => $ttsFile['speed'] ?? '+0%',
                    ];
                }
            }
        }
        
        return null;
    }
    
    private function cacheAudioPath(string $langCode, string $md5, string $speedKey, string $relativePath): void
    {
        $entry = AppQyV1MultiLangDictionaryModel::findByMd5($langCode, $md5);
        
        if (!$entry) {
            return;
        }
        
        $ttsFiles = $entry->tts_files ?? [];
        
        $ttsFiles[] = [
            'path' => $relativePath,
            'speed_key' => $speedKey,
            'type' => 'sentence',
            'provider' => 'edge-tts',
            'created_at' => now()->toDateTimeString(),
        ];
        
        $entry->tts_files = $ttsFiles;
        $entry->tts_provider = 'edge-tts';
        $entry->save();
    }
    
    public function getAvailableVoices(): array
    {
        return self::getVOICES();
    }
    
    public function getAudioPath(string $relativePath): ?string
    {
        $fullPath = $this->audioDir . '/' . $relativePath;
        return file_exists($fullPath) ? $fullPath : null;
    }
}
