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
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries');

        if (!Schema::connection($connectionName)->hasTable($tableName)) {
            Schema::connection($connectionName)->create($tableName, function (Blueprint $table) {
                $table->increments('id');
                $table->string('name', 255);
                $table->text('description')->nullable();
                $table->string('language', 50)->default('english');
                $table->integer('total_words')->default(0);
                $table->boolean('is_public')->default(true);
                $table->unsignedInteger('owner_user_id')->nullable();
                $table->string('source', 100)->nullable();
                $table->string('difficulty_level', 50)->nullable();
                $table->string('category', 100)->default('general');
                $table->text('image_url')->nullable();
                $table->boolean('is_recommended')->default(false);
                $table->text('tags')->nullable();
                $table->timestamps();

                $table->unique('source', 'uniq_vocab_lib_source');
                $table->index('language', 'idx_vocab_lib_language');
                $table->index('is_public', 'idx_vocab_lib_public');
                $table->index('owner_user_id', 'idx_vocab_lib_owner');
                $table->index('category', 'idx_vocab_lib_category');
                $table->index('is_recommended', 'idx_vocab_lib_recommended');
            });
        }
    }

    public function down(): void
    {
        $connectionName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel)->getConnectionName();
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries');
        Schema::connection($connectionName)->dropIfExists($tableName);
    }
};

