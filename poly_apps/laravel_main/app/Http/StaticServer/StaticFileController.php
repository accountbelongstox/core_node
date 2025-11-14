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
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use App\Utils\FileReader;

class StaticFileController
{
    private $basePath;

    // Directory list to be filtered (only for non-logged-in users)
    private $excludedDirectories = [
        '.git',
        'node_modules',
        'vendor',
        'storage',
        'tests',
        '.idea',
        '.vscode'
    ];

    // File extensions to be filtered (only for non-logged-in users)
    private $excludedExtensions = [
        '.exe',
        '.dll',
        '.so',
        '.dylib',
        '.zip',
        '.db',
        '.sqlite',
    ];

    // Search rules configuration
    private $searchRules = [
        // Directories to skip (including subdirectories)
        'skipDirectories' => [
            'node_modules',
            'vendor',
            '.git',
            'storage',
            'public/build',
            'public/hot',
            'bootstrap/cache',
            '.idea',
            '.vscode',
            '__pycache__',
            'dist',
            'build',
            'coverage',
            '.backup',
            '.cache',
            '.out',
            '.log',
            '.tmp',
            '.pid',
        ],
        // Files to skip
        'skipFiles' => [
            '.DS_Store',
            'Thumbs.db',
            '.gitignore',
            '.env',
            '*.log',
            '*.lock',
            '*.cache',
            '*.pid',
            '*.out',
            '*.tmp',
            '*.backup',
            '*.cache',
            '*.log',
            '*.pid',
            '*.out',
            '*.tmp',
            '*.backup',

            // 图片格式
            '*.jpg',
            '*.jpeg',
            '*.png',
            '*.gif',
            '*.bmp',
            '*.svg',
            '*.webp',
            '*.tiff',
            '*.ico',

            // 视频格式
            '*.mp4',
            '*.mkv',
            '*.avi',
            '*.mov',
            '*.flv',
            '*.wmv',
            '*.webm',
            '*.mpg',
            '*.mpeg',
            '*.3gp',

            // 音频格式
            '*.mp3',
            '*.wav',
            '*.aac',
            '*.flac',
            '*.ogg',
            '*.m4a',
            '*.wma',
            '*.alac',
            '*.aiff',

        ],
        // Supported file extensions for search
        'supportedExtensions' => [
            // Text files
            'txt',
            'md',
            'markdown',
            // Code files
            // 'php',
            // 'js',
            // 'jsx',
            // 'ts',
            // 'tsx',
            // 'vue',
            // 'html',
            // 'htm',
            // 'css',
            // 'scss',
            // 'less',
            // 'sass',
            // 'py',
            // 'rb',
            // 'java',
            // 'c',
            // 'cpp',
            // 'h',
            // 'hpp',
            // 'cs',
            // 'go',
            // 'rs',
            // 'swift',
            // // Configuration files
            // 'json',
            // 'xml',
            // 'yaml',
            // 'yml',
            // 'ini',
            // 'conf',
            // 'config',
            // // Other text files
            // 'sql',
            // 'sh',
            // 'bash',
            // 'env.example'
        ]
    ];

    private $maxEditableFileSize = 10 * 1024 * 1024; // 10MB
    private $maxSearchableFileSize = 5 * 1024 * 1024; // 5MB limit for searchable files
    private $searchTimeout = 30; // Search timeout in seconds
    private $searchFlagFile; // Search flag file path
    private $searchStartTime; // Search start time
    private $searchedDirs = []; // Searched directories
    private $searchedFiles = []; // Searched files
    
    private string $staticFilesDir;

    public function __construct()
    {
        // Use the new external storage system
        $this->staticFilesDir = \App\Providers\PathMapper::getStaticPath();
        $this->basePath = $this->staticFilesDir;

        // Initialize search flag file path
        $this->searchFlagFile = storage_path('app/search_flag.json');
    }

    public function index(Request $request)
    {
        return view('static-files');
    }

