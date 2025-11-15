<?php

use Illuminate\Support\Facades\Route;
use App\Services\OctaneTimerService;
use App\Helpers\PycoreCaller;
use App\Providers\PathMapper;

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
     * Get test timer heartbeat file content
     */
    Route::get('test/heartbeat', function () {
        $tmpDir = PathMapper::getLaravelTmpDir();
        $heartbeatFile = $tmpDir . '/octane_timer_heartbeat.txt';

        if (!file_exists($heartbeatFile)) {
            return response()->json([
                'success' => false,
                'error' => 'Heartbeat file not found - timer may not be running',
                'file_path' => $heartbeatFile,
            ], 404);
        }

        $content = file_get_contents($heartbeatFile);
        $lastModified = filemtime($heartbeatFile);
        $secondsAgo = time() - $lastModified;

        return response()->json([
            'success' => true,
            'file_path' => $heartbeatFile,
            'content' => $content,
            'last_modified' => date('Y-m-d H:i:s', $lastModified),
            'seconds_ago' => $secondsAgo,
            'is_fresh' => $secondsAgo < 3,
        ]);
    });

    /**
     * Get test timer date files
     */
    Route::get('test/date-files', function () {
        $tmpDir = PathMapper::getLaravelTmpDir();
        $files = glob($tmpDir . '/timer_date_*.txt');

        if (empty($files)) {
            return response()->json([
                'success' => false,
                'error' => 'No date files found - timer may not be running',
                'dir' => $tmpDir,
            ], 404);
        }

        // Sort by modification time (newest first)
        usort($files, function($a, $b) {
            return filemtime($b) - filemtime($a);
        });

        $fileList = [];
        foreach ($files as $file) {
            $fileList[] = [
                'name' => basename($file),
                'path' => $file,
                'created' => date('Y-m-d H:i:s', filemtime($file)),
                'seconds_ago' => time() - filemtime($file),
            ];
        }

        return response()->json([
            'success' => true,
            'dir' => $tmpDir,
            'total_files' => count($fileList),
            'files' => $fileList,
        ]);
    });
});
