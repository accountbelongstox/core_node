<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\StaticServer;

use App\Services\DownloadManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DownloadController
{
    private $downloadManager;

    public function __construct(DownloadManager $downloadManager)
    {
        $this->downloadManager = $downloadManager;
    }

    public function create(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'urls' => 'required|array',
            'urls.*' => 'required|url',
            'save_path' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // No controller-level try/catch (LARAVEL_GUIDE: trust the framework
        // exception handler). Input is validated above.
        $tasks = [];
        foreach ($request->input('urls') as $url) {
            $task = $this->downloadManager->createTask(
                $url,
                $request->input('save_path')
            );
            $tasks[] = [
                'id' => $task->id,
                'url' => $task->url,
                'filename' => $task->filename,
                'status' => $task->status
            ];
        }

        return response()->json([
            'success' => true,
            'tasks' => $tasks
        ]);
    }

    public function status($taskId)
    {
        $status = $this->downloadManager->getTaskStatus($taskId);
        
        if (!$status) {
            return response()->json([
                'success' => false,
                'error' => 'Task not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'status' => $status
        ]);
    }

    public function list()
    {
        $tasks = \App\Models\DownloadTask::orderBy('created_at', 'desc')
            ->get()
            ->map(function($task) {
                return [
                    'id' => $task->id,
                    'url' => $task->url,
                    'filename' => $task->filename,
                    'status' => $task->status,
                    'progress' => $task->progress,
                    'total_size' => $task->total_size,
                    'downloaded_size' => $task->downloaded_size,
                    'created_at' => $task->created_at->format('Y-m-d H:i:s')
                ];
            });

        return response()->json([
            'success' => true,
            'tasks' => $tasks
        ]);
    }
} 