<?php

namespace App\Apps\AppQyV1\Services;

use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ClientDeviceSettingsModel;

class AppQyV1ClientDeviceSettingsTableService
{
    /**
     * Idempotently ensure the guest device-settings table exists (sys:init).
     *
     * @return array<string,string> table => 'created' | 'exists'
     */
    public static function ensureTablesExist(): array
    {
        $model = new AppQyV1ClientDeviceSettingsModel();
        $connection = $model->getConnectionName();
        $tableName = $model->getTable();

        $existedBefore = Schema::connection($connection)->hasTable($tableName);

        $appKey = AppKeys::APPQYV1;
        $prefix = AppTablePrefixServiceProvider::getPrefix($appKey);

        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'client_key' => ['type' => 'string', 'length' => 64, 'nullable' => false],
                'settings' => ['type' => 'text', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                [
                    'columns' => ['client_key'],
                    'name' => 'unique_cds_client_key',
                    'unique' => true,
                ],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $connection,
            $tableName,
            $tableStructure,
            ['shrink_columns' => false, 'modify_columns' => true, 'add_indexes' => true]
        );

        return [$tableName => $existedBefore ? 'exists' : 'created'];
    }
}
