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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_media_sources');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'group_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true, 'comment' => 'FK to word_groups.id'],
                'source_type' => ['type' => 'string', 'length' => 16, 'nullable' => false, 'comment' => 'book|subtitle'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'comment' => 'Media source key (books/subtitles.source_key)'],
                'title' => ['type' => 'string', 'length' => 255, 'nullable' => true, 'comment' => 'Snapshot of source title at link time'],
                'language' => ['type' => 'string', 'length' => 16, 'nullable' => true, 'comment' => 'Snapshot of source language at link time'],
                'words_added' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'New words merged into the group by this source'],
                'added_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'When the source was linked to the group'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['group_id']],
                ['columns' => ['group_id', 'source_type', 'source_key'], 'unique' => true, 'name' => 'uniq_group_media_source'],
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
        Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
