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

use App\Http\Controllers\Controller;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class ClipboardController extends Controller
{
    private static $sensitiveExtensions = [
        'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phps',
        'sh', 'bash', 'cgi', 'pl', 'py', 'rb', 'asp', 'aspx',
        'jsp', 'jspx', 'exe', 'bat', 'cmd', 'ps1', 'vbs'
    ];
    
    private static $maxHistoryCount = 10;
    private static $expireDays = 10;

    private static function getClipboardBaseDir(): string
    {
        $baseDir = storage_path('app/clipboard_data');
        if (!File::isDirectory($baseDir)) {
            File::makeDirectory($baseDir, 0755, true);
        }
        return $baseDir;
    }

    private static function getNamespaceDir(string $namespace): string
    {
        $namespaceDir = self::getClipboardBaseDir() . '/' . $namespace;
        if (!File::isDirectory($namespaceDir)) {
            File::makeDirectory($namespaceDir, 0755, true);
        }
        return $namespaceDir;
    }

    private static function getFilesDir(string $namespace): string
    {
        $filesDir = self::getNamespaceDir($namespace) . '/files';
        if (!File::isDirectory($filesDir)) {
            File::makeDirectory($filesDir, 0755, true);
            self::secureDirectory($filesDir);
        }
        return $filesDir;
    }

    private static function secureDirectory(string $dir): void
    {
        if (PHP_OS_FAMILY === 'Linux' || PHP_OS_FAMILY === 'Darwin') {
            exec("chmod -R 644 " . escapeshellarg($dir) . " 2>/dev/null");
            exec("chmod 755 " . escapeshellarg($dir) . " 2>/dev/null");
            exec("find " . escapeshellarg($dir) . " -type f -exec chmod 644 {} \\; 2>/dev/null");
        }
    }

    private static function sanitizeFilename(string $filename): array
    {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $basename = pathinfo($filename, PATHINFO_FILENAME);
        $originalName = $filename;
        $storedName = $filename;
        
        if (in_array($extension, self::$sensitiveExtensions)) {
            $storedName = $basename . '.' . $extension . '.txt';
        }
        
        return [
            'original' => $originalName,
            'stored' => $storedName,
            'extension' => $extension
        ];
    }

    private static function generateNamespace(): string
    {
        $chars = '0123456789abcdefghijklmnopqrstuvwxyz';
        $length = 8;
        $result = '';
        for ($i = 0; $i < $length; $i++) {
            $result .= $chars[mt_rand(0, strlen($chars) - 1)];
        }
        return $result;
    }
    
    private static function cleanupExpiredData(): void
    {
        try {
            $baseDir = self::getClipboardBaseDir();
            if (!File::isDirectory($baseDir)) {
                return;
            }
            
            $expireTime = time() - (self::$expireDays * 24 * 60 * 60);
            $directories = File::directories($baseDir);
            
            foreach ($directories as $dir) {
                $dataFile = $dir . '/data.json';
                if (File::exists($dataFile)) {
                    $lastModified = File::lastModified($dataFile);
                    if ($lastModified < $expireTime) {
                        File::deleteDirectory($dir);
                    }
                } else {
                    $dirTime = File::lastModified($dir);
                    if ($dirTime < $expireTime) {
                        File::deleteDirectory($dir);
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Clipboard cleanup error: ' . $e->getMessage());
        }
    }
    
    private static function trimHistory(array &$data, string $namespace): void
    {
        if (count($data['history']) > self::$maxHistoryCount) {
            $removedEntries = array_splice($data['history'], self::$maxHistoryCount);
            $filesDir = self::getFilesDir($namespace);
            foreach ($removedEntries as $entry) {
                if (!empty($entry['files'])) {
                    foreach ($entry['files'] as $file) {
                        $filePath = $filesDir . '/' . $file['stored_name'];
                        if (File::exists($filePath)) {
                            File::delete($filePath);
                        }
                    }
                }
            }
        }
    }
    
    private static function updateLastAccess(string $namespace): void
    {
        $dataFile = self::getDataFilePath($namespace);
        if (File::exists($dataFile)) {
            touch($dataFile);
        }
    }

    private static function getDataFilePath(string $namespace): string
    {
        return self::getNamespaceDir($namespace) . '/data.json';
    }

    private static function loadClipboardData(string $namespace): array
    {
        $dataFile = self::getDataFilePath($namespace);
        if (File::exists($dataFile)) {
            $content = File::get($dataFile);
            return json_decode($content, true) ?: self::getDefaultData($namespace);
        }
        return self::getDefaultData($namespace);
    }

    private static function getDefaultData(string $namespace): array
    {
        return [
            'namespace' => $namespace,
            'current' => [
                'text' => '',
                'files' => [],
                'updated_at' => now()->toISOString()
            ],
            'history' => []
        ];
    }

    private static function saveClipboardData(string $namespace, array $data): void
    {
        $dataFile = self::getDataFilePath($namespace);
        File::put($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    public static function getOrCreateNamespace(Request $request)
    {
        try {
            self::cleanupExpiredData();
            
            $namespace = $request->input('namespace');
            
            if (!$namespace) {
                $namespace = self::generateNamespace();
            }
            
            $namespace = strtolower(trim($namespace));
            
            if (!preg_match('/^[a-z0-9]{1,20}$/', $namespace)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Namespace must be alphanumeric (a-z, 0-9), max 20 characters'
                ], 400);
            }
            
            $data = self::loadClipboardData($namespace);
            self::trimHistory($data, $namespace);
            self::saveClipboardData($namespace, $data);
            self::updateLastAccess($namespace);
            
            return response()->json([
                'success' => true,
                'namespace' => $namespace,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            Log::error('Clipboard getOrCreateNamespace error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get or create namespace'
            ], 500);
        }
    }

    public static function saveText(Request $request)
    {
        try {
            self::cleanupExpiredData();
            
            $namespace = strtolower(trim($request->input('namespace', '')));
            $text = $request->input('text', '');
            
            if (!$namespace || !preg_match('/^[a-z0-9]{1,20}$/', $namespace)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Valid namespace is required'
                ], 400);
            }
            
            $data = self::loadClipboardData($namespace);
            $data['current']['text'] = $text;
            $data['current']['updated_at'] = now()->toISOString();
            self::trimHistory($data, $namespace);
            self::saveClipboardData($namespace, $data);
            self::updateLastAccess($namespace);
            
            return response()->json([
                'success' => true,
                'message' => 'Text saved successfully',
                'updated_at' => $data['current']['updated_at']
            ]);
        } catch (\Exception $e) {
            Log::error('Clipboard saveText error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to save text'
            ], 500);
        }
    }

    public static function getData(Request $request)
    {
        try {
            $namespace = strtolower(trim($request->input('namespace', '')));
            
            if (!$namespace || !preg_match('/^[a-z0-9]{1,20}$/', $namespace)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Valid namespace is required'
                ], 400);
            }
            
            $data = self::loadClipboardData($namespace);
            self::trimHistory($data, $namespace);
            self::updateLastAccess($namespace);
            
            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            Log::error('Clipboard getData error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get data'
            ], 500);
        }
    }

    public static function uploadFiles(Request $request)
    {
        try {
            self::cleanupExpiredData();
            
            $namespace = strtolower(trim($request->input('namespace', '')));
            
            if (!$namespace || !preg_match('/^[a-z0-9]{1,20}$/', $namespace)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Valid namespace is required'
                ], 400);
            }
            
            if (!$request->hasFile('files')) {
                return response()->json([
                    'success' => false,
                    'message' => 'No files uploaded'
                ], 400);
            }
            
            $files = $request->file('files');
            if (!is_array($files)) {
                $files = [$files];
            }
            
            $filesDir = self::getFilesDir($namespace);
            $data = self::loadClipboardData($namespace);
            $uploadedFiles = [];
            
            foreach ($files as $file) {
                $originalName = $file->getClientOriginalName();
                $fileInfo = self::sanitizeFilename($originalName);
                $uniqueId = uniqid() . '_';
                $storedName = $uniqueId . $fileInfo['stored'];
                
                $file->move($filesDir, $storedName);
                
                $filePath = $filesDir . '/' . $storedName;
                if (PHP_OS_FAMILY === 'Linux' || PHP_OS_FAMILY === 'Darwin') {
                    exec("chmod 644 " . escapeshellarg($filePath) . " 2>/dev/null");
                }
                
                $uploadedFiles[] = [
                    'id' => $uniqueId,
                    'original_name' => $fileInfo['original'],
                    'stored_name' => $storedName,
                    'size' => filesize($filePath),
                    'uploaded_at' => now()->toISOString()
                ];
            }
            
            $data['current']['files'] = array_merge($data['current']['files'], $uploadedFiles);
            $data['current']['updated_at'] = now()->toISOString();
            self::trimHistory($data, $namespace);
            self::saveClipboardData($namespace, $data);
            self::updateLastAccess($namespace);
            
            self::secureDirectory($filesDir);
            
            return response()->json([
                'success' => true,
                'message' => count($uploadedFiles) . ' file(s) uploaded successfully',
                'files' => $uploadedFiles
            ]);
        } catch (\Exception $e) {
            Log::error('Clipboard uploadFiles error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload files: ' . $e->getMessage()
            ], 500);
        }
    }

    public static function downloadFile(Request $request)
    {
        try {
            $namespace = $request->input('namespace');
            $storedName = $request->input('stored_name');
            $originalName = $request->input('original_name');
            
            if (!$namespace || !$storedName) {
                return response()->json([
                    'success' => false,
                    'message' => 'Namespace and stored_name are required'
                ], 400);
            }
            
            $filesDir = self::getFilesDir($namespace);
            $filePath = $filesDir . '/' . $storedName;
            
            if (!File::exists($filePath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found'
                ], 404);
            }
            
            $downloadName = $originalName ?: $storedName;
            
            return response()->download($filePath, $downloadName);
        } catch (\Exception $e) {
            Log::error('Clipboard downloadFile error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to download file'
            ], 500);
        }
    }

    public static function deleteFile(Request $request)
    {
        try {
            $namespace = $request->input('namespace');
            $storedName = $request->input('stored_name');
            
            if (!$namespace || !$storedName) {
                return response()->json([
                    'success' => false,
                    'message' => 'Namespace and stored_name are required'
                ], 400);
            }
            
            $filesDir = self::getFilesDir($namespace);
            $filePath = $filesDir . '/' . $storedName;
            
            if (File::exists($filePath)) {
                File::delete($filePath);
            }
            
            $data = self::loadClipboardData($namespace);
            $data['current']['files'] = array_filter($data['current']['files'], function($file) use ($storedName) {
                return $file['stored_name'] !== $storedName;
            });
            $data['current']['files'] = array_values($data['current']['files']);
            $data['current']['updated_at'] = now()->toISOString();
            self::saveClipboardData($namespace, $data);
            
            return response()->json([
                'success' => true,
                'message' => 'File deleted successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Clipboard deleteFile error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete file'
            ], 500);
        }
    }

    public static function createNew(Request $request)
    {
        try {
            self::cleanupExpiredData();
            
            $namespace = strtolower(trim($request->input('namespace', '')));
            
            if (!$namespace || !preg_match('/^[a-z0-9]{1,20}$/', $namespace)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Valid namespace is required'
                ], 400);
            }
            
            $data = self::loadClipboardData($namespace);
            
            if (!empty($data['current']['text']) || !empty($data['current']['files'])) {
                $historyEntry = [
                    'text' => $data['current']['text'],
                    'files' => $data['current']['files'],
                    'created_at' => $data['current']['updated_at'] ?? now()->toISOString()
                ];
                
                array_unshift($data['history'], $historyEntry);
                
                self::trimHistory($data, $namespace);
            }
            
            $data['current'] = [
                'text' => '',
                'files' => [],
                'updated_at' => now()->toISOString()
            ];
            
            self::saveClipboardData($namespace, $data);
            self::updateLastAccess($namespace);
            
            return response()->json([
                'success' => true,
                'message' => 'New clipboard created, history saved',
                'data' => $data
            ]);
        } catch (\Exception $e) {
            Log::error('Clipboard createNew error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create new clipboard'
            ], 500);
        }
    }

    public static function restoreHistory(Request $request)
    {
        try {
            $namespace = strtolower(trim($request->input('namespace', '')));
            $historyIndex = (int) $request->input('history_index', 0);
            
            if (!$namespace || !preg_match('/^[a-z0-9]{1,20}$/', $namespace)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Valid namespace is required'
                ], 400);
            }
            
            $data = self::loadClipboardData($namespace);
            
            if (!isset($data['history'][$historyIndex])) {
                return response()->json([
                    'success' => false,
                    'message' => 'History entry not found'
                ], 404);
            }
            
            $historyEntry = $data['history'][$historyIndex];
            
            if (!empty($data['current']['text']) || !empty($data['current']['files'])) {
                $currentAsHistory = [
                    'text' => $data['current']['text'],
                    'files' => $data['current']['files'],
                    'created_at' => $data['current']['updated_at'] ?? now()->toISOString()
                ];
                array_unshift($data['history'], $currentAsHistory);
            }
            
            $data['current'] = [
                'text' => $historyEntry['text'],
                'files' => $historyEntry['files'],
                'updated_at' => now()->toISOString()
            ];
            
            array_splice($data['history'], $historyIndex + 1, 1);
            
            self::trimHistory($data, $namespace);
            
            self::saveClipboardData($namespace, $data);
            self::updateLastAccess($namespace);
            
            return response()->json([
                'success' => true,
                'message' => 'History restored successfully',
                'data' => $data
            ]);
        } catch (\Exception $e) {
            Log::error('Clipboard restoreHistory error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to restore history'
            ], 500);
        }
    }
}
