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

use App\Providers\PathMapper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class UploadController
{
    private string $baseDir;

    public function __construct()
    {
        // Use the new external storage system
        $this->baseDir = PathMapper::getUploadPath();
    }

    public function checkExists(Request $request)
    {
        // No controller-level try/catch (LARAVEL_GUIDE: trust the framework
        // exception handler).
        $filename = $request->input('filename');
        $path = $request->input('path', '');
        $size = $request->input('size');

        if (empty($filename)) {
            return response()->json([
                'success' => false,
                'message' => 'Filename is required'
            ], 400);
        }

        // Build the full file path
        $fullPath = $this->baseDir . DIRECTORY_SEPARATOR . trim($path, '/\\') . DIRECTORY_SEPARATOR . $filename;

        if (File::exists($fullPath)) {
            $existingSize = File::size($fullPath);
            return response()->json([
                'success' => true,
                'exists' => true,
                'sameSize' => $existingSize === (int)$size,
                'existingSize' => $existingSize,
                'path' => $path,
                'filename' => $filename
            ]);
        }

        return response()->json([
            'success' => true,
            'exists' => false,
            'path' => $path,
            'filename' => $filename
        ]);
    }

    public function upload(Request $request)
    {
        // No controller-level try/catch (LARAVEL_GUIDE: trust the framework
        // exception handler).
        $files = $request->file('files');  // accept multiple files
        $savePath = $request->input('path', '');
        $forceUpload = $request->input('force', false);

        if (!$files || empty($files)) {
            return response()->json([
                'success' => false,
                'message' => 'No files uploaded'
            ], 400);
        }

        $results = [];
        foreach ($files as $file) {
            // Build the full save path
            $fullSavePath = $this->baseDir . DIRECTORY_SEPARATOR . trim($savePath, '/\\');
            if (!File::exists($fullSavePath)) {
                File::makeDirectory($fullSavePath, 0755, true);
            }

            $originalName = $file->getClientOriginalName();
            $extension = $file->getClientOriginalExtension();
            $fileName = pathinfo($originalName, PATHINFO_FILENAME);
            $fullFilePath = $fullSavePath . DIRECTORY_SEPARATOR . $originalName;

            // Force upload or file already exists -> generate a new filename
            if ($forceUpload || File::exists($fullFilePath)) {
                $counter = 1;
                do {
                    $newFileName = sprintf('%s_%d.%s', $fileName, $counter, $extension);
                    $fullFilePath = $fullSavePath . DIRECTORY_SEPARATOR . $newFileName;
                    $counter++;
                } while (File::exists($fullFilePath));
            }

            // Move the file to its destination
            $file->move(dirname($fullFilePath), basename($fullFilePath));

            $results[] = [
                'originalName' => $originalName,
                'savedAs' => basename($fullFilePath),
                'path' => $savePath,
                'success' => true
            ];
        }

        return response()->json([
            'success' => true,
            'message' => 'Files uploaded successfully',
            'results' => $results
        ]);
    }
} 