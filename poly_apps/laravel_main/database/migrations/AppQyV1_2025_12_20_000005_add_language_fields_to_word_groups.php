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
                if (!Schema::connection($connection)->hasColumn($tableName, 'language')) {
                    $table->string('language', 10)->default('en')->after('thumbnail_url')->comment('Language code (en, zh, ja, etc.)');
                }
                if (!Schema::connection($connection)->hasColumn($tableName, 'is_language_default')) {
                    $table->boolean('is_language_default')->default(false)->after('language')->comment('Is this the default group for this language');
                }
            });

            $dbConnection = Schema::connection($connection)->getConnection();
            $indexExists = $dbConnection->select(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_uid_language'"
            );

            if (empty($indexExists)) {
                $dbConnection->statement("CREATE INDEX idx_uid_language ON {$tableName}(uid, language)");
            }

            $indexExists2 = $dbConnection->select(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_uid_language_default'"
            );

            if (empty($indexExists2)) {
                $dbConnection->statement("CREATE INDEX idx_uid_language_default ON {$tableName}(uid, language, is_language_default)");
            }
        }
    }

    public function down(): void
    {
        $appKey = \App\Constants\AppKeys::APPQYV1;
        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = \App\Providers\AppTablePrefixServiceProvider::buildTableName($appKey, 'word_groups');
        
        if (Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->table($tableName, function (Blueprint $table) {
                $table->dropColumn(['language', 'is_language_default']);
            });

            $dbConnection = Schema::connection($connection)->getConnection();
            $dbConnection->statement('DROP INDEX IF EXISTS idx_uid_language');
            $dbConnection->statement('DROP INDEX IF EXISTS idx_uid_language_default');
        }
    }
};
