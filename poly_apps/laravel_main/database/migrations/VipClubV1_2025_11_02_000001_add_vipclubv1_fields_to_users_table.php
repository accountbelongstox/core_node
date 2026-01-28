<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'sqlite';
    protected $tableName = 'users';

    public function up(): void
    {
        // This migration only adds columns to existing users table
        $tableStructure = [
            'columns' => [
                'phone' => [
                    'type' => 'string',
                    'nullable' => true,
                    'after' => 'email',
                ],
                'avatar_url' => [
                    'type' => 'string',
                    'nullable' => true,
                    'after' => 'phone',
                ],
                'member_type' => [
                    'type' => 'enum',
                    'values' => ['guest', 'regular', 'gold', 'platinum', 'diamond'],
                    'nullable' => false,
                    'default' => 'guest',
                    'after' => 'avatar_url',
                ],
                'vip_points' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'after' => 'member_type',
                ],
                'member_since' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'after' => 'vip_points',
                ],
                'member_expiry' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                    'after' => 'member_since',
                ],
                'is_active' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => true,
                    'after' => 'member_expiry',
                ],
                'preferences' => [
                    'type' => 'json',
                    'nullable' => true,
                    'after' => 'is_active',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => false,
            ]
        );
    }

    public function down(): void
    {
        if (Schema::hasTable($this->tableName)) {
            Schema::table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                $columns = ['phone', 'avatar_url', 'member_type', 'vip_points', 'member_since', 'member_expiry', 'is_active', 'preferences'];
                $columnsToRemove = [];
                foreach ($columns as $column) {
                    if (Schema::hasColumn($this->tableName, $column)) {
                        $columnsToRemove[] = $column;
                    }
                }
                if (!empty($columnsToRemove)) {
                    $table->dropColumn($columnsToRemove);
                }
            });
        }
    }
};
