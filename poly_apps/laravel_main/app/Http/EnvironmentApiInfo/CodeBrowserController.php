<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\EnvironmentApiInfo;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Auth;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

class CodeBrowserController
{
    private $baseDirectory;
    private $allowedExtensions;
    private $excludedDirectories;

    public function __construct()
    {
        $this->baseDirectory = PathMapper::getCoreNodeDir();

        $this->allowedExtensions = [
            'php', 'js', 'py', 'html', 'css', 'json', 'md', 'txt',
            'yaml', 'yml', 'xml', 'sh', 'env', 'sql', 'vue', 'ts'
        ];
        $this->excludedDirectories = [
            'node_modules', 'vendor', '.git', '__pycache__',
            '.idea', '.vscode', 'cache', 'logs'
        ];

        if ($this->baseDirectory) {
            $promptsDir = $this->baseDirectory . DIRECTORY_SEPARATOR . '_prompts';
            FileSystemManager::ensureDirectoryExists($promptsDir);

            $deleteDir = $this->baseDirectory . DIRECTORY_SEPARATOR . '_delete';
            FileSystemManager::ensureDirectoryExists($deleteDir);
        }
    }

    public function checkAuth(Request $request)
    {
        $userToken = $request->header('Auth-User-Token');
        $authToken = $request->bearerToken();

        if ($userToken || $authToken || Auth::check()) {
            return response()->json([
                'authenticated' => true,
                'message' => 'User is authenticated',
                'base_directory' => $this->baseDirectory,
                'base_directory_exists' => $this->baseDirectory && FileSystemManager::exists($this->baseDirectory)
            ]);
        }

        return response()->json([
            'authenticated' => false,
            'message' => 'Please login to access code browser'
        ], 401);
    }

    public function getFileTree(Request $request)
    {
        $path = null;
        $fullPath = null;

        if (!$this->baseDirectory || !FileSystemManager::exists($this->baseDirectory)) {
            return response()->json([
                'error' => 'Core Node directory not found',
                'debug' => [
                    'base_directory' => $this->baseDirectory,
                    'exists' => $this->baseDirectory ? FileSystemManager::exists($this->baseDirectory) : false
                ]
            ], 404);
        }

        $path = $request->input('path', '');
        $fullPath = $this->baseDirectory . ($path ? DIRECTORY_SEPARATOR . $path : '');

        if (!$this->isPathSafe($fullPath)) {
            return response()->json([
                'error' => 'Access denied'
            ], 403);
        }

        if (!FileSystemManager::exists($fullPath) || !FileSystemManager::isDir($fullPath)) {
            return response()->json([
                'error' => 'Directory not found'
            ], 404);
        }

        $items = $this->scanDirectory($fullPath, $path);

        return response()->json([
            'items' => $items,
            'path' => $path ?: 'ncore'
        ]);
    }

    public function readFile(Request $request)
    {
        $relativePath = null;
        $fullPath = null;
        $extension = null;
        $content = null;

        $relativePath = $request->input('path');

        if (!$relativePath) {
            return response()->json([
                'error' => 'Path is required'
            ], 400);
        }

        $fullPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $relativePath;

        if (!$this->isPathSafe($fullPath)) {
            return response()->json([
                'error' => 'Access denied'
            ], 403);
        }

        if (!FileSystemManager::exists($fullPath) || !FileSystemManager::isFile($fullPath)) {
            return response()->json([
                'error' => 'File not found'
            ], 404);
        }

        $extension = pathinfo($fullPath, PATHINFO_EXTENSION);
        $isPromptFile = strpos($relativePath, '_prompts' . DIRECTORY_SEPARATOR) === 0;

        if (!$isPromptFile && !in_array($extension, $this->allowedExtensions)) {
            return response()->json([
                'error' => 'File type not allowed'
            ], 403);
        }

        $content = FileSystemManager::readFile($fullPath);

        return response()->json([
            'content' => $content,
            'path' => $relativePath,
            'extension' => $extension,
            'size' => FileSystemManager::filesize($fullPath),
            'modified' => date('Y-m-d H:i:s', FileSystemManager::filemtime($fullPath))
        ]);
    }

