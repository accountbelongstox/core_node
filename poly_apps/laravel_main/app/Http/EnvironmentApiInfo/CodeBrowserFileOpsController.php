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


namespace App\Http\EnvironmentApiInfo;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

class CodeBrowserFileOpsController
{
    private $baseDirectory;
    private $deleteDirectory;

    public function __construct()
    {
        $this->baseDirectory = PathMapper::getCoreNodeDir();
        $this->deleteDirectory = $this->baseDirectory . DIRECTORY_SEPARATOR . '_delete';

        if ($this->baseDirectory) {
            FileSystemManager::ensureDirectoryExists($this->deleteDirectory);

            $promptsDir = $this->baseDirectory . DIRECTORY_SEPARATOR . '_prompts';
            FileSystemManager::ensureDirectoryExists($promptsDir);
        }
    }

    public function deleteFile(Request $request)
    {
        $relativePath = null;
        $fullPath = null;
        $deleteTargetPath = null;
        $deleteTargetDir = null;

        $relativePath = $request->input('path');

        if (!$relativePath) {
            return response()->json(['error' => 'Path is required'], 400);
        }

        $fullPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $relativePath;

        if (!$this->isPathSafe($fullPath)) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        if (!FileSystemManager::exists($fullPath) || !FileSystemManager::isFile($fullPath)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        $deleteTargetPath = $this->deleteDirectory . DIRECTORY_SEPARATOR . $relativePath;
        $deleteTargetDir = dirname($deleteTargetPath);

        FileSystemManager::ensureDirectoryExists($deleteTargetDir);

        if (FileSystemManager::exists($deleteTargetPath)) {
            FileSystemManager::delete($deleteTargetPath);
        }

        if (!FileSystemManager::rename($fullPath, $deleteTargetPath)) {
            return response()->json(['error' => 'Failed to delete file'], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'File moved to _delete directory',
            'path' => $relativePath
        ]);
    }

    public function restoreFile(Request $request)
    {
        $relativePath = null;
        $deleteSourcePath = null;
        $restoreTargetPath = null;
        $restoreTargetDir = null;

        $relativePath = $request->input('path');

        if (!$relativePath) {
            return response()->json(['error' => 'Path is required'], 400);
        }

        if (strpos($relativePath, '_delete' . DIRECTORY_SEPARATOR) !== 0) {
            return response()->json(['error' => 'Invalid delete path'], 400);
        }

        $deleteSourcePath = $this->baseDirectory . DIRECTORY_SEPARATOR . $relativePath;

        if (!FileSystemManager::exists($deleteSourcePath) || !FileSystemManager::isFile($deleteSourcePath)) {
            return response()->json(['error' => 'File not found in _delete directory'], 404);
        }

        $originalPath = str_replace('_delete' . DIRECTORY_SEPARATOR, '', $relativePath);
        $restoreTargetPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $originalPath;

        if (FileSystemManager::exists($restoreTargetPath)) {
            return response()->json([
                'error' => 'File already exists at target location',
                'exists' => true
            ], 409);
        }

        $restoreTargetDir = dirname($restoreTargetPath);
        FileSystemManager::ensureDirectoryExists($restoreTargetDir);

        if (!FileSystemManager::rename($deleteSourcePath, $restoreTargetPath)) {
            return response()->json(['error' => 'Failed to restore file'], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'File restored successfully',
            'path' => $originalPath
        ]);
    }

    public function renameItem(Request $request)
    {
        $oldPath = null;
        $newName = null;
        $fullOldPath = null;
        $fullNewPath = null;
        $parentDir = null;

        $oldPath = $request->input('path');
        $newName = $request->input('new_name');

        if (!$oldPath || !$newName) {
            return response()->json(['error' => 'Path and new name are required'], 400);
        }

        if ($oldPath === '_delete' || $oldPath === '_prompts') {
            return response()->json(['error' => 'Cannot rename special directories'], 403);
        }

        $fullOldPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $oldPath;

        if (!$this->isPathSafe($fullOldPath)) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        if (!FileSystemManager::exists($fullOldPath)) {
            return response()->json(['error' => 'Item not found'], 404);
        }

        $parentDir = dirname($fullOldPath);
        $fullNewPath = $parentDir . DIRECTORY_SEPARATOR . $newName;

        if (FileSystemManager::exists($fullNewPath)) {
            return response()->json(['error' => 'Item with this name already exists'], 409);
        }

        if (!FileSystemManager::rename($fullOldPath, $fullNewPath)) {
            return response()->json(['error' => 'Failed to rename item'], 500);
        }

        $newRelativePath = str_replace($this->baseDirectory . DIRECTORY_SEPARATOR, '', $fullNewPath);

        return response()->json([
            'success' => true,
            'message' => 'Item renamed successfully',
            'old_path' => $oldPath,
            'new_path' => $newRelativePath
        ]);
    }

    public function getPrompts(Request $request)
    {
        $promptsDir = null;
        $files = null;
        $items = [];

        $promptsDir = $this->baseDirectory . DIRECTORY_SEPARATOR . '_prompts';

        FileSystemManager::ensureDirectoryExists($promptsDir);

        $files = FileSystemManager::scandir($promptsDir);

        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $fullPath = $promptsDir . DIRECTORY_SEPARATOR . $file;

            if (FileSystemManager::isFile($fullPath)) {
                $items[] = [
                    'name' => $file,
                    'path' => '_prompts' . DIRECTORY_SEPARATOR . $file,
                    'modified' => date('Y-m-d H:i:s', FileSystemManager::filemtime($fullPath)),
                    'size' => FileSystemManager::filesize($fullPath)
                ];
            }
        }

        return response()->json([
            'items' => $items
        ]);
    }

