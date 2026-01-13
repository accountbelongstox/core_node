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
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_words');
        if (!Schema::connection($this->connection)->hasTable($tableName)) {
            Schema::connection($this->connection)->create($tableName, function (Blueprint $table) {
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
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_words');
        Schema::connection($this->connection)->dropIfExists($tableName);
    }
};
