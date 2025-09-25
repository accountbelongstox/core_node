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
        
        // 安全检查：确保路径在允许的范围内
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

        // 安全检查：确保路径在允许的范围内
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
        // 实现路径安全检查逻辑
        // 例如：检查路径是否在允许的目录内，是否包含危险的路径遍历等
        
        // 禁止访问 .env 文件
        if (basename($path) === '.env') {
            return false;
        }

        // 禁止路径遍历
        if (str_contains($path, '..')) {
            return false;
        }

        // 只允许访问特定目录
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