    public function createPrompt(Request $request)
    {
        $name = null;
        $promptsDir = null;
        $filePath = null;
        $relativePath = null;
        $processedName = null;
        $words = null;

        $name = $request->input('name');

        if (!$name) {
            return response()->json(['error' => 'Name is required'], 400);
        }

        $processedName = trim($name);
        $processedName = preg_replace('/\s+/', ' ', $processedName);

        $words = explode(' ', $processedName);
        $words = array_map(function($word) {
            return ucfirst(strtolower($word));
        }, $words);
        $processedName = implode(' ', $words);

        if (!preg_match('/\.md$/i', $processedName)) {
            $processedName .= '.md';
        }

        $promptsDir = $this->baseDirectory . DIRECTORY_SEPARATOR . '_prompts';

        FileSystemManager::ensureDirectoryExists($promptsDir);

        $filePath = $promptsDir . DIRECTORY_SEPARATOR . $processedName;

        if (FileSystemManager::exists($filePath)) {
            return response()->json(['error' => 'Prompt already exists'], 409);
        }

        if (!FileSystemManager::writeFile($filePath, '')) {
            return response()->json(['error' => 'Failed to create prompt'], 500);
        }

        $relativePath = '_prompts' . DIRECTORY_SEPARATOR . $processedName;

        return response()->json([
            'success' => true,
            'message' => 'Prompt created successfully',
            'path' => $relativePath,
            'name' => $processedName
        ]);
    }

    public function translatePrompt(Request $request)
    {
        $relativePath = null;
        $fullPath = null;
        $content = null;
        $lines = null;
        $translatedLines = [];
        $hasChanges = false;
        $lastModified = null;
        $currentModified = null;

        $relativePath = $request->input('path');
        $lastModified = $request->input('last_modified');

        if (!$relativePath) {
            return response()->json(['error' => 'Path is required'], 400);
        }

        $fullPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $relativePath;

        if (!$this->isPathSafe($fullPath)) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        if (!FileSystemManager::exists($fullPath) || !FileSystemManager::isFile($fullPath)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        $currentModified = FileSystemManager::filemtime($fullPath);

        if ($lastModified && $currentModified != $lastModified) {
            return response()->json([
                'error' => 'File has been modified',
                'modified' => true
            ], 409);
        }

        $content = FileSystemManager::readFile($fullPath);
        $lines = explode("\n", $content);

        foreach ($lines as $line) {
            if ($this->containsChinese($line)) {
                $translated = $this->translateLine($line);
                if ($translated) {
                    $translatedLines[] = $line;
                    $hasChanges = true;
                } else {
                    $translatedLines[] = $line;
                }
            } else {
                $translatedLines[] = $line;
            }
        }

        if ($hasChanges) {
            $newContent = implode("\n", $translatedLines);
            FileSystemManager::writeFile($fullPath, $newContent);
        }

        return response()->json([
            'success' => true,
            'has_changes' => $hasChanges,
            'modified' => date('Y-m-d H:i:s', FileSystemManager::filemtime($fullPath))
        ]);
    }

    private function containsChinese($text)
    {
        return preg_match('/[\x{4e00}-\x{9fa5}]/u', $text) > 0;
    }

    private function translateLine($line)
    {
        $token = null;
        $response = null;
        $data = null;

        $token = env('TRANSLATION_PASSCODE', '12345678');

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(30)->post(url('/translation/simple/google'), [
                'text' => $line,
                'target_language' => 'en',
                'passcode' => $token
            ]);

            $data = $response->json();

            if ($data['success'] && isset($data['translated_text'])) {
                return $data['translated_text'];
            }

            return null;
        } catch (\Exception $e) {
            return null;
        }
    }

    private function isPathSafe($path)
    {
        $realPath = null;

        $realPath = realpath($path);

        if ($realPath === false) {
            $realPath = realpath(dirname($path));
            if ($realPath === false) {
                return false;
            }
        }

        return strpos($realPath, $this->baseDirectory) === 0;
    }
}
