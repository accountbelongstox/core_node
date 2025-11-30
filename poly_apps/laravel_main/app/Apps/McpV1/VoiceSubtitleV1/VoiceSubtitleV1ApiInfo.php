<?php

namespace App\Apps\McpV1\VoiceSubtitleV1;

class VoiceSubtitleV1ApiInfo
{
    public static function getApiInfo(): array
    {
        return [
            'app_name' => 'VoiceSubtitleV1',
            'app_version' => '1.0.0',
            'app_description' => 'Voice Subtitle Manager - AI-powered TTS with multi-language support',
            'base_url' => '/api/voice-subtitle/v1',
            'apis' => [
                [
                    'method' => 'POST',
                    'path' => '/add',
                    'description' => 'Add item to subtitle queue',
                    'params' => [
                        'type' => 'string (required) - text|image|url|voice|file',
                        'content' => 'string (required) - Content or path/URL',
                        'language' => 'string (optional) - Target language (default: en)',
                        'voice' => 'string (optional) - TTS voice (default: en-US-AriaNeural)',
                    ],
                    'example' => [
                        'type' => 'text',
                        'content' => 'Hello, this is a test.',
                        'language' => 'en',
                        'voice' => 'en-US-AriaNeural',
                    ],
                ],
                [
                    'method' => 'GET',
                    'path' => '/queue',
                    'description' => 'Get current queue',
                    'params' => [],
                ],
                [
                    'method' => 'GET',
                    'path' => '/current',
                    'description' => 'Get current playing item',
                    'params' => [],
                ],
                [
                    'method' => 'POST',
                    'path' => '/next',
                    'description' => 'Move to next item',
                    'params' => [],
                ],
                [
                    'method' => 'POST',
                    'path' => '/previous',
                    'description' => 'Move to previous item',
                    'params' => [],
                ],
                [
                    'method' => 'POST',
                    'path' => '/set-index',
                    'description' => 'Set queue index',
                    'params' => [
                        'index' => 'integer (required) - Queue index to jump to',
                    ],
                ],
                [
                    'method' => 'DELETE',
                    'path' => '/remove',
                    'description' => 'Remove item from queue',
                    'params' => [
                        'index' => 'integer (required) - Queue index to remove',
                    ],
                ],
                [
                    'method' => 'DELETE',
                    'path' => '/clear',
                    'description' => 'Clear entire queue',
                    'params' => [],
                ],
                [
                    'method' => 'GET',
                    'path' => '/stats',
                    'description' => 'Get TTS cache statistics',
                    'params' => [],
                ],
            ],
        ];
    }
}
