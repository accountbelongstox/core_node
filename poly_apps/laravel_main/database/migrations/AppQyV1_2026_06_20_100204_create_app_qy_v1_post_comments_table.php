<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social Center: post comments (Social Center expansion §POSTS comments).
 *
 * Threaded one level via parent_comment_id (null = top-level). Soft-deleted
 * (deleted_at) so an author can remove a comment without breaking thread ids.
 *
 * Idempotent via SafeMigrationHelper — add-only, never drops data.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'post_comments');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'post_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'parent_comment_id' => ['type' => 'unsignedBigInteger', 'nullable' => true, 'comment' => 'Parent comment id for one-level threading'],
                'body' => ['type' => 'text', 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
                'deleted_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['post_id']],
                ['columns' => ['user_id']],
                ['columns' => ['created_at']],
                ['columns' => ['post_id', 'created_at'], 'name' => 'idx_app_qy_v1_post_comments_post_created'],
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
