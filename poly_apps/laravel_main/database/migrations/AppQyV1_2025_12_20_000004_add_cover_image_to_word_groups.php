<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('appqyv1')->hasTable('app_qy_v1_word_groups')) {
            Schema::connection('appqyv1')->table('app_qy_v1_word_groups', function (Blueprint $table) {
                if (!Schema::connection('appqyv1')->hasColumn('app_qy_v1_word_groups', 'cover_image_uuid')) {
                    $table->string('cover_image_uuid', 36)->nullable()->after('words_frequency')->comment('Cover image UUID');
                }
                if (!Schema::connection('appqyv1')->hasColumn('app_qy_v1_word_groups', 'cover_category')) {
                    $table->string('cover_category', 50)->nullable()->after('cover_image_uuid')->comment('Cover category: vocabulary, grammar, etc.');
                }
                if (!Schema::connection('appqyv1')->hasColumn('app_qy_v1_word_groups', 'cover_url')) {
                    $table->text('cover_url')->nullable()->after('cover_category')->comment('Cover image URL');
                }
                if (!Schema::connection('appqyv1')->hasColumn('app_qy_v1_word_groups', 'thumbnail_url')) {
                    $table->text('thumbnail_url')->nullable()->after('cover_url')->comment('Thumbnail image URL');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::connection('appqyv1')->hasTable('app_qy_v1_word_groups')) {
            Schema::connection('appqyv1')->table('app_qy_v1_word_groups', function (Blueprint $table) {
                $table->dropColumn(['cover_image_uuid', 'cover_category', 'cover_url', 'thumbnail_url']);
            });
        }
    }
};
