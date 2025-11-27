<?php

namespace App\Utils;

use Illuminate\Support\Facades\Log;

class StartupLogger
{
    private static $startupLogFile = '/tmp/laravel_startup.log';
    private static $startTime = null;

    public static function init()
    {
        self::$startTime = microtime(true);
        self::clearLog();
        self::log('INIT', 'Startup logging initialized');
    }

    public static function log($stage, $message, $data = [])
    {
        $elapsed = self::$startTime ? round((microtime(true) - self::$startTime) * 1000, 2) : 0;

        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s.u'),
            'elapsed_ms' => $elapsed,
            'stage' => $stage,
            'message' => $message,
            'data' => $data,
            'memory_mb' => round(memory_get_usage(true) / 1024 / 1024, 2)
        ];

        $logLine = json_encode($logEntry, JSON_UNESCAPED_UNICODE) . PHP_EOL;

        try {
            if (!file_exists(self::$startupLogFile)) {
                touch(self::$startupLogFile);
                chmod(self::$startupLogFile, 0666);
            }

            file_put_contents(self::$startupLogFile, $logLine, FILE_APPEND | LOCK_EX);
        } catch (\Exception $e) {
        }

        Log::channel('single')->info("[STARTUP] {$stage}: {$message}", $data);
    }

    public static function checkpoint($stage, $message = '')
    {
        self::log($stage, $message ?: "Checkpoint: {$stage}");
    }

    public static function error($stage, $message, $exception = null)
    {
        $data = [];
        if ($exception) {
            $data = [
                'exception' => get_class($exception),
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => $exception->getTraceAsString()
            ];
        }

        self::log($stage . '_ERROR', $message, $data);
        Log::channel('single')->error("[STARTUP ERROR] {$stage}: {$message}", $data);
    }

    public static function clearLog()
    {
        try {
            file_put_contents(self::$startupLogFile, '');
            chmod(self::$startupLogFile, 0666);
        } catch (\Exception $e) {
        }
    }

    public static function getLogContents()
    {
        if (!file_exists(self::$startupLogFile)) {
            return [];
        }

        $lines = file(self::$startupLogFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        return array_map(function($line) {
            return json_decode($line, true);
        }, $lines);
    }

    public static function getLogPath()
    {
        return self::$startupLogFile;
    }
}
