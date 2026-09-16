<?php

return [
    'text_too_large' => 'The merged clipboard text exceeds the text limit.',
    'initializing' => 'Initializing cloud clipboard tables and upload storage...',
    'initialization_failed' => 'Cloud clipboard initialization failed for :resource.',
    'not_initialized' => 'Cloud clipboard tables are missing. The server start.sh initializes them through php artisan sys:init.',
    'success' => 'Clipboard saved.',
    'invalid_namespace' => 'Namespace must contain 1–40 lowercase letters, digits, underscores, or hyphens.',
    'password_required' => 'The clipboard password is required or incorrect.',
    'entry_missing' => 'The clipboard entry has been deleted.',
    'file_missing' => 'The clipboard attachment does not exist.',
    'conflict' => 'Another browser changed this entry. Refresh before saving your draft.',
    'upload_failed' => 'The uploaded attachment could not be stored.',
];
