<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Drops the app_passive_queue_jobs table as we've migrated to Octane Timer tasks.
     * PassiveQueue has been replaced by AppQyV1CoverGenerationTask which runs every 5 seconds.
     */
    public function up(): void
    {
        Schema::dropIfExists('app_passive_queue_jobs');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('app_passive_queue_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('job_class');
            $table->json('payload')->nullable();
            $table->string('status')->default('pending');
            $table->integer('attempts')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamp('available_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'available_at']);
            $table->index('job_class');
        });
    }
};
