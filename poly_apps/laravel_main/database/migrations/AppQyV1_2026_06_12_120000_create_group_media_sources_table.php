<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
