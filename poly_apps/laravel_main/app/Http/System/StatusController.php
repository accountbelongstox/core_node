<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Http\System;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

class StatusController extends BaseController
{
    /**
     * Get system status information
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        // No controller-level try/catch (LARAVEL_GUIDE: trust the framework
        // handler). The sub-status helpers below deliberately catch their own
        // infra errors and report them AS DATA (status endpoint contract) —
        // that is feature behaviour, not error swallowing, so it stays.
        $systemInfo = [
            'status' => 'online',
            'timestamp' => now()->toISOString(),
            'server_time' => now()->format('Y-m-d H:i:s'),
            'version' => '1.0.0',
            'environment' => app()->environment(),
            'debug' => config('app.debug'),
            'database' => $this->getDatabaseStatus(),
            'storage' => $this->getStorageStatus(),
            'memory' => $this->getMemoryStatus()
        ];

        return response()->json([
            'success' => true,
            'data' => $systemInfo
        ]);
    }

    /**
     * Get database connection status
     *
     * @return array
     */
    protected function getDatabaseStatus(): array
    {
        try {
            \App\Apps\ClashV1\ClashV1Models\ClashV1ConfigModel::databaseIsAvailable();
            return [
                'status' => 'connected',
                'driver' => config('database.default'),
                'connection' => 'ok'
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'disconnected',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Get storage status
     *
     * @return array
     */
    protected function getStorageStatus(): array
    {
        try {
            $storagePath = storage_path();
            return [
                'status' => is_writable($storagePath) ? 'writable' : 'readonly',
                'path' => $storagePath,
                'free_space' => $this->formatBytes(disk_free_space($storagePath))
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Get memory status
     *
     * @return array
     */
    protected function getMemoryStatus(): array
    {
        return [
            'current_usage' => $this->formatBytes(memory_get_usage(true)),
            'peak_usage' => $this->formatBytes(memory_get_peak_usage(true)),
            'limit' => ini_get('memory_limit')
        ];
    }

    /**
     * Format bytes to human readable format
     *
     * @param int $bytes
     * @return string
     */
    protected function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, 2) . ' ' . $units[$i];
    }
}
