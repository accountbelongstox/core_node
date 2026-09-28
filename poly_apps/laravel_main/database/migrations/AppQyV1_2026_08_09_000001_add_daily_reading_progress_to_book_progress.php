<?php

use Illuminate\Database\Migrations\Migration;
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_book_reading_progress');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'article_id' => [
                    'type' => 'string',
                    'length' => 255,
                    'nullable' => true,
                    'comment' => 'Last daily-reading article for the authenticated user',
                ],
                'selection_mode' => [
                    'type' => 'string',
                    'length' => 32,
                    'nullable' => true,
                    'default' => 'latest',
                    'comment' => 'Daily-reading start selection: latest, resume, or random',
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
    }
};
