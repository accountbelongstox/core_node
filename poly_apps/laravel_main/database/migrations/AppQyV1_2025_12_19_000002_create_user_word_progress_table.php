<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    
    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function up(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_word_progress');
        if (!Schema::connection($this->connection)->hasTable($tableName)) {
            Schema::connection($this->connection)->create($tableName, function (Blueprint $table) {
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
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_word_progress');
        Schema::connection($this->connection)->dropIfExists($tableName);
    }
};