    public function saveFile(Request $request)
    {
        $relativePath = null;
        $content = null;
        $fullPath = null;
        $extension = null;
        $backupFilename = null;

        $relativePath = $request->input('path');
        $content = $request->input('content');
        $skipBackup = $request->input('skip_backup', false);
        $cleanupOldBackups = $request->input('cleanup_old_backups', false);

        if (!$relativePath || $content === null) {
            return response()->json([
                'error' => 'Path and content are required'
            ], 400);
        }

        $fullPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $relativePath;

        if (!$this->isPathSafe($fullPath)) {
            return response()->json([
                'error' => 'Access denied'
            ], 403);
        }

        if (!FileSystemManager::exists($fullPath) || !FileSystemManager::isFile($fullPath)) {
            return response()->json([
                'error' => 'File not found'
            ], 404);
        }

        $extension = pathinfo($fullPath, PATHINFO_EXTENSION);
        $isPromptFile = strpos($relativePath, '_prompts' . DIRECTORY_SEPARATOR) === 0;

        if (!$isPromptFile && !in_array($extension, $this->allowedExtensions)) {
            return response()->json([
                'error' => 'File type not allowed'
            ], 403);
        }

        if (!FileSystemManager::isWritable($fullPath)) {
            return response()->json([
                'error' => 'File is not writable'
            ], 403);
        }

        if (!$skipBackup) {
            $backup = $fullPath . '.bak.' . date('YmdHis');
            FileSystemManager::copy($fullPath, $backup);
            $backupFilename = basename($backup);
        }

        if ($cleanupOldBackups) {
            $this->cleanupOldBackups($fullPath);
        }

        if (!FileSystemManager::writeFile($fullPath, $content)) {
            return response()->json([
                'error' => 'Failed to save file'
            ], 500);
        }

        $response = [
            'success' => true,
            'message' => 'File saved successfully',
            'path' => $relativePath,
            'modified' => date('Y-m-d H:i:s', FileSystemManager::filemtime($fullPath))
        ];

        if ($backupFilename) {
            $response['backup'] = $backupFilename;
        }

        return response()->json($response);
    }

    private function cleanupOldBackups($filePath)
    {
        $directory = dirname($filePath);
        $filename = basename($filePath);
        $pattern = $filename . '.bak.*';

        $backups = [];
        $entries = FileSystemManager::scandir($directory);

        foreach ($entries as $entry) {
            if (fnmatch($pattern, $entry)) {
                $backupPath = $directory . DIRECTORY_SEPARATOR . $entry;
                if (FileSystemManager::isFile($backupPath)) {
                    $backups[] = [
                        'path' => $backupPath,
                        'mtime' => FileSystemManager::filemtime($backupPath)
                    ];
                }
            }
        }

        usort($backups, function($a, $b) {
            return $b['mtime'] - $a['mtime'];
        });

        $keepCount = 3;
        for ($i = $keepCount; $i < count($backups); $i++) {
            FileSystemManager::delete($backups[$i]['path']);
        }
    }

    private function isPathSafe($path)
    {
        $realPath = realpath($path);

        if ($realPath === false) {
            $realPath = realpath(dirname($path));
            if ($realPath === false) {
                return false;
            }
        }

        return strpos($realPath, $this->baseDirectory) === 0;
    }

    private function scanDirectory($directory, $relativePath)
    {
        $items = [];
        $entries = null;
        $name = null;
        $fullPath = null;
        $relPath = null;

        $entries = FileSystemManager::scandir($directory);

        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            $name = $entry;
            $fullPath = $directory . DIRECTORY_SEPARATOR . $entry;
            $relPath = $relativePath ? $relativePath . DIRECTORY_SEPARATOR . $entry : $entry;

            if (FileSystemManager::isDir($fullPath)) {
                if (in_array($name, $this->excludedDirectories)) {
                    continue;
                }

                $items[] = [
                    'name' => $name,
                    'type' => 'directory',
                    'path' => $relPath,
                    'modified' => date('Y-m-d H:i:s', FileSystemManager::filemtime($fullPath))
                ];
            } else {
                $extension = pathinfo($fullPath, PATHINFO_EXTENSION);
                $isPromptFile = strpos($relPath, '_prompts' . DIRECTORY_SEPARATOR) === 0;
                $editable = $isPromptFile || in_array($extension, $this->allowedExtensions);

                $items[] = [
                    'name' => $name,
                    'type' => 'file',
                    'path' => $relPath,
                    'extension' => $extension,
                    'size' => FileSystemManager::filesize($fullPath),
                    'modified' => date('Y-m-d H:i:s', FileSystemManager::filemtime($fullPath)),
                    'editable' => $editable
                ];
            }
        }

        usort($items, function($a, $b) {
            if ($a['type'] === $b['type']) {
                return strcmp($a['name'], $b['name']);
            }
            return $a['type'] === 'directory' ? -1 : 1;
        });

        return $items;
    }
}
