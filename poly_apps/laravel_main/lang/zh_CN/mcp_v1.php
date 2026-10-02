<?php

return [
    'init' => [
        'placeholder_table_aligned' => '已对齐 placeholder_images 表（:count 处变更）',
        'placeholder_table_missing' => '连接 :connection 上缺少 placeholder_images 表或其中的列',
    ],
    'cleanup' => [
        'table_missing' => '已跳过占位图清理：连接 :connection 上缺少 placeholder_images 表（请运行 php artisan sys:init）。',
    ],
    'voice_subtitle' => [
        'pipeline_input_missing' => '语音字幕任务 :task_id 没有保存的流水线输入，请重新提交。',
        'queue_item_failed' => '无法为该任务生成队列条目',
    ],
];
