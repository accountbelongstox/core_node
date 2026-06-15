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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'subtitles');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'source_key' => ['type' => 'string', 'length' => 64, 'nullable' => false, 'unique' => true, 'comment' => 'Stable hash of the source abs path (pycore)'],
                'title' => ['type' => 'string', 'nullable' => true, 'comment' => 'Media title'],
                'original_name' => ['type' => 'string', 'nullable' => true, 'comment' => 'Source original basename (mapping filename.original)'],
                'ascii_name' => ['type' => 'string', 'nullable' => true, 'comment' => 'Transcoded ASCII stem (mapping filename.ascii)'],
                'language' => ['type' => 'string', 'length' => 20, 'nullable' => true, 'index' => true, 'comment' => 'Primary language'],
                'duration_sec' => ['type' => 'float', 'nullable' => true, 'comment' => 'Total duration in seconds'],
                'rel_path' => ['type' => 'text', 'nullable' => true, 'comment' => 'Relative source path'],
                'output_dir' => ['type' => 'text', 'nullable' => true, 'comment' => 'Output directory used by worker'],
                'full_content' => ['type' => 'longText', 'nullable' => true, 'comment' => 'Complete .srt backup'],
                'files' => ['type' => 'json', 'nullable' => true, 'comment' => 'Whole-file outputs {full_mp4, tiny_mp4, mp3, srt} (basenames in output dir)'],
                'subtitle_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Number of subtitle entries'],
                'segment_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Number of segments'],
                'sentence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'Number of sentences'],
                'synced_at' => ['type' => 'timestamp', 'nullable' => true, 'comment' => 'Last sync timestamp'],
                'metadata' => ['type' => 'json', 'nullable' => true, 'comment' => 'Additional metadata'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['source_key'], 'unique' => true],
                ['columns' => ['language']],
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
