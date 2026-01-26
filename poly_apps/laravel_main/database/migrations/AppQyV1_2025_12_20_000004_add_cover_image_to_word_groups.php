<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'word_groups');
        
        if (Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->table($tableName, function (Blueprint $table) use ($connection, $tableName) {
                if (!Schema::connection($connection)->hasColumn($tableName, 'cover_image_uuid')) {
                    $table->string('cover_image_uuid', 36)->nullable()->after('words_frequency')->comment('Cover image UUID');
                }
                if (!Schema::connection($connection)->hasColumn($tableName, 'cover_category')) {
                    $table->string('cover_category', 50)->nullable()->after('cover_image_uuid')->comment('Cover category: vocabulary, grammar, etc.');
                }
                if (!Schema::connection($connection)->hasColumn($tableName, 'cover_url')) {
                    $table->text('cover_url')->nullable()->after('cover_category')->comment('Cover image URL');
                }
                if (!Schema::connection($connection)->hasColumn($tableName, 'thumbnail_url')) {
                    $table->text('thumbnail_url')->nullable()->after('cover_url')->comment('Thumbnail image URL');
                }
            });
        }
    }

    public function down(): void
    {
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'word_groups');
        
        if (Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->table($tableName, function (Blueprint $table) {
                $table->dropColumn(['cover_image_uuid', 'cover_category', 'cover_url', 'thumbnail_url']);
            });
        }
    }
};
