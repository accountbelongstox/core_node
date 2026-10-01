<?php

use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection(RelayTablesMaps::connection());
        $table = RelayTablesMaps::table(RelayTablesMaps::DEVICES);

        if (!$schema->hasTable($table) || $schema->hasColumn($table, 'node_platform')) {
            return;
        }
        $schema->table($table, function (Blueprint $blueprint): void {
            $blueprint->string('node_platform', 16)->default('desktop');
        });
    }

    public function down(): void
    {
    }
};
