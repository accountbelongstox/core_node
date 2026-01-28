<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        $tableName = 'voice_subtitle_user_settings';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'user_identifier' => ['type' => 'string', 'length' => 100, 'nullable' => false, 'unique' => true],
                'target_language' => ['type' => 'text', 'nullable' => false, 'default' => '["en"]'],
                'default_voice' => ['type' => 'string', 'length' => 100, 'nullable' => false, 'default' => 'en-US-AriaNeural'],
                'playback_rate' => ['type' => 'decimal', 'precision' => 3, 'scale' => 2, 'nullable' => false, 'default' => 1.0],
                'auto_play' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'play_mode' => ['type' => 'string', 'length' => 50, 'nullable' => false, 'default' => 'all'],
                'play_limit' => ['type' => 'integer', 'nullable' => false, 'default' => 300],
                'play_group' => ['type' => 'string', 'length' => 100, 'nullable' => true],
                'play_language' => ['type' => 'string', 'length' => 50, 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['user_identifier']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection ?? config('database.default'),
            $tableName,
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
        $connection = $this->connection ?? config('database.default');
        Schema::connection($connection)->dropIfExists('voice_subtitle_user_settings');
    }
};
