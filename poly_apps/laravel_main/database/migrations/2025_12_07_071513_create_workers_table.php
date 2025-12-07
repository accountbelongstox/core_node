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
        // Check if table exists before creating
        if (!Schema::hasTable('workers')) {
            Schema::create('workers', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('worker_id')->unique();
                $table->string('worker_name');
                $table->json('processor_types');
                $table->enum('status', ['online', 'offline', 'busy'])->default('offline');
                $table->timestamp('last_heartbeat_at')->nullable();
                $table->string('hostname')->nullable();
                $table->string('platform')->nullable();
                $table->json('metadata')->nullable();
                $table->integer('completed_tasks')->default(0);
                $table->integer('failed_tasks')->default(0);
                $table->string('current_task_id')->nullable();
                $table->timestamps();

                // Indexes
                $table->index('status');
                $table->index('last_heartbeat_at');
                $table->index(['status', 'last_heartbeat_at'], 'idx_worker_status');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('workers');
    }
};