    public function list(Request $request)
    {
        $path = $this->cleanPath($request->input('path', ''));
        $fullPath = $this->getFullPath($path);

        if (!File::exists($fullPath)) {
            return response()->json(['error' => 'Path does not exist'], 404);
        }

        if (!File::isDirectory($fullPath)) {
            return response()->json(['error' => 'Path is not a directory'], 400);
        }

        $items = collect(File::files($fullPath))
            ->map(function ($file) {
                $relativePath = $this->getRelativePath($file->getPathname());
                $isEditable = $this->isEditableFile($file->getFilename()) &&
                    $this->isFileSizeEditable($file->getPathname());

                return [
                    'name' => $file->getFilename(),
                    'path' => $relativePath,
                    'type' => 'file',
                    'size' => $this->formatSize($file->getSize()),
                    'editable' => $isEditable,
                    'sizeExceeded' => $file->getSize() > $this->maxEditableFileSize
                ];
            });

        $directories = collect(File::directories($fullPath))
            ->filter(function ($directory) {
                return !$this->isExcludedDirectory(basename($directory));
            })
            ->map(function ($directory) {
                $relativePath = $this->getRelativePath($directory);
                return [
                    'name' => basename($directory),
                    'path' => $relativePath,
                    'type' => 'directory'
                ];
            });

        $items = $directories->merge($items);

        return response()->json([
            'path' => $path,
            'items' => $items->values()
        ]);
    }

