<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * DB-driven TTS variant specs per language (app_qy_v1_tts_variant_specs).
 *
 * One row per (lang, variant_key) describing the accent/gender the worker
 * synthesizes. is_primary pins the canonical primary variant (variant_key '')
 * whose file lives at {lang}/{content_id}.mp3; non-primary variants use the
 * suffixed path {lang}/{content_id}_{variant_key}.mp3. Static table,
 * auto-discovered by sys:init's single migrate --force. Idempotent add-only via
 * SafeMigrationHelper. Default rows are seeded by InitializeApps (sys:init) via
 * AppQyV1TtsVariantSpecModel::seedDefaults().
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
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_variant_specs');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'lang' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'comment' => 'normalized language code (en|zh|ja|...)'],
                'variant_key' => ['type' => 'string', 'length' => 32, 'nullable' => false, 'default' => '', 'comment' => 'primary="" -> {lang}/{content_id}.mp3; else {lang}/{content_id}_{key}.mp3'],
                'accent' => ['type' => 'string', 'length' => 16, 'nullable' => true, 'comment' => 'us|uk|... or null'],
                'gender' => ['type' => 'string', 'length' => 16, 'nullable' => true, 'comment' => 'female|male or null'],
                'is_primary' => ['type' => 'boolean', 'nullable' => false, 'default' => false, 'comment' => 'primary variant for the language'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['lang', 'variant_key'], 'unique' => true, 'name' => 'uniq_tts_variant_spec_lang_key'],
                ['columns' => ['lang'], 'name' => 'idx_tts_variant_spec_lang'],
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
