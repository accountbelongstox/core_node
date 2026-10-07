<?php

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;

/**
 * Book audio plans with phrase clips (audio_orchestration_contract
 * book_plan.plan_request.include_phrases, lane phrase_audio). Add-only.
 */
return new class extends Migration
{
    protected $connection;
    protected $plansTable;
    protected $columnName = 'include_phrases';

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $this->plansTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, 'book_audio_plans');
    }

    public function up(): void
    {
        SafeMigrationHelper::safeAddColumn(
            $this->connection,
            $this->plansTable,
            $this->columnName,
            static function (Blueprint $table, string $column): void {
                $table->boolean($column)->default(false);
            }
        );
    }

    public function down(): void
    {
    }
};
