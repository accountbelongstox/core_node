<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class ServerManagerV1FileManagerCtl extends ServerManagerV1BaseCtl
{
    /**
     * Browse server filesystem with security restrictions
     */
    public function browse(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'file_browse');
        if ($validation) {
            return $validation;
        }
        
        try {
            $path = $request->input('path', '/');
            $path = ServerManagerV1Utils::sanitizePath($path);
            
            // Security check: validate path is allowed
            if (!ServerManagerV1Utils::isPathAllowed($path)) {
                ServerManagerV1Utils::logFileAccess('browse', $path, false, 'Path not in whitelist');
                return $this->errorResponse(
                    'Access denied. Path not in allowed whitelist.',
                    ServerManagerV1Constants::RESPONSE_FORBIDDEN
                );
            }
            
            if (!is_dir($path)) {
                ServerManagerV1Utils::logFileAccess('browse', $path, false, 'Path is not a directory');
                return $this->errorResponse(
                    'Path is not a directory or does not exist.',
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }
            
            $items = ServerManagerV1Utils::getDirectoryListing($path);
            
            // Log successful access
            ServerManagerV1Utils::logFileAccess('browse', $path, true);
            
            return $this->successResponse([
                'path' => $path,
                'items' => $items,
                'total_items' => count($items),
                'allowed_paths' => ServerManagerV1Constants::getAllowedDownloadPaths()
            ], 'Directory listing retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'file_browse');
        }
    }
    
    /**
     * Download files from server with security restrictions
     */
    public function download(Request $request): Response|JsonResponse
    {
        $validation = $this->validateRequest($request, 'file_download');
        if ($validation) {
            return $validation;
        }
        
        $paramValidation = $this->validateParameters($request, ['file_path']);
        if ($paramValidation) {
            return $paramValidation;
        }
        
        try {
            $filePath = $request->input('file_path');
            $filePath = ServerManagerV1Utils::sanitizePath($filePath);
            
            // Security check: validate path is allowed
            if (!ServerManagerV1Utils::isPathAllowed($filePath)) {
                ServerManagerV1Utils::logFileAccess('download', $filePath, false, 'Path not in whitelist');
                return $this->errorResponse(
                    'Access denied. File path not in allowed whitelist.',
                    ServerManagerV1Constants::RESPONSE_FORBIDDEN
                );
            }
            
            if (!file_exists($filePath)) {
                ServerManagerV1Utils::logFileAccess('download', $filePath, false, 'File does not exist');
                return $this->errorResponse(
                    'File does not exist.',
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }
            
            if (!is_file($filePath)) {
                ServerManagerV1Utils::logFileAccess('download', $filePath, false, 'Path is not a file');
                return $this->errorResponse(
                    'Path is not a file.',
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            $fileSize = filesize($filePath);
            
            // Check file size limit
            if ($fileSize > ServerManagerV1Constants::MAX_FILE_DOWNLOAD_SIZE) {
                ServerManagerV1Utils::logFileAccess('download', $filePath, false, 'File too large');
                return $this->errorResponse(
                    'File too large. Maximum size: ' . ServerManagerV1Utils::formatFileSize(ServerManagerV1Constants::MAX_FILE_DOWNLOAD_SIZE),
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            // Log successful access
            ServerManagerV1Utils::logFileAccess('download', $filePath, true);
            
            $fileName = basename($filePath);
            $mimeType = mime_content_type($filePath) ?: 'application/octet-stream';
            
            return response()->download($filePath, $fileName, [
                'Content-Type' => $mimeType,
                'Content-Length' => $fileSize,
                'Cache-Control' => 'no-cache, must-revalidate',
                'Expires' => '0'
            ]);
            
        } catch (\Exception $e) {
            Log::error('File download error', [
                'file_path' => $filePath ?? 'unknown',
                'error' => $e->getMessage(),
                'ip' => $request->ip()
            ]);
            
            return $this->errorResponse(
                'File download failed.',
                ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
            );
        }
    }
    
    /**
     * Get file information
     */
    public function getFileInfo(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'file_info');
        if ($validation) {
            return $validation;
        }
        
        $paramValidation = $this->validateParameters($request, ['file_path']);
        if ($paramValidation) {
            return $paramValidation;
        }
        
        try {
            $filePath = $request->input('file_path');
            $filePath = ServerManagerV1Utils::sanitizePath($filePath);
            
            // Security check: validate path is allowed
            if (!ServerManagerV1Utils::isPathAllowed($filePath)) {
                ServerManagerV1Utils::logFileAccess('info', $filePath, false, 'Path not in whitelist');
                return $this->errorResponse(
                    'Access denied. File path not in allowed whitelist.',
                    ServerManagerV1Constants::RESPONSE_FORBIDDEN
                );
            }
            
            if (!file_exists($filePath)) {
                ServerManagerV1Utils::logFileAccess('info', $filePath, false, 'File does not exist');
                return $this->errorResponse(
                    'File does not exist.',
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }
            
            $isDirectory = is_dir($filePath);
            $fileInfo = [
                'path' => $filePath,
                'name' => basename($filePath),
                'is_directory' => $isDirectory,
                'size' => $isDirectory ? 0 : filesize($filePath),
                'size_human' => $isDirectory ? '0 B' : ServerManagerV1Utils::formatFileSize(filesize($filePath)),
                'modified' => filemtime($filePath),
                'modified_human' => date('Y-m-d H:i:s', filemtime($filePath)),
                'permissions' => substr(sprintf('%o', fileperms($filePath)), -4),
                'readable' => is_readable($filePath),
                'writable' => is_writable($filePath),
                'executable' => is_executable($filePath)
            ];
            
            if (!$isDirectory) {
                $fileInfo['mime_type'] = mime_content_type($filePath) ?: 'unknown';
                $fileInfo['extension'] = pathinfo($filePath, PATHINFO_EXTENSION);
                $fileInfo['can_preview'] = ServerManagerV1Utils::isPreviewAllowed($filePath);
            }
            
            // Log successful access
            ServerManagerV1Utils::logFileAccess('info', $filePath, true);
            
            return $this->successResponse($fileInfo, 'File information retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'file_info');
        }
    }
    
    /**
     * Preview text files
     */
    public function preview(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'file_preview');
        if ($validation) {
            return $validation;
        }
        
        $paramValidation = $this->validateParameters($request, ['file_path']);
        if ($paramValidation) {
            return $paramValidation;
        }
        
        try {
            $filePath = $request->input('file_path');
            $filePath = ServerManagerV1Utils::sanitizePath($filePath);
            $maxLines = (int)$request->input('max_lines', 100);
            $maxLines = min($maxLines, 1000); // Hard limit
            
            // Security check: validate path is allowed
            if (!ServerManagerV1Utils::isPathAllowed($filePath)) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'Path not in whitelist');
                return $this->errorResponse(
                    'Access denied. File path not in allowed whitelist.',
                    ServerManagerV1Constants::RESPONSE_FORBIDDEN
                );
            }
            
            if (!file_exists($filePath)) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'File does not exist');
                return $this->errorResponse(
                    'File does not exist.',
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }
            
            if (!is_file($filePath)) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'Path is not a file');
                return $this->errorResponse(
                    'Path is not a file.',
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            // Check if file type is allowed for preview
            if (!ServerManagerV1Utils::isPreviewAllowed($filePath)) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'File type not allowed for preview');
                return $this->errorResponse(
                    'File type not allowed for preview. Allowed extensions: ' . implode(', ', ServerManagerV1Constants::ALLOWED_PREVIEW_EXTENSIONS),
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            $fileSize = filesize($filePath);
            
            // Check file size for preview (smaller limit than download)
            $maxPreviewSize = 1048576; // 1MB
            if ($fileSize > $maxPreviewSize) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'File too large for preview');
                return $this->errorResponse(
                    'File too large for preview. Maximum size: ' . ServerManagerV1Utils::formatFileSize($maxPreviewSize),
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            // Read file content
            $content = file_get_contents($filePath);
            if ($content === false) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'Failed to read file');
                return $this->errorResponse(
                    'Failed to read file content.',
                    ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
                );
            }
            
            // Split into lines and limit
            $lines = explode("\n", $content);
            $totalLines = count($lines);
            $truncated = false;
            
            if ($totalLines > $maxLines) {
                $lines = array_slice($lines, 0, $maxLines);
                $truncated = true;
            }
            
            // Log successful access
            ServerManagerV1Utils::logFileAccess('preview', $filePath, true);
            
            return $this->successResponse([
                'file_path' => $filePath,
                'file_name' => basename($filePath),
                'file_size' => $fileSize,
                'file_size_human' => ServerManagerV1Utils::formatFileSize($fileSize),
                'total_lines' => $totalLines,
                'displayed_lines' => count($lines),
                'truncated' => $truncated,
                'content' => implode("\n", $lines),
                'lines' => $lines,
                'mime_type' => mime_content_type($filePath) ?: 'text/plain'
            ], 'File preview retrieved successfully');
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'file_preview');
        }
    }
}
