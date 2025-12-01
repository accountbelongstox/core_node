<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        if (!Schema::connection('AppQyV1')->hasTable('app_qy_v1_user_selected_libraries')) {
            Schema::connection('AppQyV1')->create('app_qy_v1_user_selected_libraries', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable(false);
                $table->unsignedBigInteger('collection_id')->nullable(false);
                $table->string('lang_code', 10)->nullable(false);
                $table->boolean('is_active')->default(true);
                $table->timestamp('selected_at')->useCurrent();
                $table->timestamps();

                $table->foreign('collection_id')
                    ->references('id')
                    ->on('app_qy_v1_vocabulary_collections')
                    ->onDelete('cascade');

                $table->index(['user_id', 'lang_code'], 'idx_selected_lib_user_lang');
                $table->index(['user_id', 'is_active'], 'idx_selected_lib_user_active');
                $table->unique(['user_id', 'collection_id'], 'unique_user_collection');
            });
        }
    }

    public function down()
    {
        Schema::connection('AppQyV1')->dropIfExists('app_qy_v1_user_selected_libraries');
    }
};
