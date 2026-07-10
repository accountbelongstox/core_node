<?php

namespace App\CallPycoreUtils;

use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Log;
use App\Utils\FileSystemManager;
use App\Services\UserConfig\UserConfigService;

class PycoreEdgeTTSUtil
{
    public static function generate(
        string $text,
        string $voice = 'en-US-AriaNeural',
        ?string $outputPath = null,
        int $timeout = 300
    ): array {
        // Binary-assist gate (default OFF): delegate to pycore's tts.synthesize
        // RPC - this util is named "Pycore", so actually call pycore instead of
        // the local edge-tts binary. ON = local binary fallback (desktop).
        if (!app(UserConfigService::class)->useServerBinaryAssist()) {
            return self::generateViaPycore($text, $voice, $outputPath, $timeout);
        }

        $tempFile = $outputPath ?: tempnam(sys_get_temp_dir(), 'edge_tts_') . '.mp3';

        // Create parent directory if needed (using FileSystemManager)
        if ($outputPath) {
            $dir = dirname($outputPath);
            FileSystemManager::ensureDirectoryExists($dir, 0775);
        }

        $command = sprintf(
            '/usr/bin/python3 /usr/local/bin/edge-tts --text %s --voice %s --write-media %s 2>&1',
            escapeshellarg($text),
            escapeshellarg($voice),
            escapeshellarg($tempFile)
        );

        Log::info('[PycoreEdgeTTS] Generating TTS', [
            'text_length' => strlen($text),
            'voice' => $voice,
        ]);

        $result = Process::timeout($timeout)->run($command);

        if (!$result->successful()) {
            $errorMsg = $result->errorOutput() ?: $result->output();
            Log::error('[PycoreEdgeTTS] Generation failed', [
                'exit_code' => $result->exitCode(),
                'error' => $errorMsg,
            ]);

            if (!$outputPath && FileSystemManager::exists($tempFile)) {
                FileSystemManager::delete($tempFile);
            }

            return [
                'success' => false,
                'error' => $errorMsg,
                'exit_code' => $result->exitCode(),
            ];
        }

        if (!FileSystemManager::exists($tempFile)) {
            return [
                'success' => false,
                'error' => 'Audio file was not created',
            ];
        }

        // Verify file size - MP3 files should be at least 100 bytes
        $fileSize = FileSystemManager::filesize($tempFile);
        $minFileSize = 100; // Minimum valid MP3 file size in bytes
        
        if ($fileSize === 0) {
            // Delete zero-byte file
            FileSystemManager::delete($tempFile);
            Log::error('[PycoreEdgeTTS] Generated audio file is 0 bytes (empty file)', [
                'output_path' => $tempFile,
                'text_length' => strlen($text),
                'voice' => $voice,
            ]);
            return [
                'success' => false,
                'error' => 'Generated audio file is 0 bytes (empty file). This may indicate a network issue, timeout, or edge-tts service problem.',
            ];
        }
        
        if ($fileSize < $minFileSize) {
            // File is suspiciously small, but not zero - log warning
            Log::warning('[PycoreEdgeTTS] Generated audio file is very small', [
                'output_path' => $tempFile,
                'file_size' => $fileSize,
                'min_expected' => $minFileSize,
                'text_length' => strlen($text),
            ]);
        }

        // Fix permissions automatically (FileSystemManager handles this)
        FileSystemManager::fixPermissions($tempFile);

        $response = [
            'success' => true,
            'voice' => $voice,
        ];

        if ($outputPath) {
            $response['audio_path'] = $outputPath;
        } else {
            $audioData = FileSystemManager::readFile($tempFile);
            $response['audio_base64'] = base64_encode($audioData);
            FileSystemManager::delete($tempFile);
        }

        return $response;
    }

    /**
     * pycore RPC path (default, binary-assist OFF). Delegates synthesis to
     * pycore's tts.synthesize and returns the same shape generate() does:
     * audio_path when $outputPath is given, audio_base64 otherwise. Laravel
     * stays binary-free; pycore's TTS orchestrator does the synthesis.
     */
    private static function generateViaPycore(string $text, string $voice, ?string $outputPath, int $timeout): array
    {
        $language = explode('-', $voice)[0] ?: 'en';

        $response = PycoreHttpClient::call('tts.synthesize', [
            'text' => $text,
            'language' => $language,
            'voice' => $voice,
            'provider' => 'edge',
            'return_base64' => true,
            'async' => false,
            'enable_cache' => true,
        ], min(max($timeout, 35), 120), false);

        if (isset($response['error']) || empty($response['success'])) {
            $error = $response['error'] ?? ($response['message'] ?? 'pycore tts.synthesize failed');
            Log::error('[PycoreEdgeTTS] pycore tts.synthesize failed', [
                'voice' => $voice,
                'error' => $error,
            ]);
            return ['success' => false, 'error' => $error];
        }

        $result = $response['result'] ?? null;
        $audioBase64 = is_array($result) ? ($result['audio_base64'] ?? null) : null;
        if (!is_string($audioBase64) || $audioBase64 === '') {
            $audioBase64 = $response['audio_base64'] ?? null;
        }
        if (!is_string($audioBase64) || $audioBase64 === '') {
            Log::error('[PycoreEdgeTTS] pycore returned no audio_base64', ['voice' => $voice]);
            return ['success' => false, 'error' => 'pycore tts.synthesize returned no audio'];
        }

        $binary = base64_decode($audioBase64, true);
        if ($binary === false || $binary === '' || strlen($binary) < 100) {
            Log::error('[PycoreEdgeTTS] pycore audio payload invalid', ['voice' => $voice]);
            return ['success' => false, 'error' => 'pycore tts.synthesize returned invalid audio'];
        }

        $responseOut = ['success' => true, 'voice' => $voice];
        if ($outputPath) {
            $dir = dirname($outputPath);
            FileSystemManager::ensureDirectoryExists($dir, 0775);
            if (@file_put_contents($outputPath, $binary) === false) {
                Log::error('[PycoreEdgeTTS] failed to write audio', ['output_path' => $outputPath]);
                return ['success' => false, 'error' => 'Failed to write audio file'];
            }
            $responseOut['audio_path'] = $outputPath;
        } else {
            $responseOut['audio_base64'] = base64_encode($binary);
        }

        return $responseOut;
    }

    public static function listVoices(?string $language = null): array
    {
        $command = '/usr/bin/python3 /usr/local/bin/edge-tts --list-voices 2>&1';

        $result = Process::timeout(30)->run($command);

        if (!$result->successful()) {
            return [
                'success' => false,
                'error' => $result->errorOutput() ?: $result->output(),
            ];
        }

        $output = trim($result->output());

        try {
            $voices = json_decode($output, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                return [
                    'success' => false,
                    'error' => 'Invalid JSON response: ' . json_last_error_msg(),
                ];
            }

            if ($language) {
                $voices = array_filter($voices, function($voice) use ($language) {
                    return isset($voice['Locale']) && str_starts_with($voice['Locale'], $language);
                });
            }

            return [
                'success' => true,
                'voices' => array_values($voices),
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'Exception: ' . $e->getMessage(),
            ];
        }
    }
}
