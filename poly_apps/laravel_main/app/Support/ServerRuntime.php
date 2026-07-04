<?php

namespace App\Support;

/**
 * Runtime detection for the process serving the request.
 *
 * The native-Windows deployment runs `php artisan serve` -> PHP's built-in
 * server (`php -S`), whose SAPI is `cli-server`. That server handles EXACTLY
 * ONE request at a time: it cannot fork, and PHP_CLI_SERVER_WORKERS is a
 * POSIX-only knob ignored on Windows. Laravel Octane (concurrent workers) is
 * unavailable there because it needs the pcntl extension.
 *
 * On such a single-worker runtime any request that BLOCKS (worker long-poll,
 * SSE stream) or runs a slow query serializes ahead of every other request —
 * including the DB-free /api/health — so those held-request transports must be
 * disabled/shortened here. Callers gate that behaviour on isSingleWorker().
 */
class ServerRuntime
{
    /**
     * True when served by PHP's single-worker built-in dev server (php -S).
     *
     * Returns false under fpm / Octane(Swoole|RoadRunner) / Apache, where real
     * request concurrency exists and held-request transports are safe.
     */
    public static function isSingleWorker(): bool
    {
        if (PHP_SAPI !== 'cli-server') {
            return false;
        }
        // PHP_CLI_SERVER_WORKERS only forks extra workers on POSIX; treat any
        // value > 1 as multi-worker, otherwise the built-in server is single.
        $workers = (int) getenv('PHP_CLI_SERVER_WORKERS');
        return $workers <= 1;
    }
}
