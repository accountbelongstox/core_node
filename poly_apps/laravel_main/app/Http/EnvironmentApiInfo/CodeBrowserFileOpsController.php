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
use Illuminate\Support\Facades\Auth;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

class CodeBrowserFileOpsController extends Controller
{
    private $baseDirectory;
    private $deleteDirectory;

    private function checkAuthentication(Request $request)
    {
        $userToken = $request->header('Auth-User-Token');
        $authToken = $request->bearerToken();

        return ($userToken || $authToken || Auth::check());
    }

    public function __construct()
    {
        error_log('[CodeBrowserFileOpsController] Constructor called');

        $this->baseDirectory = PathMapper::getCoreNodeDir();
        error_log('[CodeBrowserFileOpsController] Base directory: ' . $this->baseDirectory);

        $this->deleteDirectory = $this->baseDirectory . DIRECTORY_SEPARATOR . '_delete';

        if ($this->baseDirectory) {
            $deleteResult = FileSystemManager::ensureDirectoryExists($this->deleteDirectory);
            error_log('[CodeBrowserFileOpsController] Delete directory exists: ' . ($deleteResult ? 'yes' : 'no'));

            $promptsDir = $this->baseDirectory . DIRECTORY_SEPARATOR . '_prompts';
            $promptsResult = FileSystemManager::ensureDirectoryExists($promptsDir);
            error_log('[CodeBrowserFileOpsController] Prompts directory exists: ' . ($promptsResult ? 'yes' : 'no'));
        } else {
            error_log('[CodeBrowserFileOpsController] Base directory is empty!');
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
            error_log('[CodeBrowserFileOpsController] deleteFile: Path is required');
            return response()->json(['error' => 'Path is required'], 400);
        }

        $fullPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $relativePath;
        error_log('[CodeBrowserFileOpsController] deleteFile: fullPath=' . $fullPath);

        if (!$this->isPathSafe($fullPath)) {
            error_log('[CodeBrowserFileOpsController] deleteFile: Access denied for path=' . $fullPath);
            return response()->json(['error' => 'Access denied'], 403);
        }

        if (!FileSystemManager::exists($fullPath)) {
            error_log('[CodeBrowserFileOpsController] deleteFile: File not found at path=' . $fullPath);
            return response()->json(['error' => 'File not found'], 404);
        }

        if (!FileSystemManager::isFile($fullPath)) {
            error_log('[CodeBrowserFileOpsController] deleteFile: Path is not a file: ' . $fullPath);
            return response()->json(['error' => 'Path is not a file'], 400);
        }

        // Handle symbolic links: delete the actual file, not just the link
        $actualPath = $fullPath;
        $isSymlink = is_link($fullPath);
        if ($isSymlink) {
            $actualPath = realpath($fullPath);
            error_log('[CodeBrowserFileOpsController] deleteFile: File is a symlink, actual path=' . $actualPath);
        }

        $deleteTargetPath = $this->deleteDirectory . DIRECTORY_SEPARATOR . $relativePath;
        $deleteTargetDir = dirname($deleteTargetPath);
        error_log('[CodeBrowserFileOpsController] deleteFile: deleteTargetPath=' . $deleteTargetPath);
        error_log('[CodeBrowserFileOpsController] deleteFile: deleteTargetDir=' . $deleteTargetDir);
        error_log('[CodeBrowserFileOpsController] deleteFile: deleteDirectory=' . $this->deleteDirectory);
        error_log('[CodeBrowserFileOpsController] deleteFile: deleteDirectory exists=' . (file_exists($this->deleteDirectory) ? 'yes' : 'no'));
        error_log('[CodeBrowserFileOpsController] deleteFile: deleteDirectory is_dir=' . (is_dir($this->deleteDirectory) ? 'yes' : 'no'));
        error_log('[CodeBrowserFileOpsController] deleteFile: deleteDirectory writable=' . (is_writable($this->deleteDirectory) ? 'yes' : 'no'));

        if (!FileSystemManager::ensureDirectoryExists($deleteTargetDir)) {
            error_log('[CodeBrowserFileOpsController] deleteFile: Failed to create delete target directory: ' . $deleteTargetDir);
            error_log('[CodeBrowserFileOpsController] deleteFile: Parent of deleteTargetDir=' . dirname($deleteTargetDir));
            error_log('[CodeBrowserFileOpsController] deleteFile: Parent exists=' . (file_exists(dirname($deleteTargetDir)) ? 'yes' : 'no'));
            error_log('[CodeBrowserFileOpsController] deleteFile: Parent writable=' . (is_writable(dirname($deleteTargetDir)) ? 'yes' : 'no'));
            return response()->json(['error' => 'Failed to create target directory', 'path' => $deleteTargetDir], 500);
        }

        if (FileSystemManager::exists($deleteTargetPath)) {
            error_log('[CodeBrowserFileOpsController] deleteFile: Target already exists, deleting: ' . $deleteTargetPath);
            if (!FileSystemManager::delete($deleteTargetPath)) {
                error_log('[CodeBrowserFileOpsController] deleteFile: Failed to delete existing target file');
                return response()->json(['error' => 'Failed to delete existing target file'], 500);
            }
        }

        error_log('[CodeBrowserFileOpsController] deleteFile: Attempting rename from ' . $fullPath . ' to ' . $deleteTargetPath);

        try {
            // If it's a symlink, move the actual file, then remove the symlink
            if ($isSymlink && $actualPath && file_exists($actualPath)) {
                error_log('[CodeBrowserFileOpsController] deleteFile: Moving actual file from ' . $actualPath . ' to ' . $deleteTargetPath);

                // Move the actual file
                $result = FileSystemManager::rename($actualPath, $deleteTargetPath);

                // Remove the symlink
                if ($result && is_link($fullPath)) {
                    error_log('[CodeBrowserFileOpsController] deleteFile: Removing symlink at ' . $fullPath);
                    unlink($fullPath);
                }
            } else {
                // Regular file or broken symlink
                if ($isSymlink && !file_exists($actualPath)) {
                    // Broken symlink - just remove it
                    error_log('[CodeBrowserFileOpsController] deleteFile: Removing broken symlink at ' . $fullPath);
                    unlink($fullPath);
                    $result = true;
                } else {
                    // Regular file
                    $result = FileSystemManager::rename($fullPath, $deleteTargetPath);
                }
            }
        } catch (\Throwable $e) {
            $errorMessage = $e->getMessage();
            error_log('[CodeBrowserFileOpsController] deleteFile: Rename failed - ' . $errorMessage);
            error_log('[CodeBrowserFileOpsController] deleteFile: Source exists: ' . (file_exists($fullPath) ? 'yes' : 'no'));
            error_log('[CodeBrowserFileOpsController] deleteFile: Source readable: ' . (is_readable($fullPath) ? 'yes' : 'no'));
            error_log('[CodeBrowserFileOpsController] deleteFile: Source writable: ' . (is_writable($fullPath) ? 'yes' : 'no'));
            error_log('[CodeBrowserFileOpsController] deleteFile: Source parent writable: ' . (is_writable(dirname($fullPath)) ? 'yes' : 'no'));
            error_log('[CodeBrowserFileOpsController] deleteFile: Target dir exists: ' . (file_exists($deleteTargetDir) ? 'yes' : 'no'));
            error_log('[CodeBrowserFileOpsController] deleteFile: Target dir writable: ' . (is_writable($deleteTargetDir) ? 'yes' : 'no'));

            return response()->json([
                'error' => 'Failed to move file to _delete directory',
                'details' => $errorMessage,
                'source' => $fullPath,
                'target' => $deleteTargetPath
            ], 500);
        }

        error_log('[CodeBrowserFileOpsController] deleteFile: Success');

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

    public function autoRenameToEnglish(Request $request)
    {
        $path = null;
        $fullPath = null;
        $currentName = null;
        $translated = null;
        $parentDir = null;
        $newPath = null;
        $newRelativePath = null;

        $path = $request->input('path');

        if (!$path) {
            return response()->json(['error' => 'Path is required'], 400);
        }

        $fullPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $path;

        if (!$this->isPathSafe($fullPath)) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        if (!FileSystemManager::exists($fullPath)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        $currentName = basename($fullPath);

        if (!$this->containsChinese($currentName)) {
            return response()->json([
                'success' => true,
                'message' => 'Filename already in English',
                'renamed' => false,
                'path' => $path
            ]);
        }

        $translated = $this->translateLine($currentName);

        if (!$translated) {
            return response()->json([
                'error' => 'Translation failed'
            ], 500);
        }

        $parentDir = dirname($fullPath);
        $newPath = $parentDir . DIRECTORY_SEPARATOR . $translated;

        if (FileSystemManager::exists($newPath)) {
            return response()->json([
                'error' => 'File with translated name already exists',
                'translated_name' => $translated
            ], 409);
        }

        if (!FileSystemManager::rename($fullPath, $newPath)) {
            return response()->json([
                'error' => 'Failed to rename file'
            ], 500);
        }

        $newRelativePath = str_replace($this->baseDirectory . DIRECTORY_SEPARATOR, '', $newPath);

        return response()->json([
            'success' => true,
            'message' => 'File automatically renamed to English',
            'renamed' => true,
            'original_name' => $currentName,
            'translated_name' => $translated,
            'old_path' => $path,
            'new_path' => $newRelativePath
        ]);
    }

    public function getPrompts(Request $request)
    {
        if (!$this->checkAuthentication($request)) {
            return response()->json([
                'error' => 'Please login to access tasks and prompts',
                'authenticated' => false
            ], 401);
        }

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
        \Log::channel('single')->info('[CreatePrompt] Received name: ' . var_export($name, true));
        \Log::channel('single')->info('[CreatePrompt] Request all: ' . json_encode($request->all()));

        if (!$name) {
            \Log::channel('single')->error('[CreatePrompt] ERROR: Name is required');
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

        \Log::channel('single')->info('[CreatePrompt] Processed name: ' . $processedName);

        $promptsDir = $this->baseDirectory . DIRECTORY_SEPARATOR . '_prompts';
        \Log::channel('single')->info('[CreatePrompt] Prompts dir: ' . $promptsDir);
        \Log::channel('single')->info('[CreatePrompt] Base directory: ' . $this->baseDirectory);

        $dirExists = FileSystemManager::ensureDirectoryExists($promptsDir);
        \Log::channel('single')->info('[CreatePrompt] Directory exists: ' . ($dirExists ? 'yes' : 'no'));

        $filePath = $promptsDir . DIRECTORY_SEPARATOR . $processedName;
        \Log::channel('single')->info('[CreatePrompt] File path: ' . $filePath);

        if (FileSystemManager::exists($filePath)) {
            \Log::channel('single')->warning('[CreatePrompt] WARNING: Prompt already exists: ' . $filePath);
            return response()->json(['error' => 'Prompt already exists'], 409);
        }

        \Log::channel('single')->info('[CreatePrompt] About to call FileSystemManager::writeFile');
        $writeResult = FileSystemManager::writeFile($filePath, '');
        \Log::channel('single')->info('[CreatePrompt] Write result: ' . ($writeResult ? 'success' : 'failed'));

        if (!$writeResult) {
            \Log::channel('single')->error('[CreatePrompt] ERROR: Failed to create prompt file: ' . $filePath);
            return response()->json(['error' => 'Failed to create prompt'], 500);
        }

        $relativePath = '_prompts' . DIRECTORY_SEPARATOR . $processedName;

        \Log::channel('single')->info('[CreatePrompt] Successfully created: ' . $relativePath);

        return response()->json([
            'success' => true,
            'message' => 'Prompt created successfully',
            'path' => $relativePath,
            'name' => $processedName
        ]);
    }

    public function translatePrompt(Request $request)
    {
        if (!$this->checkAuthentication($request)) {
            return response()->json([
                'error' => 'Please login to access translation features',
                'authenticated' => false
            ], 401);
        }

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
                if ($translated && trim($translated) !== '' && $translated !== $line) {
                    $translatedLines[] = $translated;
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

            $this->cleanupOldBackups($fullPath);

            FileSystemManager::writeFile($fullPath, $newContent);
        }

        return response()->json([
            'success' => true,
            'has_changes' => $hasChanges,
            'modified' => date('Y-m-d H:i:s', FileSystemManager::filemtime($fullPath))
        ]);
    }

    private function cleanupOldBackups($filePath)
    {
        $directory = dirname($filePath);
        $filename = basename($filePath);
        $pattern = $filename . '.bak.*';

        $backups = [];
        $entries = FileSystemManager::scandir($directory);

        if (!$entries) {
            return;
        }

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

    public function translatePromptName(Request $request)
    {
        if (!$this->checkAuthentication($request)) {
            return response()->json([
                'error' => 'Please login to access translation features',
                'authenticated' => false
            ], 401);
        }

        $name = null;
        $translated = null;

        $name = $request->input('name');

        if (!$name) {
            return response()->json(['error' => 'Name is required'], 400);
        }

        if (!$this->containsChinese($name)) {
            return response()->json([
                'success' => true,
                'original' => $name,
                'translated' => $name
            ]);
        }

        $translated = $this->translateLine($name);

        if (!$translated) {
            return response()->json([
                'error' => 'Translation failed'
            ], 500);
        }

        return response()->json([
            'success' => true,
            'original' => $name,
            'translated' => $translated
        ]);
    }

    public function translateSingleLine(Request $request)
    {
        if (!$this->checkAuthentication($request)) {
            return response()->json([
                'error' => 'Please login to access translation features',
                'authenticated' => false
            ], 401);
        }

        $line = null;
        $translated = null;

        $line = $request->input('line');

        if ($line === null || $line === '') {
            return response()->json([
                'success' => true,
                'translated' => ''
            ]);
        }

        if (!$this->containsChinese($line)) {
            return response()->json([
                'success' => true,
                'translated' => $line
            ]);
        }

        $translated = $this->translateLine($line);

        if (!$translated) {
            return response()->json([
                'error' => 'Translation failed',
                'original' => $line
            ], 500);
        }

        return response()->json([
            'success' => true,
            'original' => $line,
            'translated' => $translated
        ]);
    }

    private function containsChinese($text)
    {
        return preg_match('/[\x{4e00}-\x{9fa5}]/u', $text) > 0;
    }

    private function translateLine($line)
    {
        try {
            $result = \App\CallPycoreUtils\PycoreTranslatorUtil::translateSingle(
                $line,
                'auto',
                'en',
                true
            );

            if (isset($result['error'])) {
                error_log('[CodeBrowserFileOpsController] Translation error: ' . $result['error']);
                return null;
            }

            if (isset($result['translated_text']) && !empty($result['translated_text'])) {
                return $result['translated_text'];
            }

            return null;
        } catch (\Exception $e) {
            error_log('[CodeBrowserFileOpsController] Translation exception: ' . $e->getMessage());
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

    /**
     * Clean broken symlinks in a directory
     */
    public function cleanBrokenSymlinks(Request $request)
    {
        if (!$this->checkAuthentication($request)) {
            return response()->json(['error' => 'Authentication required'], 401);
        }

        $relativePath = $request->input('path', '_prompts');
        $fullPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $relativePath;

        if (!$this->isPathSafe($fullPath)) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        if (!is_dir($fullPath)) {
            return response()->json(['error' => 'Path is not a directory'], 400);
        }

        $cleaned = 0;
        $files = scandir($fullPath);

        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $itemPath = $fullPath . DIRECTORY_SEPARATOR . $file;

            // Check if it's a broken symlink
            if (is_link($itemPath) && !file_exists($itemPath)) {
                error_log('[CodeBrowserFileOpsController] cleanBrokenSymlinks: Removing broken link: ' . $itemPath);
                if (unlink($itemPath)) {
                    $cleaned++;
                }
            }
        }

        return response()->json([
            'success' => true,
            'cleaned' => $cleaned,
            'message' => "Cleaned $cleaned broken symlink(s)"
        ]);
    }
}
