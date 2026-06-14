<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'articles');
    }

    /**
     * The articles table was created without the user_id column while the
     * AppQyV1Article model and AppQyV1ArticleController always write it.
     * Add it idempotently (nullable so existing rows stay valid on both
     * SQLite and PostgreSQL).
     */
    public function up(): void
    {
        SafeMigrationHelper::safeAddColumn(
            $this->connection,
            $this->tableName,
            'user_id',
            function ($table, $columnName) {
                $table->unsignedBigInteger($columnName)->nullable()->comment('Owner user id');
            }
        );

        SafeMigrationHelper::safeAddIndex(
            $this->connection,
            $this->tableName,
            ['user_id']
        );
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);
        if ($schema->hasTable($this->tableName) && $schema->hasColumn($this->tableName, 'user_id')) {
            $schema->table($this->tableName, function ($table) {
                $table->dropColumn('user_id');
            });
        }
    }
};
