<?php

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
