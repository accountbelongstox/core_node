<?php

namespace App\Services\PassiveQueue;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class PassiveQueueTableService
{
    public static function ensureTableExists(): array
    {
        $connection = config('database.default');
        $schema = Schema::connection($connection);

        if ($schema->hasTable('app_passive_queue_jobs')) {
            return ['app_passive_queue_jobs' => 'exists'];
        }

        $schema->create('app_passive_queue_jobs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('job_class', 255);
            $table->json('payload')->nullable();
            $table->string('status', 32)->default('pending');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamp('available_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'available_at'], 'idx_passive_jobs_status_available');
        });

        return ['app_passive_queue_jobs' => 'created'];
    }
}
