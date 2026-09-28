<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1ElevatedAccess;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
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

        // Get allowed paths
        $allowedPaths = ServerManagerV1Constants::getAllowedDownloadPaths();
        $requestedPath = $request->input('path');
        $resolved = ServerManagerV1Utils::resolveBrowsePath(
            is_string($requestedPath) && trim($requestedPath) !== '' ? $requestedPath : null
        );
        $realPath = $resolved['path'];

        if ($realPath === null) {
            ServerManagerV1Utils::logFileAccess('browse', $requestedPath ?? '', false, 'No allowed directory exists');
            return $this->error(
                __('server_manager.messages.no_allowed_directory_exists_on_this_host'),
                ServerManagerV1Constants::RESPONSE_NOT_FOUND,
                ['allowed_paths' => $allowedPaths]
            );
        }

        if (!ServerManagerV1Utils::isPathAllowed($realPath)) {
            ServerManagerV1Utils::logFileAccess('browse', $realPath, false, 'Path not in whitelist');
            return $this->error(
                __('server_manager.messages.access_denied_path_not_in_allowed_whitelist'),
                ServerManagerV1Constants::RESPONSE_FORBIDDEN,
                [
                    'path' => $realPath,
                    'allowed_paths' => $allowedPaths
                ]
            );
        }

        if (!is_dir($realPath)) {
            ServerManagerV1Utils::logFileAccess('browse', $realPath, false, 'Path is not a directory');
            return $this->error(
                __('server_manager.messages.path_is_not_a_directory'),
                ServerManagerV1Constants::RESPONSE_NOT_FOUND,
                ['path' => $realPath]
            );
        }

        $items = ServerManagerV1Utils::getDirectoryListing($realPath);

        // Log successful access
        ServerManagerV1Utils::logFileAccess('browse', $realPath, true);

        return $this->success([
            'path' => $realPath,
            'items' => $items,
            'total_items' => count($items),
            'allowed_paths' => $allowedPaths,
            'path_fallback' => (bool) ($resolved['fallback'] ?? false),
            'requested_path' => $resolved['requested'] ?? null,
        ], __('server_manager.messages.directory_listing_retrieved_successfully'));
    }

    /**
     * Download files from server with security restrictions
     */
    public function download(Request $request): BinaryFileResponse|JsonResponse
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
                return $this->error(
                    __('server_manager.messages.access_denied_file_path_not_in_allowed'),
                    ServerManagerV1Constants::RESPONSE_FORBIDDEN
                );
            }
            
            if (!file_exists($filePath)) {
                ServerManagerV1Utils::logFileAccess('download', $filePath, false, 'File does not exist');
                return $this->error(
                    __('server_manager.messages.file_does_not_exist'),
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }
            
            if (!is_file($filePath)) {
                ServerManagerV1Utils::logFileAccess('download', $filePath, false, 'Path is not a file');
                return $this->error(
                    __('server_manager.messages.path_is_not_a_file'),
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            $fileSize = filesize($filePath);
            
            // Check file size limit
            if ($fileSize > ServerManagerV1Constants::MAX_FILE_DOWNLOAD_SIZE) {
                ServerManagerV1Utils::logFileAccess('download', $filePath, false, 'File too large');
                return $this->error(
                    __('server_manager.messages.file_too_large_maximum_size') . ServerManagerV1Utils::formatFileSize(ServerManagerV1Constants::MAX_FILE_DOWNLOAD_SIZE),
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
            
            return $this->error(
                __('server_manager.messages.file_download_failed'),
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
                return $this->error(
                    __('server_manager.messages.access_denied_file_path_not_in_allowed'),
                    ServerManagerV1Constants::RESPONSE_FORBIDDEN
                );
            }
            
            if (!file_exists($filePath)) {
                ServerManagerV1Utils::logFileAccess('info', $filePath, false, 'File does not exist');
                return $this->error(
                    __('server_manager.messages.file_does_not_exist'),
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
            
            return $this->success($fileInfo, __('server_manager.messages.file_information_retrieved_successfully'));
            
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
            $forEdit = filter_var($request->input('for_edit', false), FILTER_VALIDATE_BOOLEAN);
            $maxPreviewSize = $forEdit
                ? ServerManagerV1Constants::MAX_FILE_WRITE_SIZE
                : 1048576;
            $maxLines = $forEdit
                ? min(max($maxLines, 1000), 50000)
                : min($maxLines, 1000);
            
            // Security check: validate path is allowed
            if (!ServerManagerV1Utils::isPathAllowed($filePath)) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'Path not in whitelist');
                return $this->error(
                    __('server_manager.messages.access_denied_file_path_not_in_allowed'),
                    ServerManagerV1Constants::RESPONSE_FORBIDDEN
                );
            }
            
            if (!file_exists($filePath)) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'File does not exist');
                return $this->error(
                    __('server_manager.messages.file_does_not_exist'),
                    ServerManagerV1Constants::RESPONSE_NOT_FOUND
                );
            }
            
            if (!is_file($filePath)) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'Path is not a file');
                return $this->error(
                    __('server_manager.messages.path_is_not_a_file'),
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            $fileSize = filesize($filePath);
            
            // Check file size for preview (smaller limit than download)
            if ($fileSize > $maxPreviewSize) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'File too large for preview');
                return $this->error(
                    __('server_manager.messages.file_too_large_for_preview_maximum_size') . ServerManagerV1Utils::formatFileSize($maxPreviewSize),
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }
            
            // Read file content
            $content = file_get_contents($filePath);
            if ($content === false) {
                ServerManagerV1Utils::logFileAccess('preview', $filePath, false, 'Failed to read file');
                return $this->error(
                    __('server_manager.messages.failed_to_read_file_content'),
                    ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR
                );
            }

            $isBinary = ServerManagerV1Utils::isBinaryContent($content);
            $previewContent = $isBinary ? base64_encode($content) : $content;
            
            // Split into lines and limit
            $lines = $isBinary ? [] : explode("\n", $content);
            $totalLines = $isBinary ? 0 : count($lines);
            $truncated = false;
            
            if (!$isBinary && $totalLines > $maxLines) {
                $lines = array_slice($lines, 0, $maxLines);
                $truncated = true;
                $previewContent = implode("\n", $lines);
            }
            
            // Log successful access
            ServerManagerV1Utils::logFileAccess('preview', $filePath, true);
            
            return $this->success([
                'file_path' => $filePath,
                'file_name' => basename($filePath),
                'file_size' => $fileSize,
                'file_size_human' => ServerManagerV1Utils::formatFileSize($fileSize),
                'total_lines' => $totalLines,
                'displayed_lines' => $isBinary ? 0 : count($lines),
                'truncated' => $truncated,
                'is_binary' => $isBinary,
                'encoding' => $isBinary ? 'base64' : 'utf-8',
                'content' => $previewContent,
                'lines' => $isBinary ? [] : $lines,
                'mime_type' => mime_content_type($filePath) ?: 'application/octet-stream'
            ], __('server_manager.messages.file_preview_retrieved_successfully'));
            
        } catch (\Exception $e) {
            return $this->handleException($e, 'file_preview');
        }
    }

    /**
     * Write text file content with whitelist and optional elevated access.
     */
    public function write(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'file_write');
        if ($validation) {
            return $validation;
        }

        $paramValidation = $this->validateParameters($request, ['file_path']);
        if ($paramValidation) {
            return $paramValidation;
        }

        if (!$request->has('content') || !is_string($request->input('content'))) {
            return $this->error(
                __('server_manager.messages.missing_required_parameter_content'),
                ServerManagerV1Constants::RESPONSE_BAD_REQUEST
            );
        }

        try {
            $filePath = ServerManagerV1Utils::sanitizePath($request->input('file_path'));
            $content = $request->input('content');
            $encoding = $request->input('encoding', 'utf-8');

            if ($encoding === 'base64') {
                $decoded = base64_decode($content, true);
                if ($decoded === false) {
                    return $this->error(
                        __('server_manager.messages.invalid_base64_content'),
                        ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                    );
                }
                $content = $decoded;
            }

            $contentBytes = strlen($content);

            if ($contentBytes > ServerManagerV1Constants::MAX_FILE_WRITE_SIZE) {
                return $this->error(
                    __('server_manager.messages.file_content_too_large_maximum_size') . ServerManagerV1Utils::formatFileSize(ServerManagerV1Constants::MAX_FILE_WRITE_SIZE),
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            $existingReal = realpath($filePath);
            $parentReal = $existingReal !== false
                ? dirname($existingReal)
                : realpath(dirname($filePath));

            if ($existingReal !== false) {
                if (!ServerManagerV1Utils::isPathAllowed($existingReal)) {
                    ServerManagerV1Utils::logFileAccess('write', $existingReal, false, 'Path not in whitelist');
                    return $this->error(
                        __('server_manager.messages.access_denied_file_path_not_in_allowed'),
                        ServerManagerV1Constants::RESPONSE_FORBIDDEN
                    );
                }
                $targetPath = $existingReal;
            } elseif ($parentReal !== false && ServerManagerV1Utils::isPathAllowed($parentReal)) {
                $targetPath = $parentReal . DIRECTORY_SEPARATOR . basename($filePath);
            } else {
                ServerManagerV1Utils::logFileAccess('write', $filePath, false, 'Path not in whitelist');
                return $this->error(
                    __('server_manager.messages.access_denied_file_path_not_in_allowed'),
                    ServerManagerV1Constants::RESPONSE_FORBIDDEN
                );
            }

            if (file_exists($targetPath) && is_dir($targetPath)) {
                return $this->error(
                    __('server_manager.messages.target_path_is_a_directory'),
                    ServerManagerV1Constants::RESPONSE_BAD_REQUEST
                );
            }

            $clientIp = $this->getClientIp($request);
            $elevatedToken = $request->header(ServerManagerV1Constants::ELEVATED_TOKEN_HEADER);
            $needsElevation = file_exists($targetPath) ? !is_writable($targetPath) : !is_writable($parentReal ?? dirname($targetPath));

            if ($needsElevation) {
                if (!$elevatedToken || !ServerManagerV1ElevatedAccess::validateToken($elevatedToken, $clientIp)) {
                    ServerManagerV1Utils::logFileAccess('write', $targetPath, false, 'Elevated access required');
                    return $this->error(
                        __('server_manager.messages.elevated_access_required_to_write_this_file'),
                        ServerManagerV1Constants::RESPONSE_FORBIDDEN,
                        ['needs_elevation' => true]
                    );
                }

                $writeResult = ServerManagerV1ElevatedAccess::writeFileWithToken(
                    $targetPath,
                    $content,
                    $elevatedToken,
                    $clientIp
                );
            } else {
                $writeResult = ServerManagerV1Utils::writeFileDirect($targetPath, $content);
            }

            if (!$writeResult['success']) {
                ServerManagerV1Utils::logFileAccess('write', $targetPath, false, $writeResult['error'] ?? 'Write failed');
                return $this->error(
                    $writeResult['error'] ?? 'Failed to write file.',
                    $writeResult['code'] ?? ServerManagerV1Constants::RESPONSE_INTERNAL_ERROR,
                    ['needs_elevation' => $writeResult['needs_elevation'] ?? false]
                );
            }

            clearstatcache(true, $targetPath);
            ServerManagerV1Utils::logFileAccess('write', $targetPath, true);

            return $this->success([
                'file_path' => $targetPath,
                'file_name' => basename($targetPath),
                'size' => filesize($targetPath),
                'size_human' => ServerManagerV1Utils::formatFileSize((int) filesize($targetPath)),
                'modified' => filemtime($targetPath),
                'modified_human' => date('Y-m-d H:i:s', filemtime($targetPath)),
                'elevated' => (bool) $needsElevation,
            ], __('server_manager.messages.file_saved_successfully'));
        } catch (\Exception $e) {
            return $this->handleException($e, 'file_write');
        }
    }

    /**
     * Exchange root password for a short-lived elevated access token.
     */
    public function elevatedAuth(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'file_elevated_auth');
        if ($validation) {
            return $validation;
        }

        if (!$request->has('password') || !is_string($request->input('password'))) {
            return $this->error(
                __('server_manager.messages.missing_required_parameter_password'),
                ServerManagerV1Constants::RESPONSE_BAD_REQUEST
            );
        }

        $result = ServerManagerV1ElevatedAccess::authenticate(
            $request->input('password'),
            $this->getClientIp($request)
        );

        if (!$result['success']) {
            return $this->error(
                $result['error'] ?? 'Authentication failed.',
                $result['code'] ?? ServerManagerV1Constants::RESPONSE_FORBIDDEN
            );
        }

        return $this->success([
            'token' => $result['token'],
            'expires_in' => $result['expires_in'],
            'header' => ServerManagerV1Constants::ELEVATED_TOKEN_HEADER,
        ], __('server_manager.messages.elevated_access_granted'));
    }

    /**
     * Revoke an elevated access token.
     */
    public function revokeElevatedAuth(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'file_elevated_revoke');
        if ($validation) {
            return $validation;
        }

        $token = $request->header(ServerManagerV1Constants::ELEVATED_TOKEN_HEADER)
            ?: $request->input('token');

        ServerManagerV1ElevatedAccess::revokeToken(is_string($token) ? $token : null);

        return $this->success(null, __('server_manager.messages.elevated_access_revoked'));
    }
}
