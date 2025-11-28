<?php

namespace App\Apps\McpV1;

class McpV1ApiInfo
{
    public function getDetails(): array
    {
        return self::getApiInfo();
    }

    public static function getApiInfo(): array
    {
        return [
            'app_name' => 'McpV1',
            'api_version' => '1.0.0',
            'description' => 'MCP Bridge Application - OCR, Screenshot, and Task Dispatch',
            'base_path' => '/api/mcp/v1',
            'supported_headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
                'Authorization' => 'Bearer token (optional for some endpoints)'
            ],
            'endpoints' => self::getEndpoints()
        ];
    }

    private static function getEndpoints(): array
    {
        return [
            // OCR APIs
            [
                'path' => url('/api/mcp/v1/ocr/recognize'),
                'method' => 'POST',
                'description' => 'OCR text recognition',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/ocr/smart-recognize'),
                'method' => 'POST',
                'description' => 'Smart OCR with auto model selection',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/ocr/batch'),
                'method' => 'POST',
                'description' => 'Batch OCR processing',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/ocr/engines'),
                'method' => 'GET',
                'description' => 'Get available OCR engines',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/ocr/engine-info'),
                'method' => 'GET',
                'description' => 'Get OCR engine information',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/health'),
                'method' => 'GET',
                'description' => 'Health check',
                'auth_required' => false
            ],
            // Task Dispatch APIs
            [
                'path' => url('/api/mcp/v1/task-dispatch/categories'),
                'method' => 'GET',
                'description' => 'Get all task categories',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/categories/{categoryId}/files'),
                'method' => 'GET',
                'description' => 'Get files in a category',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/categories'),
                'method' => 'POST',
                'description' => 'Create new task category',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/queue/add-file'),
                'method' => 'POST',
                'description' => 'Add file to task queue',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/queue/{categoryId}/tasks'),
                'method' => 'GET',
                'description' => 'Get all tasks in category queue',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/queue/{categoryId}/last-task'),
                'method' => 'GET',
                'description' => 'Get last task in category queue',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/queue/{categoryId}/has-latest'),
                'method' => 'GET',
                'description' => 'Check if category has latest task',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/queue/{categoryId}/search'),
                'method' => 'GET',
                'description' => 'Search tasks in category',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/queue/{categoryId}/tasks/{taskId}/status'),
                'method' => 'PUT',
                'description' => 'Update task status',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/queue/{categoryId}/stats'),
                'method' => 'GET',
                'description' => 'Get queue statistics',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/mappings'),
                'method' => 'GET',
                'description' => 'Get all prompt mappings',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/mappings/{categoryId}'),
                'method' => 'GET',
                'description' => 'Get category prompt mapping',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/mappings/{categoryId}'),
                'method' => 'PUT',
                'description' => 'Update category prompt mapping',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/mappings/{categoryId}/reset'),
                'method' => 'POST',
                'description' => 'Reset category prompt mapping',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/task-dispatch/mappings/{categoryId}'),
                'method' => 'DELETE',
                'description' => 'Delete category prompt mapping',
                'auth_required' => false
            ],
            // Screenshot Management APIs
            [
                'path' => url('/api/mcp/v1/screenshots/upload'),
                'method' => 'POST',
                'description' => 'Upload screenshot',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots/upload-merge'),
                'method' => 'POST',
                'description' => 'Upload and merge screenshots',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots/upload-batch'),
                'method' => 'POST',
                'description' => 'Batch upload screenshots',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots/latest'),
                'method' => 'GET',
                'description' => 'Get latest screenshots',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots/search'),
                'method' => 'GET',
                'description' => 'Search screenshots',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots/stats'),
                'method' => 'GET',
                'description' => 'Get screenshot statistics',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots'),
                'method' => 'GET',
                'description' => 'Get all screenshots',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots/{id}'),
                'method' => 'GET',
                'description' => 'Get screenshot by ID',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots/{id}/file'),
                'method' => 'GET',
                'description' => 'Stream screenshot file',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots/{id}.{ext}'),
                'method' => 'GET',
                'description' => 'Stream screenshot file with extension',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots/{id}'),
                'method' => 'DELETE',
                'description' => 'Delete screenshot',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/screenshots/clear-all/confirm'),
                'method' => 'DELETE',
                'description' => 'Clear all screenshots (requires confirmation)',
                'auth_required' => false
            ],
            // Placeholder Generator APIs
            [
                'path' => url('/api/mcp/v1/placeholders/generate'),
                'method' => 'POST',
                'description' => 'Generate placeholder image',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/placeholders'),
                'method' => 'GET',
                'description' => 'List placeholder images',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/placeholders/stats'),
                'method' => 'GET',
                'description' => 'Get placeholder statistics',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/placeholders/cleanup'),
                'method' => 'POST',
                'description' => 'Cleanup old placeholders',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/placeholders/{uuid}/download'),
                'method' => 'GET',
                'description' => 'Download placeholder image',
                'auth_required' => false
            ],
            [
                'path' => url('/api/mcp/v1/placeholders/{uuid}'),
                'method' => 'DELETE',
                'description' => 'Delete placeholder image',
                'auth_required' => false
            ]
        ];
    }
}
