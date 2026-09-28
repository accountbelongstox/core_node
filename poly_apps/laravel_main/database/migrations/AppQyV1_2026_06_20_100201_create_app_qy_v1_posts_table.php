<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social Center: posts / feed (Social Center expansion §POSTS).
 *
 * One row per user post. post_type text|images|video|live. Counters
 * (like_count / comment_count) are maintained by the controllers. Soft-deleted
 * (deleted_at) so an authored post is hidden, never hard-removed.
 *
 * Idempotent via SafeMigrationHelper — re-running sys:init only ADDS missing
 * columns/indexes and NEVER drops data.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'posts');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true, 'comment' => 'Author user id'],
                'content' => ['type' => 'text', 'nullable' => true, 'comment' => 'Post body text'],
                // String (not DB enum) keeps pgsql/sqlite symmetric.
                'post_type' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'text', 'comment' => 'text|images|video|live'],
                'video_url' => ['type' => 'string', 'length' => 500, 'nullable' => true, 'comment' => 'Root-relative stored video url'],
                'external_url' => ['type' => 'string', 'length' => 500, 'nullable' => true, 'comment' => 'External embed/link url'],
                'cover_image_url' => ['type' => 'string', 'length' => 500, 'nullable' => true, 'comment' => 'Root-relative cover image url'],
                'visibility' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'default' => 'public', 'comment' => 'public|followers|private'],
                'like_count' => ['type' => 'unsignedInteger', 'nullable' => false, 'default' => 0],
                'comment_count' => ['type' => 'unsignedInteger', 'nullable' => false, 'default' => 0],
                'metadata' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                'deleted_at' => ['type' => 'timestamp', 'nullable' => true, 'index' => true],
            ],
            'indexes' => [
                ['columns' => ['user_id']],
                ['columns' => ['created_at']],
                ['columns' => ['deleted_at']],
                ['columns' => ['user_id', 'created_at'], 'name' => 'idx_app_qy_v1_posts_user_created'],
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
