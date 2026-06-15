<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Group word progress consolidation - step 3 (drops).
 *
 * Removes the legacy row-per-word tables after AppQyV1_2026_06_12_160001
 * converted everything into group_word_progress (one JSON row per
 * user+group) and every consumer was rewired to the new model.
 *
 * DELIBERATELY a separate migration file so steps 1+2 can land and be
 * smoke-verified first. Run this ONLY after the conversion verification
 * and the pre-drop smoke pass.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $prefix;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->prefix = AppTablePrefixServiceProvider::getPrefix($this->appKey);
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        foreach ([
            'group_words',
            'user_word_progress',
        ] as $suffix) {
            $table = $this->prefix . '_' . $suffix;
            $schema->dropIfExists($table);
            echo "[drop] {$table} dropped\n";
        }
    }

    public function down(): void
    {
        // One-way: per-word rows cannot be restored from the JSON map alone
        // (row ids/timestamps are gone). Restore from backup if needed.
    }
};
