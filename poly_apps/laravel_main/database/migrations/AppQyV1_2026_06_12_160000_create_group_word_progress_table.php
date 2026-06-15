<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Group word progress consolidation - step 1 (new table).
 *
 * ONE row per (user, group) holding the whole word membership + progress
 * state as a JSON map (word_id-as-string-key => short-key entry, legend in
 * AppQyV1GroupWordProgressModel). Replaces the row-per-word pair
 * group_words + user_word_progress, which were ~1:1 redundant and hit
 * PostgreSQL's 65535 bind-parameter limit on large groups.
 * group_id is unique (groups are per-user).
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_word_progress');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => [
                    'type' => 'bigIncrements',
                ],
                'user_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'comment' => 'Owner user id (word_groups.uid)',
                ],
                'group_id' => [
                    'type' => 'unsignedBigInteger',
                    'nullable' => false,
                    'comment' => 'Group id from word_groups (unique - one row per group)',
                ],
                'language_code' => [
                    'type' => 'string',
                    'length' => 16,
                    'nullable' => true,
                    'comment' => 'Dictionary language code (tts_cache_{lang})',
                ],
                'words' => [
                    'type' => 'json',
                    'nullable' => true,
                    'comment' => 'Map word_id => {fr,lr,lv,nr,rc,vc,wt,pf,aa} (legend in AppQyV1GroupWordProgressModel)',
                ],
                'total_words' => [
                    'type' => 'integer',
                    'nullable' => false,
                    'default' => 0,
                    'comment' => 'Cache: count of keys in words',
                ],
                'created_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
                'updated_at' => [
                    'type' => 'timestamp',
                    'nullable' => true,
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['group_id'],
                    'name' => 'unique_gwp_group',
                    'unique' => true,
                ],
                [
                    'columns' => ['user_id'],
                    'name' => 'idx_gwp_user',
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
        \Illuminate\Support\Facades\Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
