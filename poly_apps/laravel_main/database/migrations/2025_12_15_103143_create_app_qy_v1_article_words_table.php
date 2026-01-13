<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'article_words');
        
        Schema::connection($connection)->create($tableName, function (Blueprint $table) {
            $table->id();
            $table->string('article_id', 64)->comment('Article ID reference');
            $table->string('word_md5', 32)->comment('Word MD5 from dictionary');
            $table->string('word', 255)->comment('The actual word text');
            $table->string('language', 20)->comment('Word language');
            $table->integer('frequency')->default(1)->comment('Frequency of word in article');
            $table->boolean('is_new_for_user')->default(false)->comment('Is this a new word for the user');
            $table->timestamps();

            $table->index('article_id');
            $table->index('word_md5');
            $table->index('language');
            $table->unique(['article_id', 'word_md5']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'article_words');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};
