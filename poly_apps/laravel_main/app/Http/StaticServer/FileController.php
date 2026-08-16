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

use App\Http\Controllers\Controller;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class FileController extends Controller
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