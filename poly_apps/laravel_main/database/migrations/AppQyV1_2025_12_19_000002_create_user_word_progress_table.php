<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::connection('appqyv1')->hasTable('app_qy_v1_user_word_progress')) {
            Schema::connection('appqyv1')->create('app_qy_v1_user_word_progress', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->comment('User ID');
                $table->unsignedBigInteger('word_id')->comment('Word ID from vocabulary_words');
                $table->unsignedBigInteger('group_id')->nullable()->comment('Optional group ID');
                $table->string('language_code', 10)->nullable()->comment('Language code');

                $table->timestamp('first_read_at')->nullable()->comment('First time user read this word');
                $table->timestamp('last_read_at')->nullable()->comment('Last time user read this word');
                $table->timestamp('last_review_at')->nullable()->comment('Last review time');
                $table->timestamp('next_review_at')->nullable()->comment('Next scheduled review time');

                $table->integer('read_count')->default(0)->comment('Number of times read');
                $table->integer('review_count')->default(0)->comment('Number of times reviewed');
                $table->integer('weight')->default(0)->comment('Weight (initially word length)');
                $table->decimal('proficiency', 5, 2)->default(0)->comment('Proficiency level 0-100');

                $table->timestamps();

                $table->unique(['user_id', 'word_id', 'group_id'], 'unique_user_word_group');
                $table->index(['user_id', 'group_id'], 'idx_progress_user_group');
                $table->index(['user_id', 'next_review_at'], 'idx_progress_next_review');
                $table->index(['user_id', 'proficiency'], 'idx_progress_proficiency');
                $table->index('word_id', 'idx_progress_word');
            });
        }
    }

    public function down(): void
    {
        Schema::connection('appqyv1')->dropIfExists('app_qy_v1_user_word_progress');
    }
};
