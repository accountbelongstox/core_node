<?php

use Illuminate\Support\Facades\Route;
use App\Services\OctaneTimerService;
use App\Helpers\PycoreCaller;

/**
 * Octane Timer Status API Routes
 */
Route::prefix('octane/timer')->group(function () {

    /**
     * Get timer service status
     */
    Route::get('status', function () {
        return response()->json([
            'success' => true,
            'data' => OctaneTimerService::getStatus(),
        ]);
    });

    /**
     * Get task statistics
     */
    Route::get('tasks', function () {
        return response()->json([
            'success' => true,
            'data' => OctaneTimerService::getTaskStats(),
        ]);
    });

    /**
     * Get Pycore caller diagnostics
     */
    Route::get('pycore/diagnostics', function () {
        return response()->json([
            'success' => true,
            'data' => PycoreCaller::getDiagnostics(),
        ]);
    });

    /**
     * Force refresh Pycore service URL
     */
    Route::post('pycore/refresh', function () {
        PycoreCaller::refreshServiceUrl();

        return response()->json([
            'success' => true,
            'message' => 'Pycore service URL refreshed',
            'data' => PycoreCaller::getDiagnostics(),
        ]);
    });

    /**
     * Reset timer statistics
     */
    Route::post('reset-stats', function () {
        OctaneTimerService::resetStats();

        return response()->json([
            'success' => true,
            'message' => 'Timer statistics reset',
        ]);
    });

    /**
     * Get timer heartbeat status. Sourced from OctaneTimerService's own
     * cross-process heartbeat (the last_alive tick stamp) -- NOT a separate
     * *.txt file. That older diagnostic file was never written by anything in
     * this codebase (dead since before this route's introduction); this now
     * reports the SAME real signal OctaneTaskStatusService::getHeartbeatStatus()
     * uses, so this route can never disagree with the main status endpoint.
     */
    Route::get('test/heartbeat', function () {
        $status = OctaneTimerService::getStatus();
        $lastAlive = $status['last_alive'] ?? null;

        if ($lastAlive === null) {
            return response()->json([
                'success' => false,
                'error' => 'No timer heartbeat recorded yet (timer never ticked)',
            ], 404);
        }

        $secondsAgo = time() - $lastAlive;
        $isFresh = (bool) ($status['running'] ?? false);

        return response()->json([
            'success' => true,
            'last_modified' => date('Y-m-d H:i:s', $lastAlive),
            'seconds_ago' => $secondsAgo,
            'is_fresh' => $isFresh,
        ]);
    });

    /**
     * Per-task last-run diagnostics. Sourced from OctaneTimerService's own
     * task stats (last_run per registered task) -- NOT the older separate
     * timer_date_*.txt files, which nothing in this codebase has ever written.
     */
    Route::get('test/date-files', function () {
        $tasks = OctaneTimerService::getTaskStats();
        $files = array_values(array_filter(array_map(
            static function (array $stats, string $name) {
                if (($stats['last_run'] ?? 0) <= 0) {
                    return null;
                }
                return [
                    'name' => $name,
                    'last_run' => date('Y-m-d H:i:s', $stats['last_run']),
                    'seconds_ago' => $stats['last_run_ago'] ?? null,
                ];
            },
            $tasks,
            array_keys($tasks)
        )));

        if (empty($files)) {
            return response()->json([
                'success' => false,
                'error' => 'No task has ticked yet',
            ], 404);
        }

        // Most recently run first.
        usort($files, static fn (array $a, array $b) => strcmp($b['last_run'], $a['last_run']));

        return response()->json([
            'success' => true,
            'total_files' => count($files),
            'files' => $files,
        ]);
    });
});
