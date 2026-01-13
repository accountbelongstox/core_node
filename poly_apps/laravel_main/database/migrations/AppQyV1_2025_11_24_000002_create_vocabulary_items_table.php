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
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_items');
        $collectionsTableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_collections');
        
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) use ($collectionsTableName) {
                $table->id();
                $table->unsignedBigInteger('collection_id')->nullable(false);
                $table->string('lang_code', 10)->nullable(false)->index();
                $table->text('word_content')->nullable(false);
                $table->string('word_md5', 32)->nullable(false)->index();
                $table->integer('word_index')->default(0)->comment('Order in collection');
                $table->json('extra_data')->nullable()->comment('Additional word metadata');
                $table->timestamps();

                $table->foreign('collection_id')
                    ->references('id')
                    ->on($collectionsTableName)
                    ->onDelete('cascade');

                $table->index(['collection_id', 'word_index'], 'idx_collection_index');
                $table->index(['lang_code', 'word_md5'], 'idx_lang_md5');
            });
        }
    }

    public function down()
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_items');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};
