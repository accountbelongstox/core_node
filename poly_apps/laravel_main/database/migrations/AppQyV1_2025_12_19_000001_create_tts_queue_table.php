<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::connection('appqyv1')->hasTable('appqyv1_tts_queue')) {
            Schema::connection('appqyv1')->create('appqyv1_tts_queue', function (Blueprint $table) {
                $table->id();
                $table->string('word', 255)->index();
                $table->string('word_md5', 32)->index();
                $table->string('language', 10)->index();
                $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending')->index();
                $table->integer('priority')->default(0)->index();
                $table->integer('retry_count')->default(0);
                $table->text('error_message')->nullable();
                $table->string('audio_path')->nullable();
                $table->timestamp('requested_at')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->unique(['word_md5', 'language']);
                $table->index(['status', 'priority', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::connection('appqyv1')->dropIfExists('appqyv1_tts_queue');
    }
};
