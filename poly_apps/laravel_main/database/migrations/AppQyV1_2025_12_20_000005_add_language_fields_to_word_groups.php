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
                if (!Schema::connection('appqyv1')->hasColumn('app_qy_v1_word_groups', 'language')) {
                    $table->string('language', 10)->default('en')->after('thumbnail_url')->comment('Language code (en, zh, ja, etc.)');
                }
                if (!Schema::connection('appqyv1')->hasColumn('app_qy_v1_word_groups', 'is_language_default')) {
                    $table->boolean('is_language_default')->default(false)->after('language')->comment('Is this the default group for this language');
                }
            });

            $connection = Schema::connection('appqyv1')->getConnection();
            $indexExists = $connection->select(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_uid_language'"
            );

            if (empty($indexExists)) {
                $connection->statement('CREATE INDEX idx_uid_language ON app_qy_v1_word_groups(uid, language)');
            }

            $indexExists2 = $connection->select(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_uid_language_default'"
            );

            if (empty($indexExists2)) {
                $connection->statement('CREATE INDEX idx_uid_language_default ON app_qy_v1_word_groups(uid, language, is_language_default)');
            }
        }
    }

    public function down(): void
    {
        if (Schema::connection('appqyv1')->hasTable('app_qy_v1_word_groups')) {
            Schema::connection('appqyv1')->table('app_qy_v1_word_groups', function (Blueprint $table) {
                $table->dropColumn(['language', 'is_language_default']);
            });

            $connection = Schema::connection('appqyv1')->getConnection();
            $connection->statement('DROP INDEX IF EXISTS idx_uid_language');
            $connection->statement('DROP INDEX IF EXISTS idx_uid_language_default');
        }
    }
};
