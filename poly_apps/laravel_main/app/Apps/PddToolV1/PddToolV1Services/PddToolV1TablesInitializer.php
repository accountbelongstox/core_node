<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Services;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\PddToolV1\PddToolV1DBTablesBrige\PddToolV1TableMaps;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotent existence check for the PddToolV1 tables. The tables are created by
 * the PddToolV1 migration (run by sys:init's migrate --force); this service is
 * the verify_tables truth-source for the initializer (and a safety net).
 */
class PddToolV1TablesInitializer
{
    /**
     * Table suffixes that must exist on the pddtoolv1 connection.
     */
    public const TABLE_SUFFIXES = [
        'profiles',
        'pdd_accounts',
        'warehouses',
        'batch_orders',
        'batch_purchase_orders',
        'recharges',
        'packages',
        'usage_logs',
        'payment_settings',
    ];

    public static function connection(): string
    {
        return AppTablePrefixServiceProvider::getConnection(AppKeys::PDDTOOLV1);
    }

    /**
     * Map of full table name => 'exists' | 'missing'.
     */
    public static function checkTables(): array
    {
        $connection = self::connection();
        $schema = Schema::connection($connection);
        $result = [];

        foreach (self::TABLE_SUFFIXES as $suffix) {
            $table = AppTablePrefixServiceProvider::buildTableName(AppKeys::PDDTOOLV1, $suffix);
            $result[$table] = $schema->hasTable($table) ? 'exists' : 'missing';
        }

        return $result;
    }

    /**
     * Whether every required table exists.
     */
    public static function allTablesExist(): bool
    {
        foreach (self::checkTables() as $status) {
            if ($status !== 'exists') {
                return false;
            }
        }
        return true;
    }
}
