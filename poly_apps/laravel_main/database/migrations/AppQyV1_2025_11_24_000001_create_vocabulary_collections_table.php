<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    public function up()
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_collections');
        
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->string('collection_name', 255)->nullable(false);
                $table->string('lang_code', 10)->nullable(false)->index();
                $table->string('source_type', 50)->default('system')->comment('system|user_upload');
                $table->unsignedBigInteger('owner_id')->nullable()->comment('User ID for private collections');
                $table->boolean('is_public')->default(true);
                $table->text('description')->nullable();
                $table->integer('total_words')->default(0);
                $table->json('meta_data')->nullable()->comment('Additional metadata like difficulty level, category');
                $table->timestamps();
                $table->softDeletes();

                $table->index(['lang_code', 'is_public'], 'idx_lang_public');
                $table->index('owner_id', 'idx_owner');
                $table->unique(['collection_name', 'lang_code', 'owner_id'], 'unique_collection_per_user_lang');
            });
        }
    }

    public function down()
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_collections');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};
