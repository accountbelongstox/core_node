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

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class FileController
{
    public function getContent(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'path' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid path'], 400);
        }

        $path = $request->input('path');

        // Security check: ensure the path is within the allowed scope
        if (!$this->isPathAllowed($path)) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        try {
            $content = Storage::get($path);
            return response($content)->header('Content-Type', 'text/plain');
        } catch (\Exception $e) {
            return response()->json(['error' => 'File not found'], 404);
        }
    }

    public function saveContent(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'path' => 'required|string',
            'content' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid input'], 400);
        }

        $path = $request->input('path');
        $content = $request->input('content');

        // Security check: ensure the path is within the allowed scope
        if (!$this->isPathAllowed($path)) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        try {
            Storage::put($path, $content);
            return response()->json(['message' => 'File saved successfully']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to save file'], 500);
        }
    }

    private function isPathAllowed($path)
    {
        // Implement path security check logic
        // For example: verify the path is inside an allowed directory and does not contain dangerous path traversal, etc.

        // Disallow access to the .env file
        if (basename($path) === '.env') {
            return false;
        }

        // Disallow path traversal
        if (str_contains($path, '..')) {
            return false;
        }

        // Only allow access to specific directories
        $allowedPaths = [
            'resources/js',
            'resources/css',
            'resources/views',
            'app',
            'config',
            'routes',
            'tests'
        ];

        foreach ($allowedPaths as $allowedPath) {
            if (str_starts_with($path, $allowedPath)) {
                return true;
            }
        }

        return false;
    }
} 