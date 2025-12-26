<?php

namespace App\CallPycoreUtils;

use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Log;
use App\Utils\FileSystemManager;

class PycoreEdgeTTSUtil
{
    public static function generate(
        string $text,
        string $voice = 'en-US-AriaNeural',
        ?string $outputPath = null,
        int $timeout = 300
    ): array {
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
