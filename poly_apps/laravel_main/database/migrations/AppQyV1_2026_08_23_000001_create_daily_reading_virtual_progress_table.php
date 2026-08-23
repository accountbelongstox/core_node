<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\Services\AppQyV1BookReadingProgressTableService;

return new class extends Migration
{
    protected $connection;
    protected string $tableName;

    public function __construct()
    {
        $appKey = AppKeys::APPQYV1;

        $this->connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName(
            $appKey,
            'daily_reading_virtual_progress'
        );
    }

    public function up(): void
    {
        AppQyV1BookReadingProgressTableService::ensureDailyReadingVirtualProgressTable();
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
