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
        Schema::create('voice_subtitle_user_settings', function (Blueprint $table) {
            $table->id();
            $table->string('user_identifier', 100)->unique();
            $table->text('target_language')->default('["en"]');
            $table->string('default_voice', 100)->default('en-US-AriaNeural');
            $table->decimal('playback_rate', 3, 2)->default(1.0);
            $table->boolean('auto_play', 1)->default(false);
            $table->string('play_mode', 50)->default('all');
            $table->integer('play_limit')->default(300);
            $table->string('play_group', 100)->nullable();
            $table->string('play_language', 50)->nullable();
            $table->timestamps();

            $table->index('user_identifier');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('voice_subtitle_user_settings');
    }
};
