<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\StaticServer;

use App\Services\BackupService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class FileBackupController
{
    private BackupService $backupService;
    private string $baseDir;
    private string $staticFilesDir;

    public function __construct(BackupService $backupService)
    {
        $this->backupService = $backupService;

        $this->staticFilesDir = PHP_OS === 'WINNT'  
            ? env('STATIC_FILES_PATH_WINDOWS') 
            : env('STATIC_FILES_PATH_LINUX');

        $this->baseDir = $this->staticFilesDir . DIRECTORY_SEPARATOR . '.tmp';
    }

    /**
     * Create a backup for the specified file and return all available backups
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function listBackups(Request $request): JsonResponse
    {
        try {
            $filePath = $request->query('path');

            if (empty($filePath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File path is required',
                    'path' => '',
                    'content' => '',
                    'backups' => []
                ], 400);
            }

            // Get file content
            $fullPath = $this->baseDir . DIRECTORY_SEPARATOR . $filePath;
            if (!File::exists($fullPath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found',
                    'path' => $filePath,
                    'content' => '',
                    'backups' => []
                ], 404);
            }

            $content = File::get($fullPath);

            // Create backup
            $backupCreated = $this->backupService->backup($filePath);

            if (!$backupCreated) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to create backup. File might not exist.',
                    'path' => $filePath,
                    'content' => $content,
                    'backups' => []
                ], 404);
            }

            // Get all available backups
            $backups = $this->backupService->getBackups($filePath);

            // Convert backup paths to relative paths
            $backups = array_map(function($backup) {
                $backup['path'] = $this->getRelativePath($backup['path']);
                return $backup;
            }, $backups);

            return response()->json([
                'success' => true,
                'message' => 'Backup created successfully',
                'path' => $filePath,
                'content' => $content,
                'backups' => $backups
            ]);

        } catch (\Exception $e) {
            Log::error('Backup operation failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'path' => $filePath ?? '',
                'content' => '',
                'backups' => []
            ], 500);
        }
    }

    /**
     * Convert absolute path to relative path
     *
     * @param string $path
     * @return string
     */
    private function getRelativePath(string $path): string
    {
        return trim(str_replace([$this->baseDir, '\\'], ['', '/'], $path), '/');
    }

    /**
     * Open file in editor with backup comparison options
     *
     * @param Request $request
     * @return \Illuminate\View\View
     */
    public function openInEditor(Request $request)
    {
        $filePath = $request->query('path');
        $backupPath = $request->query('backup_path');

        if ($backupPath) {
            // If backup path is provided, open diff editor
            return view('editor.diff', [
                'originalPath' => $backupPath,
                'modifiedPath' => $filePath
            ]);
        }

        // Get backups for the dropdown
        $backups = $this->backupService->getBackups($filePath);

        return view('editor.single', [
            'filePath' => $filePath,
            'backups' => $backups
        ]);
    }

    /**
     * Get file content for editor
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getFileContent(Request $request): JsonResponse
    {
        try {
            $filePath = $request->query('path');
            $fullPath = $this->baseDir . DIRECTORY_SEPARATOR . $filePath;

            if (!File::exists($fullPath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found'
                ], 404);
            }

            $content = File::get($fullPath);
            return response()->json([
                'success' => true,
                'content' => $content
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get file content: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Save file content and create backup
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function saveFileContent(Request $request): JsonResponse
    {
        try {
            $filePath = $request->input('path');
            $content = $request->input('content');

            if (empty($filePath) || !isset($content)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File path and content are required'
                ], 400);
            }

            // Create backup before saving
            $this->backupService->backup($filePath);

            // Save new content
            $fullPath = $this->baseDir . DIRECTORY_SEPARATOR . $filePath;
            File::put($fullPath, $content);

            return response()->json([
                'success' => true,
                'message' => 'File saved successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to save file: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
} 