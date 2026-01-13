<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $connectionName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel)->getConnectionName();
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'user_vocabulary_selections');

        if (!Schema::connection($connectionName)->hasTable($tableName)) {
            Schema::connection($connectionName)->create($tableName, function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id');
                $table->unsignedInteger('library_id');
                $table->timestamp('selected_at')->useCurrent();
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['user_id', 'library_id'], 'uniq_user_library_selection');
                $table->foreign('library_id')
                    ->references('id')
                    ->on(\App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries'))
                    ->onDelete('cascade');

                $table->index('user_id', 'idx_user_vocab_sel_user');
                $table->index('is_active', 'idx_user_vocab_sel_active');
            });
        }
    }

    public function down(): void
    {
        $connectionName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel)->getConnectionName();
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'user_vocabulary_selections');
        Schema::connection($connectionName)->dropIfExists($tableName);
    }
};

