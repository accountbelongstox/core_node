<?php

namespace App\Services\EdgeTTS;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class EdgeTTSService
{
    private $dataDir;
    private $audioDir;
    private $jsonDbDir;
    private $cacheManager;
    
    const VOICES = [
        'en' => 'en-US-JennyNeural',
        'zh' => 'zh-CN-XiaoxiaoNeural',
        'ja' => 'ja-JP-NanamiNeural',
        'ko' => 'ko-KR-SunHiNeural',
        'es' => 'es-ES-ElviraNeural',
        'fr' => 'fr-FR-DeniseNeural',
        'de' => 'de-DE-KatjaNeural',
        'ru' => 'ru-RU-SvetlanaNeural',
        'ar' => 'ar-EG-SalmaNeural',
        'pt' => 'pt-BR-FranciscaNeural',
        'it' => 'it-IT-ElsaNeural',
        'nl' => 'nl-NL-ColetteNeural',
        'pl' => 'pl-PL-ZofiaNeural',
        'tr' => 'tr-TR-EmelNeural',
        'vi' => 'vi-VN-HoaiMyNeural',
        'th' => 'th-TH-PremwadeeNeural',
        'id' => 'id-ID-GadisNeural',
    ];
    
    const TEXT_TYPES = ['sentence', 'word', 'letter'];
    
    public function __construct()
    {
        $laravelDataDir = PathMapper::getLaravelDataDir();
        if (!$laravelDataDir) {
            throw new \Exception('Laravel data directory not found');
        }
        
        $this->dataDir = $laravelDataDir . '/tts_data';
        $this->audioDir = $this->dataDir . '/audio';
        $this->jsonDbDir = $this->dataDir . '/json_db';
        
        $this->initializeDirectories();
        $this->cacheManager = new TTSCacheManager($this->jsonDbDir);
    }
    
    private function initializeDirectories(): void
    {
        $dirs = [
            $this->dataDir,
            $this->audioDir,
            $this->jsonDbDir,
        ];
        
        foreach (self::VOICES as $langCode => $voice) {
            $dirs[] = $this->audioDir . '/' . $langCode;
            $dirs[] = $this->audioDir . '/' . $langCode . '/sentence';
            $dirs[] = $this->audioDir . '/' . $langCode . '/word';
            $dirs[] = $this->audioDir . '/' . $langCode . '/letter';
            $dirs[] = $this->jsonDbDir . '/' . $langCode;
        }
        
        foreach ($dirs as $dir) {
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
        }
    }
    
    public function generateAudio(
        string $text,
        string $langCode,
        string $textType = 'sentence',
        array $options = []
    ): array {
        if (!isset(self::VOICES[$langCode])) {
            return [
                'success' => false,
                'error' => 'Unsupported language: ' . $langCode,
            ];
        }
        
        if (!in_array($textType, self::TEXT_TYPES)) {
            $textType = 'sentence';
        }
        
        $text = trim($text);
        if (empty($text)) {
            return [
                'success' => false,
                'error' => 'Empty text',
            ];
        }
        
        $cached = $this->cacheManager->get($langCode, $textType, $text);
        if ($cached) {
            if (file_exists($this->audioDir . '/' . $cached['audio_path'])) {
                return [
                    'success' => true,
                    'cached' => true,
                    'audio_path' => $cached['audio_path'],
                    'audio_url' => '/tts/audio/' . $cached['audio_path'],
                    'text' => $text,
                    'language' => $langCode,
                    'type' => $textType,
                ];
            }
        }
        
        $hash = $this->generateHash($text, $langCode, $textType);
        $relativePath = $langCode . '/' . $textType . '/' . $hash . '.mp3';
        $fullPath = $this->audioDir . '/' . $relativePath;
        
        if (file_exists($fullPath)) {
            $this->cacheManager->set($langCode, $textType, $text, $relativePath);
            return [
                'success' => true,
                'cached' => true,
                'audio_path' => $relativePath,
                'audio_url' => '/tts/audio/' . $relativePath,
                'text' => $text,
                'language' => $langCode,
                'type' => $textType,
            ];
        }
        
        $voice = self::VOICES[$langCode];
        $rate = $options['rate'] ?? '0%';
        $volume = $options['volume'] ?? '0%';
        $pitch = $options['pitch'] ?? '0Hz';
        
        try {
            $result = $this->executeEdgeTTS($text, $voice, $fullPath, $rate, $volume, $pitch);
            
            if ($result['success']) {
                $this->cacheManager->set($langCode, $textType, $text, $relativePath);
                
                return [
                    'success' => true,
                    'cached' => false,
                    'audio_path' => $relativePath,
                    'audio_url' => '/tts/audio/' . $relativePath,
                    'text' => $text,
                    'language' => $langCode,
                    'type' => $textType,
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
    
    private function executeEdgeTTS(
        string $text,
        string $voice,
        string $outputPath,
        string $rate = '0%',
        string $volume = '0%',
        string $pitch = '0Hz'
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
        $escapedRate = escapeshellarg($rate);
        $escapedVolume = escapeshellarg($volume);
        $escapedPitch = escapeshellarg($pitch);
        
        $command = sprintf(
            '%s -m edge_tts --text %s --voice %s --rate %s --volume %s --pitch %s --write-media %s 2>&1',
            $pythonPath,
            $escapedText,
            $escapedVoice,
            $escapedRate,
            $escapedVolume,
            $escapedPitch,
            $escapedOutput
        );
        
        $output = [];
        $returnCode = 0;
        exec($command, $output, $returnCode);
        
        if ($returnCode === 0 && file_exists($outputPath)) {
            return ['success' => true];
        } else {
            $error = implode("\n", $output);
            Log::error('[EdgeTTS] Command failed: ' . $command);
            Log::error('[EdgeTTS] Output: ' . $error);
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
    
    private function generateHash(string $text, string $langCode, string $textType): string
    {
        return md5($langCode . ':' . $textType . ':' . $text);
    }
    
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
    
    public function getAvailableVoices(): array
    {
        return self::VOICES;
    }
    
    public function getAudioPath(string $relativePath): ?string
    {
        $fullPath = $this->audioDir . '/' . $relativePath;
        return file_exists($fullPath) ? $fullPath : null;
    }
}
