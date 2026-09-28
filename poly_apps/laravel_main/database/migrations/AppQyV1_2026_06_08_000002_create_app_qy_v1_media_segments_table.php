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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'media_segments');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'index' => true, 'comment' => 'FK to subtitles.source_key'],
                'seg_index' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Segment ordinal index'],
                'start_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'Segment start time in seconds'],
                'end_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'Segment end time in seconds'],
                'mp4' => ['type' => 'string', 'nullable' => true, 'comment' => 'Clip mp4 filename (2x2 clip)'],
                'full_mp4' => ['type' => 'string', 'nullable' => true, 'comment' => 'Compressed full-resolution clip filename'],
                'mp3' => ['type' => 'string', 'nullable' => true, 'comment' => 'Clip mp3 filename'],
                'sub_idx_start' => ['type' => 'integer', 'nullable' => true, 'comment' => 'First subtitle index in segment'],
                'sub_idx_end' => ['type' => 'integer', 'nullable' => true, 'comment' => 'Last subtitle index in segment'],
                'subtitle_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Subtitle entries in segment'],
                'clip_status' => ['type' => 'json', 'nullable' => true, 'comment' => 'Which clips are present (mp4/mp3)'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_key']],
                ['columns' => ['source_key', 'seg_index'], 'unique' => true, 'name' => 'uniq_media_seg_source_idx'],
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
