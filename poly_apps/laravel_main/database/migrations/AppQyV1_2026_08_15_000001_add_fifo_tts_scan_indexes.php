<?php

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    protected $connection;
    protected $appKey;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function up(): void
    {
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            $indexSuffix = strtolower(preg_replace('/[^a-z0-9]+/i', '_', $language));
            $sentenceTable = AppQyV1TableMaps::getSentenceTableName($language);

            SafeMigrationHelper::safeAddIndex(
                $this->connection,
                $sentenceTable,
                ['has_audio', 'id'],
                'idx_sent_' . $indexSuffix . '_audio_fifo'
            );

            SafeMigrationHelper::safeAddIndex(
                $this->connection,
                $sentenceTable,
                ['tts_status', 'has_audio', 'id'],
                'idx_sent_' . $indexSuffix . '_status_fifo'
            );
        }
    }

    public function down(): void
    {
        // Add-only migration: intentionally no destructive rollback.
    }
};
