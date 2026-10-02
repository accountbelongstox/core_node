<?php

return [
    'init' => [
        'placeholder_table_aligned' => 'Table placeholder_images aligned (:count changes)',
        'placeholder_table_missing' => 'Table placeholder_images or one of its columns is missing on connection :connection',
    ],
    'cleanup' => [
        'table_missing' => 'Placeholder cleanup skipped: table placeholder_images is missing on connection :connection (run php artisan sys:init).',
    ],
    'voice_subtitle' => [
        'pipeline_input_missing' => 'The voice-subtitle task :task_id has no stored pipeline input; submit it again.',
        'queue_item_failed' => 'Failed to generate queue item for task',
    ],
];
