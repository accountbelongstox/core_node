<?php

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection;
    protected $appKey;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function up(): void
    {
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            $table = AppQyV1TableMaps::getDictionaryTableName($language);
            if (!Schema::connection($this->connection)->hasTable($table)) {
                continue;
            }
            SafeMigrationHelper::safeAddColumns($this->connection, $table, [
                'image_mcp_submitted_at' => function (Blueprint $blueprint, string $column) {
                    $blueprint->timestamp($column)->nullable()
                        ->comment('Last successful word-image submission from mcp-chrome');
                },
            ]);
        }
    }

    public function down(): void
    {
        // Add-only migration.
    }
};
