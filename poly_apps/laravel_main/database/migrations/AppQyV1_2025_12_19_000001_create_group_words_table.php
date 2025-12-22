<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::connection('appqyv1')->hasTable('app_qy_v1_group_words')) {
            Schema::connection('appqyv1')->create('app_qy_v1_group_words', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('group_id')->comment('Group ID from word_groups table');
                $table->unsignedBigInteger('word_id')->comment('Word ID from vocabulary_words table');
                $table->string('language_code', 10)->nullable()->comment('Language code: en, ja, lo, vi');
                $table->timestamp('added_at')->useCurrent()->comment('When word was added to group');
                $table->timestamps();

                $table->unique(['group_id', 'word_id'], 'unique_group_word');
                $table->index('group_id', 'idx_group_words_group');
                $table->index('word_id', 'idx_group_words_word');
                $table->index('language_code', 'idx_group_words_lang');
            });
        }
    }

    public function down(): void
    {
        Schema::connection('appqyv1')->dropIfExists('app_qy_v1_group_words');
    }
};
