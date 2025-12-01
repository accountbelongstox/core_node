<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        if (!Schema::connection('AppQyV1')->hasTable('app_qy_v1_vocabulary_items')) {
            Schema::connection('AppQyV1')->create('app_qy_v1_vocabulary_items', function (Blueprint $table) {
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
                    ->on('app_qy_v1_vocabulary_collections')
                    ->onDelete('cascade');

                $table->index(['collection_id', 'word_index'], 'idx_collection_index');
                $table->index(['lang_code', 'word_md5'], 'idx_lang_md5');
            });
        }
    }

    public function down()
    {
        Schema::connection('AppQyV1')->dropIfExists('app_qy_v1_vocabulary_items');
    }
};
