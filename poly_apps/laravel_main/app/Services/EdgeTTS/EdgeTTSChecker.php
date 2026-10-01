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
        $pythonPath = self::pythonWithEdgeTTS();
        $edgeTTSAvailable = $pythonPath !== null;
        $edgeTTSVersion = $edgeTTSAvailable ? self::getEdgeTTSVersion($pythonPath) : null;

        return [
            'available' => $edgeTTSAvailable,
            'python_path' => $pythonPath,
            'edge_tts_version' => $edgeTTSVersion,
            'checked_at' => now()->toDateTimeString(),
        ];
    }

    private static function checkEdgeTTS(): bool
    {
        return self::pythonWithEdgeTTS() !== null;
    }

    /**
     * The first Python interpreter on PATH that can run `python -m edge_tts`
     * (Windows: `where`, POSIX: `command -v`), or null.
     */
    public static function pythonWithEdgeTTS(): ?string
    {
        $isWindows = PHP_OS_FAMILY === 'Windows';
        $candidates = $isWindows ? ['python', 'python3'] : ['python3', 'python'];
        $probe = null;
        $path = '';

        foreach ($candidates as $command) {
            $probe = Process::run(($isWindows ? 'where ' : 'command -v ') . escapeshellarg($command));
            if (!$probe->successful()) {
                continue;
            }
            $path = trim(explode("\n", str_replace("\r", '', $probe->output()))[0] ?? '');
            if ($path !== '' && Process::run(escapeshellarg($path) . ' -m edge_tts --help')->successful()) {
                return $path;
            }
        }

        return null;
    }

    /**
     * Get edge-tts version
     */
    private static function getEdgeTTSVersion(string $pythonPath): ?string
    {
        $result = Process::run(escapeshellarg($pythonPath) . ' -m edge_tts --version');
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
