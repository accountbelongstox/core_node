<?php

return [
    'init' => [
        'placeholder_table_aligned' => '已对齐 placeholder_images 表（:count 处变更）',
        'placeholder_table_missing' => '连接 :connection 上缺少 placeholder_images 表或其中的列',
    ],
    'cleanup' => [
        'table_missing' => '已跳过占位图清理：连接 :connection 上缺少 placeholder_images 表（请运行 php artisan sys:init）。',
    ],
];
