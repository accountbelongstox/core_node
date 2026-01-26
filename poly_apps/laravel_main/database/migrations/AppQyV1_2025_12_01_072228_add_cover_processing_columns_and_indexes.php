<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    
    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_covers');
        Schema::connection($this->connection)->table($tableName, function (Blueprint $table) {
            // Add attempts column for retry tracking
            $table->integer('attempts')->default(0)->after('priority');

            // Add composite index for efficient timer task queries
            // Optimizes: WHERE status IN ('pending', 'retry') ORDER BY priority DESC, last_requested_at ASC
            $table->index(['status', 'priority', 'last_requested_at'], 'idx_cover_processing');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_covers');
        Schema::connection($this->connection)->table($tableName, function (Blueprint $table) {
            $table->dropIndex('idx_cover_processing');
            $table->dropColumn('attempts');
        });
    }
};
