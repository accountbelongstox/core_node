<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class AppQyV1TTSService
{
    private $dataDir;
    private $audioDir;
    
    const VOICES = [
        'af' => 'af-ZA-AdriNeural', 'am' => 'am-ET-MekdesNeural',
        'ar' => 'ar-EG-SalmaNeural', 'as' => 'as-IN-YashicaNeural',
        'az' => 'az-AZ-BanuNeural', 'bg' => 'bg-BG-KalinaNeural',
        'bn' => 'bn-IN-TanishaaNeural', 'bs' => 'bs-BA-VesnaNeural',
        'ca' => 'ca-ES-AlbaNeural', 'cs' => 'cs-CZ-VlastaNeural',
        'cy' => 'cy-GB-NiaNeural', 'da' => 'da-DK-ChristelNeural',
        'de' => 'de-DE-KatjaNeural', 'el' => 'el-GR-AthinaNeural',
        'en' => 'en-US-JennyNeural', 'es' => 'es-ES-ElviraNeural',
        'et' => 'et-EE-AnuNeural', 'eu' => 'eu-ES-AinhoaNeural',
        'fa' => 'fa-IR-DilaraNeural', 'fi' => 'fi-FI-NooraNeural',
        'fil' => 'fil-PH-BlessicaNeural', 'fr' => 'fr-FR-DeniseNeural',
        'ga' => 'ga-IE-OrlaNeural', 'gl' => 'gl-ES-SabelaNeural',
        'gu' => 'gu-IN-DhwaniNeural', 'he' => 'he-IL-HilaNeural',
        'hi' => 'hi-IN-SwaraNeural', 'hr' => 'hr-HR-GabrijelaNeural',
        'hu' => 'hu-HU-NoemiNeural', 'hy' => 'hy-AM-AnahitNeural',
        'id' => 'id-ID-GadisNeural', 'is' => 'is-IS-GudrunNeural',
        'it' => 'it-IT-ElsaNeural', 'ja' => 'ja-JP-NanamiNeural',
        'jv' => 'jv-ID-SitiNeural', 'ka' => 'ka-GE-EkaNeural',
        'kk' => 'kk-KZ-AigulNeural', 'km' => 'km-KH-SreymomNeural',
        'kn' => 'kn-IN-SapnaNeural', 'ko' => 'ko-KR-SunHiNeural',
        'lo' => 'lo-LA-KeomanyNeural', 'lt' => 'lt-LT-OnaNeural',
        'lv' => 'lv-LV-EveritaNeural', 'mk' => 'mk-MK-MarijaNeural',
        'ml' => 'ml-IN-SobhanaNeural', 'mn' => 'mn-MN-YesuiNeural',
        'mr' => 'mr-IN-AarohiNeural', 'ms' => 'ms-MY-YasminNeural',
        'mt' => 'mt-MT-GraceNeural', 'my' => 'my-MM-NilarNeural',
        'nb' => 'nb-NO-IselinNeural', 'ne' => 'ne-NP-HemkalaNeural',
        'nl' => 'nl-NL-ColetteNeural', 'or' => 'or-IN-SubhasiniNeural',
        'pa' => 'pa-IN-VaaniNeural', 'pl' => 'pl-PL-ZofiaNeural',
        'ps' => 'ps-AF-LatifaNeural', 'pt' => 'pt-BR-FranciscaNeural',
        'ro' => 'ro-RO-AlinaNeural', 'ru' => 'ru-RU-SvetlanaNeural',
        'si' => 'si-LK-ThiliniNeural', 'sk' => 'sk-SK-ViktoriaNeural',
        'sl' => 'sl-SI-PetraNeural', 'so' => 'so-SO-UbaxNeural',
        'sq' => 'sq-AL-AnilaNeural', 'sr' => 'sr-RS-SophieNeural',
        'su' => 'su-ID-TutiNeural', 'sv' => 'sv-SE-HilleviNeural',
        'sw' => 'sw-TZ-RehemaNeural', 'ta' => 'ta-IN-PallaviNeural',
        'te' => 'te-IN-ShrutiNeural', 'th' => 'th-TH-PremwadeeNeural',
        'tr' => 'tr-TR-EmelNeural', 'uk' => 'uk-UA-PolinaNeural',
        'ur' => 'ur-PK-UzmaNeural', 'uz' => 'uz-UZ-MadinaNeural',
        'vi' => 'vi-VN-HoaiMyNeural', 'wuu' => 'wuu-CN-XiaotongNeural',
        'yue' => 'yue-CN-XiaoMinNeural', 'zh' => 'zh-CN-XiaoxiaoNeural',
        'zu' => 'zu-ZA-ThandoNeural',
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
        if (!is_dir($path)) {
            if (!mkdir($path, 0755, true)) {
                throw new \Exception('Failed to create directory: ' . $path);
            }
        }
        
        if (!is_writable($path)) {
            throw new \Exception('Directory is not writable: ' . $path);
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
                'audio_url' => '/app_qy_v1/ai_tools/tts/audio/' . $relativePath,
                'text' => $text,
                'language' => $langCode,
                'type' => $textType,
                'speed' => $rate,
            ];
        }
        
        $voice = self::VOICES[$langCode];
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
                    'audio_url' => '/app_qy_v1/ai_tools/tts/audio/' . $relativePath,
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
                        'audio_url' => '/app_qy_v1/ai_tools/tts/audio/' . $path,
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
        return self::VOICES;
    }
    
    public function getAudioPath(string $relativePath): ?string
    {
        $fullPath = $this->audioDir . '/' . $relativePath;
        return file_exists($fullPath) ? $fullPath : null;
    }
}
