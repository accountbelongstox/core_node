<?php

namespace App\CallPycoreUtils;

use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Log;

class PycoreGoogleTranslateUtil
{
    private static $pycoreRoot;
    private static $pythonPath;

    private static function initPaths()
    {
        if (self::$pycoreRoot === null) {
            $currentDir = __DIR__;
            self::$pycoreRoot = dirname(dirname(dirname($currentDir))) . '/pycore';
        }

        if (self::$pythonPath === null) {
            self::$pythonPath = self::findPythonPath();
        }
    }

    private static function findPythonPath(): string
    {
        $pythonCommands = ['python3', 'python'];

        foreach ($pythonCommands as $cmd) {
            $result = Process::run("which {$cmd} 2>/dev/null");
            if ($result->successful()) {
                return trim($result->output());
            }
        }

        return 'python3';
    }

    public static function translateSingle(
        string $text,
        string $sourceLang = 'auto',
        string $targetLang = 'en',
        bool $useCache = true
    ): array {
        self::initPaths();

        $input = [
            'action' => 'translate_single',
            'text' => $text,
            'src' => $sourceLang,
            'dest' => $targetLang,
            'use_cache' => $useCache,
        ];

        return self::executePythonTranslate($input);
    }

    public static function translateBatch(
        array $texts,
        string $sourceLang = 'auto',
        string $targetLang = 'en',
        bool $useCache = true
    ): array {
        self::initPaths();

        $input = [
            'action' => 'translate_batch',
            'texts' => $texts,
            'src' => $sourceLang,
            'dest' => $targetLang,
            'use_cache' => $useCache,
        ];

        return self::executePythonTranslate($input);
    }

    public static function detectLanguage(string $text): array
    {
        self::initPaths();

        $input = [
            'action' => 'detect_language',
            'text' => $text,
        ];

        return self::executePythonTranslate($input);
    }

    private static function executePythonTranslate(array $input): array
    {
        $inputJson = json_encode($input, JSON_UNESCAPED_UNICODE);

        $command = sprintf(
            'cd %s && PYTHONPATH=%s %s -m pyutils.translator.__main__ %s 2>&1',
            escapeshellarg(self::$pycoreRoot),
            escapeshellarg(self::$pycoreRoot),
            self::$pythonPath,
            escapeshellarg($inputJson)
        );

        Log::info('[PycoreGoogleTranslate] Executing command', [
            'input' => $input,
        ]);

        $result = Process::timeout(300)->run($command);

        if (!$result->successful()) {
            $errorMsg = $result->errorOutput() ?: $result->output();
            Log::error('[PycoreGoogleTranslate] Execution failed', [
                'exit_code' => $result->exitCode(),
                'error' => $errorMsg,
            ]);

            return [
                'success' => false,
                'error' => $errorMsg,
                'exit_code' => $result->exitCode(),
            ];
        }

        $output = trim($result->output());

        try {
            $decoded = json_decode($output, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::error('[PycoreGoogleTranslate] Invalid JSON response', [
                    'output' => $output,
                    'error' => json_last_error_msg(),
                ]);

                return [
                    'success' => false,
                    'error' => 'Invalid JSON response: ' . json_last_error_msg(),
                ];
            }

            return array_merge(['success' => true], $decoded);

        } catch (\Exception $e) {
            Log::error('[PycoreGoogleTranslate] Exception parsing response', [
                'exception' => $e->getMessage(),
                'output' => $output,
            ]);

            return [
                'success' => false,
                'error' => 'Exception: ' . $e->getMessage(),
            ];
        }
    }

    public static function clearCache(string $sourceLang = null, string $targetLang = null): array
    {
        self::initPaths();

        $input = [
            'action' => 'clear_cache',
            'src_lang' => $sourceLang,
            'dest_lang' => $targetLang,
        ];

        return self::executePythonTranslate($input);
    }
}
