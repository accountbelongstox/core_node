<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Check if global_tasks table exists
        if (!Schema::hasTable('global_tasks')) {
            // Create complete table from scratch
            Schema::create('global_tasks', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('task_id')->unique();
                $table->string('app_name')->index();
                $table->string('task_type')->nullable();
                $table->string('execution_type')->default('local_timer')->index();
                $table->string('status')->default('pending')->index();
                $table->string('assigned_to')->nullable()->index();
                $table->timestamp('assigned_at')->nullable();
                $table->timestamp('timeout_at')->nullable()->index();
                $table->integer('timeout_seconds')->default(120);
                $table->integer('priority')->default(0)->index();
                $table->integer('retry_count')->default(0);
                $table->integer('max_retries')->default(3);
                $table->decimal('progress', 5, 2)->default(0);
                $table->json('payload')->nullable();
                $table->json('steps')->nullable();
                $table->json('result')->nullable();
                $table->text('error')->nullable();
                $table->string('queue_item_id')->nullable()->index();
                $table->timestamps();

                // Composite indexes for efficient task pulling
                $table->index(['status', 'execution_type', 'priority'], 'idx_task_pulling');
                $table->index(['status', 'timeout_at'], 'idx_timeout_check');
            });
        } else {
            // Table exists, add missing fields only if they don't exist
            Schema::table('global_tasks', function (Blueprint $table) {
                if (!Schema::hasColumn('global_tasks', 'execution_type')) {
                    $table->string('execution_type')->default('local_timer')->after('task_type')->index();
                }

                if (!Schema::hasColumn('global_tasks', 'assigned_to')) {
                    $table->string('assigned_to')->nullable()->after('status')->index();
                }

                if (!Schema::hasColumn('global_tasks', 'assigned_at')) {
                    $table->timestamp('assigned_at')->nullable()->after('assigned_to');
                }

                if (!Schema::hasColumn('global_tasks', 'timeout_at')) {
                    $table->timestamp('timeout_at')->nullable()->after('assigned_at')->index();
                }

                if (!Schema::hasColumn('global_tasks', 'timeout_seconds')) {
                    $table->integer('timeout_seconds')->default(120)->after('timeout_at');
                }

                if (!Schema::hasColumn('global_tasks', 'priority')) {
                    $table->integer('priority')->default(0)->after('timeout_seconds')->index();
                }

                if (!Schema::hasColumn('global_tasks', 'retry_count')) {
                    $table->integer('retry_count')->default(0)->after('priority');
                }

                if (!Schema::hasColumn('global_tasks', 'max_retries')) {
                    $table->integer('max_retries')->default(3)->after('retry_count');
                }
            });

            // Try to add composite indexes (ignore if already exist)
            try {
                Schema::table('global_tasks', function (Blueprint $table) {
                    $table->index(['status', 'execution_type', 'priority'], 'idx_task_pulling');
                });
            } catch (\Exception $e) {
                // Index already exists, ignore
            }

            try {
                Schema::table('global_tasks', function (Blueprint $table) {
                    $table->index(['status', 'timeout_at'], 'idx_timeout_check');
                });
            } catch (\Exception $e) {
                // Index already exists, ignore
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Skip rollback - this migration creates/updates essential tables
        // Rollback should be done manually if needed
    }
};
