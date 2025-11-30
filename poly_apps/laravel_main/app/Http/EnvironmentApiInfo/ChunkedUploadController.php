<?php

namespace App\Http\EnvironmentApiInfo;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

class ChunkedUploadController
{
    private $baseDirectory;
    private $chunksDirectory;

    public function __construct()
    {
        $this->baseDirectory = PathMapper::getStaticPath();
        $this->chunksDirectory = storage_path('app/upload_chunks');
        FileSystemManager::ensureDirectoryExists($this->baseDirectory);
        FileSystemManager::ensureDirectoryExists($this->chunksDirectory);
    }

    public function initUpload(Request $request)
    {
        $uploadId = null;
        $fileName = null;
        $fileSize = null;
        $chunkSize = null;
        $totalChunks = null;
        $targetPath = null;
        $uploadDir = null;

        $request->validate([
            'file_name' => 'required|string',
            'file_size' => 'required|integer',
            'chunk_size' => 'required|integer',
            'target_path' => 'required|string',
            'file_hash' => 'nullable|string'
        ]);

        $uploadId = uniqid('upload_', true);
        $fileName = $request->input('file_name');
        $fileSize = $request->input('file_size');
        $chunkSize = $request->input('chunk_size');
        $totalChunks = (int) ceil($fileSize / $chunkSize);
        $targetPath = $request->input('target_path');

        $uploadDir = $this->chunksDirectory . DIRECTORY_SEPARATOR . $uploadId;
        FileSystemManager::mkdir($uploadDir, 0755, true);

        $metadata = [
            'upload_id' => $uploadId,
            'file_name' => $fileName,
            'file_size' => $fileSize,
            'chunk_size' => $chunkSize,
            'total_chunks' => $totalChunks,
            'target_path' => $targetPath,
            'uploaded_chunks' => [],
            'created_at' => time(),
            'file_hash' => $request->input('file_hash', '')
        ];

        FileSystemManager::writeFile(
            $uploadDir . DIRECTORY_SEPARATOR . 'metadata.json',
            json_encode($metadata, JSON_PRETTY_PRINT)
        );

        return response()->json([
            'success' => true,
            'upload_id' => $uploadId,
            'total_chunks' => $totalChunks,
            'chunk_size' => $chunkSize
        ]);
    }

    public function uploadChunk(Request $request)
    {
        $uploadId = null;
        $chunkIndex = null;
        $uploadDir = null;
        $metadataPath = null;
        $metadata = null;
        $chunkPath = null;

        $request->validate([
            'upload_id' => 'required|string',
            'chunk_index' => 'required|integer',
            'chunk' => 'required|file'
        ]);

        $uploadId = $request->input('upload_id');
        $chunkIndex = $request->input('chunk_index');
        $uploadDir = $this->chunksDirectory . DIRECTORY_SEPARATOR . $uploadId;

        if (!FileSystemManager::exists($uploadDir)) {
            return response()->json([
                'error' => 'Upload session not found'
            ], 404);
        }

        $metadataPath = $uploadDir . DIRECTORY_SEPARATOR . 'metadata.json';
        if (!FileSystemManager::exists($metadataPath)) {
            return response()->json([
                'error' => 'Upload metadata not found'
            ], 404);
        }

        $metadata = json_decode(FileSystemManager::readFile($metadataPath), true);

        if ($chunkIndex >= $metadata['total_chunks']) {
            return response()->json([
                'error' => 'Invalid chunk index'
            ], 400);
        }

        $chunkPath = $uploadDir . DIRECTORY_SEPARATOR . "chunk_{$chunkIndex}";
        $request->file('chunk')->move($uploadDir, "chunk_{$chunkIndex}");

        if (!in_array($chunkIndex, $metadata['uploaded_chunks'])) {
            $metadata['uploaded_chunks'][] = $chunkIndex;
            sort($metadata['uploaded_chunks']);
        }

        $metadata['last_updated'] = time();

        FileSystemManager::writeFile($metadataPath, json_encode($metadata, JSON_PRETTY_PRINT));

        return response()->json([
            'success' => true,
            'uploaded_chunks' => count($metadata['uploaded_chunks']),
            'total_chunks' => $metadata['total_chunks'],
            'progress' => (count($metadata['uploaded_chunks']) / $metadata['total_chunks']) * 100
        ]);
    }

    public function checkProgress(Request $request)
    {
        $uploadId = null;
        $uploadDir = null;
        $metadataPath = null;
        $metadata = null;

        $request->validate([
            'upload_id' => 'required|string'
        ]);

        $uploadId = $request->input('upload_id');
        $uploadDir = $this->chunksDirectory . DIRECTORY_SEPARATOR . $uploadId;

        if (!FileSystemManager::exists($uploadDir)) {
            return response()->json([
                'error' => 'Upload session not found'
            ], 404);
        }

        $metadataPath = $uploadDir . DIRECTORY_SEPARATOR . 'metadata.json';
        $metadata = json_decode(FileSystemManager::readFile($metadataPath), true);

        return response()->json([
            'success' => true,
            'uploaded_chunks' => $metadata['uploaded_chunks'],
            'total_chunks' => $metadata['total_chunks'],
            'progress' => (count($metadata['uploaded_chunks']) / $metadata['total_chunks']) * 100,
            'file_name' => $metadata['file_name'],
            'file_size' => $metadata['file_size']
        ]);
    }