    private function formatSize($size)
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $power = $size > 0 ? floor(log($size, 1024)) : 0;
        return number_format($size / pow(1024, $power), 2, '.', ',') . ' ' . $units[$power];
    }

    private function cleanPath($path)
    {
        // Remove any ".." and extra slashes
        $path = trim(str_replace('\\', '/', $path), '/');
        $parts = array_filter(explode('/', $path), 'strlen');
        $absolutes = [];

        foreach ($parts as $part) {
            if ($part === '.') {
                continue;
            }
            if ($part === '..') {
                array_pop($absolutes);
            } else {
                $absolutes[] = $part;
            }
        }

        return implode('/', $absolutes);
    }

    private function getFullPath($subPath)
    {
        if (empty($subPath)) {
            return $this->basePath;
        }
        // Use DIRECTORY_SEPARATOR to ensure correct path separator
        return $this->basePath . DIRECTORY_SEPARATOR . $subPath;
    }

    private function getRelativePath($path)
    {
        return trim(str_replace([$this->basePath, '\\'], ['', '/'], $path), '/');
    }

    /**
     * Get file content
     */
    public function getContent(Request $request)
    {
        $path = $this->cleanPath($request->input('path'));
        $fullPath = $this->getFullPath($path);

        if (!FileReader::isFile($fullPath)) {
            return response()->json(['error' => 'File does not exist'], 404);
        }

        if (!$this->isEditableFile(basename($fullPath))) {
            return response()->json(['error' => 'File is not editable'], 403);
        }

        if (!$this->isFileSizeEditable($fullPath)) {
            $size = FileReader::getFileSize($fullPath);
            return response()->json([
                'error' => 'File is too large to edit',
                'size' => $this->formatSize($size),
                'maxSize' => $this->formatSize($this->maxEditableFileSize)
            ], 413);
        }

        // Use FileReader to handle different encodings
        $result = FileReader::readWithEncoding($fullPath, null, true);
        $content = is_array($result) ? $result['content'] : '';

        return response()->json([
            'content' => $content,
            'path' => $path,
            'encoding' => is_array($result) ? $result['encoding'] : 'UTF-8'
        ]);
    }

    /**
     * Save file content
     */
    public function saveContent(Request $request)
    {
        $path = $request->input('path');
        $content = $request->input('content');
        $confirmationCount = (int)$request->input('confirmation_count', 0);

        $fullPath = $this->getFullPath($path);

        if (!file_exists($fullPath)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        if (!is_writable($fullPath)) {
            return response()->json(['error' => 'File is not writable'], 403);
        }

        // 检查是否需要确认
        if ($this->needsConfirmation($fullPath) && $confirmationCount < 3) {
            return response()->json([
                'needsConfirmation' => true,
                'confirmationCount' => $confirmationCount,
                'message' => 'Please confirm to save this file type'
            ], 200);
        }

        try {
            // 创建备份
            $backupPath = $this->createBackup($fullPath);

            // 保存新内容
            file_put_contents($fullPath, $content);

            return response()->json([
                'message' => 'File saved successfully',
                'backup' => basename($backupPath)
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Download file
     */
    public function download(Request $request, $path)
    {
        if (empty($path)) {
            return response()->json(['error' => 'Path parameter is required'], 400);
        }

        $fullPath = $this->getFullPath($path);

        if (!file_exists($fullPath)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        if (!is_file($fullPath)) {
            return response()->json(['error' => 'Path is not a file'], 400);
        }

        if (!is_readable($fullPath)) {
            return response()->json(['error' => 'File is not readable'], 403);
        }

        return response()->download($fullPath);
    }

    /**
     * Check if file extension is in the excluded list
     */
    private function isExcludedExtension($extension)
    {
        // Logged-in users can access all file types
        if (Auth::check()) {
            return false;
        }
        return in_array(strtolower($extension), $this->excludedExtensions);
    }

    /**
     * Check if directory is in the excluded list
     */
    private function isExcludedDirectory($directoryName)
    {
        // Logged-in users can access all directories
        if (Auth::check()) {
            return false;
        }
        return in_array($directoryName, $this->excludedDirectories);
    }

    private function isEditableFile($filename)
    {
        // Logged-in users can edit all files
        if (Auth::check()) {
            return true;
        }
        // Non-logged-in users can only edit specific files (e.g., .gitignore)
        $allowedFiles = ['.gitignore'];
        return in_array($filename, $allowedFiles);
    }

    private function isFileSizeEditable($fullPath)
    {
        // Check if file exists
        if (!File::exists($fullPath)) {
            return false;
        }

        // Check if file size exceeds limit
        return File::size($fullPath) <= $this->maxEditableFileSize;
    }

    private function needsConfirmation($filename)
    {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return in_array($extension, [
            'php',
            'mp3',
            'mp4',
            'avi',
            'mkv',
            'zip',
            'rar',
            '7z',
            'tar',
            'gz'
        ]);
    }

    private function getBackupDirectory()
    {
        $backupDir = storage_path('app/backups');
        if (!file_exists($backupDir)) {
            mkdir($backupDir, 0755, true);
        }
        return $backupDir;
    }

    private function createBackup($originalPath)
    {
        $backupDir = $this->getBackupDirectory();
        $relativePath = $this->getRelativePath($originalPath);
        $backupPath = $backupDir . '/' . $relativePath;
        $backupDirPath = dirname($backupPath);

        if (!file_exists($backupDirPath)) {
            mkdir($backupDirPath, 0755, true);
        }

        // Add timestamp to filename
        $filename = basename($originalPath);
        $extension = pathinfo($filename, PATHINFO_EXTENSION);
        $nameWithoutExt = pathinfo($filename, PATHINFO_FILENAME);
        $timestamp = date('Y-m-d_H-i-s');
        $backupFilename = "{$nameWithoutExt}_{$timestamp}.{$extension}";
        $finalBackupPath = $backupDirPath . '/' . $backupFilename;

        copy($originalPath, $finalBackupPath);

        // Clean old backups
        $this->cleanOldBackups($backupDirPath, $nameWithoutExt);

        return $finalBackupPath;
    }

    private function cleanOldBackups($directory, $baseFilename)
    {
        $files = glob($directory . '/' . $baseFilename . '_*.{' . implode(',', ['php', 'mp3', 'mp4', 'avi', 'mkv', 'zip', 'rar', '7z', 'tar', 'gz']) . '}', GLOB_BRACE);
        $now = time();

        foreach ($files as $file) {
            if (is_file($file)) {
                $fileTime = filemtime($file);
                if (($now - $fileTime) > (7 * 24 * 60 * 60)) { // 7 days
                    unlink($file);
                }
            }
        }
    }

    /**
     * Get list of file backups
     */
    public function getBackups(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'path' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid path'], 400);
        }

        $originalPath = $request->input('path');

        // Build backup file path pattern
        $backupDir = 'backups';  // Backup root directory
        $relativePath = dirname($originalPath);  // Get relative directory path of original file
        $filename = basename($originalPath);  // Get filename
        $backupPattern = $backupDir . '/' . $relativePath . '/' . pathinfo($filename, PATHINFO_FILENAME) . '_*.' . pathinfo($filename, PATHINFO_EXTENSION);

        try {
            // Find all matching backup files
            $backupFiles = Storage::files(dirname($backupPattern));
            $backupFiles = array_filter($backupFiles, function ($file) use ($backupPattern) {
                return fnmatch($backupPattern, $file);
            });

            // Get information for each backup file
            $backups = array_map(function ($file) {
                return [
                    'path' => $file,
                    'timestamp' => Storage::lastModified($file),
                    'size' => Storage::size($file)
                ];
            }, $backupFiles);

            // Sort by timestamp, newest first
            usort($backups, function ($a, $b) {
                return $b['timestamp'] - $a['timestamp'];
            });

            return response()->json([
                'original' => $originalPath,
                'backups' => $backups
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to get backups'], 500);
        }
    }

    /**
     * Restore backup file
     */
    public function restoreBackup(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'backup_path' => 'required|string',
            'target_path' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid input'], 400);
        }

        $backupPath = $request->input('backup_path');
        $targetPath = $request->input('target_path');

        try {
            // Create backup of current file before restoring
            $this->createBackup($targetPath);

            // Restore file from backup
            if (Storage::exists($backupPath)) {
                Storage::copy($backupPath, $targetPath);
                return response()->json(['message' => 'Backup restored successfully']);
            }

            return response()->json(['error' => 'Backup file not found'], 404);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to restore backup'], 500);
        }
    }

    /**
     * Check if search should stop
     * 
     * @return bool
     */
    private function shouldStopSearch(): bool
    {
        // Check for timeout
        if (time() - $this->searchStartTime >= $this->searchTimeout) {
            return true;
        }

        // Check flag file
        if (file_exists($this->searchFlagFile)) {
            $flagData = json_decode(file_get_contents($this->searchFlagFile), true);
            return $flagData['timestamp'] > $this->searchStartTime;
        }

        return false;
    }

    /**
     * Update search flag file
     */
    private function updateSearchFlag()
    {
        $flagData = [
            'timestamp' => time(),
            'pid' => getmypid()
        ];
        file_put_contents($this->searchFlagFile, json_encode($flagData));
    }

    public function search(Request $request)
    {
        $searchTerm = $request->get('term');
        if (empty($searchTerm)) {
            return response()->json([
                'pathMatches' => [],
                'contentMatches' => []
            ]);
        }

        // 更新搜索标志和开始时间
        $this->searchStartTime = time();
        $this->updateSearchFlag();

        // 重置搜索统计
        $this->searchedDirs = [];
        $this->searchedFiles = [];

        $pathMatches = [];
        $contentMatches = [];

        // 搜索文件和目录名
        $this->searchInDirectory($this->basePath, $searchTerm, $pathMatches, $contentMatches);

        // 检查是否因超时而停止
        $wasTimeout = time() - $this->searchStartTime >= $this->searchTimeout;

        return response()->json([
            'pathMatches' => $pathMatches,
            'contentMatches' => $contentMatches,
            'searchStats' => [
                'wasTimeout' => $wasTimeout,
                'searchedDirs' => array_values(array_unique($this->searchedDirs)),
                'searchedFiles' => array_values(array_unique($this->searchedFiles)),
                'totalDirs' => count($this->searchedDirs),
                'totalFiles' => count($this->searchedFiles),
                'duration' => time() - $this->searchStartTime
            ]
        ]);
    }

    /**
     * Get search configuration
     * 
     * @return array Array containing search rules
     */
    public function getSearchConfig(): array
    {
        return [
            'rules' => $this->searchRules,
            'maxSearchableFileSize' => $this->maxSearchableFileSize,
            'excludedForNonAuth' => [
                'directories' => $this->excludedDirectories,
                'extensions' => $this->excludedExtensions
            ]
        ];
    }

    /**
     * Check if file is searchable
     * 
     * @param string $filePath File path
     * @param string $fileName File name
     * @return bool
     */
    private function isSearchable(string $filePath, string $fileName): bool
    {
        // Check file size
        if (FileReader::getFileSize($filePath) > $this->maxSearchableFileSize) {
            return false;
        }

        // Check file extension
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        if (!in_array($extension, $this->searchRules['supportedExtensions'])) {
            return false;
        }

        // Check if in skip files list
        foreach ($this->searchRules['skipFiles'] as $pattern) {
            if (fnmatch($pattern, $fileName)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if directory should be skipped
     * 
     * @param string $dirName Directory name
     * @return bool
     */
    private function shouldSkipDirectory(string $dirName): bool
    {
        return in_array($dirName, $this->searchRules['skipDirectories']);
    }

    private function searchInDirectory($directory, $searchTerm, &$pathMatches, &$contentMatches, $relativePath = '')
    {
        try {
            // Check if search should stop
            if ($this->shouldStopSearch()) {
                return;
            }

            $items = scandir($directory);
            // Record searched directory
            $this->searchedDirs[] = $relativePath ?: '/';

            foreach ($items as $item) {
                if ($item === '.' || $item === '..') {
                    continue;
                }

                // Check again if search should stop
                if ($this->shouldStopSearch()) {
                    return;
                }

                $fullPath = $directory . DIRECTORY_SEPARATOR . $item;
                $currentRelativePath = $relativePath ? $relativePath . '/' . $item : $item;

                // Check if directory should be skipped
                if (FileReader::isDirectory($fullPath)) {
                    if ($this->shouldSkipDirectory($item)) {
                        continue;
                    }

                    // If directory name contains search term, add to path matches
                    if (stripos($item, $searchTerm) !== false) {
                        $pathMatches[] = [
                            'type' => 'directory',
                            'path' => $currentRelativePath,
                            'name' => $item
                        ];
                    }
                    // Recursively search subdirectories
                    $this->searchInDirectory($fullPath, $searchTerm, $pathMatches, $contentMatches, $currentRelativePath);
                }
                // Check file
                elseif (FileReader::isFile($fullPath)) {
                    // Record searched file
                    $this->searchedFiles[] = $currentRelativePath;

                    // Check if file is searchable
                    if (!$this->isSearchable($fullPath, $item)) {
                        continue;
                    }

                    // Check filename
                    if (stripos($item, $searchTerm) !== false) {
                        $pathMatches[] = [
                            'type' => 'file',
                            'path' => $currentRelativePath,
                            'name' => $item
                        ];
                    }

                    try {
                        $result = FileReader::readWithEncoding($fullPath, null, true);
                        $content = is_array($result) ? $result['content'] : '';

                        if (!empty($content) && stripos($content, $searchTerm) !== false) {
                            // Get context of matching line
                            preg_match("/(.{0,50}$searchTerm.{0,50})/i", $content, $matches);
                            $preview = isset($matches[1]) ? '...' . $matches[1] . '...' : '';

                            $contentMatches[] = [
                                'path' => $currentRelativePath,
                                'preview' => $preview,
                                'size' => $this->formatSize(FileReader::getFileSize($fullPath)),
                                'encoding' => is_array($result) ? $result['encoding'] : 'UTF-8'
                            ];
                        }
                    } catch (\Exception $e) {
                        Log::warning("Error reading file {$fullPath}: " . $e->getMessage());
                        continue;
                    }
                }

                // Limit search results count
                if (count($pathMatches) > 100 || count($contentMatches) > 100) {
                    return;
                }
            }
        } catch (\Exception $e) {
            Log::error("Error searching in directory {$directory}: " . $e->getMessage());
        }
    }

    public function downloadFromUrl(Request $request)
    {
        $url = $request->input('url');
        $path = $this->cleanPath($request->input('path', ''));

        if (empty($url)) {
            return response()->json(['success' => false, 'message' => 'URL cannot be empty']);
        }

        try {
            // Get filename from URL
            $originalFileName = basename(parse_url($url, PHP_URL_PATH));
            if (empty($originalFileName)) {
                $originalFileName = 'downloaded_file';
            }

            // Get file extension
            $extension = pathinfo($originalFileName, PATHINFO_EXTENSION);
            $fileName = pathinfo($originalFileName, PATHINFO_FILENAME);

            // Build complete save path
            $savePath = $this->getFullPath($path);
            $fullFileName = $fileName;
            $counter = 0;

            // Check if file exists, rename if necessary
            while (file_exists($savePath . DIRECTORY_SEPARATOR . $fullFileName . ($extension ? '.' . $extension : ''))) {
                $counter++;
                $fullFileName = $fileName . $counter;
            }

            // Final filename (with extension)
            $finalFileName = $fullFileName . ($extension ? '.' . $extension : '');
            $finalSavePath = $savePath . DIRECTORY_SEPARATOR . $finalFileName;

            // Download file using CURL
            $ch = curl_init($url);
            $fp = fopen($finalSavePath, 'wb');
            curl_setopt($ch, CURLOPT_FILE, $fp);
            curl_setopt($ch, CURLOPT_HEADER, 0);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 60);
            curl_exec($ch);

            if (curl_errno($ch)) {
                fclose($fp);
                unlink($finalSavePath);
                throw new \Exception(curl_error($ch));
            }

            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            fclose($fp);

            if ($httpCode !== 200) {
                unlink($finalSavePath);
                return response()->json([
                    'success' => false,
                    'message' => 'Download failed, HTTP status code: ' . $httpCode
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'File downloaded successfully',
                'fileName' => $finalFileName
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Download failed: ' . $e->getMessage()
            ]);
        }
    }
}
