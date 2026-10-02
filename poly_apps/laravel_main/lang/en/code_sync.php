<?php

return [
    'messages' => [
        'started' => 'Code sync job started',
        'already_running' => 'A code sync job is already running',
        'status_retrieved' => 'Code sync status retrieved',
    ],
    'errors' => [
        'unsupported_platform' => 'Code sync runs only on the Linux server.',
        'busy' => 'Another code sync request is being processed.',
        'state_write_failed' => 'Unable to persist the code sync job state.',
        'schedule_failed' => 'Unable to schedule the code sync job.',
        'job_not_found' => 'Code sync job not found.',
        'gitsync_failed' => 'gitsync failed on the server; see git_output_tail.',
        'migration_unsafe' => 'The migration safety check failed; no migration was run.',
        'migrate_failed' => 'Database migration failed; see migrate_output_tail.',
        'reload_failed' => 'The FrankenPHP worker restart failed.',
        'job_exception' => 'The code sync job raised an exception.',
    ],
];
