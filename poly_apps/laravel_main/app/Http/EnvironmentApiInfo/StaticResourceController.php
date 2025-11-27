<?php

namespace App\Http\EnvironmentApiInfo;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

class StaticResourceController
{
    private $baseDirectory;

    public function __construct()
    {
        $this->baseDirectory = PathMapper::getStaticPath();
        FileSystemManager::ensureDirectoryExists($this->baseDirectory);
    }

    public function getFileTree(Request $request)
    {
        $path = null;
        $fullPath = null;

        if (!$this->baseDirectory || !FileSystemManager::exists($this->baseDirectory)) {
            return response()->json([
                'error' => 'Static resource directory not found',
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
            'path' => $path ?: 'static'
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
        $mimeType = $this->getMimeType($fullPath, $extension);

        $isTextFile = $this->isTextFile($mimeType);

        if ($isTextFile) {
            $content = FileSystemManager::readFile($fullPath);
        } else {
            $content = null;
        }

        return response()->json([
            'content' => $content,
            'path' => $relativePath,
            'extension' => $extension,
            'mimeType' => $mimeType,
            'isText' => $isTextFile,
            'size' => FileSystemManager::filesize($fullPath),
            'modified' => date('Y-m-d H:i:s', FileSystemManager::filemtime($fullPath))
        ]);
    }

    public function streamFile(Request $request)
    {
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
        $mimeType = $this->getMimeType($fullPath, $extension);

        return response()->file($fullPath, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline; filename="' . basename($fullPath) . '"'
        ]);
    }

    public function uploadFiles(Request $request)
    {
        $targetPath = null;
        $targetFullPath = null;
        $uploadedFiles = [];

        $targetPath = $request->input('target_path', '');
        $targetFullPath = $this->baseDirectory . ($targetPath ? DIRECTORY_SEPARATOR . $targetPath : '');

        if (!$this->isPathSafe($targetFullPath)) {
            return response()->json([
                'error' => 'Access denied'
            ], 403);
        }

        if (!FileSystemManager::exists($targetFullPath) || !FileSystemManager::isDir($targetFullPath)) {
            return response()->json([
                'error' => 'Target directory not found'
            ], 404);
        }

        if (!$request->hasFile('files')) {
            return response()->json([
                'error' => 'No files uploaded'
            ], 400);
        }

        $files = $request->file('files');
        if (!is_array($files)) {
            $files = [$files];
        }

        $filePaths = $request->input('file_paths', []);

        foreach ($files as $index => $file) {
            if ($file->isValid()) {
                $originalName = $file->getClientOriginalName();
                $relativePath = isset($filePaths[$index]) ? $filePaths[$index] : $originalName;

                $pathParts = explode('/', $relativePath);
                $fileName = array_pop($pathParts);

                $currentPath = $targetFullPath;
                foreach ($pathParts as $dirName) {
                    if (!empty($dirName)) {
                        $safeDirName = $this->sanitizeFileName($dirName);
                        $currentPath = $currentPath . DIRECTORY_SEPARATOR . $safeDirName;

                        if (!FileSystemManager::exists($currentPath)) {
                            FileSystemManager::makeDirectory($currentPath, 0755, true);
                        }
                    }
                }

                $safeName = $this->sanitizeFileName($fileName);
                $destinationPath = $currentPath . DIRECTORY_SEPARATOR . $safeName;

                $counter = 1;
                $baseNameWithoutExt = pathinfo($safeName, PATHINFO_FILENAME);
                $extension = pathinfo($safeName, PATHINFO_EXTENSION);

                while (FileSystemManager::exists($destinationPath)) {
                    $safeName = $baseNameWithoutExt . '_' . $counter . ($extension ? '.' . $extension : '');
                    $destinationPath = $currentPath . DIRECTORY_SEPARATOR . $safeName;
                    $counter++;
                }

                $file->move($currentPath, $safeName);

                $uploadedFiles[] = [
                    'original_name' => $originalName,
                    'saved_name' => $safeName,
                    'relative_path' => $relativePath,
                    'size' => FileSystemManager::filesize($destinationPath)
                ];
            }
        }

        return response()->json([
            'success' => true,
            'uploaded_count' => count($uploadedFiles),
            'files' => $uploadedFiles
        ]);
    }

    public function renameItem(Request $request)
    {
        $oldPath = null;
        $newName = null;
        $oldFullPath = null;
        $newFullPath = null;

        $oldPath = $request->input('old_path');
        $newName = $request->input('new_name');

        if (!$oldPath || !$newName) {
            return response()->json([
                'error' => 'Old path and new name are required'
            ], 400);
        }

        $oldFullPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $oldPath;

        if (!$this->isPathSafe($oldFullPath)) {
            return response()->json([
                'error' => 'Access denied'
            ], 403);
        }

        if (!FileSystemManager::exists($oldFullPath)) {
            return response()->json([
                'error' => 'File or directory not found'
            ], 404);
        }

        $safeName = $this->sanitizeFileName($newName);
        $parentDir = dirname($oldFullPath);
        $newFullPath = $parentDir . DIRECTORY_SEPARATOR . $safeName;

        if (FileSystemManager::exists($newFullPath)) {
            return response()->json([
                'error' => 'A file or directory with that name already exists'
            ], 409);
        }

        if (!FileSystemManager::rename($oldFullPath, $newFullPath)) {
            return response()->json([
                'error' => 'Failed to rename'
            ], 500);
        }

        $newRelativePath = str_replace($this->baseDirectory . DIRECTORY_SEPARATOR, '', $newFullPath);

        return response()->json([
            'success' => true,
            'old_path' => $oldPath,
            'new_path' => $newRelativePath,
            'new_name' => $safeName
        ]);
    }

    public function createDirectory(Request $request)
    {
        $parentPath = null;
        $dirName = null;
        $translateName = null;
        $fullPath = null;

        $parentPath = $request->input('parent_path', '');
        $dirName = $request->input('dir_name');
        $translateName = $request->input('translate_name', false);

        if (!$dirName) {
            return response()->json([
                'error' => 'Directory name is required'
            ], 400);
        }

        $safeName = $dirName;
        if ($translateName) {
            $safeName = $this->sanitizeFileName($dirName);
        }

        $parentFullPath = $this->baseDirectory . ($parentPath ? DIRECTORY_SEPARATOR . $parentPath : '');

        if (!$this->isPathSafe($parentFullPath)) {
            return response()->json([
                'error' => 'Access denied'
            ], 403);
        }

        if (!FileSystemManager::exists($parentFullPath) || !FileSystemManager::isDir($parentFullPath)) {
            return response()->json([
                'error' => 'Parent directory not found'
            ], 404);
        }

        $fullPath = $parentFullPath . DIRECTORY_SEPARATOR . $safeName;

        if (FileSystemManager::exists($fullPath)) {
            return response()->json([
                'error' => 'Directory already exists'
            ], 409);
        }

        if (!FileSystemManager::makeDirectory($fullPath, 0755, true)) {
            return response()->json([
                'error' => 'Failed to create directory'
            ], 500);
        }

        $relativePath = $parentPath ? $parentPath . DIRECTORY_SEPARATOR . $safeName : $safeName;

        return response()->json([
            'success' => true,
            'path' => $relativePath,
            'name' => $safeName
        ]);
    }

    private function sanitizeFileName($filename)
    {
        $filename = str_replace(' ', '_', $filename);

        $filename = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $filename);

        $filename = preg_replace('/_+/', '_', $filename);

        $filename = trim($filename, '_');

        return $filename;
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
                $items[] = [
                    'name' => $name,
                    'type' => 'directory',
                    'path' => $relPath,
                    'modified' => date('Y-m-d H:i:s', FileSystemManager::filemtime($fullPath))
                ];
            } else {
                $extension = pathinfo($fullPath, PATHINFO_EXTENSION);
                $mimeType = $this->getMimeType($fullPath, $extension);

                $items[] = [
                    'name' => $name,
                    'type' => 'file',
                    'path' => $relPath,
                    'extension' => $extension,
                    'mimeType' => $mimeType,
                    'size' => FileSystemManager::filesize($fullPath),
                    'modified' => date('Y-m-d H:i:s', FileSystemManager::filemtime($fullPath))
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

    private function getMimeType($fullPath, $extension)
    {
        if (function_exists('mime_content_type')) {
            $mimeType = mime_content_type($fullPath);
            if ($mimeType) {
                return $mimeType;
            }
        }

        return match(strtolower($extension)) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml',
            'mp4' => 'video/mp4',
            'webm' => 'video/webm',
            'ogg' => 'video/ogg',
            'mp3' => 'audio/mpeg',
            'wav' => 'audio/wav',
            'pdf' => 'application/pdf',
            'json' => 'application/json',
            'xml' => 'application/xml',
            'txt' => 'text/plain',
            'html', 'htm' => 'text/html',
            'css' => 'text/css',
            'js' => 'text/javascript',
            'md' => 'text/markdown',
            default => 'application/octet-stream'
        };
    }

    private function isTextFile($mimeType)
    {
        return str_starts_with($mimeType, 'text/') ||
               in_array($mimeType, [
                   'application/json',
                   'application/xml',
                   'application/javascript'
               ]);
    }
}
