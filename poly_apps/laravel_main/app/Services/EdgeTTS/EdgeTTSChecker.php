<?php

namespace App\Services\EdgeTTS;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;

class EdgeTTSChecker
{
    private const CACHE_KEY = 'edge_tts_availability';
    private const CACHE_TTL = 300; // 5 minutes

    /**
     * Check if edge-tts is available on the system
     */
    public static function isAvailable(): bool
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return self::checkEdgeTTS();
        });
    }

    /**
     * Force check without cache
     */
    public static function checkNow(): bool
    {
        Cache::forget(self::CACHE_KEY);
        return self::isAvailable();
    }

    /**
     * Get detailed status information
     */
    public static function getStatus(): array
    {
        $pythonPath = self::findPythonPath();
        $edgeTTSAvailable = false;
        $edgeTTSVersion = null;

        if ($pythonPath) {
            $edgeTTSAvailable = self::checkEdgeTTSInstalled($pythonPath);
            if ($edgeTTSAvailable) {
                $edgeTTSVersion = self::getEdgeTTSVersion($pythonPath);
            }
        }

        return [
            'available' => $edgeTTSAvailable,
            'python_path' => $pythonPath,
            'edge_tts_version' => $edgeTTSVersion,
            'checked_at' => now()->toDateTimeString(),
        ];
    }

    /**
     * Perform the actual edge-tts check
     */
    private static function checkEdgeTTS(): bool
    {
        $pythonPath = self::findPythonPath();
        if (!$pythonPath) {
            return false;
        }

        return self::checkEdgeTTSInstalled($pythonPath);
    }

    /**
     * Find Python executable path
     */
    private static function findPythonPath(): ?string
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

    /**
     * Check if edge-tts module is installed
     */
    private static function checkEdgeTTSInstalled(string $pythonPath): bool
    {
        $result = Process::run("{$pythonPath} -m edge_tts --help 2>/dev/null");
        return $result->successful();
    }

    /**
     * Get edge-tts version
     */
    private static function getEdgeTTSVersion(string $pythonPath): ?string
    {
        $result = Process::run("{$pythonPath} -m edge_tts --version 2>&1");
        if ($result->successful()) {
            return trim($result->output());
        }
        return null;
    }

    /**
     * Get installation instructions
     */
    public static function getInstallInstructions(): string
    {
        return "To install edge-tts, run:\n" .
               "pip install edge-tts\n" .
               "or\n" .
               "pip3 install edge-tts";
    }
}
