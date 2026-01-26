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
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'user_languages');

        if (!Schema::connection($connectionName)->hasTable($tableName)) {
            Schema::connection($connectionName)->create($tableName, function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id');
                $table->string('language', 50);
                $table->string('native_language', 50)->nullable();
                $table->boolean('is_learning')->default(true);
                $table->string('proficiency_level', 50)->nullable();
                $table->timestamps();

                $table->unique(['user_id', 'language'], 'uniq_user_language');
                $table->index('user_id', 'idx_user_lang_user');
                $table->index('is_learning', 'idx_user_lang_learning');
            });
        }
    }

    public function down(): void
    {
        $connectionName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel)->getConnectionName();
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'user_languages');
        Schema::connection($connectionName)->dropIfExists($tableName);
    }
};

