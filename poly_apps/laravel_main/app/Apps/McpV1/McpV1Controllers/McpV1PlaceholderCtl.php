<?php

namespace App\Apps\McpV1\McpV1Controllers;

use App\Apps\McpV1\McpV1Models\McpV1PlaceholderImageModel;
use App\Apps\McpV1\McpV1Utils\McpV1PlaceholderUtil;
use App\Utils\FileSystemManager;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class McpV1PlaceholderCtl
{
    public function generate(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'width' => 'required|integer|min:1|max:4096',
                'height' => 'required|integer|min:1|max:4096',
                'text' => 'nullable|string|max:255',
                'real_image' => 'nullable|boolean',
            ]);

            $width = $validated['width'];
            $height = $validated['height'];
            $text = $validated['text'] ?? null;
            $realImage = $validated['real_image'] ?? false;

            $result = McpV1PlaceholderUtil::generatePlaceholder($width, $height, $text, $realImage);

            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'error' => $result['error'] ?? 'Failed to generate placeholder'
                ], 500);
            }

            $placeholder = McpV1PlaceholderImageModel::createRecord([
                'uuid' => $result['uuid'],
                'filename' => $result['filename'],
                'width' => $width,
                'height' => $height,
                'text' => $text,
                'type' => $result['type'],
                'file_path' => $result['file_path'],
                'file_size' => $result['file_size'],
                'downloaded' => false,
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'uuid' => $placeholder->uuid,
                    'filename' => $placeholder->filename,
                    'width' => $placeholder->width,
                    'height' => $placeholder->height,
                    'text' => $placeholder->text,
                    'type' => $placeholder->type,
                    'file_size' => $placeholder->file_size,
                    'download_url' => McpV1PlaceholderUtil::getDownloadUrl($placeholder->uuid),
                    'created_at' => $placeholder->created_at->toIso8601String(),
                ],
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Placeholder generation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to generate placeholder: ' . $e->getMessage()
            ], 500);
        }
    }

    public function download(string $uuid): BinaryFileResponse|JsonResponse
    {
        try {
            $placeholder = McpV1PlaceholderImageModel::findByUuid($uuid);

            if (!$placeholder) {
                return response()->json([
                    'success' => false,
                    'error' => 'Placeholder not found'
                ], 404);
            }

            if (!FileSystemManager::exists($placeholder->file_path)) {
                return response()->json([
                    'success' => false,
                    'error' => 'File not found'
                ], 404);
            }

            McpV1PlaceholderImageModel::markAsDownloaded($uuid);

            register_shutdown_function(function () use ($placeholder) {
                try {
                    if (connection_aborted() === 0) {
                        FileSystemManager::deleteFile($placeholder->file_path);
                        $placeholder->deleteRecord();
                        Log::info('Placeholder deleted after download', ['uuid' => $placeholder->uuid]);
                    }
                } catch (\Exception $e) {
                    Log::error('Failed to delete placeholder after download', [
                        'uuid' => $placeholder->uuid,
                        'error' => $e->getMessage()
                    ]);
                }
            });

            return response()->download(
                $placeholder->file_path,
                $placeholder->filename,
                [
                    'Content-Type' => 'image/png',
                    'Cache-Control' => 'no-cache, no-store, must-revalidate',
                ]
            );
        } catch (\Exception $e) {
            Log::error('Placeholder download failed', [
                'uuid' => $uuid,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to download placeholder'
            ], 500);
        }
    }

    public function list(Request $request): JsonResponse
    {
        try {
            $perPage = $request->input('per_page', 20);
            $page = $request->input('page', 1);

            $downloaded = $request->has('downloaded')
                ? filter_var($request->input('downloaded'), FILTER_VALIDATE_BOOLEAN)
                : null;
            $placeholders = McpV1PlaceholderImageModel::filteredPage(
                $downloaded,
                (int) $perPage,
                (int) $page
            );

            $items = $placeholders->items();
            $data = array_map(function ($item) {
                return [
                    'uuid' => $item->uuid,
                    'filename' => $item->filename,
                    'width' => $item->width,
                    'height' => $item->height,
                    'text' => $item->text,
                    'type' => $item->type,
                    'file_size' => $item->file_size,
                    'downloaded' => $item->downloaded,
                    'downloaded_at' => $item->downloaded_at?->toIso8601String(),
                    'download_url' => McpV1PlaceholderUtil::getDownloadUrl($item->uuid),
                    'created_at' => $item->created_at->toIso8601String(),
                ];
            }, $items);

            return response()->json([
                'success' => true,
                'data' => $data,
                'pagination' => [
                    'total' => $placeholders->total(),
                    'per_page' => $placeholders->perPage(),
                    'current_page' => $placeholders->currentPage(),
                    'last_page' => $placeholders->lastPage(),
                    'from' => $placeholders->firstItem(),
                    'to' => $placeholders->lastItem(),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to list placeholders', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to list placeholders'
            ], 500);
        }
    }

    public function stats(): JsonResponse
    {
        try {
            $stats = McpV1PlaceholderImageModel::getStats();

            return response()->json([
                'success' => true,
                'data' => $stats,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get placeholder stats', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to get stats'
            ], 500);
        }
    }

    public function cleanup(): JsonResponse
    {
        try {
            $deletedCount = McpV1PlaceholderImageModel::cleanupOldImages();
            $deletedFiles = McpV1PlaceholderUtil::cleanupOldFiles();

            return response()->json([
                'success' => true,
                'data' => [
                    'deleted_records' => $deletedCount,
                    'deleted_files' => $deletedFiles,
                    'message' => "Cleanup completed: {$deletedCount} records and {$deletedFiles} files deleted"
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Cleanup failed', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Cleanup failed: ' . $e->getMessage()
            ], 500);
        }
    }

    public function delete(string $uuid): JsonResponse
    {
        try {
            $placeholder = McpV1PlaceholderImageModel::findByUuid($uuid);

            if (!$placeholder) {
                return response()->json([
                    'success' => false,
                    'error' => 'Placeholder not found'
                ], 404);
            }

            if (FileSystemManager::exists($placeholder->file_path)) {
                FileSystemManager::deleteFile($placeholder->file_path);
            }

            $placeholder->deleteRecord();

            return response()->json([
                'success' => true,
                'message' => 'Placeholder deleted successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to delete placeholder', [
                'uuid' => $uuid,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to delete placeholder'
            ], 500);
        }
    }
}
