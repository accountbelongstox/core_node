<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $connectionName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyWordModel)->getConnectionName();
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_words');

        if (!Schema::connection($connectionName)->hasTable($tableName)) {
            Schema::connection($connectionName)->create($tableName, function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('library_id');
                $table->integer('word_index');
                $table->text('word');
                $table->timestamp('created_at')->useCurrent();

                $table->foreign('library_id')
                    ->references('id')
                    ->on(\App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries'))
                    ->onDelete('cascade');

                $table->index('library_id', 'idx_vocab_words_library');
                $table->index('word', 'idx_vocab_words_word');
                $table->index(['library_id', 'word_index'], 'idx_vocab_words_lib_index');
            });
        }
    }

    public function down(): void
    {
        $connectionName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyWordModel)->getConnectionName();
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_words');
        Schema::connection($connectionName)->dropIfExists($tableName);
    }
};

