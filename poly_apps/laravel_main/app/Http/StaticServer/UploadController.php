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
        try {
            $filename = $request->input('filename');
            $path = $request->input('path', '');
            $size = $request->input('size');

            if (empty($filename)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Filename is required'
                ], 400);
            }

            // 构建完整的文件路径
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

        } catch (\Exception $e) {
            Log::error('Check file exists failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Check failed: ' . $e->getMessage()
            ], 500);
        }
    }

    public function upload(Request $request)
    {
        try {
            $files = $request->file('files');  // 改为接收多个文件
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
                // 构建完整的保存路径
                $fullSavePath = $this->baseDir . DIRECTORY_SEPARATOR . trim($savePath, '/\\');
                if (!File::exists($fullSavePath)) {
                    File::makeDirectory($fullSavePath, 0755, true);
                }

                $originalName = $file->getClientOriginalName();
                $extension = $file->getClientOriginalExtension();
                $fileName = pathinfo($originalName, PATHINFO_FILENAME);
                $fullFilePath = $fullSavePath . DIRECTORY_SEPARATOR . $originalName;

                // 如果强制上传或文件已存在，生成新的文件名
                if ($forceUpload || File::exists($fullFilePath)) {
                    $counter = 1;
                    do {
                        $newFileName = sprintf('%s_%d.%s', $fileName, $counter, $extension);
                        $fullFilePath = $fullSavePath . DIRECTORY_SEPARATOR . $newFileName;
                        $counter++;
                    } while (File::exists($fullFilePath));
                }

                // 移动文件到目标位置
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

        } catch (\Exception $e) {
            Log::error('Upload failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Upload failed: ' . $e->getMessage()
            ], 500);
        }
    }
} 