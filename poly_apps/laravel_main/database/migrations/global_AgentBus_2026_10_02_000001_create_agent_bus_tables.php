<?php

use App\Apps\AgentBus\AgentBusServices\AgentBusInitializer;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        AgentBusInitializer::ensureTablesExist();
    }

    public function down(): void
    {
    }
};
