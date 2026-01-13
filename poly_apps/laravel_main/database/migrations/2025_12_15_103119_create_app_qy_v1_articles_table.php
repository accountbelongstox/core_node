<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'articles');
        
        Schema::connection($connection)->create($tableName, function (Blueprint $table) {
            $table->id();
            $table->string('article_id', 64)->unique()->comment('Unique article identifier');
            $table->string('title')->nullable()->comment('Article title');
            $table->text('content')->comment('Article content');
            $table->string('language', 20)->default('english')->comment('Article language');
            $table->string('article_type', 50)->default('general')->comment('Article type for categorization');
            $table->string('source')->nullable()->comment('Source of the article');
            $table->string('difficulty_level', 20)->nullable()->comment('Difficulty level (beginner, intermediate, advanced)');
            $table->integer('word_count')->default(0)->comment('Total word count');
            $table->integer('unique_word_count')->default(0)->comment('Unique word count');
            $table->integer('sentence_count')->default(0)->comment('Total sentence count');
            $table->boolean('is_daily_reading')->default(false)->comment('Is this a daily reading article');
            $table->date('reading_date')->nullable()->comment('Date for daily reading');
            $table->string('task_id', 64)->nullable()->comment('Associated task ID');
            $table->boolean('tts_generated')->default(false)->comment('Whether TTS audio has been generated');
            $table->json('metadata')->nullable()->comment('Additional metadata');
            $table->timestamps();

            $table->index('article_id');
            $table->index('language');
            $table->index('article_type');
            $table->index('is_daily_reading');
            $table->index('reading_date');
            $table->index('task_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'articles');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};
