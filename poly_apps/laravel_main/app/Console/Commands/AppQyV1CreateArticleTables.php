<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1CreateArticleTables extends Command
{
    protected $signature = 'appqyv1:create-article-tables';
    protected $description = 'Create AppQyV1 article tables (deprecated: use php artisan sys:init instead)';

    public function handle()
    {
        $this->warn('⚠️  This command is deprecated. Use "php artisan sys:init" to initialize all tables.');
        $this->newLine();
        
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $articlesTable = AppTablePrefixServiceProvider::buildTableName($appKey, 'articles');

        if (!Schema::connection($connection)->hasTable($articlesTable)) {
            $this->info("Creating {$articlesTable} table...");

            Schema::connection($connection)->create($articlesTable, function (Blueprint $table) {
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

            $this->info("{$articlesTable} table created successfully.");
        } else {
            $this->info("{$articlesTable} table already exists.");
        }

        $articleWordsTable = AppTablePrefixServiceProvider::buildTableName($appKey, 'article_words');
        if (!Schema::connection($connection)->hasTable($articleWordsTable)) {
            $this->info("Creating {$articleWordsTable} table...");

            Schema::connection($connection)->create($articleWordsTable, function (Blueprint $table) {
                $table->id();
                $table->string('article_id', 64)->comment('Article ID reference');
                $table->string('word_md5', 32)->comment('Word MD5 from dictionary');
                $table->string('word', 255)->comment('The actual word text');
                $table->string('language', 20)->comment('Word language');
                $table->integer('frequency')->default(1)->comment('Frequency of word in article');
                $table->boolean('is_new_for_user')->default(false)->comment('Is this a new word for the user');
                $table->timestamps();

                $table->index('article_id');
                $table->index('word_md5');
                $table->index('language');
                $table->unique(['article_id', 'word_md5']);
            });

            $this->info("{$articleWordsTable} table created successfully.");
        } else {
            $this->info("{$articleWordsTable} table already exists.");
        }

        $this->info('All article tables created successfully!');

        return 0;
    }
}
