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

    public function up()
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_learning_progress');
        if (!Schema::connection($this->connection)->hasTable($tableName)) {
            Schema::connection($this->connection)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable(false);
                $table->string('lang_code', 10)->nullable(false);
                $table->string('word_md5', 32)->nullable(false);
                $table->text('word_content')->nullable(false);
                $table->string('learning_status', 20)->default('new')->comment('new|learning|learned|reviewing|mastered');
                $table->integer('review_count')->default(0);
                $table->integer('correct_count')->default(0);
                $table->integer('wrong_count')->default(0);
                $table->timestamp('last_reviewed_at')->nullable();
                $table->timestamp('next_review_at')->nullable()->comment('Spaced repetition schedule');
                $table->integer('familiarity_level')->default(0)->comment('0-5 based on spaced repetition algorithm');
                $table->json('review_history')->nullable()->comment('Track review performance over time');
                $table->timestamps();
                $table->softDeletes();

                $table->index(['user_id', 'lang_code'], 'idx_learning_progress_user_lang');
                $table->index(['user_id', 'learning_status'], 'idx_user_status');
                $table->index(['user_id', 'next_review_at'], 'idx_user_next_review');
                $table->index('word_md5', 'idx_word_md5');
                $table->unique(['user_id', 'lang_code', 'word_md5'], 'unique_user_word');
            });
        }
    }

    public function down()
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_learning_progress');
        Schema::connection($this->connection)->dropIfExists($tableName);
    }
};
