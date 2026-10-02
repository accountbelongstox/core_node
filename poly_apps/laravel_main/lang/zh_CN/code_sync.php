<?php

return [
    'messages' => [
        'started' => '代码同步任务已启动',
        'already_running' => '已有代码同步任务正在运行',
        'status_retrieved' => '已获取代码同步状态',
    ],
    'errors' => [
        'unsupported_platform' => '代码同步仅在 Linux 服务器上运行。',
        'busy' => '正在处理另一个代码同步请求。',
        'state_write_failed' => '无法保存代码同步任务状态。',
        'schedule_failed' => '无法调度代码同步任务。',
        'job_not_found' => '代码同步任务不存在。',
        'gitsync_failed' => '服务器上的 gitsync 失败，详见 git_output_tail。',
        'migration_unsafe' => '迁移安全检查失败，未执行任何迁移。',
        'migrate_failed' => '数据库迁移失败，详见 migrate_output_tail。',
        'reload_failed' => 'FrankenPHP 工作进程重启失败。',
        'job_exception' => '代码同步任务抛出异常。',
    ],
];
