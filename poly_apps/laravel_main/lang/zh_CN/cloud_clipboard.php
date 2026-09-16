<?php

return [
    'text_too_large' => '合并后的剪贴板文本超过长度限制。',
    'initializing' => '正在初始化云剪贴板表和上传存储…',
    'initialization_failed' => '云剪贴板资源 :resource 初始化失败。',
    'not_initialized' => '云剪贴板数据库表尚未初始化，服务器 start.sh 会通过 php artisan sys:init 自动初始化。',
    'success' => '剪贴板已保存。',
    'invalid_namespace' => '命名空间须为 1–40 位小写字母、数字、下划线或短横线。',
    'password_required' => '请提供正确的剪贴板密码。',
    'entry_missing' => '剪贴板记录已被删除。',
    'file_missing' => '剪贴板附件不存在。',
    'conflict' => '其他浏览器已修改此记录，请刷新后保存草稿。',
    'upload_failed' => '无法保存上传的附件。',
];
