<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;
    
    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'word_groups');
    }

    public function up(): void
    {
        // This migration only adds columns to existing table
        $tableStructure = [
            'columns' => [
                'cover_image_uuid' => [
                    'type' => 'string',
                    'length' => 36,
                    'nullable' => true,
                    'after' => 'words_frequency',
                    'comment' => 'Cover image UUID',
                ],
                'cover_category' => [
                    'type' => 'string',
                    'length' => 50,
                    'nullable' => true,
                    'after' => 'cover_image_uuid',
                    'comment' => 'Cover category: vocabulary, grammar, etc.',
                ],
                'cover_url' => [
                    'type' => 'text',
                    'nullable' => true,
                    'after' => 'cover_category',
                    'comment' => 'Cover image URL',
                ],
                'thumbnail_url' => [
                    'type' => 'text',
                    'nullable' => true,
                    'after' => 'cover_url',
                    'comment' => 'Thumbnail image URL',
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
                'add_indexes' => true,
            ]
        );
    }

    public function down(): void
    {
        if (Schema::connection($this->connection)->hasTable($this->tableName)) {
            Schema::connection($this->connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->dropColumn(['cover_image_uuid', 'cover_category', 'cover_url', 'thumbnail_url']);
            });
        }
    }
};
