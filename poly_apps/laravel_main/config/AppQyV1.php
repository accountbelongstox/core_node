<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

use App\Providers\PathMapper;

$externalDataRoot = PathMapper::mapWebPath('app_external_data');
$databaseRoot = PathMapper::mapWebPath('app_external_data', 'databases');
$audioRoot = PathMapper::getLaravelStaticDir('app_qy_v1/audio');
$imageRoot = PathMapper::getLaravelStaticDir('app_qy_v1');
$cacheRoot = PathMapper::getLaravelCacheDir('app_qy_v1');
$tempRoot = PathMapper::getLaravelTmpDir('app_qy_v1');
$markersRoot = PathMapper::getLaravelDataDir('markers/app_qy_v1');

return [
    /*
    |--------------------------------------------------------------------------
    | AppQyV1 Application Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains configuration options for the AppQyV1 dictionary
    | application including paths, storage settings, and external dependencies.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Storage Paths Configuration
    |--------------------------------------------------------------------------
    |
    | These paths define where AppQyV1 stores its external data including
    | databases, audio files, images, and cache directories.
    |
    */
    'paths' => [
        'external_data_root' => $externalDataRoot,

        'main_database' => $databaseRoot.'/dictv1_main.sqlite',
        'legacy_database' => $databaseRoot.'/legacy_data.db',
        'cache_database' => $databaseRoot.'/cache_translate.db',

        'audio_directory' => $audioRoot.'/word_sounds',
        'audio_subtitles' => $audioRoot.'/word_subtitles',
        'sentence_sounds' => $audioRoot.'/sentence_sounds',
        'sentence_subtitles' => $audioRoot.'/sentence_subtitles',
        'audio_archive' => $cacheRoot.'/audio_archive.7z',

        'images_directory' => $imageRoot.'/word_images',
        'images_archive' => $cacheRoot.'/images_archive.7z',

        'cache_directory' => $cacheRoot,
        'temp_directory' => $tempRoot,

        'markers_directory' => $markersRoot,
    ],

    /*
    |--------------------------------------------------------------------------
    | URL Configuration
    |--------------------------------------------------------------------------
    |
    | URL prefixes for accessing static resources through the web interface.
    |
    */
    'urls' => [
        'audio_url_prefix' => '/static/app_qy_v1/audio',
        'images_url_prefix' => '/static/app_qy_v1/word_images',
        'cdn_audio_prefix' => null,
        'cdn_images_prefix' => null,
    ],

    /*
    |--------------------------------------------------------------------------
    | AI Translation Provider Fallback
    |--------------------------------------------------------------------------
    |
    | Order in which AppQyV1TranslationService::translateWithFallback() tries
    | AI providers. The first provider that returns a usable translation wins;
    | on error / over-quota / down it falls through to the next. The final
    | "google" provider delegates to pycore (PycoreTranslatorUtil) so a request
    | still completes even when every direct LLM key is unavailable.
    |
    | Allowed values: openrouter, gemini, deepseek, google.
    |
    */
    'ai' => [
        'fallback_chain' => ['openrouter', 'gemini', 'deepseek', 'google'],

        // Per-provider model override (null = each client's own default).
        'models' => [
            'openrouter' => null,
            'gemini' => null,
            'deepseek' => null,
        ],

        // Status-endpoint cache TTL (seconds). Octane-friendly; keeps repeated
        // probes cheap. Matches pycore's ai_probe cache window.
        'status_cache_ttl' => 30,
    ],

    /*
    |--------------------------------------------------------------------------
    | External Dependencies
    |--------------------------------------------------------------------------
    |
    | Configuration for external tools and dependencies required by AppQyV1.
    |
    */
    'dependencies' => [
        'python' => [
            'command' => 'python3',
            'required_version' => '3.7',
        ],

        'edge_tts' => [
            'package_name' => 'edge-tts',
            'install_command' => 'pip3 install edge-tts',
            'test_command' => 'python3 -c "import edge_tts; print(edge_tts.__version__)"',
        ],

        'edge_browser' => [
            'detection_command' => 'which microsoft-edge || which microsoft-edge-stable',
            'install_script' => 'dd.sh',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Authentication Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for the dual authentication system (user auth + resource access).
    |
    */
    'auth' => [
        'debug_tokens' => [],

        'resource_access_keys' => [],

        'modes' => [
            'debug' => [
                'enabled' => false,
                'header' => 'Auth-Debug-Token',
                'description' => 'Development mode resource access',
            ],

            'production' => [
                'header' => 'Resource-Access-Key',
                'description' => 'Production mode resource access',
            ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Processing Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for background processing, statistics, and resource management.
    |
    */
    'processing' => [
        'batch_size' => 1000,
        'max_memory_usage' => 512,
        'max_cpu_usage' => 80,

        'scheduled_tasks' => [
            'audio_generation_enabled' => true,
            'schedule_time_start' => '02:00',
            'schedule_time_end' => '06:00',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | File Format Support
    |--------------------------------------------------------------------------
    |
    | Supported file formats for audio and image resources.
    |
    */
    'formats' => [
        'audio' => ['mp3', 'wav', 'ogg', 'flac'],
        'images' => ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        'archives' => ['7z', 'zip', 'tar.gz'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Statistics and Monitoring
    |--------------------------------------------------------------------------
    |
    | Configuration for statistics collection and system monitoring.
    |
    */
    'statistics' => [
        'enabled' => true,
        'cache_duration' => 60,
        'detailed_logging' => false,
    ],
];
