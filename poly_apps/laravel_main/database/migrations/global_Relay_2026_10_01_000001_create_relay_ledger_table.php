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
        $table = RelayTablesMaps::table(RelayTablesMaps::LEDGER);

        if ($schema->hasTable($table)) {
            return;
        }
        $schema->create($table, function (Blueprint $blueprint): void {
            $blueprint->bigIncrements('id');
            $blueprint->uuid('operation_id');
            $blueprint->unsignedBigInteger('user_id');
            $blueprint->uuid('device_id')->nullable();
            $blueprint->string('route_policy', 64)->nullable();
            $blueprint->unsignedSmallInteger('http_status')->nullable();
            $blueprint->string('outcome', 32)->nullable();
            $blueprint->unsignedBigInteger('t_admit')->nullable();
            $blueprint->unsignedBigInteger('t_publish')->nullable();
            $blueprint->unsignedBigInteger('t_dev_recv')->nullable();
            $blueprint->unsignedBigInteger('t_dev_send')->nullable();
            $blueprint->unsignedBigInteger('t_ui_send')->nullable();
            $blueprint->unsignedBigInteger('t_ui_recv')->nullable();
            $blueprint->unsignedInteger('exec_ms')->nullable();
            $blueprint->unsignedInteger('bytes_in')->nullable();
            $blueprint->unsignedInteger('bytes_out')->nullable();
            $blueprint->timestampTz('created_at', 3)->useCurrent();
            $blueprint->timestampTz('updated_at', 3)->useCurrent();
            $blueprint->unique('operation_id', 'relay_ledger_op_uq');
            $blueprint->index(['user_id', 'created_at'], 'relay_ledger_user_time_idx');
            $blueprint->index('created_at', 'relay_ledger_time_idx');
        });
    }

    public function down(): void
    {
        Schema::connection(RelayTablesMaps::connection())->dropIfExists(RelayTablesMaps::table(RelayTablesMaps::LEDGER));
    }
};
