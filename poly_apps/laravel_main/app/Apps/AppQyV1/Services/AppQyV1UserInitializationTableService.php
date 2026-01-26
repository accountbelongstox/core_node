<?php

namespace App\Apps\AppQyV1\Services;

use Illuminate\Support\Facades\Schema;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserInitializationModel;

class AppQyV1UserInitializationTableService
{
    /**
     * Check if user initialization table exists
     * Table is created automatically by 'php artisan sys:init' command
     * This method only checks table existence, does not create tables
     */
    public static function ensureTablesExist(): array
    {
        $model = new AppQyV1UserInitializationModel();
        $connectionName = $model->getConnectionName();
        $results = [];
        $tableName = $model->getTable();
        $exists = Schema::connection($connectionName)->hasTable($tableName);

        $results[$tableName] = $exists ? 'exists' : 'missing';

        return $results;
    }
}