    public function mergeChunks(Request $request)
    {
        $uploadId = null;
        $uploadDir = null;
        $metadataPath = null;
        $metadata = null;
        $targetFullPath = null;
        $finalPath = null;
        $outputHandle = null;
        $i = null;
        $chunkPath = null;
        $chunkData = null;

        $request->validate([
            'upload_id' => 'required|string'
        ]);

        $uploadId = $request->input('upload_id');
        $uploadDir = $this->chunksDirectory . DIRECTORY_SEPARATOR . $uploadId;

        if (!FileSystemManager::exists($uploadDir)) {
            return response()->json([
                'error' => 'Upload session not found'
            ], 404);
        }

        $metadataPath = $uploadDir . DIRECTORY_SEPARATOR . 'metadata.json';

        if (!FileSystemManager::exists($metadataPath)) {
            return response()->json([
                'error' => 'Upload metadata not found'
            ], 404);
        }

        $metadata = json_decode(FileSystemManager::readFile($metadataPath), true);

        if (!$metadata) {
            return response()->json([
                'error' => 'Invalid upload metadata'
            ], 500);
        }

        if (count($metadata['uploaded_chunks']) !== $metadata['total_chunks']) {
            return response()->json([
                'error' => 'Not all chunks uploaded',
                'uploaded' => count($metadata['uploaded_chunks']),
                'total' => $metadata['total_chunks']
            ], 400);
        }

        $targetFullPath = $this->baseDirectory . DIRECTORY_SEPARATOR . $metadata['target_path'];

        $fileName = str_replace('/', DIRECTORY_SEPARATOR, $metadata['file_name']);
        $fileName = str_replace('\\', DIRECTORY_SEPARATOR, $fileName);

        $pathParts = explode(DIRECTORY_SEPARATOR, $fileName);
        $actualFileName = array_pop($pathParts);

        $currentPath = $targetFullPath;
        foreach ($pathParts as $dirName) {
            if (!empty($dirName)) {
                $currentPath = $currentPath . DIRECTORY_SEPARATOR . $dirName;
                if (!FileSystemManager::exists($currentPath)) {
                    FileSystemManager::mkdir($currentPath, 0755, true);
                }
            }
        }

        if (!FileSystemManager::exists($currentPath) || !FileSystemManager::isDir($currentPath)) {
            return response()->json([
                'error' => 'Failed to create target directory'
            ], 500);
        }

        $finalPath = $currentPath . DIRECTORY_SEPARATOR . $actualFileName;

        if (FileSystemManager::exists($finalPath)) {
            $pathInfo = pathinfo($actualFileName);
            $basename = $pathInfo['filename'];
            $extension = isset($pathInfo['extension']) ? '.' . $pathInfo['extension'] : '';
            $counter = 1;

            while (FileSystemManager::exists($finalPath)) {
                $finalPath = $currentPath . DIRECTORY_SEPARATOR . $basename . '_' . $counter . $extension;
                $counter++;
            }
        }

        $outputHandle = fopen($finalPath, 'wb');

        for ($i = 0; $i < $metadata['total_chunks']; $i++) {
            $chunkPath = $uploadDir . DIRECTORY_SEPARATOR . "chunk_{$i}";

            if (!FileSystemManager::exists($chunkPath)) {
                fclose($outputHandle);
                FileSystemManager::delete($finalPath);

                return response()->json([
                    'error' => "Missing chunk {$i}"
                ], 500);
            }

            $chunkData = FileSystemManager::readFile($chunkPath);
            fwrite($outputHandle, $chunkData);
        }

        fclose($outputHandle);

        $this->cleanupChunks($uploadDir);

        return response()->json([
            'success' => true,
            'file_path' => str_replace($this->baseDirectory . DIRECTORY_SEPARATOR, '', $finalPath),
            'file_size' => FileSystemManager::filesize($finalPath)
        ]);
    }

    public function cancelUpload(Request $request)
    {
        $uploadId = null;
        $uploadDir = null;

        $request->validate([
            'upload_id' => 'required|string'
        ]);

        $uploadId = $request->input('upload_id');
        $uploadDir = $this->chunksDirectory . DIRECTORY_SEPARATOR . $uploadId;

        if (FileSystemManager::exists($uploadDir)) {
            $this->cleanupChunks($uploadDir);
        }

        return response()->json([
            'success' => true
        ]);
    }

    private function cleanupChunks($uploadDir)
    {
        if (FileSystemManager::exists($uploadDir)) {
            $files = FileSystemManager::scandir($uploadDir);

            foreach ($files as $file) {
                if ($file === '.' || $file === '..') {
                    continue;
                }

                $filePath = $uploadDir . DIRECTORY_SEPARATOR . $file;
                if (FileSystemManager::isFile($filePath)) {
                    FileSystemManager::delete($filePath);
                }
            }

            FileSystemManager::delete($uploadDir);
        }
    }
}
