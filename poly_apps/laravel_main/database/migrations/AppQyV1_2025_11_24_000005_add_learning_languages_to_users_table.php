<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'learning_languages')) {
                $table->json('learning_languages')->nullable()->comment('Array of language codes user is learning');
            }
            if (!Schema::hasColumn('users', 'native_language')) {
                $table->string('native_language', 10)->nullable()->default('zh')->comment('User native language code');
            }
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'learning_languages')) {
                $table->dropColumn('learning_languages');
            }
            if (Schema::hasColumn('users', 'native_language')) {
                $table->dropColumn('native_language');
            }
        });
    }
};
