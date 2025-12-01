<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::connection('AppQyV1')->table('app_qy_v1_vocabulary_covers', function (Blueprint $table) {
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
        Schema::connection('AppQyV1')->table('app_qy_v1_vocabulary_covers', function (Blueprint $table) {
            $table->dropIndex('idx_cover_processing');
            $table->dropColumn('attempts');
        });
    }
};
