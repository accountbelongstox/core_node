<?php

namespace App\Apps\McpV1;

class McpV1ApiInfo
{
    public static function getApiInfo(): array
    {
        return [
            'app_name' => 'McpV1',
            'app_version' => '1.0.0',
            'description' => 'MCP Bridge Application',
            'base_path' => '/api/mcp/v1',
            'apis' => [
                '/ocr/recognize' => [
                    'method' => 'POST',
                    'feature' => 'OCR text recognition'
                ],
                '/ocr/smart-recognize' => [
                    'method' => 'POST',
                    'feature' => 'Smart OCR with auto model selection'
                ],
                '/ocr/batch' => [
                    'method' => 'POST',
                    'feature' => 'Batch OCR processing'
                ],
                '/ocr/engines' => [
                    'method' => 'GET',
                    'feature' => 'Get available OCR engines'
                ],
                '/ocr/engine-info' => [
                    'method' => 'GET',
                    'feature' => 'Get OCR engine information'
                ],
                '/health' => [
                    'method' => 'GET',
                    'feature' => 'Health check'
                ]
            ]
        ];
    }
}
