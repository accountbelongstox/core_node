<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use Illuminate\Support\Facades\Cache;

/**
 * TTS Queue Performance Metrics Tracker
 *
 * Tracks in-memory statistics for TTS processing:
 * - Average processing time per type
 * - Total processed count
 * - Total runtime
 */
class AppQyV1TTSQueueMetrics
{
    private const CACHE_KEY_PREFIX = 'appqyv1_tts_metrics:';
    private const CACHE_TTL = 86400; // 24 hours

    /**
     * Record processing time for a task
     */
    public static function recordProcessingTime(string $taskType, float $processingTimeMs): void
    {
        $cacheKey = self::CACHE_KEY_PREFIX . $taskType;

        $metrics = Cache::get($cacheKey, [
            'count' => 0,
            'total_time_ms' => 0,
            'avg_time_ms' => 0,
        ]);

        $metrics['count']++;
        $metrics['total_time_ms'] += $processingTimeMs;
        $metrics['avg_time_ms'] = $metrics['total_time_ms'] / $metrics['count'];

        Cache::put($cacheKey, $metrics, self::CACHE_TTL);

        // Also update global stats
        self::incrementTotalProcessed();
    }

    /**
     * Increment total processed count
     */
    private static function incrementTotalProcessed(): void
    {
        $cacheKey = self::CACHE_KEY_PREFIX . 'global';

        $global = Cache::get($cacheKey, [
            'total_processed' => 0,
            'start_time' => microtime(true),
        ]);

        $global['total_processed']++;

        Cache::put($cacheKey, $global, self::CACHE_TTL);
    }

    /**
     * Get all metrics
     */
    public static function getMetrics(): array
    {
        $wordMetrics = Cache::get(self::CACHE_KEY_PREFIX . 'word', [
            'count' => 0,
            'total_time_ms' => 0,
            'avg_time_ms' => 0,
        ]);

        $sentenceMetrics = Cache::get(self::CACHE_KEY_PREFIX . 'sentence', [
            'count' => 0,
            'total_time_ms' => 0,
            'avg_time_ms' => 0,
        ]);

        $articleMetrics = Cache::get(self::CACHE_KEY_PREFIX . 'article', [
            'count' => 0,
            'total_time_ms' => 0,
            'avg_time_ms' => 0,
        ]);

        $global = Cache::get(self::CACHE_KEY_PREFIX . 'global', [
            'total_processed' => 0,
            'start_time' => microtime(true),
        ]);

        $totalRuntimeSeconds = microtime(true) - $global['start_time'];

        return [
            'word' => [
                'processed_count' => $wordMetrics['count'],
                'avg_processing_time_ms' => round($wordMetrics['avg_time_ms'], 2),
                'total_processing_time_ms' => round($wordMetrics['total_time_ms'], 2),
            ],
            'sentence' => [
                'processed_count' => $sentenceMetrics['count'],
                'avg_processing_time_ms' => round($sentenceMetrics['avg_time_ms'], 2),
                'total_processing_time_ms' => round($sentenceMetrics['total_time_ms'], 2),
            ],
            'article' => [
                'processed_count' => $articleMetrics['count'],
                'avg_processing_time_ms' => round($articleMetrics['avg_time_ms'], 2),
                'total_processing_time_ms' => round($articleMetrics['total_time_ms'], 2),
            ],
            'global' => [
                'total_processed' => $global['total_processed'],
                'total_runtime_seconds' => round($totalRuntimeSeconds, 2),
                'total_runtime_formatted' => self::formatDuration($totalRuntimeSeconds),
            ],
        ];
    }

    /**
     * Reset all metrics
     */
    public static function reset(): void
    {
        Cache::forget(self::CACHE_KEY_PREFIX . 'word');
        Cache::forget(self::CACHE_KEY_PREFIX . 'sentence');
        Cache::forget(self::CACHE_KEY_PREFIX . 'article');
        Cache::put(self::CACHE_KEY_PREFIX . 'global', [
            'total_processed' => 0,
            'start_time' => microtime(true),
        ], self::CACHE_TTL);
    }

    /**
     * Format duration in human-readable format
     */
    private static function formatDuration(float $seconds): string
    {
        if ($seconds < 60) {
            return round($seconds, 1) . 's';
        }

        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;

        if ($minutes < 60) {
            return $minutes . 'm ' . round($remainingSeconds) . 's';
        }

        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;

        if ($hours < 24) {
            return $hours . 'h ' . $remainingMinutes . 'm';
        }

        $days = floor($hours / 24);
        $remainingHours = $hours % 24;

        return $days . 'd ' . $remainingHours . 'h';
    }

    /**
     * Initialize global metrics if not exists
     */
    public static function initialize(): void
    {
        $cacheKey = self::CACHE_KEY_PREFIX . 'global';

        if (!Cache::has($cacheKey)) {
            Cache::put($cacheKey, [
                'total_processed' => 0,
                'start_time' => microtime(true),
            ], self::CACHE_TTL);
        }
    }
}
