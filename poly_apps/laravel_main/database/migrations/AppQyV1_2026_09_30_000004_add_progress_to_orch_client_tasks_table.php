<?php

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection;

    private string $tableName;

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, 'orch_client_tasks');
    }

    public function up(): void
    {
        // The create migration gained `progress` after it had already run, so
        // existing databases lack the column and every client-task write fails
        // with SQLSTATE 42703.
        $schema = Schema::connection($this->connection);

        if (!$schema->hasTable($this->tableName) || $schema->hasColumn($this->tableName, 'progress')) {
            return;
        }

        $schema->table($this->tableName, function (Blueprint $table): void {
            $table->json('progress')->nullable();
        });
    }

    public function down(): void
    {
    }
};
