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
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_covers');

        if (!Schema::connection($connectionName)->hasTable($tableName)) {
            Schema::connection($connectionName)->create($tableName, function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('library_id')->unique();
                $table->string('cover_filename', 255);
                $table->string('status', 50)->default('pending');
                $table->text('prompt')->nullable();
                $table->text('description')->nullable();
                $table->integer('priority')->default(0);
                $table->text('error_message')->nullable();
                $table->integer('width')->default(1280);
                $table->integer('height')->default(720);
                $table->timestamp('last_requested_at')->nullable();
                $table->timestamp('last_generated_at')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('finished_at')->nullable();
                $table->timestamps();

                $table->foreign('library_id')
                    ->references('id')
                    ->on(\App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries'))
                    ->onDelete('cascade');

                $table->index('status', 'idx_vocab_covers_status');
                $table->index('priority', 'idx_vocab_covers_priority');
            });
        }
    }

    public function down(): void
    {
        $connectionName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel)->getConnectionName();
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_covers');
        Schema::connection($connectionName)->dropIfExists($tableName);
    }
};

