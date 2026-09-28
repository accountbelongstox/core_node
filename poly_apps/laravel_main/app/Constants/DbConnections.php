<?php

namespace App\Constants;

/**
 * Canonical database connection names (config/database.php).
 *
 * MAIN hosts the shared global tables (users, workers, global_tasks,
 * global_task_events, invite codes, ...). Per-app connections (appqyv1,
 * mcpv1, ...) host only that app's tables. Never inline the 'main' literal;
 * reference this constant so a rename touches one file.
 */
final class DbConnections
{
    public const MAIN = 'main';
}
