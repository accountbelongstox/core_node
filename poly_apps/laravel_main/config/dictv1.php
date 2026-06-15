<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

return [
    /*
    |--------------------------------------------------------------------------
    | DictV1 Application Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains configuration options for the DictV1 dictionary
    | application including paths, storage settings, and external dependencies.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Storage Paths Configuration
    |--------------------------------------------------------------------------
    |
    | These paths define where DictV1 stores its external data including
    | databases, audio files, images, and cache directories.
    |
    */
    'paths' => [
        // External data root directory
        'external_data_root' => env('DICT_EXTERNAL_DATA_PATH', storage_path('app/external_data')),

        // Database paths
        'main_database' => env('DICT_MAIN_DATABASE_PATH', database_path('dictv1_main.sqlite')),
        'legacy_database' => env('DICT_LEGACY_DATABASE_PATH', storage_path('app/external_data/databases/legacy_data.db')),
        'cache_database' => env('DICT_CACHE_DATABASE_PATH', storage_path('app/external_data/databases/cache_translate.db')),

        // Audio storage paths
        'audio_directory' => env('DICT_AUDIO_PATH', storage_path('app/external_data/audio/word_sounds')),
        'audio_subtitles' => env('DICT_AUDIO_SUBTITLES_PATH', storage_path('app/external_data/audio/word_subtitles')),
        'sentence_sounds' => env('DICT_SENTENCE_SOUNDS_PATH', storage_path('app/external_data/audio/sentence_sounds')),
        'sentence_subtitles' => env('DICT_SENTENCE_SUBTITLES_PATH', storage_path('app/external_data/audio/sentence_subtitles')),
        'audio_archive' => env('DICT_AUDIO_ARCHIVE_PATH', storage_path('app/external_data/cache/audio_archive.7z')),

        // Image storage paths
        'images_directory' => env('DICT_IMAGES_PATH', storage_path('app/external_data/images/word_images')),
        'images_archive' => env('DICT_IMAGES_ARCHIVE_PATH', storage_path('app/external_data/cache/images_archive.7z')),

        // Cache and temporary paths
        'cache_directory' => env('DICT_CACHE_PATH', storage_path('app/external_data/cache')),
        'temp_directory' => env('DICT_TEMP_PATH', storage_path('app/external_data/cache/temp')),

        // Markers and status files
        'markers_directory' => env('DICT_MARKERS_PATH', storage_path('app/external_data/markers')),
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
        'audio_url_prefix' => env('DICT_AUDIO_URL_PREFIX', '/storage/external/audio'),
        'images_url_prefix' => env('DICT_IMAGES_URL_PREFIX', '/storage/external/images'),
        'cdn_audio_prefix' => env('DICT_CDN_AUDIO_PREFIX', null),
        'cdn_images_prefix' => env('DICT_CDN_IMAGES_PREFIX', null),
    ],

    /*
    |--------------------------------------------------------------------------
    | External Dependencies
    |--------------------------------------------------------------------------
    |
    | Configuration for external tools and dependencies required by DictV1.
    |
    */
    'dependencies' => [
        'python' => [
            'command' => env('DICT_PYTHON_COMMAND', 'python3'),
            'required_version' => env('DICT_PYTHON_MIN_VERSION', '3.7'),
        ],

        'edge_tts' => [
            'package_name' => 'edge-tts',
            'install_command' => 'pip3 install edge-tts',
            'test_command' => 'python3 -c "import edge_tts; print(edge_tts.__version__)"',
        ],

        'edge_browser' => [
            'detection_command' => 'which microsoft-edge || which microsoft-edge-stable',
            'install_script' => env('DICT_EDGE_INSTALL_SCRIPT', 'dd.sh'),
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
        'debug_tokens' => [
            'dev-token-123',
            'test-debug-token',
        ],

        'resource_access_keys' => [
            'resource-key-001',
            'static-access-key',
        ],

        'modes' => [
            'debug' => [
                'enabled' => env('APP_DEBUG', false),
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
        'batch_size' => env('DICT_PROCESSING_BATCH_SIZE', 1000),
        'max_memory_usage' => env('DICT_MAX_MEMORY_MB', 512),
        'max_cpu_usage' => env('DICT_MAX_CPU_PERCENT', 80),

        'scheduled_tasks' => [
            'audio_generation_enabled' => env('DICT_AUTO_AUDIO_GENERATION', true),
            'schedule_time_start' => env('DICT_SCHEDULE_START', '02:00'),
            'schedule_time_end' => env('DICT_SCHEDULE_END', '06:00'),
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
        'enabled' => env('DICT_STATISTICS_ENABLED', true),
        'cache_duration' => env('DICT_STATS_CACHE_MINUTES', 60),
        'detailed_logging' => env('DICT_DETAILED_STATS', false),
    ],
];