<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Social Center: post images (Social Center expansion §POSTS images[]).
 *
 * Zero-or-more images per post (up to 9 enforced by the controller). image_url
 * is a root-relative '/static/app_qy_v1/post_images/{post_id}/{seq}.jpg'.
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'post_images');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'post_id' => ['type' => 'unsignedBigInteger', 'nullable' => false, 'index' => true],
                'image_url' => ['type' => 'string', 'length' => 500, 'nullable' => false, 'comment' => 'Root-relative stored image url'],
                'sequence' => ['type' => 'unsignedInteger', 'nullable' => false, 'default' => 0, 'comment' => 'Display order within the post'],
                'caption' => ['type' => 'text', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['post_id']],
                ['columns' => ['post_id', 'sequence'], 'name' => 'idx_app_qy_v1_post_images_post_seq'],
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
